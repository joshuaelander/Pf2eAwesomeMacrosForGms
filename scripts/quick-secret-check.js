/*
 * Quick Secret Check Macro for PF2e
 * This macro allows GMs to perform instant secret checks (Perception, Stealth, etc.) 
 * for the whole party or selected tokens against a slider-defined DC.
 */

export const QUICK_SECRET_MACRO_NAME = "Quick Secret Check";
export const QUICK_SECRET_MACRO_ICON = "icons/magic/control/hypnosis-mesmerism-eye-tan.webp";

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
 * Defensive helper to find skill data on a PF2e actor.
 * Includes special handling for Perception since it's structurally different than standard skills.
 */
function getSkillInfo(actor, skillKey) {
    const systemData = actor.system ?? actor.data?.system ?? {};
    
    // Special handling for Perception
    if (skillKey.toLowerCase() === 'perception') {
        return systemData.perception ?? systemData.attributes?.perception ?? null;
    }

    // Standard skills
    const skills = systemData.skills ?? null;
    if (skills && skills[skillKey]) {
        return skills[skillKey];
    }

    // Try older shapes or flattened names for backward compatibility
    if (actor.data?.data?.skills && actor.data.data.skills[skillKey]) {
        return actor.data.data.skills[skillKey];
    }

    if (skills) {
        const foundKey = Object.keys(skills).find(k => k.toLowerCase() === skillKey.toLowerCase());
        if (foundKey) return skills[foundKey];
    }

    return null;
}

/**
 * Create the secret aggregated chat message for multiple checks.
 * Whispered to all GMs (GM-only).
 */
async function createAggregatedSecretMessage(results, dc, skillLabel) {
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
        
        // Highlight nat 1 and 20 visually in the breakdown
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

    const title = `Secret ${escapeHtml(skillLabel)} Check (DC ${dc})`;
    const content = `
    <div class="secret-check-result" style="padding:6px;">
      <h3 style="margin-bottom: 8px;">${title}</h3>
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
async function performSecretCheck(skillKey, skillLabel, dc) {
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
        
        // Grab modifier from multiple possible locations depending on PF2e version
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

    await createAggregatedSecretMessage(results, dc, skillLabel);
}

/**
 * Open the Quick Secret Check dialog.
 * Utilizes a DC Slider and a grid of Quick Buttons for immediate rolling.
 */
export function openSecretCheckDialog() {
    const selectionNote = (canvas?.tokens?.controlled?.length > 0)
        ? `Using ${canvas.tokens.controlled.length} selected token(s).`
        : `Using the active party (Alliance: Party).`;

    const content = `
    <style>
      .qsc-container { font-family: "Signika", sans-serif; }
      .qsc-dc-wrapper { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 5px; border: 1px solid var(--color-border-light-2); }
      .qsc-dc-slider { flex-grow: 1; cursor: pointer; }
      .qsc-dc-display { font-size: 1.5em; font-weight: bold; width: 40px; text-align: right; color: var(--color-text-dark-primary); }
      .qsc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
      .qsc-btn { 
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
      .qsc-note { font-size: 0.85em; color: var(--color-text-dark-secondary); font-style: italic; text-align: center; margin-top: 8px; }
    </style>
    <div class="qsc-container">
      <div class="qsc-dc-wrapper">
        <label style="font-weight: bold;">Target DC:</label>
        <input type="range" id="qsc-dc-slider" class="qsc-dc-slider" min="10" max="50" value="15" step="1"/>
        <span id="qsc-dc-display" class="qsc-dc-display">15</span>
      </div>
      
      <p style="margin-bottom: 8px; font-weight:bold;">Exploration & Interaction:</p>
      <div class="qsc-grid">
        <button type="button" class="qsc-btn" data-skill="perception" data-label="Perception"><i class="fas fa-eye"></i> Perception</button>
        <button type="button" class="qsc-btn" data-skill="stealth" data-label="Stealth"><i class="fas fa-user-ninja"></i> Stealth</button>
        <button type="button" class="qsc-btn" data-skill="deception" data-label="Deception"><i class="fas fa-mask"></i> Deception</button>
        <button type="button" class="qsc-btn" data-skill="diplomacy" data-label="Diplomacy"><i class="fas fa-handshake"></i> Diplomacy</button>
        <button type="button" class="qsc-btn" data-skill="thievery" data-label="Thievery"><i class="fas fa-unlock-alt"></i> Thievery</button>
        <button type="button" class="qsc-btn" data-skill="survival" data-label="Survival"><i class="fas fa-campground"></i> Survival</button>
      </div>

      <p style="margin-bottom: 8px; font-weight:bold;">Knowledge & Identification:</p>
      <div class="qsc-grid">
        <button type="button" class="qsc-btn" data-skill="arcana" data-label="Arcana"><i class="fas fa-hat-wizard"></i> Arcana</button>
        <button type="button" class="qsc-btn" data-skill="crafting" data-label="Crafting"><i class="fas fa-hammer"></i> Crafting</button>
        <button type="button" class="qsc-btn" data-skill="medicine" data-label="Medicine"><i class="fas fa-briefcase-medical"></i> Medicine</button>
        <button type="button" class="qsc-btn" data-skill="nature" data-label="Nature"><i class="fas fa-leaf"></i> Nature</button>
        <button type="button" class="qsc-btn" data-skill="occultism" data-label="Occultism"><i class="fas fa-book-spells"></i> Occultism</button>
        <button type="button" class="qsc-btn" data-skill="religion" data-label="Religion"><i class="fas fa-pray"></i> Religion</button>
        <button type="button" class="qsc-btn" data-skill="society" data-label="Society"><i class="fas fa-city"></i> Society</button>
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
            slider.on('input', function() {
                display.text(this.value);
            });

            // Bind click events to our custom quick buttons
            html.find('.qsc-btn').click((ev) => {
                const button = ev.currentTarget;
                const skillKey = button.dataset.skill;
                const skillLabel = button.dataset.label;
                const dc = parseInt(slider.val(), 10) || 15;
                
                // Fire the check
                performSecretCheck(skillKey, skillLabel, dc);
                
                // Instantly close the dialog for a split-second workflow
                dialogRef.close();
            });
        }
    });
    
    dialogRef.render(true);
}