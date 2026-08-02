/**
 * PF2e Awesome Macros for GMs (Main Entry Script)
 * This script runs once on the Foundry VTT 'ready' hook.
 * It serves as the module's entry point, handling imports, global registration, 
 * and programmatically syncing macro documents for user convenience.
 */

// --- 1. CONFIGURATION AND IMPORT MACRO LOGIC FILES ---
const MODULE_ID = "pf2e-awesome-macros-for-gms";
const MACRO_FOLDER_NAME = "PF2e Awesome Macros For GMs";
const MACRO_FOLDER_COLOR = "#5549fd"; // Blue color for the macro folder

// Import the core functions and constants for the macros
import { generateEncounter, RANDOM_ENCOUNTER_MACRO_NAME, RANDOM_ENCOUNTER_MACRO_ICON } from './random-encounter-macro.js';
import { openJournalExportDialog, JOURNAL_EXPORT_MACRO_NAME, JOURNAL_EXPORT_MACRO_ICON } from './journal-to-html-export.js';
import { openFullRestoreDialog, FULL_RESTORE_MACRO_NAME, FULL_RESTORE_MACRO_ICON } from './full-restore.js';
import { resizeToken, QUICK_TOKEN_RESIZER_MACRO_NAME, QUICK_TOKEN_RESIZER_MACRO_ICON } from './quick-token-resizer.js';
import { cleanupCombat, COMBAT_CLEANUP_MACRO_NAME, COMBAT_CLEANUP_MACRO_ICON } from './quick-combat-cleanup.js';
import { applyInitiativeModifier, INITIATIVE_MODIFIER_MACRO_NAME, INITIATIVE_MODIFIER_MACRO_ICON } from './apply-initiative-modifier.js';
import { awardXP, EXPERIENCE_AWARD_MACRO_NAME, EXPERIENCE_AWARD_MACRO_ICON } from './award-xp.js';
import { addCondition, CONDITION_MACRO_NAME, CONDITION_MACRO_ICON } from './easy-add-conditions.js';
import { openSecretCheckDialog, QUICK_SECRET_MACRO_NAME, QUICK_SECRET_MACRO_ICON } from './quick-secret-check.js';
import { generateEncounterLoot, ENCOUNTER_LOOT_MACRO_NAME, ENCOUNTER_LOOT_MACRO_ICON } from './encounter-loot-generator.js';
import { updateTokenNameDisplay, TOKEN_NAME_VISIBILITY_MACRO_NAME, TOKEN_NAME_VISIBILITY_MACRO_ICON } from './reveal-to-players.js';

// --- 2. THE DESIRED MACRO STATE ---
// Add any new macros to this array. The Smart Sync will handle the rest!
const DESIRED_MACROS = [
    { name: RANDOM_ENCOUNTER_MACRO_NAME, icon: RANDOM_ENCOUNTER_MACRO_ICON, command: `game.pf2eAwesomeMacros.generateEncounter();` },
    { name: JOURNAL_EXPORT_MACRO_NAME, icon: JOURNAL_EXPORT_MACRO_ICON, command: `game.pf2eAwesomeMacros.openJournalExportDialog();` },
    { name: FULL_RESTORE_MACRO_NAME, icon: FULL_RESTORE_MACRO_ICON, command: `game.pf2eAwesomeMacros.openFullRestoreDialog();` },
    { name: QUICK_TOKEN_RESIZER_MACRO_NAME, icon: QUICK_TOKEN_RESIZER_MACRO_ICON, command: `game.pf2eAwesomeMacros.resizeToken();` },
    { name: COMBAT_CLEANUP_MACRO_NAME, icon: COMBAT_CLEANUP_MACRO_ICON, command: `game.pf2eAwesomeMacros.cleanupCombat();` },
    { name: INITIATIVE_MODIFIER_MACRO_NAME, icon: INITIATIVE_MODIFIER_MACRO_ICON, command: `game.pf2eAwesomeMacros.applyInitiativeModifier();` },
    { name: EXPERIENCE_AWARD_MACRO_NAME, icon: EXPERIENCE_AWARD_MACRO_ICON, command: `game.pf2eAwesomeMacros.awardXP();` },
    { name: CONDITION_MACRO_NAME, icon: CONDITION_MACRO_ICON, command: `game.pf2eAwesomeMacros.addCondition();` },
    { name: QUICK_SECRET_MACRO_NAME, icon: QUICK_SECRET_MACRO_ICON, command: `game.pf2eAwesomeMacros.openSecretCheckDialog();` },
    { name: ENCOUNTER_LOOT_MACRO_NAME, icon: ENCOUNTER_LOOT_MACRO_ICON, command: `game.pf2eAwesomeMacros.generateEncounterLoot();` },
    { name: TOKEN_NAME_VISIBILITY_MACRO_NAME, icon: TOKEN_NAME_VISIBILITY_MACRO_ICON, command: `game.pf2eAwesomeMacros.updateTokenNameDisplay();` }
];


// --- 3. HELPER FUNCTIONS ---

async function getOrCreateFolder(name, type) {
    let folder = game.folders.getName(name);

    if (!folder) {
        try {
            folder = await Folder.create({
                name: name,
                type: type,
                parent: null,
                color: MACRO_FOLDER_COLOR
            });
        } catch (err) {
            console.error(`PF2e Awesome Macros For GMs | Failed to create folder: ${name}`, err);
            return null;
        }
    }
    return folder;
}

/**
 * Compares the existing macros in the world to the DESIRED_MACROS list.
 * Creates missing macros, updates existing ones, and deletes obsolete ones.
 */
async function syncMacros() {
    const folder = await getOrCreateFolder(MACRO_FOLDER_NAME, 'Macro');
    if (!folder) return;

    // Find all macros currently in the world that belong to this module
    const existingMacros = game.macros.filter(m => m.flags?.[MODULE_ID]?.isModuleMacro);
    const desiredNames = DESIRED_MACROS.map(m => m.name);

    // 1. Delete Obsolete Macros (Exists in world, but no longer in DESIRED_MACROS)
    const obsoleteIds = existingMacros.filter(m => !desiredNames.includes(m.name)).map(m => m.id);
    if (obsoleteIds.length > 0) {
        await Macro.deleteDocuments(obsoleteIds);
        console.log(`PF2e Awesome Macros For GMs | Deleted ${obsoleteIds.length} obsolete macros.`);
    }

    // 2. Create or Update Macros
    let createdCount = 0;
    let updatedCount = 0;

    for (const desired of DESIRED_MACROS) {
        const existing = existingMacros.find(m => m.name === desired.name);

        if (existing) {
            // If it exists, ensure the code, icon, and folder are perfectly up to date
            if (existing.command !== desired.command || existing.img !== desired.icon || existing.folder?.id !== folder.id) {
                await existing.update({ command: desired.command, img: desired.icon, folder: folder.id });
                updatedCount++;
            }
        } else {
            // If it doesn't exist, create it from scratch
            const macroData = {
                name: desired.name,
                type: "script",
                img: desired.icon,
                command: desired.command,
                folder: folder.id,
                flags: { [MODULE_ID]: { isModuleMacro: true } }
            };
            await Macro.create(macroData, { renderSheet: false });
            createdCount++;
        }
    }

    if (createdCount > 0 || updatedCount > 0) {
        ui.notifications.info(`[PF2e Awesome Macros] Sync complete! Created: ${createdCount}, Updated: ${updatedCount}.`);
    }
}


// --- 4. HOOKS AND INITIALIZATION ---
Hooks.once('ready', async () => {
    // Define a global namespace for module functions
    game.pf2eAwesomeMacros = game.pf2eAwesomeMacros || {};

    // Register Global Functions 
    game.pf2eAwesomeMacros.generateEncounter = generateEncounter;
    game.pf2eAwesomeMacros.openJournalExportDialog = openJournalExportDialog;
    game.pf2eAwesomeMacros.openFullRestoreDialog = openFullRestoreDialog;
    game.pf2eAwesomeMacros.resizeToken = resizeToken;
    game.pf2eAwesomeMacros.cleanupCombat = cleanupCombat;
    game.pf2eAwesomeMacros.applyInitiativeModifier = applyInitiativeModifier;
    game.pf2eAwesomeMacros.awardXP = awardXP;
    game.pf2eAwesomeMacros.addCondition = addCondition;
    game.pf2eAwesomeMacros.openSecretCheckDialog = openSecretCheckDialog;
    game.pf2eAwesomeMacros.generateEncounterLoot = generateEncounterLoot;
    game.pf2eAwesomeMacros.updateTokenNameDisplay = updateTokenNameDisplay;

    if (game.user.isGM) {
        const currentVersion = game.modules.get(MODULE_ID)?.version || "1.0.0";
        let folder = game.folders.getName(MACRO_FOLDER_NAME);
        const storedVersion = folder ? folder.getFlag(MODULE_ID, "moduleVersion") : null;

        // Run the Smart Sync if the version has changed
        if (currentVersion !== storedVersion) {
            await syncMacros();

            // Re-fetch the folder just in case it was created during the sync
            folder = game.folders.getName(MACRO_FOLDER_NAME);
            if (folder) {
                await folder.setFlag(MODULE_ID, "moduleVersion", currentVersion);
            }
        }
    }
    console.log('PF2e Awesome Macros for GMs | All module logic and macros initialized.');
});