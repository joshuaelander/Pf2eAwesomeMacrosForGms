/**
 * PF2e Random Encounter Generator (Logic File)
 * This file contains the core functions for encounter generation.
 * It is called by the main module script and the auto-created macro.
 */

export const SCENE_FOLDER_NAME = "Random Encounters";
export const RANDOM_ENCOUNTER_MACRO_NAME = "Create Random Encounter";
export const RANDOM_ENCOUNTER_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/random-encounter-icon.png"; // Icon url e.g. "icons/svg/d20.svg" 

/**
 * Gets an existing Scene folder by name, or creates it if it doesn't exist.
 * @returns {Promise<Folder|null>} The Folder document, or null if creation failed.
 */
async function getOrCreateSceneFolder() {
    let folder = game.folders.getName(SCENE_FOLDER_NAME);

    if (!folder) {
        // Create the folder if it doesn't exist
        try {
            folder = await Folder.create({
                name: SCENE_FOLDER_NAME,
                type: 'Scene',
                parent: null, // Create at the top level
                // Optionally, you can set a color for this scene folder too: color: "#006400"
            });
            ui.notifications.info(`[PF2e Generator] Created Scene folder: "${SCENE_FOLDER_NAME}". Please place scenes inside it.`);
        } catch (err) {
            console.error(`PF2e Generator | Failed to create Scene folder: ${SCENE_FOLDER_NAME}`, err);
            ui.notifications.error(`Failed to create Scene folder "${SCENE_FOLDER_NAME}". Check F12 console.`);
            return null;
        }
    }
    return folder;
}

// --- CORE LOGIC WRAPPED IN A GLOBAL FUNCTION ---
/**
 * Executes the random encounter generation process.
 * This is the function that the auto-created macro will call.
 */
export async function generateEncounter() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can generate encounters!");
        return;
    }
    ui.notifications.info("Starting Encounter Generation...");

    // 1. Get Party Data
    const characters = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
    if (characters.length === 0) {
        return ui.notifications.error("No player characters found to scale encounter.");
    }

    const levels = characters.map(c => c.system.details.level.value);
    const totalLevels = levels.reduce((a, b) => a + b, 0);
    const apl = Math.round(totalLevels / characters.length);
    const partySize = characters.length;

    console.log(`PF2e Generator | Party Size: ${partySize}, APL: ${apl}`);

    // --- Difficulty and Trait Selection Dialog ---
    const xpValues = {
        Trivial: 40,
        Low: 60,
        Moderate: 80,
        Severe: 120,
        Extreme: 160
    };

    const dialogContent = `
        <form>
            <div class="form-group" style="padding: 5px 0;">
                <label style="font-weight: bold;">Select Encounter Difficulty for Party of ${partySize} (APL: ${apl}):</label>
                <div class="form-fields" style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                    ${Object.keys(xpValues).map(key => `
                        <label class="radio-label" style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="difficulty" value="${key}" ${key === 'Moderate' ? 'checked' : ''} style="margin-right: 8px;">
                            ${key} (${xpValues[key]} XP Base)
                        </label>
                    `).join('')}
                </div>
            </div>
            <hr>
            
            <!-- Rarity Selection -->
            <div class="form-group" style="padding: 5px 0;">
                <label style="font-weight: bold;">Filter by Monster Rarity:</label>
                <div class="form-fields">
                    <select name="rarity" style="width: 100%;">
                        <option value="any">Any Rarity</option>
                        <option value="common">Common</option>
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="unique">Unique</option>
                    </select>
                </div>
            </div>
            <hr>

            <div class="form-group" style="padding: 5px 0;">
                <label style="font-weight: bold;">Optional: Shared Creature Trait (e.g., Fiend, Swarm, Fire):</label>
                <div class="form-fields">
                    <input type="text" name="trait" placeholder="Leave blank for random selection" style="width: 100%;">
                </div>
            </div>
        </form>
    `;

    // Use a Promise to handle the Dialog resolution asynchronously
    const difficultyPromise = new Promise((resolve) => {
        new Dialog({
            title: "Select Encounter Parameters",
            content: dialogContent,
            buttons: {
                generate: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Generate",
                    callback: (html) => {
                        const selectedDifficulty = html.find('input[name="difficulty"]:checked').val();
                        const selectedTrait = html.find('input[name="trait"]').val().trim();
                        const selectedRarity = html.find('select[name="rarity"]').val();
                        resolve({ selectedDifficulty, selectedTrait, selectedRarity });
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () => resolve(null)
                }
            },
            default: "generate",
            close: () => resolve(null)
        }, { width: 350 }).render(true);
    });

    const result = await difficultyPromise;

    if (!result) {
        ui.notifications.info("Encounter generation cancelled.");
        return;
    }

    const { selectedDifficulty, selectedTrait, selectedRarity } = result;

    const baseXp = xpValues[selectedDifficulty];

    // Adjustment: 20xp per character variance from 4-person party
    let xpBudget = baseXp + (20 * (partySize - 4));

    // Safety cap: Ensure budget is at least Trivial XP for a 4-person party (40 XP)
    if (xpBudget < 40) xpBudget = 40;

    ui.notifications.info(`Generating a ${selectedDifficulty} encounter (Budget: ${xpBudget} XP). Theme: ${selectedTrait || 'Random'}. Rarity: ${selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)}.`);
    // --- END: Difficulty and Trait Selection Dialog ---


    // 2. Get Random Scene
    const sceneFolder = await getOrCreateSceneFolder();
    if (!sceneFolder) {
        return ui.notifications.error(`Folder "${SCENE_FOLDER_NAME}" not found in Scenes directory.`);
    }

    const scenes = sceneFolder.contents;
    if (scenes.length === 0) {
        return ui.notifications.error(`No scenes found in folder "${SCENE_FOLDER_NAME}".`);
    }

    const targetScene = scenes[Math.floor(Math.random() * scenes.length)];

    // 3. Select Monsters - PASSING THE SELECTED TRAIT AND RARITY
    const monstersToSpawn = await pickMonsters(apl, xpBudget, selectedTrait, selectedRarity);

    if (monstersToSpawn.length === 0) {
        let filterDetails = selectedTrait ? `trait "${selectedTrait}"` : "";
        filterDetails += selectedRarity !== "any" ? (filterDetails ? " and " : "") + `rarity "${selectedRarity}"` : "";

        ui.notifications.warn(`Could not find suitable monsters matching level and ${filterDetails || "filter criteria"}. Try broadening your search.`);
        return;
    }

    // 4. Activate Scene and calculate cluster anchor
    await targetScene.view();

    // Calculate the raw center point for the monster spawn
    const clusterX = Math.floor(targetScene.dimensions.width / 2);
    const clusterY = Math.floor(targetScene.dimensions.height / 2);


    // --- Start Building GM Summary ---
    const summaryHeader = `
        <h3 style="margin: 0; padding-bottom: 5px; border-bottom: 1px solid #ccc;">
            <i class="fas fa-dice-d20"></i> Random Encounter Report
        </h3>
        <p style="margin: 5px 0 0;"><strong>Scene:</strong> ${targetScene.name}</p>
        <p style="margin: 0;"><strong>Difficulty:</strong> <span style="font-weight: bold; color: #cc0000;">${selectedDifficulty} (${xpBudget} XP)</span></p>
        <p style="margin: 0;"><strong>APL:</strong> ${apl}, <strong>Party Size:</strong> ${partySize}</p>
    `;

    const monsterList = monstersToSpawn.map(m => {
        const level = m.system?.details?.level?.value ?? "N/A";
        return `<li style="margin-left: -15px;">${m.name} (Level ${level})</li>`;
    }).join('');

    const summaryContent = `
        <div style="font-family: 'Baskerville', serif; background: #f9f7f4; padding: 10px; border: 2px solid #5d4037; border-radius: 5px;">
            ${summaryHeader}
            <p style="margin: 10px 0 5px; font-weight: bold;">Creatures Spawned:</p>
            <ul style="list-style-type: circle; margin: 0 0 5px 25px;">${monsterList}</ul>
            <p style="font-size: 0.85em; color: #777; margin: 0;">Tokens are spawned at the map center for GM placement.</p>
        </div>
    `;
    // --- End Building GM Summary ---


    // Wait for view transition
    setTimeout(async () => {
        let successfulSpawns = 0;
        // Iterate with index 'i' to determine placement offset
        for (let i = 0; i < monstersToSpawn.length; i++) {
            const monsterData = monstersToSpawn[i];
            const spawned = await spawnMonster(monsterData, targetScene, clusterX, clusterY, i);
            if (spawned) {
                successfulSpawns++;
            }
        }

        // 5. Send GM-only chat message
        const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);

        await ChatMessage.create({
            user: game.user.id,
            speaker: { alias: "Encounter Generator" }, // Use alias for a cleaner look
            content: summaryContent,
            whisper: gmUsers,
            flavor: "GM-Only Encounter Report"
        });

        ui.notifications.info(`Encounter generated with ${successfulSpawns} creatures!`);
    }, 1000); // Increased delay
}

/**
 * Filters and selects monsters based on APL, XP budget, and optional traits/rarity.
 * @param {number} apl - Average Party Level.
 * @param {number} budget - XP budget for the encounter.
 * @param {string} requiredTrait - Optional required trait string.
 * @param {string} requiredRarity - Optional required rarity string ('any', 'common', etc.).
 * @returns {Promise<Actor[]>} Array of selected monster Actors.
 */
export async function pickMonsters(apl, budget, requiredTrait = "", requiredRarity = "any") {
    const packKeys = ['pf2e.pathfinder-monster-core', 'pf2e.pathfinder-bestiary'];
    let candidates = [];
    const traitLower = requiredTrait.toLowerCase();
    const rarityLower = requiredRarity.toLowerCase();

    for (const key of packKeys) {
        const pack = game.packs.get(key);
        if (pack) {
            const index = await pack.getIndex({ fields: ['system.details.level.value', 'type', 'system.traits.value', 'system.traits.rarity'] });

            let valid = index.filter(i =>
                i.type === 'npc' &&
                i.system.details.level.value >= (apl - 3) &&
                i.system.details.level.value <= (apl + 2)
            );

            if (rarityLower !== "any") {
                valid = valid.filter(i => {
                    const monsterRarity = i.system.traits?.rarity?.toLowerCase() || 'common';
                    return monsterRarity === rarityLower;
                });
            }

            if (traitLower) {
                valid = valid.filter(i => i.system.traits?.value?.includes(traitLower));

                if (valid.length === 0) {
                    valid = index.filter(i =>
                        i.type === 'npc' &&
                        i.system.details.level.value >= (apl - 3) &&
                        i.system.details.level.value <= (apl + 2) &&
                        i.name.toLowerCase().includes(traitLower)
                    );
                }
            }

            candidates = candidates.concat(valid.map(i => ({ ...i, pack: key })));
        }
    }

    if (candidates.length === 0) return [];

    let currentSpent = 0;
    let selected = [];
    let attempts = 0;

    let selectedUniqueActorIds = new Set();
    let selectedTraits = [];

    while (currentSpent < budget && attempts < 100) {
        attempts++;
        let pick = null;

        // Strategy 1 (Consistency): 70% chance to reuse an already selected monster type
        if (selectedUniqueActorIds.size > 0 && Math.random() < 0.7) {
            const reusableIds = Array.from(selectedUniqueActorIds);
            const reusableId = reusableIds[Math.floor(Math.random() * reusableIds.length)];
            pick = candidates.find(c => c._id === reusableId);
        }

        // Strategy 2 (Synergy/New Monster): 30% chance or fallback
        if (!pick) {
            let candidateList = candidates;

            if (selectedTraits.length > 0) {
                const systemTraitsToExclude = new Set(['common', 'uncommon', 'rare', 'unique']);
                const commonTraits = selectedTraits.filter((t, i) =>
                    selectedTraits.indexOf(t) === i && !systemTraitsToExclude.has(t)
                );

                const synergisticCandidates = candidates.filter(c =>
                    c.system.traits?.value?.some(t => commonTraits.includes(t))
                );

                if (synergisticCandidates.length > 0 && Math.random() < 0.6) {
                    candidateList = synergisticCandidates;
                }
            }

            pick = candidateList[Math.floor(Math.random() * candidateList.length)];
        }

        if (!pick) continue;

        const level = pick.system.details.level.value;
        const diff = level - apl;

        let cost = 0;
        if (diff === -4) cost = 10;
        else if (diff === -3) cost = 15;
        else if (diff === -2) cost = 20;
        else if (diff === -1) cost = 30;
        else if (diff === 0) cost = 40;
        else if (diff === 1) cost = 60;
        else if (diff === 2) cost = 80;
        else continue;

        if (currentSpent + cost <= budget + 10) {
            const actor = await game.packs.get(pick.pack).getDocument(pick._id);
            if (actor) {
                selected.push(actor);
                currentSpent += cost;
                selectedUniqueActorIds.add(pick._id);

                if (pick.system.traits?.value) {
                    selectedTraits.push(...pick.system.traits.value);
                }
            }
        }
    }
    return selected;
}

/**
 * Spawns a monster token on the target scene.
 * @param {Actor} compendiumActor - The monster Actor document.
 * @param {Scene} scene - The scene to spawn on.
 * @param {number} anchorX - X coordinate base for spawning.
 * @param {number} anchorY - Y coordinate base for spawning.
 * @param {number} spawnIndex - Index to calculate offset.
 * @returns {Promise<boolean>} True if spawned successfully.
 */
export async function spawnMonster(compendiumActor, scene, anchorX, anchorY, spawnIndex) {
    let worldActor = game.actors.find(a => a.sourceId === compendiumActor.uuid);

    if (!worldActor) {
        try {
            worldActor = await Actor.create(compendiumActor.toObject(), { renderSheet: false });
        } catch (error) {
            console.error(`PF2e Generator | CRITICAL ERROR: Failed to import actor ${compendiumActor.name}.`, error);
            ui.notifications.error(`Failed to import actor ${compendiumActor.name}. Check F12 console for details.`);
            return false;
        }
    }

    if (!worldActor) {
        console.error(`PF2e Generator | World actor is undefined after import attempt for: ${compendiumActor.name}`);
        return false;
    }

    const gridSize = scene.grid.size;
    const tokensPerRow = 5;
    const spacing = 2;

    const column = spawnIndex % tokensPerRow;
    const row = Math.floor(spawnIndex / tokensPerRow);

    const offsetX = column * spacing * gridSize;
    const offsetY = row * spacing * gridSize;

    let x = anchorX + offsetX;
    let y = anchorY + offsetY;

    if (scene.grid.type !== CONST.GRID_TYPES.NONE) {
        x = scene.grid.w * Math.floor(x / scene.grid.w);
        y = scene.grid.h * Math.floor(y / scene.grid.h);
    }

    x = Math.round(x);
    y = Math.round(y);

    const tokenData = await worldActor.getTokenDocument({
        x: x,
        y: y,
        elevation: 0,
        hidden: true // Tokens are spawned hidden
    });

    await scene.createEmbeddedDocuments("Token", [tokenData]);
    return true;
}