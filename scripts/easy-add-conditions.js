/**
 * PF2e Easy Add/Remove Condition
 * * A macro to add or remove specific conditions and persistent damage,
 * * or clear all conditions from selected actors or the entire party.
 * * Targeting: Auto-detects selected tokens or defaults to active party/PC actors.
 * * Updated for PF2e V12/V13/V14
 */

export const CONDITION_MACRO_NAME = "Easy Add/Remove Condition";
export const CONDITION_MACRO_ICON = "systems/pf2e/icons/conditions/doomed.webp";

// --------------- MAIN MACRO LOGIC ---------------
export async function addCondition() {
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
        ui.notifications.error('No target actors found.');
        return;
    }

    const content = `
<style>
    .pf2e-status-dialog { font-family: "Signika", sans-serif; }
    .pf2e-status-dialog .form-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .pf2e-status-dialog label { flex: 2; margin-right: 10px; font-weight: bold; }
    .pf2e-status-dialog input[type="number"], .pf2e-status-dialog input[type="text"], .pf2e-status-dialog select { flex: 3; padding: 4px; border: 1px solid var(--color-border-dark-4); border-radius: 3px; background: rgba(0,0,0,0.05); }
    .pf2e-status-dialog .target-list { flex: 3; text-align: right; font-weight: normal; font-size: 1em; word-break: break-word; font-style: italic; }
    .pf2e-status-header { border-bottom: 1px solid #782e22; margin-bottom: 10px; font-weight: bold; color: #782e22; padding-bottom: 3px; }
    .pf2e-mode-group { display: flex; gap: 8px; flex: 3; font-weight: normal; }
    .pf2e-mode-group label { font-weight: normal; display: flex; align-items: center; cursor: pointer; font-size: 1em; white-space: nowrap; }
    .pf2e-mode-group input { margin-right: 4px; cursor: pointer; }
    optgroup { font-weight: bold; color: #555; font-style: normal; }
    option { color: #000; font-weight: normal; }
</style>
<form class="pf2e-status-dialog">
    <div class="pf2e-status-header">Targeting & Mode</div>
    
    <div class="form-group">
        <label>Targets:</label>
        <div class="target-list">${targetLabel}</div>
    </div>

    <div class="form-group" style="margin-bottom: 15px;">
        <label>Action Mode:</label>
        <div class="pf2e-mode-group">
            <label><input type="radio" name="actionMode" value="apply" checked> Apply</label>
            <label><input type="radio" name="actionMode" value="remove"> Remove</label>
            <label><input type="radio" name="actionMode" value="clearAll"> Clear All</label>
        </div>
    </div>

    <div id="conditionDetailsSection">
        <div class="pf2e-status-header">Condition Details</div>
        
        <div class="form-group">
            <label for="conditionName">Condition:</label>
            <select id="conditionName" name="conditionName">
                <optgroup label="Lowered Stats">
                    <option value="clumsy">Clumsy</option>
                    <option value="drained">Drained</option>
                    <option value="enfeebled">Enfeebled</option>
                    <option value="fatigued">Fatigued</option>
                    <option value="frightened">Frightened</option>
                    <option value="off-guard">Off-Guard (Flat-Footed)</option>
                    <option value="sickened">Sickened</option>
                    <option value="stupefied">Stupefied</option>
                </optgroup>
                <optgroup label="Senses">
                    <option value="blinded">Blinded</option>
                    <option value="dazzled">Dazzled</option>
                    <option value="deafened">Deafened</option>
                </optgroup>
                <optgroup label="Stealth">
                    <option value="concealed">Concealed</option>
                    <option value="hidden">Hidden</option>
                    <option value="invisible">Invisible</option>
                    <option value="undetected">Undetected</option>
                    <option value="unnoticed">Unnoticed</option>
                </optgroup>
                <optgroup label="Movement">
                    <option value="encumbered">Encumbered</option>
                    <option value="fleeing">Fleeing</option>
                    <option value="grabbed">Grabbed</option>
                    <option value="immobilized">Immobilized</option>
                    <option value="paralyzed">Paralyzed</option>
                    <option value="petrified">Petrified</option>
                    <option value="restrained">Restrained</option>
                </optgroup>
                <optgroup label="Mental">
                    <option value="confused">Confused</option>
                    <option value="controlled">Controlled</option>
                    <option value="fascinated">Fascinated</option>
                    <option value="quickened">Quickened</option>
                    <option value="slowed">Slowed</option>
                    <option value="stunned">Stunned</option>
                </optgroup>
                <optgroup label="Dying">
                    <option value="doomed">Doomed</option>
                    <option value="dying">Dying</option>
                    <option value="persistent-damage">Persistent Damage</option>
                    <option value="prone">Prone</option>
                    <option value="unconscious">Unconscious</option>
                    <option value="wounded">Wounded</option>
                </optgroup>
            </select>
        </div>

        <div class="form-group" id="valueGroup">
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
                    <option value="fire" selected>Fire</option>
                    <option value="force">Force</option>
                    <option value="mental">Mental</option>
                    <option value="piercing">Piercing</option>
                    <option value="poison">Poison</option>
                    <option value="slashing">Slashing</option>
                </select>
            </div>
            <div class="form-group" id="formulaGroup">
                <label for="damageFormula">Damage Formula (e.g. 1d6):</label>
                <input type="text" id="damageFormula" name="damageFormula" value="1d6">
            </div>
        </div>
    </div>
</form>
`;

    let dialogRef = new Dialog({
        title: "Manage Conditions",
        content: content,
        buttons: {
            execute: {
                icon: "<i class='fas fa-bolt'></i>",
                label: "Execute",
                callback: (html) => executeConditionAction(html, targetActors)
            },
            cancel: {
                icon: "<i class='fas fa-times'></i>",
                label: "Cancel"
            }
        },
        // ... (inside the dialog options)
        default: "execute",
        render: (html) => {
            const conditionSelect = html.find('[name="conditionName"]');
            const pdOptions = html.find('#persistentDamageOptions');
            const valueInput = html.find('[name="conditionValue"]');
            const valueGroup = html.find('#valueGroup');
            const formulaGroup = html.find('#formulaGroup');
            const detailsSection = html.find('#conditionDetailsSection');
            const modeRadios = html.find('[name="actionMode"]');

            function updateVisibility() {
                const mode = html.find('[name="actionMode"]:checked').val();
                const condition = conditionSelect.val();

                // Handle Mode Visibility
                if (mode === 'clearAll') {
                    detailsSection.hide();
                } else {
                    detailsSection.show();
                }

                // Handle Condition/Value Visibility based on Mode and Selection
                if (condition === 'persistent-damage') {
                    pdOptions.show();
                    valueGroup.hide();

                    if (mode === 'remove') {
                        formulaGroup.hide();
                    } else {
                        formulaGroup.show();
                    }
                } else {
                    pdOptions.hide();
                    if (mode === 'remove') {
                        valueGroup.hide();
                    } else {
                        valueGroup.show();
                        valueInput.prop('disabled', false);
                    }
                }

                // --- THE NEW LINE ---
                // Tell Foundry to recalculate the window height dynamically!
                dialogRef.setPosition({ height: "auto" });
            }

            conditionSelect.on('change', updateVisibility);
            modeRadios.on('change', updateVisibility);
            updateVisibility(); // Init
        }
    });

    dialogRef.render(true);

    /**
     * Executes the logic to apply or remove conditions.
     * @param {JQuery} html The dialog HTML element.
     * @param {ActorPF2e[]} actorsToUpdate The list of actors to target.
     */
    async function executeConditionAction(html, actorsToUpdate) {
        const actionMode = html.find('[name="actionMode"]:checked').val();
        const conditionName = html.find('[name="conditionName"]').val();
        const conditionValue = parseInt(html.find('[name="conditionValue"]').val());
        const damageType = html.find('[name="damageType"]').val();
        const damageFormula = html.find('[name="damageFormula"]').val().trim();

        const results = [];

        for (const actor of actorsToUpdate) {
            try {
                // --- MODE: CLEAR ALL CONDITIONS ---
                if (actionMode === 'clearAll') {
                    const conditionsToRemove = actor.itemTypes.condition.map(c => c.id);
                    if (conditionsToRemove.length > 0) {
                        await actor.deleteEmbeddedDocuments("Item", conditionsToRemove);
                        results.push(`Cleared all conditions from ${actor.name}`);
                    }
                    continue; // Move to next actor
                }

                // --- MODE: REMOVE SPECIFIC CONDITION ---
                if (actionMode === 'remove') {
                    if (conditionName === 'persistent-damage') {
                        // Find all persistent damage items matching the selected damage type
                        const pdItems = actor.itemTypes.condition.filter(c => c.slug === 'persistent-damage' && c.system.persistent?.damageType === damageType);
                        if (pdItems.length > 0) {
                            await actor.deleteEmbeddedDocuments("Item", pdItems.map(i => i.id));
                            results.push(`Removed Persistent ${damageType.capitalize()} Damage from ${actor.name}`);
                        }
                    } else {
                        if (actor.hasCondition(conditionName)) {
                            await actor.decreaseCondition(conditionName, { forceRemove: true });
                            results.push(`Removed ${conditionName.capitalize()} from ${actor.name}`);
                        }
                    }
                    continue; // Move to next actor
                }

                // --- MODE: APPLY CONDITION ---
                if (actionMode === 'apply') {
                    if (conditionName === 'persistent-damage') {
                        if (!damageFormula) {
                            ui.notifications.error(`Persistent Damage requires a Formula. Skipping ${actor.name}.`);
                            continue;
                        }

                        const itemData = {
                            type: "condition",
                            name: `Persistent ${damageType.capitalize()}`,
                            system: {
                                slug: "persistent-damage",
                                persistent: {
                                    formula: damageFormula,
                                    damageType: damageType,
                                    dc: 15
                                }
                            }
                        };

                        await actor.createEmbeddedDocuments("Item", [itemData]);
                        results.push(`Applied Persistent Damage (${damageFormula} ${damageType}) to ${actor.name}`);

                    } else {
                        if (!actor.hasCondition(conditionName)) {
                            await actor.increaseCondition(conditionName);
                        }

                        const condition = actor.getCondition(conditionName);
                        if (condition) {
                            if (typeof condition.system.value.value === 'number') {
                                if (condition.system.value.value !== conditionValue) {
                                    await condition.update({ "system.value.value": conditionValue });
                                }
                                results.push(`Applied ${conditionName.capitalize()} ${conditionValue} to ${actor.name}`);
                            } else {
                                results.push(`Applied ${conditionName.capitalize()} to ${actor.name}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error processing condition for ${actor.name}:`, err);
                ui.notifications.error(`Error processing condition for ${actor.name}. Check console.`);
            }
        }

        // Report Results
        if (results.length > 0) {
            let chatContent = '<strong>Condition Updates:</strong><ul>';
            for (const message of results) {
                chatContent += `<li>${message}</li>`;
            }
            chatContent += '</ul>';

            ChatMessage.create({
                content: chatContent,
                whisper: ChatMessage.getWhisperRecipients("GM")
            });
            ui.notifications.info(`Successfully processed ${actorsToUpdate.length} actors.`);
        } else {
            ui.notifications.info("No conditions were updated (or no changes were needed).");
        }
    }
}