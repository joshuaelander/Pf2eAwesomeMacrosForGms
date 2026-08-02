// Token Name Visibility Macro
// Quickly changes the display name mode for selected tokens, or all non-party tokens.

export const TOKEN_NAME_VISIBILITY_MACRO_NAME = "Reveal to Players";
export const TOKEN_NAME_VISIBILITY_MACRO_ICON = "icons/magic/perception/orb-crystal-ball-scrying-blue.webp";

/**
 * Helper function to handle the token name display updates.
 */
export async function updateTokenNameDisplay() {
    // Determine the targets to update
    const selectedTokens = canvas.tokens.controlled.map(t => t.document);
    let tokensToUpdate = selectedTokens;
    let isMassUpdate = false;

    // If nothing is selected, default to all non-party tokens on the scene
    if (tokensToUpdate.length === 0) {
        tokensToUpdate = canvas.scene.tokens.filter(t => t.actor?.alliance !== "party");
        isMassUpdate = true;
    }

    // Failsafe in case the scene is empty
    if (tokensToUpdate.length === 0) {
        ui.notifications.warn("No valid tokens found on the scene to update.");
        return;
    }

    // Dynamically generate the warning text for the dialog
    const content = isMassUpdate
        ? `<p>⚠️ <b>No tokens selected.</b></p><p>Do you want to mass update the display names of <b>ALL ${tokensToUpdate.length} non-party tokens</b> on this scene?</p><hr><p>Select the new display mode below:</p>`
        : `<p>Update display names for <b>${tokensToUpdate.length} selected token(s)</b>?</p><hr><p>Select the new display mode below:</p>`;

    // Function to handle the actual database update
    const applyUpdate = async (mode) => {
        const updates = tokensToUpdate.map(t => ({
            _id: t.id,
            displayName: mode
        }));
        await canvas.scene.updateEmbeddedDocuments("Token", updates);
        ui.notifications.info(`Updated display names for ${tokensToUpdate.length} token(s).`);
    };

    // Render the UI Dialog
    new Dialog({
        title: "Token Name Display Mode",
        content: content,
        buttons: {
            none: {
                label: "Never Displayed",
                callback: () => applyUpdate(CONST.TOKEN_DISPLAY_MODES.NONE)
            },
            ownerHover: {
                label: "Hovered for Owner",
                callback: () => applyUpdate(CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER)
            },
            hover: {
                label: "Hovered by Anyone",
                callback: () => applyUpdate(CONST.TOKEN_DISPLAY_MODES.HOVER)
            },
            always: {
                label: "Always for Everyone",
                callback: () => applyUpdate(CONST.TOKEN_DISPLAY_MODES.ALWAYS)
            },
            cancel: {
                label: "Cancel",
                icon: '<i class="fas fa-times"></i>'
            }
        },
        default: "cancel"
    }, { width: 600 }).render(true);
}