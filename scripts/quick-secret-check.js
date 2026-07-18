/*
 * Quick Secret Check Macro for PF2e
 * This macro allows GMs to perform instant secret checks (Perception, Stealth, Saves, etc.) 
 * for the whole party or selected tokens against a slider-defined DC.
 * Automatically detects targets to set Recall Knowledge DCs and highlight suggested skills.
 */

export const QUICK_SECRET_MACRO_NAME = "Quick Secret Check";
export const QUICK_SECRET_MACRO_ICON = "icons/magic/symbols/question-stone-yellow.webp";

/**
 * Simple HTML escape to avoid injection in chat content/options.
 */
function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/**
 * Calculates Degree of Success using PF2e rules, including Natural 1 and Natural 20 adjustments.
 * 3 = Critical Success, 2 = Success, 1 = Failure, 0 = Critical Failure
 */
function calculateDegreeOfSuccess(total, dc, d20Result) {
    const difference = total - dc;
    let degree = 0;

    // Base calculation
    if (difference >= 10) degree = 3; // Crit Success
    else if (difference >= 0) degree = 2; // Success
    else if (difference >= -9) degree = 1; // Failure
    else degree = 0; // Crit Failure

    // Natural 20 / Natural 1 adjustments
    if (d20Result === 20) {
        degree = Math.min(3, degree + 1);
    } else if (d20Result === 1) {
        degree = Math.max(0, degree - 1);
    }

    // Map back to string labels
    switch (degree) {
        case 3: return 'Critical Success';
        case 2: return 'Success';
        case 1: return 'Failure';
        case 0: return 'Critical Failure';
        default: return 'Failure';
    }
}

/**
 * Calculates the standard level-based DC for a given target actor, adjusted for rarity.
 */
function calculateRKDC(targetActor) {
    if (!targetActor || targetActor.type !== 'npc') return 15;
    const level = targetActor.system?.details?.level?.value || 0;
    const rarity = targetActor.system?.traits?.rarity || 'common';

    const dcs = {
        "-1": 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22,
        7: 23, 8: 24, 9: 26, 10: 27, 11: 28, 12: 30, 13: 31, 14: 32,
        15: 34, 16: 35, 17: 36, 18: 38, 19: 39, 20: 40, 21: 42,
        22: 44, 23: 46, 24: 48, 25: 50
    };
    let dc = dcs[level] !== undefined ? dcs[level] : (14 + level * 1.3);

    if (rarity === 'uncommon') dc += 2;
    else if (rarity === 'rare') dc += 5;
    else if (rarity === 'unique') dc += 10;

    return Math.floor(dc);
}

/**
 * Maps a target's traits to the most likely Recall Knowledge skill.
 */
function getSuggestedSkill(actor) {
    if (!actor || actor.type !== 'npc') return null;
    const traits = actor.system?.traits?.value || [];
    const rkMap = { aberration: 'occultism', animal: 'nature', astral: 'occultism', beast: 'nature', celestial: 'religion', construct: 'crafting', dragon: 'arcana', elemental: 'arcana', ethereal: 'occultism', fey: 'nature', fiend: 'religion', fungus: 'nature', humanoid: 'society', monitor: 'religion', ooze: 'occultism', plant: 'nature', spirit: 'occultism', undead: 'religion' };

    for (const trait of traits) {
        if (rkMap[trait]) return rkMap[trait];
    }
    return null;
}

/**
 * Defensive helper to find skill/save data on a PF2e actor.
 * Includes special handling for Perception and Saves since they are structurally different.
 */
function getSkillInfo(actor, skillKey) {
    const systemData = actor.system ?? actor.data?.system ?? {};
    const lowerKey = skillKey.toLowerCase();

    // Special handling for Perception
    if (lowerKey === 'perception') {
        return systemData.perception ?? systemData.attributes?.perception ?? null;
    }

    // Special handling for Saving Throws
    if (['fortitude', 'reflex', 'will'].includes(lowerKey)) {
        return systemData.saves?.[lowerKey] ?? null;
    }

    // Standard skills
    const skills = systemData.skills ?? null;
    if (skills && skills[skillKey]) {
        return skills[skillKey];
    }

    if (skills) {
        const foundKey = Object.keys(skills).find(k => k.toLowerCase() === lowerKey);
        if (foundKey) return skills[foundKey];
    }

    return null;
}

/**
 * Create the secret aggregated chat message for multiple checks.
 * Whispered to all GMs (GM-only).
 */
async function createAggregatedSecretMessage(results, dc, skillLabel, targetName = null) {
    const colorMap = {
        'Critical Success': '#00aa00',
        'Success': '#0066cc',
        'Failure': '#cc6600',
        'Critical Failure': '#cc0000'
    };

    let rows = '';
    for (const res of results) {
        const color = colorMap[res.degree] || '#000000';
        const d20display = res.d20 !== null ? `${res.d20}` : '—';
        const isNat20 = res.d20 === 20;
        const isNat1 = res.d20 === 1;

        let d20Formatted = d20display;
        if (isNat20) d20Formatted = `<strong style="color: #00aa00;">${d20display}</strong>`;
        if (isNat1) d20Formatted = `<strong style="color: #cc0000;">${d20display}</strong>`;

        const breakdown = res.d20 !== null ? `${d20Formatted} + ${res.total - res.d20}` : `${res.total}`;
        rows += `
      <div class="secret-check-row" style="border-left: 4px solid ${color}; padding-left:8px; margin-bottom:6px;">
        <strong>${escapeHtml(res.actorName)}</strong>:
        <span>${res.total} (${breakdown})</span>
        &nbsp;|&nbsp;
        <span style="color:${color}; font-weight:bold;">${escapeHtml(res.degree)}</span>
      </div>
    `;
    }

    const titlePrefix = targetName ? `Secret ${escapeHtml(skillLabel)} vs ${escapeHtml(targetName)}` : `Secret ${escapeHtml(skillLabel)} Check`;
    const title = `${titlePrefix} (DC ${dc})`;

    const content = `
    <div class="secret-check-result" style="padding:6px;">
      <h3 style="margin-bottom: 8px; border-bottom: 1px solid var(--color-border-dark-4); padding-bottom: 4px;">${title}</h3>
      ${rows}
    </div>
  `;

    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);

    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: null }),
        content: content,
        whisper: gmIds,
        blind: true // Important for PF2e secret rolls
    });

    ui.notifications.info(`Secret ${skillLabel} check completed for ${results.length} actor(s).`);
}

/**
 * Perform secret checks for multiple actors.
 */
async function performSecretCheck(skillKey, skillLabel, dc, targetName) {
    const controlled = canvas?.tokens?.controlled ?? [];
    let targetActors = [];

    // Target Selection Logic
    if (controlled.length > 0) {
        const seen = new Set();
        for (const token of controlled) {
            const actor = token.actor;
            if (actor && !seen.has(actor.id)) {
                targetActors.push(actor);
                seen.add(actor.id);
            }
        }
    } else {
        if (game.actors.party) {
            targetActors = Array.from(game.actors.party.members);
        } else {
            targetActors = game.actors.filter(a => a.type === 'character' && (a.system?.details?.alliance === 'party' || a.alliance === 'party'));
            if (targetActors.length === 0) {
                targetActors = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
            }
        }
    }

    if (targetActors.length === 0) {
        ui.notifications.error('No target actors found (no controlled tokens and no party actors).');
        return;
    }

    // Roll for each actor
    const rollPromises = targetActors.map(async (actor) => {
        const skillInfo = getSkillInfo(actor, skillKey);

        const modifier = Number(skillInfo?.mod ?? skillInfo?.value ?? skillInfo?.total ?? 0);
        const safeModifier = Number.isFinite(modifier) ? modifier : 0;
        const formula = `1d20 ${safeModifier >= 0 ? '+' : '-'} ${Math.abs(safeModifier)}`;

        let roll;
        try {
            roll = await new Roll(formula).evaluate({ async: true });
        } catch (err) {
            console.error('Secret Check | Roll failed for', actor.name, err);
            roll = { total: 0, dice: [], toJSON: () => ({}) };
        }

        let d20Result = null;
        try {
            const d20Term = roll.dice?.find(d => d.faces === 20);
            d20Result = d20Term?.results?.[0]?.result ?? null;
        } catch (e) {
            d20Result = null;
        }

        const degree = calculateDegreeOfSuccess(roll.total, dc, d20Result);

        return {
            actorId: actor.id,
            actorName: actor.name,
            total: roll.total ?? 0,
            d20: d20Result,
            degree: degree,
            roll: roll
        };
    });

    let results;
    try {
        results = await Promise.all(rollPromises);
    } catch (err) {
        console.error('Secret Check | Error evaluating rolls:', err);
        ui.notifications.error('Error performing one or more rolls.');
        return;
    }

    await createAggregatedSecretMessage(results, dc, skillLabel, targetName);
}

/**
 * Open the Quick Secret Check dialog.
 * Utilizes a DC Slider and a grid of Quick Buttons for immediate rolling.
 */
export function openSecretCheckDialog() {
    // 1. Check for targeted enemies to auto-set DC and suggest a skill
    const targets = Array.from(game.user.targets ?? []);
    const targetActor = targets.length > 0 ? targets[0].actor : null;

    const initialDC = targetActor ? calculateRKDC(targetActor) : 15;
    const suggestedSkill = targetActor ? getSuggestedSkill(targetActor) : null;

    const targetIndicator = targetActor
        ? `<div style="text-align: center; color: var(--color-text-dark-primary); margin-bottom: 8px; font-weight: bold; font-size: 1.1em;">
             <i class="fas fa-crosshairs" style="color: #8b0000;"></i> Target: ${escapeHtml(targetActor.name)}
           </div>`
        : '';

    const selectionNote = (canvas?.tokens?.controlled?.length > 0)
        ? `Using ${canvas.tokens.controlled.length} selected token(s).`
        : `Using the active party (Alliance: Party).`;

    // Helper to conditionally apply the highlight class
    const getBtnClass = (skillKey) => skillKey === suggestedSkill ? 'qsc-btn qsc-suggested' : 'qsc-btn';

    const content = `
    <style>
      .qsc-container { font-family: "Signika", sans-serif; }
      .qsc-dc-wrapper { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 5px; border: 1px solid var(--color-border-light-2); }
      .qsc-dc-slider { flex-grow: 1; cursor: pointer; }
      .qsc-dc-display { font-size: 1.5em; font-weight: bold; width: 40px; text-align: right; color: var(--color-text-dark-primary); }
      .qsc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
      .qsc-btn { 
          position: relative;
          padding: 8px; 
          background: var(--color-background-light-2); 
          border: 1px solid var(--color-border-dark-4); 
          border-radius: 4px; 
          cursor: pointer; 
          font-weight: bold; 
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
      }
      .qsc-btn:hover { background: var(--color-background-light-1); box-shadow: 0 0 5px var(--color-shadow-primary); }
      .qsc-btn i { font-size: 1.1em; color: var(--color-text-dark-secondary); }
      
      /* Highlight class for suggested skills */
      .qsc-suggested { 
          border: 2px solid #d99a2c; 
          background: rgba(217, 154, 44, 0.15); 
          box-shadow: 0 0 6px rgba(217, 154, 44, 0.5); 
      }
      .qsc-suggested i { color: #8b5a00; }
      .qsc-suggested::after {
          content: '★';
          position: absolute;
          top: -6px;
          right: -4px;
          color: #d99a2c;
          font-size: 1.1em;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      }

      .qsc-note { font-size: 0.85em; color: var(--color-text-dark-secondary); font-style: italic; text-align: center; margin-top: 8px; }
    </style>
    <div class="qsc-container">
      
      ${targetIndicator}

      <div class="qsc-dc-wrapper">
        <label style="font-weight: bold;">Target DC:</label>
        <input type="range" id="qsc-dc-slider" class="qsc-dc-slider" min="10" max="50" value="${initialDC}" step="1"/>
        <span id="qsc-dc-display" class="qsc-dc-display">${initialDC}</span>
      </div>
      
      <p style="margin-bottom: 8px; font-weight:bold;">Exploration & Interaction:</p>
      <div class="qsc-grid">
        <button type="button" class="${getBtnClass('perception')}" data-skill="perception" data-label="Perception"><i class="fas fa-eye"></i> Perception</button>
        <button type="button" class="${getBtnClass('stealth')}" data-skill="stealth" data-label="Stealth"><i class="fas fa-user-ninja"></i> Stealth</button>
        <button type="button" class="${getBtnClass('deception')}" data-skill="deception" data-label="Deception"><i class="fas fa-mask"></i> Deception</button>
        <button type="button" class="${getBtnClass('diplomacy')}" data-skill="diplomacy" data-label="Diplomacy"><i class="fas fa-handshake"></i> Diplomacy</button>
        <button type="button" class="${getBtnClass('thievery')}" data-skill="thievery" data-label="Thievery"><i class="fas fa-unlock-alt"></i> Thievery</button>
        <button type="button" class="${getBtnClass('survival')}" data-skill="survival" data-label="Survival"><i class="fas fa-campground"></i> Survival</button>
        <button type="button" class="${getBtnClass('athletics')}" data-skill="athletics" data-label="Athletics"><i class="fas fa-dumbbell"></i> Athletics</button>
        <button type="button" class="${getBtnClass('acrobatics')}" data-skill="acrobatics" data-label="Acrobatics"><i class="fas fa-running"></i> Acrobatics</button>
      </div>

      <p style="margin-bottom: 8px; font-weight:bold;">Knowledge & Identification:</p>
      <div class="qsc-grid">
        <button type="button" class="${getBtnClass('arcana')}" data-skill="arcana" data-label="Arcana"><i class="fas fa-hat-wizard"></i> Arcana</button>
        <button type="button" class="${getBtnClass('crafting')}" data-skill="crafting" data-label="Crafting"><i class="fas fa-hammer"></i> Crafting</button>
        <button type="button" class="${getBtnClass('medicine')}" data-skill="medicine" data-label="Medicine"><i class="fas fa-briefcase-medical"></i> Medicine</button>
        <button type="button" class="${getBtnClass('nature')}" data-skill="nature" data-label="Nature"><i class="fas fa-leaf"></i> Nature</button>
        <button type="button" class="${getBtnClass('occultism')}" data-skill="occultism" data-label="Occultism"><i class="fas fa-book-spells"></i> Occultism</button>
        <button type="button" class="${getBtnClass('religion')}" data-skill="religion" data-label="Religion"><i class="fas fa-pray"></i> Religion</button>
        <button type="button" class="${getBtnClass('society')}" data-skill="society" data-label="Society"><i class="fas fa-city"></i> Society</button>
      </div>
      
      <p style="margin-bottom: 8px; margin-top: 4px; font-weight:bold;">Saving Throws:</p>
      <div class="qsc-grid">
        <button type="button" class="${getBtnClass('fortitude')}" data-skill="fortitude" data-label="Fortitude"><i class="fas fa-heartbeat"></i> Fortitude</button>
        <button type="button" class="${getBtnClass('reflex')}" data-skill="reflex" data-label="Reflex"><i class="fas fa-bolt"></i> Reflex</button>
        <button type="button" class="${getBtnClass('will')}" data-skill="will" data-label="Will"><i class="fas fa-brain"></i> Will</button>
      </div>
      
      <div class="qsc-note">${selectionNote}</div>
    </div>
  `;

    let dialogRef = new Dialog({
        title: 'Quick Secret Check',
        content: content,
        buttons: {
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
            }
        },
        render: (html) => {
            // Live update the DC number display when dragging the slider
            const slider = html.find('#qsc-dc-slider');
            const display = html.find('#qsc-dc-display');
            slider.on('input', function () {
                display.text(this.value);
            });

            // Bind click events to our custom quick buttons
            html.find('.qsc-btn').click((ev) => {
                const button = ev.currentTarget;
                const skillKey = button.dataset.skill;
                const skillLabel = button.dataset.label;
                const dc = parseInt(slider.val(), 10) || 15;
                const targetLabel = targetActor ? targetActor.name : null;

                // Fire the check
                performSecretCheck(skillKey, skillLabel, dc, targetLabel);

                // Instantly close the dialog for a split-second workflow
                dialogRef.close();
            });
        }
    });

    dialogRef.render(true);
}