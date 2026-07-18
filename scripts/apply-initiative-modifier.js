/**
 * PF2e Apply Initiative Modifier Macro
 * * Updates the initiative of selected actors or all actors in the 
 * active party by a specified amount in the current encounter.
 * * Requirements: Must be executed when a Combat/Encounter is active.
 */
export const INITIATIVE_MODIFIER_MACRO_NAME = "Apply Initiative Modifier";
export const INITIATIVE_MODIFIER_MACRO_ICON = "icons/magic/time/clock-stopwatch-white-blue.webp";

export async function applyInitiativeModifier() {
    const macroName = INITIATIVE_MODIFIER_MACRO_NAME;

    // Determine the target actors using modern party/alliance logic
    let targets = canvas.tokens.controlled.map(t => t.actor);

    if (targets.length === 0) {
        if (game.actors.party) {
            targets = Array.from(game.actors.party.members);
        } else {
            targets = game.actors.filter(a => a.type === 'character' && (a.system?.details?.alliance === 'party' || a.alliance === 'party'));
            if (targets.length === 0) {
                targets = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
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
        // Check if the actor is in the current combat[cite: 5]
        const combatant = combat.getCombatantByActor(actor.id);
        return combatant;
    });

    if (targets.length === 0) {
        ui.notifications.info("None of the selected or default actors are participants in the current combat.");
        return;
    }

    // Define the update function to be called by the quick buttons
    const performInitiativeUpdate = async (modifier) => {
        const updates = [];
        const chatMessages = [];

        targets.forEach(actor => {
            const combatant = combat.getCombatantByActor(actor.id);
            if (combatant) {
                const oldInitiative = combatant.initiative || 0;
                const newInitiative = oldInitiative + modifier;

                updates.push({
                    _id: combatant.id,
                    initiative: newInitiative
                });

                // Prepare chat message content[cite: 5]
                const sign = modifier >= 0 ? '+' : '';
                chatMessages.push(`<strong>${actor.name}</strong>: ${oldInitiative} &rarr; ${newInitiative} (${sign}${modifier})`);
            }
        });

        // Update Combatant Initiatives[cite: 5]
        if (updates.length > 0) {
            try {
                await combat.updateEmbeddedDocuments("Combatant", updates);

                // Post private GM chat message[cite: 5]
                const chatContent = `
                    <h3>${macroName} - Initiative Updated</h3>
                    <p>Applied a modifier of <strong>${modifier >= 0 ? '+' : ''}${modifier}</strong> to the following combatants:</p>
                    <ul style="list-style-type: none; padding-left: 0;">${chatMessages.map(msg => `<li>${msg}</li>`).join('')}</ul>
                `;

                await ChatMessage.create({
                    content: chatContent,
                    whisper: ChatMessage.getWhisperRecipients('GM'),
                    speaker: { alias: macroName }
                });

                ui.notifications.info(`Successfully updated initiative for ${updates.length} combatant(s).`);
            } catch (err) {
                console.error("Failed to update combatant initiatives:", err);
                ui.notifications.error("Failed to update combatant initiatives. Check the console for details.");
            }
        } else {
            ui.notifications.info("No combatants were updated.");
        }
    };

    // Prepare dialog content with quick buttons[cite: 5]
    const targetNames = targets.map(a => `<li>${a.name}</li>`).join("");
    const dialogContent = `
    <style>
      .init-mod-container { font-family: "Signika", sans-serif; }
      .init-btn-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0; }
      .init-btn { 
          padding: 8px 0; 
          font-weight: bold; 
          font-size: 1.2em; 
          cursor: pointer; 
          border-radius: 4px; 
          border: 1px solid var(--color-border-dark-4); 
          background: var(--color-background-light-2); 
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
      }
      .init-btn:hover { background: var(--color-background-light-1); box-shadow: 0 0 5px var(--color-shadow-primary); }
      .init-btn.pos { color: #006400; background: #e8f5e9; border-color: #a5d6a7; }
      .init-btn.pos:hover { background: #c8e6c9; }
      .init-btn.neg { color: #8b0000; background: #ffebee; border-color: #ef9a9a; }
      .init-btn.neg:hover { background: #ffcdd2; }
    </style>
    
    <div class="init-mod-container">
        <p>Apply an Initiative Modifier to the following combatants:</p>
        <ul style="list-style-type: disc; margin-left: 1.5em; max-height: 150px; overflow-y: auto;">
            ${targetNames}
        </ul>
        
        <div class="init-btn-grid">
            <button type="button" class="init-btn pos" data-mod="1">+1</button>
            <button type="button" class="init-btn pos" data-mod="2">+2</button>
            <button type="button" class="init-btn pos" data-mod="3">+3</button>
            <button type="button" class="init-btn pos" data-mod="4">+4</button>
            <button type="button" class="init-btn pos" data-mod="5">+5</button>
            
            <button type="button" class="init-btn neg" data-mod="-1">-1</button>
            <button type="button" class="init-btn neg" data-mod="-2">-2</button>
            <button type="button" class="init-btn neg" data-mod="-3">-3</button>
            <button type="button" class="init-btn neg" data-mod="-4">-4</button>
            <button type="button" class="init-btn neg" data-mod="-5">-5</button>
        </div>
        <p style="text-align: center; font-size: 0.85em; font-style: italic; color: var(--color-text-dark-secondary);">
            Clicking a value will immediately apply it and close this window.
        </p>
    </div>
    `;

    // Display the dialog[cite: 5]
    let dialogRef = new Dialog({
        title: macroName,
        content: dialogContent,
        buttons: {
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        render: (html) => {
            // Bind click events to the new modifier buttons
            html.find('.init-btn').click((ev) => {
                const button = ev.currentTarget;
                const modifier = parseInt(button.dataset.mod, 10);

                // Fire the update logic
                performInitiativeUpdate(modifier);

                // Instantly close the dialog for speed
                dialogRef.close();
            });
        }
    });

    dialogRef.render(true);
}