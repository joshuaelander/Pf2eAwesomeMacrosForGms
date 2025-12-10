/**
 * PF2e Custom Macro Collection (Main Entry Script)
 * This script runs once on the Foundry VTT 'ready' hook.
 * It serves as the module's entry point, handling imports, global registration, 
 * and programmatically creating macro documents for user convenience.
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
import { openRecallKnowledgeDialog, QUICK_RECALL_MACRO_NAME, QUICK_RECALL_MACRO_ICON } from './quick-recall-knowledge.js';
import { openJournalExportDialog, JOURNAL_EXPORT_MACRO_NAME, JOURNAL_EXPORT_MACRO_ICON } from './journal-to-html-export.js';
import { openFullRestoreDialog, FULL_RESTORE_MACRO_NAME, FULL_RESTORE_MACRO_ICON } from './full-restore.js';
import { resizeToken, QUICK_TOKEN_RESIZER_MACRO_NAME, QUICK_TOKEN_RESIZER_MACRO_ICON } from './quick-token-resizer.js';
import { cleanupCombat, COMBAT_CLEANUP_MACRO_NAME, COMBAT_CLEANUP_MACRO_ICON } from './quick-combat-cleanup.js';
import { applyInitiativeModifier, INITIATIVE_MODIFIER_MACRO_NAME, INITIATIVE_MODIFIER_MACRO_ICON } from './apply-initiative-modifier.js';
import { awardXP, EXPERIENCE_AWARD_MACRO_NAME, EXPERIENCE_AWARD_MACRO_ICON } from './award-xp.js';
import { addStatusEffect, STATUS_EFFECT_MACRO_NAME, STATUS_EFFECT_MACRO_ICON } from './easy-add-conditions.js';
import { addExplorationActivity, EXPLORATION_ACTIVITY_MACRO_NAME, EXPLORATION_ACTIVITY_MACRO_ICON } from './easy-exploration.js';

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
    // Define a global namespace for module functions
    game.pf2eAwedomeMacros = game.pf2eAwedomeMacros || {};

    // Register Global Functions 
    game.pf2eAwedomeMacros.generateEncounter = generateEncounter;
    game.pf2eAwedomeMacros.openRecallKnowledgeDialog = openRecallKnowledgeDialog;
    game.pf2eAwedomeMacros.openJournalExportDialog = openJournalExportDialog;
    game.pf2eAwedomeMacros.openFullRestoreDialog = openFullRestoreDialog;
    game.pf2eAwedomeMacros.resizeToken = resizeToken;
    game.pf2eAwedomeMacros.cleanupCombat = cleanupCombat;
    game.pf2eAwedomeMacros.applyInitiativeModifier = applyInitiativeModifier;
    game.pf2eAwedomeMacros.awardXP = awardXP;
    game.pf2eAwedomeMacros.addStatusEffect = addStatusEffect;

    // Get or Create the Target Folder
    let targetFolderId = null;
    if (game.user.isGM) {
        const folder = await getOrCreateFolder(MACRO_FOLDER_NAME, 'Macro');
        if (folder) {
            targetFolderId = folder.id;
        }
    }

    // Programmatically create the macro buttons 
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

    createMacroDocument(
        JOURNAL_EXPORT_MACRO_NAME,
        JOURNAL_EXPORT_MACRO_ICON,
        `game.pf2eAwedomeMacros.openJournalExportDialog();`,
        targetFolderId
    );

    createMacroDocument(
        FULL_RESTORE_MACRO_NAME,
        FULL_RESTORE_MACRO_ICON,
        `game.pf2eAwedomeMacros.openFullRestoreDialog();`,
        targetFolderId
    );

    createMacroDocument(
        QUICK_TOKEN_RESIZER_MACRO_NAME,
        QUICK_TOKEN_RESIZER_MACRO_ICON,
        `game.pf2eAwedomeMacros.resizeToken();`,
        targetFolderId
    );

    createMacroDocument(
        COMBAT_CLEANUP_MACRO_NAME,
        COMBAT_CLEANUP_MACRO_ICON,
        `game.pf2eAwedomeMacros.cleanupCombat();`,
        targetFolderId
    );

    createMacroDocument(
        INITIATIVE_MODIFIER_MACRO_NAME,
        INITIATIVE_MODIFIER_MACRO_ICON,
        `game.pf2eAwedomeMacros.applyInitiativeModifier();`,
        targetFolderId
    );

    createMacroDocument(
        EXPERIENCE_AWARD_MACRO_NAME,
        EXPERIENCE_AWARD_MACRO_ICON,
        `game.pf2eAwedomeMacros.awardXP();`,
        targetFolderId
    );

    createMacroDocument(
        STATUS_EFFECT_MACRO_NAME,
        STATUS_EFFECT_MACRO_ICON,
        `game.pf2eAwedomeMacros.addStatusEffect();`,
        targetFolderId
    );

    createMacroDocument(
        EXPLORATION_ACTIVITY_MACRO_NAME,
        EXPLORATION_ACTIVITY_MACRO_ICON,
        `game.pf2eAwedomeMacros.addExplorationActivity();`,
        targetFolderId
    );

    console.log('PF2e Awesome Macros | All module logic and macros initialized.');
});