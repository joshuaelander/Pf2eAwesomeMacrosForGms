/**
 * PF2e Random Encounter Generator (Logic File)
 * This file contains the core functions for encounter generation.
 * It is called by the main module script and the auto-created macro.
 */

export const RANDOM_ENCOUNTER_MACRO_NAME = "Create Random Encounter";
export const RANDOM_ENCOUNTER_MACRO_ICON = "icons/environment/creatures/golem-stone-purple.webp";

/**
 * Executes the random encounter generation process.
 * This is the function that the auto-created macro will call.
 */
export async function generateEncounter() {
    if (!game.user.isGM) {
        ui.notifications.warn("Sorry, only the GM can generate encounters.");
        return;
    }

    // 1. Validate that the GM is actually viewing a scene
    const targetScene = canvas.scene;
    if (!targetScene) {
        return ui.notifications.error("You must be on a scene to generate an encounter on it.");
    }

    // Get default Party Data to populate the UI fields
    let defaultCharacters = [];
    if (game.actors.party) {
        defaultCharacters = Array.from(game.actors.party.members);
    } else {
        defaultCharacters = game.actors.filter(a => a.type === 'character' && (a.system?.details?.alliance === 'party' || a.alliance === 'party'));
        if (defaultCharacters.length === 0) {
            defaultCharacters = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
        }
    }

    let defaultApl = 1;
    let defaultPartySize = 4;

    if (defaultCharacters.length > 0) {
        const levels = defaultCharacters.map(c => c.system.details.level.value);
        const totalLevels = levels.reduce((a, b) => a + b, 0);
        defaultApl = Math.round(totalLevels / defaultCharacters.length);
        defaultPartySize = defaultCharacters.length;
    }

    // --- Difficulty and Trait Selection Dialog ---
    const xpValues = {
        Trivial: 40,
        Low: 60,
        Moderate: 80,
        Severe: 120,
        Extreme: 160
    };

    const commonTraits = [
        "Aberration", "Animal", "Beast", "Construct", "Dragon",
        "Elemental", "Fey", "Fiend", "Fungus", "Humanoid",
        "Ooze", "Plant", "Spirit", "Undead"
    ];

    const dialogContent = `
        <style>
            .reg-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 0.9em; }
            .reg-grid label { display: flex; align-items: center; gap: 4px; cursor: pointer; white-space: nowrap; }
            .reg-header { font-weight: bold; margin-bottom: 4px; }
            .reg-flex { display: flex; gap: 10px; margin-bottom: 10px; }
            .reg-flex > div { flex: 1; }
            .ui-underline-separator { border-bottom: 1px solid #782e22; margin-bottom: 10px; font-weight: bold; color: #782e22; }
        </style>
        <form>
            <div class="reg-flex">
                <div>
                    <label class="reg-header">Party Size:</label>
                    <input type="number" name="partySize" value="${defaultPartySize}" min="1" max="10" style="width: 100%; text-align: center;">
                </div>
                <div>
                    <label class="reg-header">Party Level:</label>
                    <input type="number" name="apl" value="${defaultApl}" min="1" max="20" style="width: 100%; text-align: center;">
                </div>
            </div>
            <div class="ui-underline-separator"></div>

            <div class="form-group" style="padding: 5px 0;">
                <label class="reg-header">Encounter Difficulty:</label>
                <div class="form-fields" style="display: flex; flex-direction: column; flex-wrap: wrap; gap: 8px; margin-top: 5px; justify-content: space-between;">
                    ${Object.keys(xpValues).map(key => `
                        <label class="radio-label" style="display: flex; align-items: center; cursor: pointer; font-size: 0.9em;">
                            <input type="radio" name="difficulty" value="${key}" ${key === 'Moderate' ? 'checked' : ''} style="margin-right: 4px;">
                            ${key} (${xpValues[key]} XP)
                        </label>
                    `).join('')}
                </div>
                <br/><p style="font-size: 0.8em; color: var(--color-text-dark-secondary); margin-top: 4px; text-align: center;">*XP shown will automatically scale based on the Party Size above.</p>
            </div>
            <div class="ui-underline-separator"></div>
            
            <div class="form-group" style="padding: 5px 0;">
                <label class="reg-header">Creature <br/>Rarities:</label>
                <div style="display: flex; gap: 12px; margin-top: 5px; align-items: center;">
                    <label><input type="checkbox" name="rarity" value="common" checked> Common</label>
                    <label><input type="checkbox" name="rarity" value="uncommon" checked> Uncommon</label>
                    <label><input type="checkbox" name="rarity" value="rare"> Rare</label>
                    <label><input type="checkbox" name="rarity" value="unique"> Unique</label>
                </div>
            </div>
            <div class="ui-underline-separator"></div>

            <div class="form-group" style="padding: 5px 0;">
                <label class="reg-header">Creature Trait(s):</label>
                <div class="reg-grid" style="margin-top: 5px; margin-bottom: 8px;">
                    ${commonTraits.map(trait => `<label><input type="checkbox" name="trait" value="${trait.toLowerCase()}"> ${trait}</label>`).join('')}
                </div>
                <input type="text" name="otherTrait" placeholder="Other Trait (e.g., fire, goblin)..." style="width: 100%;">
            </div>
        </form>
    `;

    // Use a Promise to handle the Dialog resolution asynchronously
    const dialogPromise = new Promise((resolve) => {
        new Dialog({
            title: "Configure Encounter Parameters",
            content: dialogContent,
            buttons: {
                generate: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: "Generate",
                    callback: (html) => {
                        const apl = parseInt(html.find('input[name="apl"]').val(), 10) || 1;
                        const partySize = parseInt(html.find('input[name="partySize"]').val(), 10) || 4;
                        const selectedDifficulty = html.find('input[name="difficulty"]:checked').val();

                        const selectedRarities = html.find('input[name="rarity"]:checked').map(function () { return this.value; }).get();
                        const selectedTraits = html.find('input[name="trait"]:checked').map(function () { return this.value; }).get();

                        const otherTrait = html.find('input[name="otherTrait"]').val().trim().toLowerCase();
                        if (otherTrait) selectedTraits.push(otherTrait);

                        resolve({ apl, partySize, selectedDifficulty, selectedRarities, selectedTraits });
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
        }, { width: 500 }).render(true); // Widened to 500 to fit the difficulty row beautifully
    });

    const result = await dialogPromise;

    if (!result) {
        return;
    }

    const { apl, partySize, selectedDifficulty, selectedRarities, selectedTraits } = result;

    if (selectedRarities.length === 0) {
        return ui.notifications.error("You must select at least one creature rarity to generate an encounter.");
    }

    const baseXp = xpValues[selectedDifficulty];
    let xpBudget = baseXp + (20 * (partySize - 4));
    if (xpBudget < 40) xpBudget = 40;

    ui.notifications.info(`Generating a ${selectedDifficulty} encounter (Budget: ${xpBudget} XP) for APL ${apl}.`);

    // Select Monsters passing arrays
    const monstersToSpawn = await pickMonsters(apl, xpBudget, selectedTraits, selectedRarities);

    if (monstersToSpawn.length === 0) {
        ui.notifications.warn(`Could not find suitable monsters matching APL ${apl} and your filter criteria. Try broadening your search.`);
        return;
    }

    // 3. Prompt GM to click the canvas to set the spawn point
    ui.notifications.info(`Encounter generated! Left-click anywhere on the map to place the monsters.`);

    const clickPos = await new Promise((resolve) => {
        const handler = (event) => {
            // Only trigger on Left-Click (button 0)
            if (event.data.button === 0) {
                canvas.app.stage.off('pointerdown', handler);
                resolve(event.data.getLocalPosition(canvas.app.stage));
            }
        };
        canvas.app.stage.on('pointerdown', handler);
    });

    const clusterX = clickPos.x;
    const clusterY = clickPos.y;

    // --- Start Building GM Summary ---
    const traitDisplay = selectedTraits.length > 0 ? selectedTraits.join(', ') : 'Any';
    const rarityDisplay = selectedRarities.join(', ');

    const summaryHeader = `
        <h4 style="margin: 0; padding-bottom: 5px; border-bottom: 1px solid #ccc;">
            <i class="fas fa-dice-d20"></i> Random Encounter
        </h4>
        <p style="margin: 5px 0 0;"><strong>Scene:</strong> ${targetScene.name}</p>
        <p style="margin: 0;"><strong>Difficulty:</strong> <span style="font-weight: bold; color: #cc0000;">${selectedDifficulty} (${xpBudget} XP)</span></p>
        <p style="margin: 0;"><strong>Party Level:</strong> ${apl}<br/><strong>Party Size:</strong> ${partySize}</p>
        <p style="margin: 0;"><strong>Traits:</strong> ${traitDisplay}<br/><strong>Rarity:</strong> ${rarityDisplay}</p>
    `;

    const monsterList = monstersToSpawn.map(m => {
        const level = m.system?.details?.level?.value ?? "N/A";
        return `<li style="margin-left: -15px;">${m.name} (Level ${level})</li>`;
    }).join('');

    const summaryContent = `
        <div style="font-family: 'Baskerville', serif; background: #f9f7f4; padding: 10px; border: 2px solid #5d4037; border-radius: 5px;">
            ${summaryHeader}
            <p style="margin: 10px 0 5px; font-weight: bold;">Creature(s) Spawned:</p>
            <ul style="list-style-type: circle; margin: 0 0 5px 25px;">${monsterList}</ul>
        </div>
    `;

    // Spawn the selected monsters at the clicked position
    let successfulSpawns = 0;
    for (let i = 0; i < monstersToSpawn.length; i++) {
        const monsterData = monstersToSpawn[i];
        const spawned = await spawnMonster(monsterData, targetScene, clusterX, clusterY, i);
        if (spawned) {
            successfulSpawns++;
        }
    }

    const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);

    await ChatMessage.create({
        user: game.user.id,
        speaker: { alias: "Encounter Generator" },
        content: summaryContent,
        whisper: gmUsers
    });

    ui.notifications.info(`Encounter generated with ${successfulSpawns} creatures!`);
}

/**
 * Filters and selects monsters based on APL, XP budget, and optional traits/rarity.
 * @param {number} apl - Average Party Level.
 * @param {number} budget - XP budget for the encounter.
 * @param {string[]} requiredTraits - Array of requested traits. Empty means any.
 * @param {string[]} requiredRarities - Array of requested rarities.
 * @returns {Promise<Actor[]>} Array of selected monster Actors.
 */
export async function pickMonsters(apl, budget, requiredTraits = [], requiredRarities = []) {
    const packKeys = ['pf2e.pathfinder-monster-core', 'pf2e.pathfinder-monster-core-2', 'pf2e.pathfinder-bestiary', 'pf2e.pathfinder-bestiary-2', 'pf2e.pathfinder-bestiary-3'];
    let candidates = [];

    for (const key of packKeys) {
        const pack = game.packs.get(key);
        if (pack) {
            const index = await pack.getIndex({ fields: ['system.details.level.value', 'type', 'system.traits.value', 'system.traits.rarity'] });

            let valid = index.filter(i =>
                i.type === 'npc' &&
                i.system.details.level.value >= (apl - 3) &&
                i.system.details.level.value <= (apl + 2)
            );

            // Filter by selected rarities
            if (requiredRarities.length > 0) {
                valid = valid.filter(i => {
                    const monsterRarity = i.system.traits?.rarity?.toLowerCase() || 'common';
                    return requiredRarities.includes(monsterRarity);
                });
            }

            // Filter by selected traits (OR logic - monster must have at least one of the selected traits)
            if (requiredTraits.length > 0) {
                valid = valid.filter(i => {
                    const sysTraits = i.system.traits?.value || [];
                    const hasTraitMatch = requiredTraits.some(rt => sysTraits.includes(rt));
                    const hasNameMatch = requiredTraits.some(rt => i.name.toLowerCase().includes(rt));
                    return hasTraitMatch || hasNameMatch;
                });
            }

            candidates = candidates.concat(valid.map(i => ({ ...i, pack: key })));
        }
    }

    if (candidates.length === 0) return [];

    let currentSpent = 0;
    let selected = [];
    let attempts = 0;

    let selectedUniqueActorIds = new Set();
    let selectedTraitsList = []; // Used internally for synergy logic

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

            if (selectedTraitsList.length > 0) {
                const systemTraitsToExclude = new Set(['common', 'uncommon', 'rare', 'unique']);
                const commonTraits = selectedTraitsList.filter((t, i) =>
                    selectedTraitsList.indexOf(t) === i && !systemTraitsToExclude.has(t)
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
                    selectedTraitsList.push(...pick.system.traits.value);
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

    const gridSize = scene.grid.size || 100;
    const tokensPerRow = 5;
    const spacing = 1.5; // Slightly tightened the cluster so they spawn closer together

    const column = spawnIndex % tokensPerRow;
    const row = Math.floor(spawnIndex / tokensPerRow);

    const offsetX = column * spacing * gridSize;
    const offsetY = row * spacing * gridSize;

    let x = anchorX + offsetX;
    let y = anchorY + offsetY;

    if (scene.grid.type !== CONST.GRID_TYPES.NONE) {
        x = gridSize * Math.floor(x / gridSize);
        y = gridSize * Math.floor(y / gridSize);
    }

    x = Math.round(x);
    y = Math.round(y);

    const tokenData = await worldActor.getTokenDocument({
        x: x,
        y: y,
        elevation: 0,
        hidden: true // Tokens are spawned hidden so players don't immediately see them
    });

    await scene.createEmbeddedDocuments("Token", [tokenData.toObject()]);
    return true;
}