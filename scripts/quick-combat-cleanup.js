// This macro ends the current active combat and removes all tokens on the scene
// that are linked to an NPC actor with 0 or less HP in the Pathfinder 2e system.
// A private chat message listing the removed enemies and their filtered inventory is sent to the GM.

export const COMBAT_CLEANUP_MACRO_NAME = "Quick Combat Cleanup";
export const COMBAT_CLEANUP_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/quick-combat-cleanup.png";

export async function cleanupCombat() {
    // Configuration for PF2e HP check
    const NPC_TYPE = 'npc';
    const HP_PATH = 'system.attributes.hp.value';

    // List of item types considered "lootable" or physical inventory in PF2e
    const LOOTABLE_TYPES = new Set(['equipment', 'consumable', 'weapon', 'armor', 'treasure', 'backpack', 'container', 'ammunition']);

    // Ensure the user running the macro is the GM, or has permission to delete tokens/end combat.
    if (!game.user.isGM) {
        ui.notifications.error("Only the Game Master can run the Combat Cleanup macro.");
        return;
    }

    // 1. Identify defeated enemies (NPCs with HP <= 0) and gather item data
    const defeatedData = canvas.tokens.placeables
        // Filter: Only include defeated NPCs
        .filter(token => {
            if (!token.actor || token.actor.type !== NPC_TYPE) return false;
            const currentHP = foundry.utils.getProperty(token.actor, HP_PATH);
            return currentHP !== null && currentHP <= 0;
        })
        // Map: Extract ID, Name, and Item List
        .map(token => {
            // Collect names of lootable items in the actor's inventory by filtering item types
            const itemNames = token.actor.items
                .filter(item => LOOTABLE_TYPES.has(item.type)) // <-- This is the crucial filtering step
                .map(item => item.name);

            return {
                id: token.id, // for removal
                name: token.name,
                items: itemNames,
            };
        });

    const tokensToRemove = defeatedData.map(data => data.id);
    const totalRemoved = defeatedData.length;

    // 2. End Combat
    const combat = game.combat;
    let combatStatusMessage = "No active encounter was found.";

    if (combat) {
        // End the active combat instance
        await combat.endCombat();
        combatStatusMessage = "The active encounter has been ended.";
    }

    // 3. Remove Tokens
    if (tokensToRemove.length > 0) {
        // Delete the tokens from the scene using their IDs
        await canvas.scene.deleteEmbeddedDocuments("Token", tokensToRemove);
        ui.notifications.info(`Cleanup complete. Removed ${totalRemoved} defeated NPCs.`);
    } else {
        ui.notifications.info("Cleanup complete. No defeated NPCs were found to remove.");
    }

    // 4. GM Chat Message
    const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);

    if (gmUsers.length > 0) {
        let listItemsHTML = '';

        if (totalRemoved > 0) {
            listItemsHTML = defeatedData.map(data => {
                const itemHtml = data.items.length > 0
                    ? `<ul style="list-style-type: circle; margin: 2px 0 0 15px; padding: 0;">${data.items.map(item => `<li>${item}</li>`).join('')}</ul>`
                    : `<em style="color: #666; font-size: 0.9em;">(No lootable items found in inventory)</em>`;

                return `
                <li style="margin-top: 8px;">
                    <strong style="font-size: 1.1em; color: #555;">${data.name}</strong>
                    ${itemHtml}
                </li>
            `;
            }).join('');
        } else {
            listItemsHTML = '<li>No defeated enemies were found and removed.</li>';
        }

        const messageContent = `
        <div style="font-family: Inter, sans-serif; border: 2px solid #730000; padding: 10px; background: #fefefe; border-radius: 8px;">
            <h3 style="margin: 0; padding-bottom: 5px; color: #730000; border-bottom: 1px solid #730000;">Quick Combat Cleanup</h3>
            <p style="margin-top: 5px;">${combatStatusMessage}</p>
            <p style="margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Removed Defeated Enemies (${totalRemoved}):</p>
            <ul style="list-style-type: none; margin: 0 0 0 10px; padding: 0;">
                ${listItemsHTML}
            </ul>
        </div>
    `;

        await ChatMessage.create({
            content: messageContent,
            whisper: gmUsers,
            // Make the message only visible to the whispered users (GMs)
            blind: true,
            // Set the speaker to the user who ran the macro
            speaker: ChatMessage.getSpeaker(),
        });
    }
}