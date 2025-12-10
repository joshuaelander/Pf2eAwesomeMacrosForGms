/**
 * PF2e Party Rest & Reset
 * * A macro to reset HP, remove Wounded/Fatigued conditions, reset Hero Points, 
 * and restore Spell Slots for the party.
 * * Options:
 * - Scope: Auto-detects selected tokens or defaults to Party folder/PC actors.
 * - Reset Health: Heals to max HP.
 * - Remove Conditions: Removes "wounded" and "fatigued".
 * - Reset Hero Points: Sets Hero Points to 1.
 * - Reset Spells/Focus: Refills spell slots and focus points.
 * * Notes:
 * - Skips actors with the "Dead" condition.
 */

export const FULL_RESTORE_MACRO_NAME = "Full Restore";
export const FULL_RESTORE_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/full-restore.png"

// --- DIALOG POPULATION AND LAUNCH ---
export function openFullRestoreDialog() {
    const controlled = canvas?.tokens?.controlled ?? [];
    let targetActors = [];
    let targetLabel = "The Party";

    if (controlled.length > 0) {
        const seen = new Set();
        for (const token of controlled) {
            const actor = token.actor;
            if (actor && !seen.has(actor.id)) {
                targetActors.push(actor);
                seen.add(actor.id);
            }
        }
        // Create a comma-separated list of names
        targetLabel = targetActors.map(a => a.name).join(", ");
    } else {
        // Try to find an actor Folder named "party" (case-insensitive)
        const actorFolders = game.folders.filter(f => f.type === 'Actor');
        const partyFolder = actorFolders.find(f => (f.name || '').toLowerCase() === 'party');

        if (partyFolder) {
            for (const actor of game.actors.values()) {
                if (actor.folder?.id === partyFolder.id) {
                    targetActors.push(actor);
                }
            }
        }

        // Fallback: if no party folder or it's empty, use player characters / actors with player owners
        if (targetActors.length === 0) {
            for (const actor of game.actors.values()) {
                if (actor && (actor.type === 'character' || actor.hasPlayerOwner)) {
                    // actor.hasPlayerOwner is true when at least one player has ownership
                    targetActors.push(actor);
                }
            }
        }
    }

    if (targetActors.length === 0) {
        ui.notifications.error('No target actors found (no controlled tokens and no party actors).');
        return;
    }

    const content = `
    <style>
        .pf2e-reset-dialog .form-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
        .pf2e-reset-dialog label { flex: 2; }
        .pf2e-reset-dialog input, .pf2e-reset-dialog select { flex: 1; }
        .pf2e-reset-dialog .target-list { flex: 2; text-align: right; font-weight: bold; font-size: 0.9em; word-break: break-word; }
        .pf2e-reset-header { border-bottom: 1px solid #782e22; margin-bottom: 10px; font-weight: bold; color: #782e22; }
    </style>
    <form class="pf2e-reset-dialog">
        <div class="pf2e-reset-header">Targeting</div>
        <div class="form-group">
            <label>Targets:</label>
            <div class="target-list">${targetLabel}</div>
        </div>

        <div class="pf2e-reset-header">Recovery Options</div>
        <div class="form-group">
            <label for="resetHP">Heal to Full HP</label>
            <input type="checkbox" id="resetHP" name="resetHP" checked>
        </div>
        <div class="form-group">
            <label for="removeWounded">Remove "Wounded" Condition</label>
            <input type="checkbox" id="removeWounded" name="removeWounded" checked>
        </div>
        <div class="form-group">
            <label for="removeFatigued">Remove "Fatigued" Condition</label>
            <input type="checkbox" id="removeFatigued" name="removeFatigued">
        </div>
        <div class="form-group">
            <label for="resetHero">Reset Hero Points to 1</label>
            <input type="checkbox" id="resetHero" name="resetHero">
        </div>
        <div class="form-group">
            <label for="resetSpells">Refill Spell Slots & Focus Points</label>
            <input type="checkbox" id="resetSpells" name="resetSpells">
        </div>
    </form>
    `;

    new Dialog({
        title: "Party Rest & Reset",
        content: content,
        buttons: {
            rest: {
                icon: "<i class='fas fa-bed'></i>",
                label: "Rest",
                callback: (html) => executeRest(html, targetActors)
            },
            cancel: {
                icon: "<i class='fas fa-times'></i>",
                label: "Cancel"
            }
        },
        default: "rest"
    }).render(true);
}

async function executeRest(html, actorsToUpdate) {
    const doHeal = html.find('[name="resetHP"]').is(':checked');
    const doWounded = html.find('[name="removeWounded"]').is(':checked');
    const doFatigued = html.find('[name="removeFatigued"]').is(':checked');
    const doHero = html.find('[name="resetHero"]').is(':checked');
    const doSpells = html.find('[name="resetSpells"]').is(':checked');

    // Array to store results for chat message: [{ name: string, changes: string[] }]
    const results = [];

    for (const actor of actorsToUpdate) {
        // Skip dead actors completely
        if (actor.hasCondition("dead")) continue;

        const changes = [];

        // --- Heal HP ---
        if (doHeal) {
            const maxHP = actor.system.attributes.hp.max;
            const currentHP = actor.system.attributes.hp.value;
            if (currentHP < maxHP) {
                await actor.update({ "system.attributes.hp.value": maxHP });
                changes.push("Health (HP)");
            }
        }

        // --- Remove Wounded ---
        if (doWounded) {
            if (actor.hasCondition("wounded")) {
                await actor.decreaseCondition("wounded", { forceRemove: true });
                changes.push("Wounded Condition");
            }
        }

        // --- Remove Fatigued ---
        if (doFatigued) {
            if (actor.hasCondition("fatigued")) {
                await actor.decreaseCondition("fatigued", { forceRemove: true });
                changes.push("Fatigued Condition");
            }
        }

        // --- Reset Hero Points ---
        if (doHero && actor.type === "character") {
            const currentHero = actor.system.resources.heroPoints.value;
            if (currentHero !== 1) {
                await actor.update({ "system.resources.heroPoints.value": 1 });
                changes.push("Hero Points");
            }
        }

        // --- Reset Spells & Focus Points ---
        if (doSpells) {
            let spellChanges = [];

            // 1. Reset Focus Points
            if (actor.system.resources?.focus) {
                const currentFocus = actor.system.resources.focus.value;
                const maxFocus = actor.system.resources.focus.max;
                if (currentFocus < maxFocus) {
                    await actor.update({ "system.resources.focus.value": maxFocus });
                    spellChanges.push("Focus Points");
                }
            }

            // 2. Reset Spell Slots (requires updating the Embedded Items)
            const spellcastingEntries = actor.itemTypes.spellcastingEntry;
            for (const entry of spellcastingEntries) {
                // We only care about entries that use slots (not wands/scrolls usually)
                if (entry.isRitual || entry.isFocusPool) continue;

                const updates = {};
                const slots = entry.system.slots;
                let hasSlotUpdate = false;

                // Loop through spell levels 1-10 (and 0 for cantrips if applicable, though usually infinite)
                for (const [key, slotData] of Object.entries(slots)) {
                    if (slotData.max > 0 && slotData.value < slotData.max) {
                        updates[`system.slots.${key}.value`] = slotData.max;
                        hasSlotUpdate = true;
                    }
                }

                if (hasSlotUpdate) {
                    await entry.update(updates);
                    if (!spellChanges.includes("Spell Slots")) spellChanges.push("Spell Slots");
                }
            }

            if (spellChanges.length > 0) {
                changes.push(spellChanges.join(" and "));
            }
        }

        if (changes.length > 0) {
            results.push({ name: actor.name, changes: changes });
        }
    }

    // Report Results
    if (results.length > 0) {
        let chatContent = '<strong>Party Rest Report:</strong><br>';

        for (const actorResult of results) {
            chatContent += `— <strong>${actorResult.name}</strong>: ${actorResult.changes.join(", ")} restored.<br>`;
        }

        ChatMessage.create({
            content: chatContent
        });
        ui.notifications.info(`Successfully rested ${results.length} actors.`);
    } else {
        ui.notifications.info("All targeted actors were already full/reset (or dead).");
    }
}