/**
 * PF2e Apply Initiative Modifier Macro
 * * Updates the initiative of selected actors or all actors in the 
 * 'Party' folder by a specified amount in the current encounter.
 * * Requirements: Must be executed when a Combat/Encounter is active.
 */
export const INITIATIVE_MODIFIER_MACRO_NAME = "Apply Initiative Modifier";
export const INITIATIVE_MODIFIER_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/apply-initiative-modifier.png";

export async function applyInitiativeModifier() {
    const macroName = INITIATIVE_MODIFIER_MACRO_NAME;

    // 1. Determine the target actors
    let targets = canvas.tokens.controlled.map(t => t.actor);

    if (targets.length === 0) {
        // Try to find an actor Folder named "party" (case-insensitive)
        const actorFolders = game.folders.filter(f => f.type === 'Actor');
        const partyFolder = actorFolders.find(f => (f.name || '').toLowerCase() === 'party');

        if (partyFolder) {
            for (const actor of game.actors.values()) {
                if (actor.folder?.id === partyFolder.id) {
                    targets.push(actor);
                }
            }
        }

        // Fallback: if no party folder or it's empty, use player characters / actors with player owners
        if (targets.length === 0) {
            for (const actor of game.actors.values()) {
                if (actor && (actor.type === 'character' || actor.hasPlayerOwner)) {
                    // actor.hasPlayerOwner is true when at least one player has ownership
                    targets.push(actor);
                }
            }
        }
        if (targets.length === 0) {
            ui.notifications.error('No target actors found (no controlled tokens and no party actors).');
            return;
        }
    }

    // Filter out non-participants or those not in the current combat
    const combat = game.combat;
    if (!combat) {
        ui.notifications.warn("There is no active combat to apply an initiative modifier to.");
        return;
    }

    targets = targets.filter(actor => {
        // Check if the actor is in the current combat
        const combatant = combat.getCombatantByActor(actor.id);
        return combatant;
    });

    if (targets.length === 0) {
        ui.notifications.info("None of the selected or default actors are participants in the current combat.");
        return;
    }

    // 2. Prepare dialog content
    const targetNames = targets.map(a => `<li>${a.name}</li>`).join("");
    const dialogContent = `
    <p>Apply an Initiative Modifier to the following combatants:</p>
    <ul style="list-style-type: disc; margin-left: 1.5em; max-height: 150px; overflow-y: auto;">
        ${targetNames}
    </ul>
    <div class="form-group" style="margin-top: 10px;">
        <label for="modifier">Modifier (e.g., +5, -2):</label>
        <input type="number" id="modifier" name="modifier" value="0" autofocus style="width: 100%; padding: 5px;">
    </div>
    <p><em>The initiative for each target will be updated by this amount.</em></p>
`;

    // 3. Display the dialog
    new Dialog({
        title: macroName,
        content: dialogContent,
        buttons: {
            update: {
                icon: '<i class="fas fa-running"></i>',
                label: "Update Initiative",
                callback: (html) => {
                    const modifierInput = html.find('#modifier').val();
                    const modifier = parseInt(modifierInput, 10);

                    if (isNaN(modifier)) {
                        ui.notifications.error("Invalid modifier entered. Please enter a number.");
                        return;
                    }

                    const updates = [];
                    const chatMessages = [];

                    targets.forEach(actor => {
                        const combatant = combat.getCombatantByActor(actor.id);
                        if (combatant) {
                            const oldInitiative = combatant.initiative;
                            const newInitiative = oldInitiative + modifier;

                            updates.push({
                                _id: combatant.id,
                                initiative: newInitiative
                            });

                            // Prepare chat message content
                            const sign = modifier >= 0 ? '+' : '';
                            chatMessages.push(`<strong>${actor.name}</strong>: ${oldInitiative} &rarr; ${newInitiative} (${sign}${modifier})`);
                        }
                    });

                    // 4. Update Combatant Initiatives
                    if (updates.length > 0) {
                        combat.updateEmbeddedDocuments("Combatant", updates)
                            .then(() => {
                                // 5. Post private GM chat message
                                const chatContent = `
                                <h3>${macroName} - Initiative Updated</h3>
                                <p>Applied a modifier of <strong>${modifier >= 0 ? '+' : ''}${modifier}</strong> to the following combatants:</p>
                                <ul style="list-style-type: none; padding-left: 0;">${chatMessages.map(msg => `<li>${msg}</li>`).join('')}</ul>
                            `;

                                ChatMessage.create({
                                    content: chatContent,
                                    whisper: ChatMessage.getWhisperRecipients('GM'),
                                    speaker: { alias: macroName }
                                });

                                ui.notifications.info(`Successfully updated initiative for ${updates.length} combatant(s).`);
                            })
                            .catch(err => {
                                console.error("Failed to update combatant initiatives:", err);
                                ui.notifications.error("Failed to update combatant initiatives. Check the console for details.");
                            });
                    } else {
                        ui.notifications.info("No combatants were updated.");
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "update"
    }).render(true);
}