/**
 * PF2e Generate Encounter Loot
 * * Creates a random assortment of level-appropriate loot.
 * * Automatically generates a PF2e Loot Actor to store the items.
 * * Supports strict "Treasure by Encounter" budgets (GM Core) or loose generation.
 */

export const ENCOUNTER_LOOT_MACRO_NAME = "Encounter Loot Generator";
export const ENCOUNTER_LOOT_MACRO_ICON = "icons/containers/bags/sack-symbol-flower-yellow.webp";

// Treasure by Encounter Budget Table (GM Core Table 4-2)
const TREASURE_BUDGET = {
    1: { trivial: 1, low: 3, moderate: 4, severe: 6, extreme: 8 },
    2: { trivial: 2, low: 5, moderate: 7, severe: 11, extreme: 15 },
    3: { trivial: 4, low: 9, moderate: 12, severe: 18, extreme: 25 },
    4: { trivial: 7, low: 14, moderate: 19, severe: 29, extreme: 39 },
    5: { trivial: 10, low: 20, moderate: 27, severe: 40, extreme: 54 },
    6: { trivial: 14, low: 29, moderate: 39, severe: 59, extreme: 78 },
    7: { trivial: 20, low: 41, moderate: 54, severe: 82, extreme: 109 },
    8: { trivial: 28, low: 57, moderate: 76, severe: 114, extreme: 152 },
    9: { trivial: 40, low: 80, moderate: 107, severe: 160, extreme: 214 },
    10: { trivial: 56, low: 112, moderate: 150, severe: 225, extreme: 300 },
    11: { trivial: 80, low: 160, moderate: 210, severe: 315, extreme: 420 },
    12: { trivial: 112, low: 225, moderate: 300, severe: 450, extreme: 600 },
    13: { trivial: 160, low: 320, moderate: 425, severe: 635, extreme: 850 },
    14: { trivial: 225, low: 450, moderate: 600, severe: 900, extreme: 1200 },
    15: { trivial: 320, low: 640, moderate: 850, severe: 1275, extreme: 1700 },
    16: { trivial: 450, low: 900, moderate: 1200, severe: 1800, extreme: 2400 },
    17: { trivial: 650, low: 1300, moderate: 1700, severe: 2550, extreme: 3400 },
    18: { trivial: 900, low: 1800, moderate: 2400, severe: 3600, extreme: 4800 },
    19: { trivial: 1300, low: 2600, moderate: 3400, severe: 5100, extreme: 6800 },
    20: { trivial: 1750, low: 3500, moderate: 4700, severe: 7000, extreme: 9400 }
};

export async function generateEncounterLoot() {
    if (!game.user.isGM) {
        return ui.notifications.warn("Only the GM can generate encounter loot.");
    }

    // 1. Fetch Party Info for Defaults
    let characters = [];
    if (game.actors.party) {
        characters = Array.from(game.actors.party.members);
    } else {
        characters = game.actors.filter(a => a.type === 'character' && (a.system?.details?.alliance === 'party' || a.alliance === 'party'));
        if (characters.length === 0) {
            characters = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
        }
    }

    let defaultApl = 1;
    let defaultPartySize = 4;

    if (characters.length > 0) {
        const levels = characters.map(c => c.system.details.level.value);
        defaultApl = Math.round(levels.reduce((a, b) => a + b, 0) / characters.length);
        defaultPartySize = characters.length;
    }

    // 2. Build the UI Dialog
    const content = `
    <style>
        .loot-gen-container { font-family: "Signika", sans-serif; }
        .loot-gen-container .form-group { margin-bottom: 12px; }
        .loot-gen-container label { font-weight: bold; }
        .loot-gen-container input[type="number"] { height: 32px; text-align: center; border-radius: 4px; border: 1px solid var(--color-border-dark-4); }
        .loot-flex { display: flex; gap: 12px; }
        .loot-flex > div { flex: 1; }
        .loot-threat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
        .loot-threat-grid label { 
            display: flex; 
            align-items: center; 
            justify-content: center;
            background: rgba(0,0,0,0.05); 
            border: 1px solid var(--color-border-light-2); 
            border-radius: 4px; 
            height: 36px;
            cursor: pointer;
            font-weight: normal;
        }
        .loot-threat-grid label:hover { background: rgba(0,0,0,0.1); }
        .loot-threat-grid input { margin-right: 6px; }
        .loot-checkbox-wrapper { display: flex; align-items: center; height: 36px; background: rgba(0,0,0,0.05); padding: 0 10px; border-radius: 4px; border: 1px solid var(--color-border-light-2); }
    </style>
    <div class="loot-gen-container">
        <div class="loot-flex">
            <div class="form-group">
                <label>Party Level:</label>
                <input type="number" id="lootApl" value="${defaultApl}" min="1" max="20" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Party Size:</label>
                <input type="number" id="lootPartySize" value="${defaultPartySize}" min="1" max="10" style="width: 100%;">
            </div>
        </div>

        <div class="form-group">
            <label>Encounter Threat:</label>
            <div class="loot-threat-grid">
                <label><input type="radio" name="lootThreat" value="trivial"> Trivial</label>
                <label><input type="radio" name="lootThreat" value="low"> Low</label>
                <label><input type="radio" name="lootThreat" value="moderate" checked> Moderate</label>
                <label><input type="radio" name="lootThreat" value="severe"> Severe</label>
                <label><input type="radio" name="lootThreat" value="extreme"> Extreme</label>
            </div>
        </div>

        <div class="form-group loot-checkbox-wrapper">
            <input type="checkbox" id="strictRules" checked style="margin-right: 10px; width: 18px; height: 18px;">
            <label for="strictRules" style="cursor: pointer; margin: 0;">Use Strict 'Treasure by Encounter' Budget</label>
        </div>
    </div>
    `;

    new Dialog({
        title: "Encounter Loot Generator",
        content: content,
        buttons: {
            generate: {
                icon: '<i class="fas fa-coins"></i>',
                label: "Generate Loot",
                callback: async (html) => {
                    const apl = parseInt(html.find('#lootApl').val(), 10) || 1;
                    const size = parseInt(html.find('#lootPartySize').val(), 10) || 4;
                    const threat = html.find('input[name="lootThreat"]:checked').val();
                    const isStrict = html.find('#strictRules').is(':checked');

                    ui.notifications.info("Searching compendium for loot...");
                    await processLootGeneration(apl, size, threat, isStrict);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "generate"
    }, { width: 400 }).render(true);
}

async function processLootGeneration(apl, partySize, threat, isStrict) {
    const pack = game.packs.get("pf2e.equipment-srd");
    if (!pack) {
        return ui.notifications.error("Could not find the 'pf2e.equipment-srd' compendium.");
    }

    // 1. Establish the Budget & Parameters
    let budgetGp = 0;
    if (isStrict) {
        const safeApl = Math.max(1, Math.min(20, apl));
        budgetGp = TREASURE_BUDGET[safeApl][threat] || 10;

        // Adjust budget for party size variance (Core rule: adjust proportionally)
        budgetGp = Math.round(budgetGp * partySize);
    }

    // 2. Fetch Compendium Index (Optimized search)
    const index = await pack.getIndex({ fields: ["system.level.value", "system.price.value", "type"] });

    // Filter index for potential items (Level appropriate: APL-1 to APL+1)
    const minLevel = Math.max(0, apl - 1);
    const maxLevel = Math.min(20, apl + 1);

    const validConsumables = index.filter(i => i.type === "consumable" && i.system?.level?.value >= minLevel && i.system?.level?.value <= maxLevel);
    const validPermanents = index.filter(i => ["weapon", "armor", "equipment"].includes(i.type) && i.system?.level?.value >= minLevel && i.system?.level?.value <= maxLevel);

    let itemsToSpawn = [];
    let remainingBudget = budgetGp;
    let selectedItemNames = [];

    // Helper to extract numeric GP value from PF2e item price object
    const getPriceInGp = (itemData) => {
        if (!itemData.system?.price?.value) return 0;
        const priceObj = itemData.system.price.value;
        let totalGp = 0;
        if (priceObj.gp) totalGp += priceObj.gp;
        if (priceObj.sp) totalGp += (priceObj.sp / 10);
        if (priceObj.cp) totalGp += (priceObj.cp / 100);
        return totalGp;
    };

    // 3. Select Items
    if (!isStrict) {
        // LOOSE MODE: Grab 1 random permanent item and 1d4 consumables
        if (validPermanents.length > 0) {
            const pick = validPermanents[Math.floor(Math.random() * validPermanents.length)];
            const doc = await pack.getDocument(pick._id);
            itemsToSpawn.push(doc.toObject());
            selectedItemNames.push(pick.name);
        }

        const consumableCount = Math.floor(Math.random() * 4) + 1; // 1d4
        for (let i = 0; i < consumableCount; i++) {
            if (validConsumables.length > 0) {
                const pick = validConsumables[Math.floor(Math.random() * validConsumables.length)];
                const doc = await pack.getDocument(pick._id);
                itemsToSpawn.push(doc.toObject());
                selectedItemNames.push(pick.name);
            }
        }
    } else {
        // STRICT MODE: Buy items until budget is constrained
        // Shuffle arrays for randomness
        const shuffledConsumables = validConsumables.sort(() => 0.5 - Math.random());
        const shuffledPermanents = validPermanents.sort(() => 0.5 - Math.random());

        // Try to buy 1 permanent item first
        for (const pick of shuffledPermanents) {
            const price = getPriceInGp(pick);
            // Ensure it doesn't eat more than 70% of the total budget so there's room for other things
            if (price > 0 && price <= (remainingBudget * 0.7)) {
                const doc = await pack.getDocument(pick._id);
                itemsToSpawn.push(doc.toObject());
                selectedItemNames.push(pick.name);
                remainingBudget -= price;
                break; // Only 1 permanent
            }
        }

        // Try to buy 2-3 consumables with the rest
        let consumablesBought = 0;
        for (const pick of shuffledConsumables) {
            const price = getPriceInGp(pick);
            if (price > 0 && price <= remainingBudget) {
                const doc = await pack.getDocument(pick._id);
                itemsToSpawn.push(doc.toObject());
                selectedItemNames.push(pick.name);
                remainingBudget -= price;
                consumablesBought++;
                if (consumablesBought >= 3) break;
            }
        }
    }

    // 4. Create the Loot Actor
    // Find or create a specific folder to keep the sidebar clean
    let folder = game.folders.find(f => f.type === "Actor" && f.name === "Encounter Loot");
    if (!folder) {
        folder = await Folder.create({ name: "Encounter Loot", type: "Actor" });
    }

    // Generate a unique incrementing name
    const existingLoot = game.actors.filter(a => a.name.startsWith(`Loot_Lvl${apl}_${threat.capitalize()}`));
    const increment = existingLoot.length + 1;
    const actorName = `Loot_Lvl${apl}_${threat.capitalize()}_${increment}`;

    const lootActor = await Actor.create({
        name: actorName,
        type: "loot",
        folder: folder.id,
        system: {
            lootSheetType: "Loot"
        }
    });

    // 5. Add Items to the Actor
    if (itemsToSpawn.length > 0) {
        await lootActor.createEmbeddedDocuments("Item", itemsToSpawn);
    }

    // 6. Output Summary to Chat
    let chatMessage = `
        <div style="background: #f9f7f4; padding: 10px; border: 2px solid #5d4037; border-radius: 5px; font-family: 'Signika', sans-serif;">
            <h3 style="margin: 0 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px;">
                <i class="fas fa-gem"></i> Encounter Loot Generated
            </h3>
            <p style="margin: 0 0 8px 0;"><strong>Actor Created:</strong> @UUID[Actor.${lootActor.id}]{${actorName}}</p>
            <p style="margin: 0 0 4px 0;"><strong>Items Found:</strong></p>
            <ul style="margin: 0 0 10px 0; padding-left: 20px;">
    `;

    if (selectedItemNames.length > 0) {
        selectedItemNames.forEach(name => {
            chatMessage += `<li>${name}</li>`;
        });
    } else {
        chatMessage += `<li><em>No items selected (Budget too low)</em></li>`;
    }
    chatMessage += `</ul>`;

    if (isStrict) {
        const roundedBudget = Math.round(remainingBudget * 100) / 100; // Round to 2 decimal places for SP/CP
        chatMessage += `
            <hr style="border-top: 1px solid #ddd; margin: 8px 0;">
            <p style="margin: 0; font-size: 0.9em;">
                <strong>Remaining Budget:</strong> <span style="color: #8b5a00; font-weight: bold;">${roundedBudget} gp</span> 
                <br><em>(Distribute this remainder as raw coinage or gems to the party).</em>
            </p>
        `;
    }

    chatMessage += `</div>`;

    await ChatMessage.create({
        user: game.user.id,
        speaker: { alias: "Loot Generator" },
        content: chatMessage,
        whisper: ChatMessage.getWhisperRecipients("GM")
    });

    ui.notifications.info(`Created ${actorName} in the Actors directory!`);
}