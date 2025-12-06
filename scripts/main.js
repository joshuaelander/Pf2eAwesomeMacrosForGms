/**
 * PF2e Custom Macro Collection (Main Entry Script)
 * This script runs once on the Foundry VTT 'ready' hook.
 * It serves as the module's entry point, handling imports, global registration, 
 * and programmatically creating macro documents for user convenience.
 * * This file is referenced by the "scripts" array in module.json.
 */

// --- 1. CONFIGURATION AND IMPORT MACRO LOGIC FILES ---

// Define the name of the folder where the macros will be placed
const MACRO_FOLDER_NAME = "PF2e Awesome Macros For GMs";
// Define the color for the macro folder (use a hex color code)
const MACRO_FOLDER_COLOR = "#9c0000"; // Dark red for visibility

// Import the core functions and constants for the Random Encounter Generator
// Note: To set a custom icon for the macro, update MACRO_ICON inside 'random_encounter_macro.js'
// Example Custom Icon Path: const MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/generator-icon.webp";
import { generateEncounter, RANDOM_ENCOUNTER_MACRO_NAME, RANDOM_ENCOUNTER_MACRO_ICON } from './random-encounter-macro.js';
import { generateEncounter, QUICK_RECALL_MACRO_NAME, QUICK_RECALL_MACRO_ICON } from './quick-recall-knowledge.js';

// --- 2. HELPER FUNCTIONS ---

/**
 * Gets an existing folder by name and type, or creates it if it doesn't exist.
 * @param {string} name - The name of the folder.
 * @param {string} type - The document type the folder contains (e.g., 'Macro').
 * @returns {Promise<Folder|null>} The Folder document, or null if creation failed.
 */
async function getOrCreateFolder(name, type) {
    let folder = game.folders.getName(name);

    if (!folder) {
        // Create the folder if it doesn't exist
        try {
            folder = await Folder.create({
                name: name,
                type: type,
                parent: null, // Create at the top level
                color: MACRO_FOLDER_COLOR // <<< Set the folder color here
            });
            ui.notifications.info(`[PF2e Awesome Macros For GMs] Created folder: ${name}.`);
        } catch (err) {
            console.error(`PF2e Awesome Macros | Failed to create folder: ${name}`, err);
            return null;
        }
    }
    return folder;
}

/**
 * Creates a macro document if it doesn't exist, and places it in a specified folder.
 * This ensures GMs don't have to manually import the macro from a compendium.
 * @param {string} name - The name of the macro document.
 * @param {string} icon - The icon path for the macro.
 * @param {string} command - The JavaScript command string (e.g., 'game.namespace.function();').
 * @param {string|null} folderId - The ID of the parent folder, or null for top-level.
 */
async function createMacroDocument(name, icon, command, folderId) {
    // Check for an existing macro with the same name
    const existingMacro = game.macros.getName(name);
    if (existingMacro) {
        return;
    }

    const macroData = {
        name: name,
        type: "script",
        img: icon,
        command: command,
        folder: folderId, // Assign the folder ID here
        // Add a flag for easy identification/cleanup later if needed
        flags: { "pf2e-awesome-macros-for-gms": { isModuleMacro: true } }
    };

    // Only allow GMs to automatically create macro documents
    if (game.user.isGM) {
        try {
            // Create the Macro in the World's macro directory
            await Macro.create(macroData, { renderSheet: false });
            ui.notifications.info(`[PF2e Awesome Macros For GMs] Created Macro: ${name}.`);
        } catch (err) {
            console.error(`PF2e Awesome Macros | Failed to create macro: ${name}`, err);
        }
    } else {
        console.warn(`PF2e Awesome Macros | Cannot auto-create macro for non-GM user: ${name}.`);
    }
}


// --- 3. HOOKS AND INITIALIZATION ---

Hooks.once('ready', async () => {
    // 1. Define a global namespace for module functions
    game.pf2eAwedomeMacros = game.pf2eAwedomeMacros || {};

    // 2. Register Global Functions 
    game.pf2eAwedomeMacros.generateEncounter = generateEncounter;
    game.pf2eAwedomeMacros.openRecallKnowledgeDialog = openRecallKnowledgeDialog;

    // 3. Get or Create the Target Folder
    let targetFolderId = null;
    if (game.user.isGM) {
        const folder = await getOrCreateFolder(MACRO_FOLDER_NAME, 'Macro');
        if (folder) {
            targetFolderId = folder.id;
        }
    }

    // 4. Programmatically create the macro buttons 
    createMacroDocument(
        RANDOM_ENCOUNTER_MACRO_NAME,
        RANDOM_ENCOUNTER_MACRO_ICON,
        `game.pf2eAwedomeMacros.generateEncounter();`,
        targetFolderId
    );

    createMacroDocument(
        QUICK_RECALL_MACRO_NAME, 
        QUICK_RECALL_MACRO_ICON, 
        `game.pf2eAwedomeMacros.openRecallKnowledgeDialog();`,
        targetFolderId
    );

    console.log('PF2e Awesome Macros | All module logic and macros initialized.');
});