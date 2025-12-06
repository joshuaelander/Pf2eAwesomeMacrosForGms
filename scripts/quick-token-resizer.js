// PF2e Token Resizer Macro
// Use this macro to quickly change the size of a selected token between common PF2e sizes.

export const QUICK_TOKEN_RESIZER_MACRO_NAME = "Quick Token Resizer";
export const QUICK_TOKEN_RESIZER_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/quick-token-resizer.png";

/**
 * Maps PF2e size keys (lowercase) to the corresponding grid dimensions (width/height).
 * Note: Small ("sm") and Medium ("med") creatures both occupy a 1x1 grid space.
 */
const SIZE_DIMENSIONS = {
    "tiny": 0.5,
    "sm": 1,
    "med": 1,
    "lg": 2,
    "huge": 3,
    "grg": 4,
};

/**
 * Helper function to handle the main logic.
 */
export async function resizeToken() {
    // 1. Check for exactly one selected token
    const controlled = canvas.tokens.controlled;
    if (controlled.length === 0) {
        return ui.notifications.warn("Please select a token before running this macro.");
    }
    if (controlled.length > 1) {
        return ui.notifications.warn("Please select only one token to resize.");
    }

    const token = controlled[0];
    const actor = token.actor;

    // 2. Validate actor and PF2e system data
    if (!actor) {
        return ui.notifications.error(`Token ${token.name} is not linked to an Actor.`);
    }

    if (actor.type === "hazard" || actor.type === "loot" || actor.type === "vehicle") {
        return ui.notifications.error(`This macro is intended for creatures (character, NPC) and cannot resize a ${actor.type}.`);
    }

    // Get the default size string (e.g., 'med', 'lg') from the PF2e actor system data
    const defaultPf2eSizeKey = actor.system?.traits?.size?.value;
    const defaultGridSize = SIZE_DIMENSIONS[defaultPf2eSizeKey] || 1; // Fallback to 1x1 (Medium)

    // Get the token's current size on the map
    const currentGridSize = token.document.width;

    // 3. Define the size options for the dropdown
    const sizeOptions = {
        // Value: Display Name
        "reset": `Reset to Default (${defaultPf2eSizeKey.toUpperCase()} / ${defaultGridSize}x${defaultGridSize})`,
        "tiny": "Tiny (0.5x0.5)",
        "sm": "Small (1x1)",
        "med": "Medium (1x1)",
        "lg": "Large (2x2)",
        "huge": "Huge (3x3)",
    };

    // Build the HTML options for the select dropdown
    let optionsHTML = '';
    for (const [key, label] of Object.entries(sizeOptions)) {
        let isSelected = false;

        // Automatically select the option that matches the token's current size
        if (key === 'reset' && currentGridSize === defaultGridSize) {
            isSelected = true;
        } else if (key !== 'reset' && SIZE_DIMENSIONS[key] === currentGridSize) {
            // Check if the current size matches one of the options
            isSelected = true;
        }

        optionsHTML += `<option value="${key}" ${isSelected ? 'selected' : ''}>${label}</option>`;
    }

    // 4. Create the Dialog content
    const content = `
        <style>
            .token-resizer-dialog .form-group { margin-bottom: 10px; }
            .token-resizer-dialog .notes { font-size: 0.75em; color: #777; margin-top: 5px; text-align: center; }
        </style>
        <div class="token-resizer-dialog">
            <p>Select a new size for the token representing <strong>${token.name}</strong>.</p>
            <p style="font-size: 0.9em; margin-top: -5px;">Current Dimensions: ${currentGridSize}x${currentGridSize} grid units.</p>
            <div class="form-group">
                <label for="token-size"><strong>New Size:</strong></label>
                <select id="token-size" name="token-size" style="width: 100%;">${optionsHTML}</select>
            </div>
            <p class="notes">Small and Medium creatures share the same 1x1 grid space in PF2e.</p>
        </div>
    `;

    // 5. Create and render the Dialog
    new Dialog({
        title: `PF2e Token Resizer: ${token.name}`,
        content: content,
        buttons: {
            resize: {
                icon: '<i class="fas fa-expand-alt"></i>',
                label: "Resize Token",
                callback: (html) => {
                    const selectedSizeKey = html.find('#token-size').val();
                    let newGridSize;

                    if (selectedSizeKey === "reset") {
                        newGridSize = defaultGridSize;
                    } else {
                        newGridSize = SIZE_DIMENSIONS[selectedSizeKey];
                    }

                    if (newGridSize === undefined) {
                        return ui.notifications.error(`Invalid size setting detected.`);
                    }

                    // Perform the update
                    token.document.update({
                        width: newGridSize,
                        height: newGridSize
                    });

                    ui.notifications.info(`Resized ${token.name} to ${newGridSize}x${newGridSize} grid units.`);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "resize"
    }, { width: 350 }).render(true);
}