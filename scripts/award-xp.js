/**
 * PF2e Experience Award Macro
 * * Awards a specified amount of XP to selected actors, optionally applying
 * a custom leveling pace (Fast/Normal/Slow) and resetting excess XP.
 * Selection logic:
 * 1. Selected tokens/actors.
 * 2. If none selected, the members of the "Party" actor (if it exists).
 * 3. If "Party" doesn't exist, all owned Player Characters (type: character).
 * * Notifies the public chat of the update, including a level-up alert if max XP is reached.
 */

export const EXPERIENCE_AWARD_MACRO_NAME = "Award Experience Points (XP)";
export const EXPERIENCE_AWARD_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/award-xp.png";

// Define the main asynchronous function for the macro
export async function awardXP() {
    // --- 1. Determine Target Actors ---
    const selectedActors = canvas.tokens.controlled.map(t => t.actor).filter(a => a);
    let actorsToUpdate = [];

    if (selectedActors.length > 0) {
        // Case 1: Use selected tokens/actors
        actorsToUpdate = selectedActors.filter(a => a.type === "character");
    }

    if (actorsToUpdate.length === 0) {
        // Case 2: Check for the "Party" actor
        const partyActor = game.actors.find(a => a.name === "Party" && a.type === "party");

        if (partyActor) {
            // Party actor found, update all its members (characters only)
            actorsToUpdate = partyActor.members.filter(m => m.type === "character");
        }
    }

    if (actorsToUpdate.length === 0) {
        // Case 3: Default to all owned PCs
        actorsToUpdate = game.actors.filter(a => a.type === "character" && a.isOwner);
    }

    // Final check for valid targets
    if (actorsToUpdate.length === 0) {
        return ui.notifications.warn("No valid PC actors found (selected, Party members, or owned PCs).");
    }

    // --- 2. Build and Display Dialog ---
    const actorNames = actorsToUpdate.map(a => a.name).join(", ");
    const content = `
        <div class="form-group">
            <p style="font-size: 0.9em; color: #555;">Awarding XP to the following actor(s):</p>
            <strong style="display: block; margin-bottom: 10px; padding: 5px; background: #f0f0f0; border-radius: 5px;">${actorNames}</strong>
        </div>

        <div class="form-group" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <label for="levelingPace"><strong>Leveling Pace:</strong></label>
            <!-- Fixed height and color to ensure visibility -->
            <select id="levelingPace" name="levelingPace" style="width: 65%; height: 28px; color: black; padding-left: 5px; border-radius: 4px; border: 1px solid #ccc;">
                <option value="normal" selected>Normal (1000 XP)</option>
                <option value="fast">Fast (800 XP)</option>
                <option value="slow">Slow (1200 XP)</option>
            </select>
        </div>

        <div class="form-group">
            <label for="xpAmount"><strong>XP to Award:</strong></label>
            <!-- Adjusted style to match dropdown -->
            <input type="number" id="xpAmount" name="xpAmount" value="10" min="1" required style="width: 100%; height: 28px; color: black; padding-left: 5px; box-sizing: border-box; border-radius: 4px; border: 1px solid #ccc;">
        </div>

        <div class="form-group" style="display: flex; align-items: flex-start; margin-top: 15px;">
            <input type="checkbox" id="resetXp" name="resetXp" style="margin-top: 5px; margin-right: 10px;" checked>
            <label for="resetXp" title="If the actor's current XP already exceeds the leveling threshold, the XP will be reset to the remainder before adding the new amount. This fixes accumulated XP from missed level-ups.">
                Reset Over-Max XP (if already leveled)
            </label>
        </div>
    `;

    new Dialog({
        title: "Award XP",
        content: content,
        buttons: {
            award: {
                icon: '<i class="fas fa-trophy"></i>',
                label: "Award XP",
                callback: async (html) => {
                    const xpAmount = parseInt(html.find('#xpAmount').val());
                    const pace = html.find('#levelingPace').val();
                    const resetXp = html.find('#resetXp').prop('checked');

                    if (isNaN(xpAmount) || xpAmount <= 0) {
                        return ui.notifications.error("Please enter a valid positive number for the XP amount.");
                    }

                    // Determine XP Threshold based on pace selection
                    let xpThreshold;
                    if (pace === 'fast') {
                        xpThreshold = 800;
                    } else if (pace === 'slow') {
                        xpThreshold = 1200;
                    } else {
                        xpThreshold = 1000;
                    }

                    await awardXp(actorsToUpdate, xpAmount, xpThreshold, resetXp);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "award"
    }, { width: 350 }).render(true);

    // --- 3. Function to Handle XP Update and Notification ---
    async function awardXp(actors, amount, xpThreshold, resetXp) {
        let levelUpMessages = [];
        let notificationSummary = [];

        for (const actor of actors) {
            let currentXP = actor.system.details.xp.value;
            const currentLevel = actor.system.details.level.value;

            const originalXP = currentXP; // Keep original for display
            let resetApplied = false;

            // --- Apply XP Reset Logic ---
            if (resetXp && currentXP >= xpThreshold) {
                // If current XP is >= threshold and reset is checked, correct the XP
                currentXP = currentXP % xpThreshold; // Calculates the remainder, effectively resetting the counter
                resetApplied = true;
            }

            // Calculate new XP
            const newXP = currentXP + amount;

            // Prepare update
            let updateData = { "system.details.xp.value": newXP };

            // Check for level up using the dynamic threshold
            if (newXP >= xpThreshold) {
                // The PF2e system handles the actual level up on data update,
                // but we flag it here for the chat notification.
                levelUpMessages.push(`
                    <li style="color: #ffaa00; font-weight: bold;">
                        ${actor.name} has reached ${newXP} XP and is ready to 
                        LEVEL UP to Level ${currentLevel + 1} (using ${xpThreshold} XP threshold)!
                    </li>
                `);
            }

            // Build summary for chat
            notificationSummary.push(`
                <li style="color: #333;">
                    ${actor.name}: 
                    <span style="font-weight: bold;">${originalXP}${resetApplied ? ' (Reset)' : ''} XP</span> 
                    &rarr; 
                    <span style="font-weight: bold; color: #16a34a;">${newXP} XP</span>
                </li>
            `);

            // Perform the update
            try {
                await actor.update(updateData);
            } catch (error) {
                console.error(`PF2E XP Macro: Failed to update XP for ${actor.name}:`, error);
            }
        }

        // --- 4. Send Chat Notification ---
        let chatContent = `
            <div style="background: #fcfcfc; border: 1px solid #ddd; padding: 10px; border-radius: 8px; font-family: sans-serif;">
                <h3 style="margin-top: 0; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">
                    <i class="fas fa-coins"></i> Experience Awarded: +${amount} XP (${xpThreshold} XP Level)
                </h3>
                <ul style="list-style-type: none; padding: 0;">
                    ${notificationSummary.join('')}
                </ul>
        `;

        let notificationSound = '';

        if (levelUpMessages.length > 0) {
            notificationSound = CONFIG.sounds.notification; // Play sound on level up
            chatContent += `
                <hr style="border-top: 1px solid #ddd; margin: 10px 0;">
                <div style="text-align: center; background: #fffbe6; border: 2px solid #fcd34d; padding: 10px; border-radius: 6px;">
                    <h3 style="color: #b45309; text-shadow: 1px 1px 1px rgba(0,0,0,0.1); margin: 0 0 5px 0;">
                        <i class="fas fa-star" style="margin-right: 5px;"></i> LEVEL UP ALERT!
                    </h3>
                    <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
                        ${levelUpMessages.join('')}
                    </ul>
                </div>
            `;
        }

        chatContent += '</div>';

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ alias: "GM XP Award" }),
            content: chatContent,
            whisper: [],
            // Public to all
            roll: null,
            sound: notificationSound,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        });

        ui.notifications.info(`Successfully awarded +${amount} XP to ${actors.length} actor(s). Check chat for details.`);
    }

};