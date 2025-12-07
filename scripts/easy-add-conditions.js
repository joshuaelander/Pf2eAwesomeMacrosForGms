/**
 * PF2e Add Status Effect
 * * A macro to add a specific condition or persistent damage type
 * * to selected actors or the entire party.
 * * Targeting: Auto-detects selected tokens or defaults to Party folder/PC actors.
 * * Updated for PF2e V12/V13
 */

export const STATUS_EFFECT_MACRO_NAME = "Easy Add Status/Condition";
export const STATUS_EFFECT_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/easy-add-condition.png";

// --------------- MAIN MACRO LOGIC ---------------
export async function addStatusEffect() {
    // 1. Determine Actors (Run immediately to populate Dialog)
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
        targetLabel = targetActors.map(a => a.name).join(", ");
    } else {
        const actorFolders = game.folders.filter(f => f.type === 'Actor');
        const partyFolder = actorFolders.find(f => (f.name || '').toLowerCase() === 'party');

        if (partyFolder) {
            for (const actor of game.actors.values()) {
                if (actor.folder?.id === partyFolder.id) {
                    targetActors.push(actor);
                }
            }
        }

        if (targetActors.length === 0) {
            for (const actor of game.actors.values()) {
                if (actor && (actor.type === 'character' || actor.hasPlayerOwner)) {
                    targetActors.push(actor);
                }
            }
        }
    }

    if (targetActors.length === 0) {
        ui.notifications.error('No target actors found.');
        return;
    }

    const content = `
<style>
    .pf2e-status-dialog .form-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .pf2e-status-dialog label { flex: 2; margin-right: 10px; }
    .pf2e-status-dialog input, .pf2e-status-dialog select { flex: 3; padding: 4px; border: 1px solid #782e22; border-radius: 3px; }
    .pf2e-status-dialog .target-list { flex: 3; text-align: right; font-weight: bold; font-size: 0.9em; word-break: break-word; }
    .pf2e-status-header { border-bottom: 1px solid #782e22; margin-bottom: 10px; font-weight: bold; color: #782e22; }
</style>
<form class="pf2e-status-dialog">
    <div class="pf2e-status-header">Targeting</div>
    <div class="form-group">
        <label>Targets:</label>
        <div class="target-list">${targetLabel}</div>
    </div>

    <div class="pf2e-status-header">Status Effect Details</div>
    
    <div class="form-group">
        <label for="conditionName">Status/Condition:</label>
        <select id="conditionName" name="conditionName">
            <option value="persistent-damage">Persistent Damage</option>
            <option value="wounded">Wounded (Ranked)</option>
            <option value="dying">Dying (Ranked)</option>
            <option value="clumsy">Clumsy (Ranked)</option>
            <option value="drained">Drained (Ranked)</option>
            <option value="fatigued">Fatigued</option>
            <option value="frightened">Frightened (Ranked)</option>
            <option value="sickened">Sickened (Ranked)</option>
            <option value="off-guard">Off-Guard (Flat-Footed)</option>
            <option value="stupefied">Stupefied (Ranked)</option>
            <option value="enfeebled">Enfeebled (Ranked)</option>
        </select>
    </div>

    <div class="form-group">
        <label for="conditionValue">Value/Rank:</label>
        <input type="number" id="conditionValue" name="conditionValue" value="1" min="1">
    </div>

    <div id="persistentDamageOptions" style="display: none;">
        <div class="form-group">
            <label for="damageType">Damage Type:</label>
            <select id="damageType" name="damageType">
                <option value="acid">Acid</option>
                <option value="bleed">Bleed</option>
                <option value="bludgeoning">Bludgeoning</option>
                <option value="cold">Cold</option>
                <option value="electricity">Electricity</option>
                <option value="fire" selected>Fire (Burn)</option>
                <option value="force">Force</option>
                <option value="mental">Mental</option>
                <option value="piercing">Piercing</option>
                <option value="poison">Poison</option>
                <option value="slashing">Slashing</option>
            </select>
        </div>
        <div class="form-group">
            <label for="damageFormula">Damage Formula (e.g., 1d6):</label>
            <input type="text" id="damageFormula" name="damageFormula" value="1d6">
        </div>
    </div>
</form>
`;

    new Dialog({
        title: "Apply Status/Condition",
        content: content,
        buttons: {
            apply: {
                icon: "<i class='fas fa-plus-circle'></i>",
                label: "Apply Status",
                callback: (html) => executeStatusAdd(html, targetActors)
            },
            cancel: {
                icon: "<i class='fas fa-times'></i>",
                label: "Cancel"
            }
        },
        default: "apply",
        render: (html) => {
            const conditionSelect = html.find('[name="conditionName"]');
            const pdOptions = html.find('#persistentDamageOptions');
            const valueInput = html.find('[name="conditionValue"]');

            function updateVisibility() {
                const val = conditionSelect.val();
                if (val === 'persistent-damage') {
                    pdOptions.show();
                    valueInput.val(1).prop('disabled', true);
                } else {
                    pdOptions.hide();
                    valueInput.prop('disabled', false);
                }
            }

            conditionSelect.on('change', updateVisibility);
            updateVisibility(); // Init
        }
    }).render(true);

    /**
     * Executes the logic to apply the condition/status to the actors.
     * @param {JQuery} html The dialog HTML element.
     * @param {ActorPF2e[]} actorsToUpdate The list of actors to target.
     */
    async function executeStatusAdd(html, actorsToUpdate) {
        const conditionName = html.find('[name="conditionName"]').val();
        const conditionValue = parseInt(html.find('[name="conditionValue"]').val());
        const damageType = html.find('[name="damageType"]').val();
        const damageFormula = html.find('[name="damageFormula"]').val().trim();

        const appliedResults = [];

        for (const actor of actorsToUpdate) {
            try {
                if (conditionName === 'persistent-damage') {
                    if (!damageFormula) {
                        ui.notifications.error(`Persistent Damage requires a Formula. Skipping ${actor.name}.`);
                        continue;
                    }

                    // Construct the Persistent Damage Condition Item directly
                    const itemData = {
                        type: "condition",
                        name: `Persistent ${damageType.capitalize()}`,
                        system: {
                            slug: "persistent-damage",
                            persistent: {
                                formula: damageFormula,
                                damageType: damageType,
                                dc: 15 // Standard DC 15 base
                            }
                        }
                    };

                    await actor.createEmbeddedDocuments("Item", [itemData]);
                    appliedResults.push(`Persistent Damage (${damageFormula} ${damageType}) to ${actor.name}`);

                } else {
                    // 1. Ensure the condition exists on the actor
                    if (!actor.hasCondition(conditionName)) {
                        await actor.increaseCondition(conditionName);
                    }

                    // 2. Force the value to the specific rank requested
                    const condition = actor.getCondition(conditionName);
                    if (condition) {
                        // Only update if the condition supports values (ranked conditions)
                        // and if the value is different from current.
                        // We check system.value.value to be safe.
                        if (typeof condition.system.value.value === 'number') {
                            if (condition.system.value.value !== conditionValue) {
                                await condition.update({ "system.value.value": conditionValue });
                            }
                            const label = conditionName.capitalize();
                            appliedResults.push(`${label} (Rank ${conditionValue}) to ${actor.name}`);
                        } else {
                            // For unranked conditions (like Fatigued, Off-Guard), just adding it (step 1) is enough
                            const label = conditionName.capitalize();
                            appliedResults.push(`${label} to ${actor.name}`);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error applying condition to ${actor.name}:`, err);
                ui.notifications.error(`Error applying to ${actor.name}. Check console.`);
            }
        }

        // Report Results
        if (appliedResults.length > 0) {
            let chatContent = '<strong>Applied Status Effects:</strong><br>';

            for (const message of appliedResults) {
                chatContent += `— ${message}<br>`;
            }

            ChatMessage.create({
                content: chatContent,
                whisper: ChatMessage.getWhisperRecipients("GM")
            });
            ui.notifications.info(`Processed ${actorsToUpdate.length} actors.`);
        } else {
            ui.notifications.info("No status effects were applied (or no changes needed).");
        }
    }
}