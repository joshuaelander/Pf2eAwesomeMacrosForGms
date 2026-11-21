/**
 * PF2e NPC / Monster Level Scaler (Foundry VTT v14)
 * Scales any PF2e NPC or monster up or down to a target level (-1 to 24)
 * using PF2e GM Core Building Creatures delta curves:
 * - AC, Max/Current HP, Saves (Fort/Ref/Will), Perception
 * - Melee & Ranged Strike attack bonuses & damage dice/flat bonuses
 * - Special ability save DCs & damage in action/attack descriptions
 * - Skills, Lores, Resistances, Weaknesses
 * - Spellcaster DC, Spell Attack, higher-rank spell slots, and matching spells from pf2e.spells-srd
 * - Saves original statblock snapshot in flags for 1-click Restore Original
 * - Adds a "Scale Level" button directly to the PF2e NPC sheet header bar
 */

export const NPC_LEVEL_SCALER_MACRO_NAME = "Scale NPC Level";
export const NPC_LEVEL_SCALER_MACRO_ICON = "icons/svg/upgrade.svg";

const MODULE_ID = "pf2e-awesome-macros-for-gms";
const STYLESHEET_HREF = `modules/${MODULE_ID}/styles/npc-level-scaler.css`;
const SNAPSHOT_FLAG = "npcScalerOriginal";
const PREFS_STORAGE_KEY = "pf2e-awesome-macros.npcScalerPrefs";

// Official PF2e GM Core Building Creatures Moderate Benchmark Curves (-1 to 24)
const AC_TABLE = {
    "-1": 14, 0: 15, 1: 15, 2: 17, 3: 18, 4: 20, 5: 21, 6: 23, 7: 24, 8: 26,
    9: 27, 10: 29, 11: 30, 12: 32, 13: 33, 14: 35, 15: 36, 16: 38, 17: 39,
    18: 41, 19: 42, 20: 44, 21: 45, 22: 47, 23: 48, 24: 50
};

const SAVE_TABLE = {
    "-1": 5, 0: 6, 1: 7, 2: 8, 3: 9, 4: 11, 5: 12, 6: 14, 7: 15, 8: 16,
    9: 18, 10: 19, 11: 21, 12: 22, 13: 23, 14: 25, 15: 26, 16: 28, 17: 29,
    18: 30, 19: 32, 20: 33, 21: 35, 22: 36, 23: 37, 24: 39
};

const ATTACK_TABLE = {
    "-1": 6, 0: 6, 1: 7, 2: 9, 3: 10, 4: 12, 5: 13, 6: 15, 7: 16, 8: 18,
    9: 19, 10: 21, 11: 22, 12: 24, 13: 25, 14: 27, 15: 28, 16: 30, 17: 31,
    18: 33, 19: 34, 20: 36, 21: 37, 22: 39, 23: 40, 24: 42
};

const DC_TABLE = {
    "-1": 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22, 7: 23, 8: 24,
    9: 26, 10: 27, 11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35, 17: 36,
    18: 38, 19: 39, 20: 40, 21: 42, 22: 44, 23: 46, 24: 48
};

const HP_TABLE = {
    "-1": 8, 0: 15, 1: 20, 2: 30, 3: 45, 4: 60, 5: 75, 6: 95, 7: 115, 8: 135,
    9: 155, 10: 175, 11: 195, 12: 215, 13: 235, 14: 255, 15: 275, 16: 295,
    17: 315, 18: 335, 19: 355, 20: 375, 21: 400, 22: 430, 23: 460, 24: 500
};

const STRIKE_DMG_TABLE = {
    "-1": 3, 0: 4, 1: 5, 2: 8, 3: 10, 4: 12, 5: 14, 6: 16, 7: 18, 8: 20,
    9: 22, 10: 24, 11: 26, 12: 28, 13: 30, 14: 32, 15: 34, 16: 36, 17: 38,
    18: 40, 19: 42, 20: 44, 21: 46, 22: 48, 23: 50, 24: 53
};

const RESISTANCE_TABLE = {
    "-1": 1, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 8,
    9: 9, 10: 10, 11: 10, 12: 11, 13: 12, 14: 13, 15: 13, 16: 14, 17: 15,
    18: 16, 19: 16, 20: 17, 21: 18, 22: 19, 23: 19, 24: 20
};

let hooksRegistered = false;
let activeDialog = null;
let spellIndexCache = null;

/**
 * Escapes HTML special characters.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * Clamps a level to PF2e's standard NPC range (-1 to 24).
 * @param {*} level
 * @returns {number}
 */
function clampLevel(level) {
    const num = Math.round(Number(level));
    if (!Number.isFinite(num)) return 0;
    return Math.max(-1, Math.min(24, num));
}

/**
 * Ensures the dialog stylesheet is attached to document.head.
 */
function ensureStylesheetLoaded() {
    if (typeof document === "undefined" || !document.head) return;
    if (document.head.querySelector(`link[href*="${STYLESHEET_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET_HREF;
    document.head.appendChild(link);
}

/**
 * Loads persisted scaler options from localStorage.
 * @returns {object}
 */
function loadPreferences() {
    const defaults = {
        scaleSkills: true,
        scaleAbilityDCs: true,
        scaleDefenses: true,
        scaleSpells: true,
        addHigherSpells: true,
        cloneActor: false,
        postSummary: true
    };
    try {
        const raw = globalThis.localStorage?.getItem(PREFS_STORAGE_KEY);
        if (!raw) return defaults;
        return { ...defaults, ...JSON.parse(raw) };
    } catch {
        return defaults;
    }
}

/**
 * Saves scaler options to localStorage.
 * @param {object} prefs
 */
function savePreferences(prefs) {
    try {
        globalThis.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore storage errors
    }
}

// --- SCALING MATH HELPERS ---

/**
 * Computes scaled Max HP preserving the creature's Low/Moderate/High/Extreme HP profile.
 * @param {number} oldMaxHp
 * @param {number} oldLevel
 * @param {number} newLevel
 * @returns {number}
 */
function computeScaledHp(oldMaxHp, oldLevel, newLevel) {
    const baseOld = HP_TABLE[clampLevel(oldLevel)] || 20;
    const baseNew = HP_TABLE[clampLevel(newLevel)] || 20;
    const rawRatio = oldMaxHp > 0 ? oldMaxHp / baseOld : 1;
    const clampedRatio = Math.max(0.5, Math.min(1.5, rawRatio));
    return Math.max(1, Math.round(baseNew * clampedRatio));
}

/**
 * Computes scaling deltas between two PF2e creature levels.
 * @param {number} oldLevel
 * @param {number} newLevel
 */
function computeLevelDeltas(oldLevel, newLevel) {
    const from = clampLevel(oldLevel);
    const to = clampLevel(newLevel);
    return {
        from,
        to,
        levelDelta: to - from,
        acDelta: AC_TABLE[to] - AC_TABLE[from],
        saveDelta: SAVE_TABLE[to] - SAVE_TABLE[from],
        attackDelta: ATTACK_TABLE[to] - ATTACK_TABLE[from],
        dcDelta: DC_TABLE[to] - DC_TABLE[from],
        dmgRatio: STRIKE_DMG_TABLE[to] / STRIKE_DMG_TABLE[from],
        resRatio: RESISTANCE_TABLE[to] / RESISTANCE_TABLE[from]
    };
}

/**
 * Scales a dice/flat damage expression (e.g. "1d8+4", "2d6", "1d10-1") proportionally to the new level.
 * Preserves die faces (d4/d6/d8/d10/d12) while stepping dice count and flat bonus to match PF2e progression.
 * @param {string} rawFormula
 * @param {number} oldLevel
 * @param {number} newLevel
 * @param {boolean} isPrimaryStrike
 * @returns {string}
 */
function scaleDamageFormula(rawFormula, oldLevel, newLevel, isPrimaryStrike = false) {
    const formula = String(rawFormula || "").trim();
    if (!formula) return formula;

    const from = clampLevel(oldLevel);
    const to = clampLevel(newLevel);
    if (from === to) return formula;

    const baseOldDmg = STRIKE_DMG_TABLE[from] || 5;
    const baseNewDmg = STRIKE_DMG_TABLE[to] || 5;

    // Match single dice expression: XdY (+|- Z)
    const diceMatch = formula.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
    if (diceMatch) {
        const oldDice = Number(diceMatch[1]);
        const faces = Number(diceMatch[2]);
        const sign = diceMatch[3] === "-" ? -1 : 1;
        const oldFlat = diceMatch[4] ? sign * Number(diceMatch[4]) : 0;
        const dieAvg = (faces + 1) / 2;
        const oldAvg = Math.max(1, oldDice * dieAvg + oldFlat);

        let ratio = oldAvg / baseOldDmg;
        if (isPrimaryStrike) {
            ratio = Math.max(0.5, Math.min(1.5, ratio));
        }
        const targetAvg = Math.max(1, baseNewDmg * ratio);

        // If the original roll had no flat bonus (e.g., rider 1d6 fire), prefer pure dice scaling
        if (!diceMatch[4] && oldFlat === 0) {
            const nextDice = Math.max(1, Math.min(12, Math.round(targetAvg / dieAvg)));
            return `${nextDice}d${faces}`;
        }

        // Standard strike: target ~55% of damage from dice, remainder from flat bonus
        const maxSuggestedDice = to <= 3 ? 2 : to <= 10 ? 3 : to <= 16 ? 4 : 5;
        let nextDice = Math.max(1, Math.min(maxSuggestedDice, Math.round((targetAvg * 0.55) / dieAvg)));
        let nextFlat = Math.round(targetAvg - nextDice * dieAvg);

        // Keep flat bonus reasonable relative to dice
        if (nextFlat < 0 && nextDice > 1) {
            nextDice = Math.max(1, nextDice - 1);
            nextFlat = Math.round(targetAvg - nextDice * dieAvg);
        }

        if (nextFlat > 0) return `${nextDice}d${faces}+${nextFlat}`;
        if (nextFlat < 0) return `${nextDice}d${faces}${nextFlat}`;
        return `${nextDice}d${faces}`;
    }

    // Plain integer constant (e.g. "4" splash/flat damage)
    if (/^\d+$/.test(formula)) {
        const oldVal = Number(formula);
        const nextVal = Math.max(1, Math.round(oldVal * (baseNewDmg / baseOldDmg)));
        return String(nextVal);
    }

    return formula;
}

/**
 * Scales @Check DCs, plain "DC XX" (excluding flat checks), and @Damage dice inside an item description.
 * @param {string} html
 * @param {number} oldLevel
 * @param {number} newLevel
 * @param {number} dcDelta
 * @returns {string}
 */
function scaleDescriptionText(html, oldLevel, newLevel, dcDelta) {
    if (!html || typeof html !== "string") return html;
    let out = html;

    // 1. Scale dc:NN inside @Check[...] tags (skip flat checks)
    if (dcDelta !== 0) {
        out = out.replace(/@Check\[([^\]]+)\]/gi, (full, inner) => {
            if (/\bflat\b/i.test(inner)) return full;
            const updated = inner.replace(/\bdc\s*:\s*(\d+)/i, (_m, num) => {
                const nextDc = Math.max(10, Number(num) + dcDelta);
                return `dc:${nextDc}`;
            });
            return `@Check[${updated}]`;
        });

        // 2. Scale plain-text "DC NN" references (skip flat checks like "DC 15 flat" or "DC 11 flat check")
        out = out.replace(/\bDC\s+(\d+)(?!\s+flat\b)/gi, (full, num, offset, str) => {
            const before = str.slice(Math.max(0, offset - 20), offset);
            if (/\bflat\s+check\s*$/i.test(before)) return full;
            const nextDc = Math.max(10, Number(num) + dcDelta);
            return `DC ${nextDc}`;
        });
    }

    // 3. Scale dice formulas inside @Damage[...] tags
    out = out.replace(/@Damage\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_full, inner) => {
        const updatedInner = inner.replace(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/gi, (expr) =>
            scaleDamageFormula(expr, oldLevel, newLevel, false)
        );
        return `@Damage[${updatedInner}]`;
    });

    return out;
}

// --- SPELLCASTING SCALING & HIGHER-RANK SPELL POPULATION ---

/**
 * Loads and caches the core PF2e spells-srd compendium index.
 * @returns {Promise<Array>}
 */
async function getSpellSrdIndex() {
    if (spellIndexCache) return spellIndexCache;
    const pack = game.packs.get("pf2e.spells-srd");
    if (!pack) return [];
    try {
        spellIndexCache = await pack.getIndex({
            fields: [
                "type",
                "system.level.value",
                "system.traits.traditions",
                "system.traits.rarity",
                "system.traits.value"
            ]
        });
    } catch (err) {
        console.warn("NPC Level Scaler | Could not index pf2e.spells-srd:", err);
        spellIndexCache = [];
    }
    return spellIndexCache;
}

/**
 * Scales spellcasting entries (DC, attack bonus, slots) and optionally adds matching-tradition
 * spells from pf2e.spells-srd for newly unlocked spell ranks.
 * @param {Actor} actor
 * @param {number} oldLevel
 * @param {number} newLevel
 * @param {object} deltas
 * @param {boolean} addHigherSpells
 * @returns {Promise<string[]>} Human-readable summary of spell changes
 */
async function scaleActorSpellcasting(actor, oldLevel, newLevel, deltas, addHigherSpells) {
    const entries = actor.items.filter((i) => i.type === "spellcastingEntry");
    if (entries.length === 0) return [];

    const notes = [];
    const oldRankCap = Math.max(1, Math.min(10, Math.ceil(Math.max(1, oldLevel) / 2)));
    const newRankCap = Math.max(1, Math.min(10, Math.ceil(Math.max(1, newLevel) / 2)));
    const rankIncrease = Math.max(0, newRankCap - oldRankCap);

    const spellPack = addHigherSpells && rankIncrease > 0 ? game.packs.get("pf2e.spells-srd") : null;
    const spellIndex = spellPack ? await getSpellSrdIndex() : [];
    const existingSpellNames = new Set(
        actor.items.filter((i) => i.type === "spell").map((s) => String(s.name || "").toLowerCase())
    );

    for (const entry of entries) {
        const entrySrc = entry._source?.system ?? entry.system;
        const entryUpdates = {};
        const oldDc = Number(entrySrc?.spelldc?.dc);
        const oldAtk = Number(entrySrc?.spelldc?.value);

        if (Number.isFinite(oldDc)) {
            entryUpdates["system.spelldc.dc"] = Math.max(10, oldDc + deltas.dcDelta);
        }
        if (Number.isFinite(oldAtk)) {
            entryUpdates["system.spelldc.value"] = oldAtk + deltas.attackDelta;
        }

        const prepType = String(entry.system?.prepared?.value || "").toLowerCase();
        const isSlottedCaster = prepType === "prepared" || prepType === "spontaneous";
        const tradition = String(entry.system?.tradition?.value || "").toLowerCase();

        // Find highest active spell rank currently configured on this entry
        const slotsObj = entry.system?.slots ?? {};
        let currentHighestRank = 0;
        for (let r = 1; r <= 10; r++) {
            const slotData = slotsObj[`slot${r}`];
            if (Number(slotData?.max || 0) > 0) {
                currentHighestRank = r;
            }
        }

        const newlyAddedSpells = [];

        if (addHigherSpells && isSlottedCaster && rankIncrease > 0 && currentHighestRank > 0) {
            const targetHighestRank = Math.min(10, currentHighestRank + rankIncrease);

            // Top up previous highest rank to 3 slots if it was only 1-2
            const prevTopKey = `slot${currentHighestRank}`;
            const prevTopMax = Number(slotsObj[prevTopKey]?.max || 0);
            if (prevTopMax > 0 && prevTopMax < 3 && targetHighestRank > currentHighestRank) {
                entryUpdates[`system.slots.${prevTopKey}.max`] = 3;
                entryUpdates[`system.slots.${prevTopKey}.value`] = 3;
            }

            // Unlock new spell ranks and populate matching spells
            for (let rank = currentHighestRank + 1; rank <= targetHighestRank; rank++) {
                const slotCount = rank === targetHighestRank ? 2 : 3;
                const slotKey = `slot${rank}`;
                entryUpdates[`system.slots.${slotKey}.max`] = slotCount;
                entryUpdates[`system.slots.${slotKey}.value`] = slotCount;

                if (spellPack && spellIndex.length > 0) {
                    const candidates = spellIndex.filter((s) => {
                        if (s.type !== "spell") return false;
                        if (Number(s.system?.level?.value) !== rank) return false;
                        const rarity = String(s.system?.traits?.rarity || "common").toLowerCase();
                        if (rarity !== "common") return false;
                        const traits = (s.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());
                        if (traits.includes("cantrip") || traits.includes("focus") || traits.includes("ritual")) return false;
                        const traditions = (s.system?.traits?.traditions ?? []).map((t) => String(t).toLowerCase());
                        if (tradition && traditions.length > 0 && !traditions.includes(tradition)) return false;
                        if (existingSpellNames.has(String(s.name || "").toLowerCase())) return false;
                        return true;
                    });

                    // Pick unique spells for this rank
                    const pool = [...candidates];
                    const chosenDocs = [];
                    for (let k = 0; k < slotCount && pool.length > 0; k++) {
                        const idx = Math.floor(Math.random() * pool.length);
                        const pick = pool.splice(idx, 1)[0];
                        const doc = await spellPack.getDocument(pick._id);
                        if (doc) {
                            existingSpellNames.add(doc.name.toLowerCase());
                            chosenDocs.push(doc);
                        }
                    }

                    if (chosenDocs.length > 0) {
                        const spellPayloads = chosenDocs.map((doc) => {
                            const data = doc.toObject();
                            delete data._id;
                            data.system = data.system || {};
                            data.system.location = data.system.location || {};
                            data.system.location.value = entry.id;
                            return data;
                        });

                        const createdSpells = await actor.createEmbeddedDocuments("Item", spellPayloads);

                        // For prepared casters, pre-slot the new spells into the new rank slots
                        if (prepType === "prepared" && createdSpells.length > 0) {
                            const preparedMap = {};
                            createdSpells.forEach((sp, idx) => {
                                preparedMap[String(idx)] = { id: sp.id, expended: false };
                            });
                            entryUpdates[`system.slots.${slotKey}.prepared`] = preparedMap;
                        }

                        newlyAddedSpells.push(
                            `Rank ${rank}: ${createdSpells.map((s) => s.name).join(", ")}`
                        );
                    }
                }
            }
        }

        if (Object.keys(entryUpdates).length > 0) {
            await entry.update(entryUpdates);
        }

        const dcNote = Number.isFinite(oldDc) ? `DC ${oldDc}→${Math.max(10, oldDc + deltas.dcDelta)}` : "";
        const atkNote = Number.isFinite(oldAtk) ? `Atk +${oldAtk}→+${oldAtk + deltas.attackDelta}` : "";
        const extraNote = newlyAddedSpells.length > 0 ? ` (${newlyAddedSpells.join("; ")})` : "";
        notes.push(`${entry.name}: ${[dcNote, atkNote].filter(Boolean).join(", ")}${extraNote}`);
    }

    return notes;
}

// --- SNAPSHOT & RESTORE ---

/**
 * Captures the NPC's original unmodified statblock into a module flag on first scale.
 * @param {Actor} actor
 */
async function ensureOriginalSnapshot(actor) {
    if (actor.getFlag(MODULE_ID, SNAPSHOT_FLAG)) return;

    const raw = actor.toObject();
    const snapshot = {
        originalLevel: Number(raw.system?.details?.level?.value ?? 0),
        name: raw.name,
        system: foundry.utils.deepClone(raw.system),
        items: foundry.utils.deepClone(raw.items)
    };
    await actor.setFlag(MODULE_ID, SNAPSHOT_FLAG, snapshot);
}

/**
 * Restores a scaled NPC back to its original pre-scaling statblock.
 * @param {Actor} actor
 * @returns {Promise<boolean>}
 */
async function restoreOriginalNpc(actor) {
    const snapshot = actor.getFlag(MODULE_ID, SNAPSHOT_FLAG);
    if (!snapshot) {
        ui.notifications.warn(`${actor.name} has no saved original snapshot to restore.`);
        return false;
    }

    // Delete current embedded items and re-create original items cleanly
    const currentItemIds = actor.items.map((i) => i.id);
    if (currentItemIds.length > 0) {
        await actor.deleteEmbeddedDocuments("Item", currentItemIds);
    }

    await actor.update({
        name: snapshot.name,
        system: foundry.utils.deepClone(snapshot.system),
        [`flags.${MODULE_ID}.-=${SNAPSHOT_FLAG}`]: null
    });

    if (Array.isArray(snapshot.items) && snapshot.items.length > 0) {
        await actor.createEmbeddedDocuments("Item", foundry.utils.deepClone(snapshot.items), { keepId: true });
    }

    ui.notifications.info(`Restored ${snapshot.name} to original Level ${snapshot.originalLevel}.`);
    return true;
}

// --- CORE SCALING EXECUTION ---

/**
 * Scales a single PF2e NPC actor to targetLevel with the chosen options.
 * @param {Actor} sourceActor
 * @param {number} targetLevel
 * @param {object} options
 * @returns {Promise<Actor|null>}
 */
async function scaleNpcActor(sourceActor, targetLevel, options) {
    if (!sourceActor || sourceActor.type !== "npc") {
        ui.notifications.warn("Only PF2e NPC / Monster actors can be scaled.");
        return null;
    }

    let actor = sourceActor;
    const baseSrc = actor._source?.system ?? actor.system;
    const oldLevel = Number(baseSrc?.details?.level?.value ?? 0);
    const newLevel = clampLevel(targetLevel);

    if (oldLevel === newLevel && !baseSrc?.attributes?.adjustment) {
        ui.notifications.info(`${actor.name} is already Level ${newLevel}.`);
        return actor;
    }

    // Optional clone (creates a brand-new sidebar Actor so the original stays untouched)
    if (options.cloneActor) {
        const cloneData = actor.toObject();
        delete cloneData._id;
        cloneData.name = `${actor.name} (Lv ${newLevel})`;
        if (cloneData.prototypeToken) {
            cloneData.prototypeToken.name = cloneData.name;
        }
        actor = await Actor.create(cloneData);
        if (!actor) return null;
    } else {
        await ensureOriginalSnapshot(actor);
    }

    const srcSys = actor._source?.system ?? actor.system;
    const deltas = computeLevelDeltas(oldLevel, newLevel);

    // 1. Core Actor Stats (read from _source so Elite/Weak or active conditions are never baked in)
    const oldAc = Number(srcSys?.attributes?.ac?.value ?? 10);
    const oldMaxHp = Number(srcSys?.attributes?.hp?.max ?? 10);
    const oldCurHp = Number(srcSys?.attributes?.hp?.value ?? oldMaxHp);
    const newMaxHp = computeScaledHp(oldMaxHp, oldLevel, newLevel);
    const hpRatio = oldMaxHp > 0 ? Math.min(1, Math.max(0, oldCurHp / oldMaxHp)) : 1;
    const newCurHp = oldCurHp >= oldMaxHp ? newMaxHp : Math.max(1, Math.round(newMaxHp * hpRatio));

    const oldFort = Number(srcSys?.saves?.fortitude?.value ?? 0);
    const oldRef = Number(srcSys?.saves?.reflex?.value ?? 0);
    const oldWill = Number(srcSys?.saves?.will?.value ?? 0);
    const oldPerc = Number(srcSys?.perception?.mod ?? srcSys?.attributes?.perception?.value ?? 0);

    const actorUpdate = {
        "system.details.level.value": newLevel,
        "system.attributes.adjustment": null,
        "system.attributes.ac.value": Math.max(10, oldAc + deltas.acDelta),
        "system.attributes.hp.max": newMaxHp,
        "system.attributes.hp.value": newCurHp,
        "system.saves.fortitude.value": oldFort + deltas.saveDelta,
        "system.saves.reflex.value": oldRef + deltas.saveDelta,
        "system.saves.will.value": oldWill + deltas.saveDelta
    };

    if (srcSys?.perception && typeof srcSys.perception.mod === "number") {
        actorUpdate["system.perception.mod"] = oldPerc + deltas.saveDelta;
    } else if (srcSys?.attributes?.perception && typeof srcSys.attributes.perception.value === "number") {
        actorUpdate["system.attributes.perception.value"] = oldPerc + deltas.saveDelta;
    }

    // Scale standard NPC skills
    if (options.scaleSkills && srcSys?.skills) {
        for (const [slug, skillData] of Object.entries(srcSys.skills)) {
            const baseVal = Number(skillData?.base);
            if (Number.isFinite(baseVal) && baseVal !== 0) {
                actorUpdate[`system.skills.${slug}.base`] = baseVal + deltas.saveDelta;
            }
        }
    }

    // Scale resistances & weaknesses
    if (options.scaleDefenses) {
        const resArr = srcSys?.attributes?.resistances;
        if (Array.isArray(resArr) && resArr.length > 0) {
            actorUpdate["system.attributes.resistances"] = resArr.map((r) => ({
                ...r,
                value: Number.isFinite(Number(r.value))
                    ? Math.max(1, Math.round(Number(r.value) * deltas.resRatio))
                    : r.value
            }));
        }
        const weakArr = srcSys?.attributes?.weaknesses;
        if (Array.isArray(weakArr) && weakArr.length > 0) {
            actorUpdate["system.attributes.weaknesses"] = weakArr.map((w) => ({
                ...w,
                value: Number.isFinite(Number(w.value))
                    ? Math.max(1, Math.round(Number(w.value) * deltas.resRatio))
                    : w.value
            }));
        }
    }

    await actor.update(actorUpdate);

    // 2. Embedded Items: Melee/Ranged Strikes, Lore Skills, and Action/Passive Save DCs & Damage
    const itemUpdates = [];

    for (const item of actor.items) {
        const itemSrc = item._source?.system ?? item.system;
        if (item.type === "melee") {
            const patch = { _id: item.id };
            const oldBonus = Number(itemSrc?.bonus?.value);
            if (Number.isFinite(oldBonus)) {
                patch["system.bonus.value"] = oldBonus + deltas.attackDelta;
            }

            const dmgRolls = itemSrc?.damageRolls;
            if (dmgRolls && typeof dmgRolls === "object") {
                const keys = Object.keys(dmgRolls);
                keys.forEach((key, idx) => {
                    const entry = dmgRolls[key];
                    if (entry?.damage) {
                        const scaled = scaleDamageFormula(entry.damage, oldLevel, newLevel, idx === 0);
                        patch[`system.damageRolls.${key}.damage`] = scaled;
                    }
                });
            }

            if (options.scaleAbilityDCs && itemSrc?.description?.value) {
                const nextDesc = scaleDescriptionText(itemSrc.description.value, oldLevel, newLevel, deltas.dcDelta);
                if (nextDesc !== itemSrc.description.value) {
                    patch["system.description.value"] = nextDesc;
                }
            }

            itemUpdates.push(patch);
        } else if (item.type === "lore" && options.scaleSkills) {
            const oldMod = Number(itemSrc?.mod?.value);
            if (Number.isFinite(oldMod)) {
                itemUpdates.push({
                    _id: item.id,
                    "system.mod.value": oldMod + deltas.saveDelta
                });
            }
        } else if (item.type === "action" && options.scaleAbilityDCs) {
            const desc = itemSrc?.description?.value;
            if (desc) {
                const nextDesc = scaleDescriptionText(desc, oldLevel, newLevel, deltas.dcDelta);
                if (nextDesc !== desc) {
                    itemUpdates.push({
                        _id: item.id,
                        "system.description.value": nextDesc
                    });
                }
            }
        }
    }

    if (itemUpdates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", itemUpdates);
    }

    // 3. Spellcasting Entries (DC, Attack, Higher-Rank Slots & Spells)
    let spellNotes = [];
    if (options.scaleSpells) {
        spellNotes = await scaleActorSpellcasting(
            actor,
            oldLevel,
            newLevel,
            deltas,
            Boolean(options.addHigherSpells)
        );
    }

    // 4. Whispered GM Summary Card
    if (options.postSummary) {
        const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
        const fmtSigned = (n) => (n >= 0 ? `+${n}` : `${n}`);
        const newAc = Math.max(10, oldAc + deltas.acDelta);

        const statRows = [
            ["AC", `${oldAc} &rarr; <strong>${newAc}</strong>`],
            ["HP", `${oldMaxHp} &rarr; <strong>${newMaxHp}</strong>`],
            ["Perception", `${fmtSigned(oldPerc)} &rarr; <strong>${fmtSigned(oldPerc + deltas.saveDelta)}</strong>`],
            ["Fortitude", `${fmtSigned(oldFort)} &rarr; <strong>${fmtSigned(oldFort + deltas.saveDelta)}</strong>`],
            ["Reflex", `${fmtSigned(oldRef)} &rarr; <strong>${fmtSigned(oldRef + deltas.saveDelta)}</strong>`],
            ["Will", `${fmtSigned(oldWill)} &rarr; <strong>${fmtSigned(oldWill + deltas.saveDelta)}</strong>`],
            ["Attacks", `<strong>${fmtSigned(deltas.attackDelta)}</strong>`],
            ["Ability DCs", `<strong>${fmtSigned(deltas.dcDelta)}</strong>`]
        ];

        const statRowsHtml = statRows
            .map(
                ([label, value]) => `
                    <tr>
                        <td style="padding: 2px 8px 2px 0; font-weight: bold; text-align: left; white-space: nowrap; width: 92px; border: none; background: transparent;">${label}</td>
                        <td style="padding: 2px 0; text-align: left; font-variant-numeric: tabular-nums; border: none; background: transparent;">${value}</td>
                    </tr>
                `
            )
            .join("");

        const spellHtml = spellNotes.length > 0
            ? `<div style="margin-top: 6px; padding-top: 5px; border-top: 1px solid #b5b3a4; text-align: left;"><strong>Spellcasting:</strong><ul style="margin: 2px 0 0 16px; padding: 0; text-align: left;">${spellNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></div>`
            : "";

        const content = `
            <div style="font-family: 'Signika', sans-serif; border: 1px solid #7a7971; border-radius: 6px; padding: 8px; background: rgba(0, 0, 0, 0.04); color: #191813; text-align: left;">
                <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #b5b3a4; padding-bottom: 5px; margin-bottom: 6px;">
                    <img src="${escapeHtml(actor.img)}" width="36" height="36" style="border-radius: 4px; border: 1px solid #7a7971; object-fit: cover; flex-shrink: 0;" />
                    <div style="text-align: left;">
                        <div style="font-weight: bold; font-size: 1.05em;">${escapeHtml(actor.name)}</div>
                        <div style="font-size: 0.82em; color: #4b4a44;">Scaled Level ${oldLevel} &rarr; <strong>Level ${newLevel}</strong></div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 0.86em; line-height: 1.35; border: none; background: transparent;">
                    <tbody>
                        ${statRowsHtml}
                    </tbody>
                </table>
                ${spellHtml}
            </div>
        `;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ alias: NPC_LEVEL_SCALER_MACRO_NAME }),
            content,
            whisper: gmIds,
            blind: true
        });
    }

    ui.notifications.info(`Scaled ${actor.name} from Level ${oldLevel} to Level ${newLevel}.`);
    if (options.cloneActor) {
        actor.sheet?.render(true);
    }
    return actor;
}

// --- DIALOG UI (FOUNDRY V14 DIALOGV2) ---

/**
 * Opens the NPC Level Scaler dialog for a specific NPC actor (e.g. from the sheet header)
 * or for the currently selected NPC token(s) on the canvas.
 * @param {Actor|null} explicitActor
 */
export async function openNpcScalerDialog(explicitActor = null) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the Game Master can scale NPC levels.");
        return;
    }

    ensureStylesheetLoaded();

    let targetActors = [];
    if (explicitActor && explicitActor.type === "npc") {
        targetActors = [explicitActor];
    } else {
        const controlled = canvas?.tokens?.controlled ?? [];
        const seen = new Set();
        for (const token of controlled) {
            const actor = token.actor;
            if (actor && actor.type === "npc") {
                const key = token.document?.actorLink ? `actor:${actor.id}` : `token:${token.id}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    targetActors.push(actor);
                }
            }
        }
    }

    if (targetActors.length === 0) {
        ui.notifications.warn("Select at least one NPC/monster token on the map, or click Scale Level on an NPC sheet header.");
        return;
    }

    if (activeDialog) {
        try {
            await activeDialog.close();
        } catch {
            // Ignore if already closed
        }
        activeDialog = null;
    }

    const primary = targetActors[0];
    const primarySrc = primary._source?.system ?? primary.system;
    const currentLevel = Number(primarySrc?.details?.level?.value ?? 0);
    const defaultTargetLevel = clampLevel(currentLevel + 2);
    const hasSnapshot = targetActors.some((a) => Boolean(a.getFlag(MODULE_ID, SNAPSHOT_FLAG)));
    const snapshotLevel = primary.getFlag(MODULE_ID, SNAPSHOT_FLAG)?.originalLevel;
    const hasSpellcasting = targetActors.some((a) => a.items.some((i) => i.type === "spellcastingEntry"));
    const prefs = loadPreferences();

    const targetSubtitle = targetActors.length === 1
        ? `Current Level ${currentLevel}${hasSpellcasting ? " · Spellcaster" : ""}`
        : `${targetActors.length} selected NPCs (Previewing: ${escapeHtml(primary.name)}, Lv ${currentLevel})`;

    const content = `
        <div class="nls-dialog">
            <div class="nls-header-card">
                <img class="nls-avatar" src="${escapeHtml(primary.img || "icons/svg/mystery-man.svg")}" width="38" height="38" alt="" />
                <div class="nls-target-info">
                    <div class="nls-target-name">${escapeHtml(targetActors.length === 1 ? primary.name : `${targetActors.length} NPCs Selected`)}</div>
                    <div class="nls-target-sub">${targetSubtitle}</div>
                </div>
            </div>

            ${hasSnapshot ? `
            <div class="nls-restore-bar">
                <span>Previously scaled${snapshotLevel !== undefined ? ` (Original: Lv ${snapshotLevel})` : ""}</span>
                <button type="button" class="nls-restore-btn" id="nls-btn-restore">Restore Original</button>
            </div>` : ""}

            <div class="nls-level-row">
                <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">Target Level</div>
                    <div class="nls-quick-pills" style="margin-top: 4px;">
                        <button type="button" class="nls-pill" data-delta="-2">-2</button>
                        <button type="button" class="nls-pill" data-delta="-1">-1</button>
                        <button type="button" class="nls-pill" data-delta="1">+1</button>
                        <button type="button" class="nls-pill" data-delta="2">+2</button>
                        <button type="button" class="nls-pill" data-delta="3">+3</button>
                        <button type="button" class="nls-pill" data-delta="5">+5</button>
                    </div>
                </div>
                <div class="nls-level-controls">
                    <button type="button" class="nls-step-btn" id="nls-step-down">−</button>
                    <input type="number" class="nls-level-input" id="nls-target-level" value="${defaultTargetLevel}" min="-1" max="24" step="1" />
                    <button type="button" class="nls-step-btn" id="nls-step-up">+</button>
                </div>
            </div>

            <div class="nls-preview-grid" id="nls-preview">
                <div class="nls-stat-cell"><span class="nls-stat-label">AC</span><span class="nls-stat-val" id="nls-prev-ac">—</span></div>
                <div class="nls-stat-cell"><span class="nls-stat-label">Max HP</span><span class="nls-stat-val" id="nls-prev-hp">—</span></div>
                <div class="nls-stat-cell"><span class="nls-stat-label">Attacks / DCs</span><span class="nls-stat-val" id="nls-prev-atk">—</span></div>
                <div class="nls-stat-cell"><span class="nls-stat-label">Fortitude</span><span class="nls-stat-val" id="nls-prev-fort">—</span></div>
                <div class="nls-stat-cell"><span class="nls-stat-label">Reflex</span><span class="nls-stat-val" id="nls-prev-ref">—</span></div>
                <div class="nls-stat-cell"><span class="nls-stat-label">Will</span><span class="nls-stat-val" id="nls-prev-will">—</span></div>
            </div>

            <div class="nls-section">
                <div class="nls-section-title">Scaling Options</div>
                <div class="nls-checks-2">
                    <label class="nls-check-label">
                        <input type="checkbox" id="nls-opt-skills" ${prefs.scaleSkills ? "checked" : ""} />
                        Scale Skills &amp; Lores
                    </label>
                    <label class="nls-check-label">
                        <input type="checkbox" id="nls-opt-dcs" ${prefs.scaleAbilityDCs ? "checked" : ""} />
                        Scale Ability DCs &amp; Damage
                    </label>
                    <label class="nls-check-label">
                        <input type="checkbox" id="nls-opt-defenses" ${prefs.scaleDefenses ? "checked" : ""} />
                        Scale Resistances / Weaknesses
                    </label>
                    <label class="nls-check-label">
                        <input type="checkbox" id="nls-opt-spells" ${prefs.scaleSpells ? "checked" : ""} />
                        Scale Spell DC &amp; Attack
                    </label>
                    <label class="nls-check-label" title="Unlocks new spell slots and adds matching-tradition spells from pf2e.spells-srd when leveling up">
                        <input type="checkbox" id="nls-opt-add-spells" ${prefs.addHigherSpells ? "checked" : ""} />
                        Add higher-rank slots &amp; spells
                    </label>
                    <label class="nls-check-label" title="Create a new sidebar actor copy instead of modifying the original">
                        <input type="checkbox" id="nls-opt-clone" ${prefs.cloneActor ? "checked" : ""} />
                        Clone as new Actor
                    </label>
                    <label class="nls-check-label">
                        <input type="checkbox" id="nls-opt-chat" ${prefs.postSummary ? "checked" : ""} />
                        Whisper summary to GM
                    </label>
                </div>
            </div>
        </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
        classes: ["nls-window"],
        window: {
            title: NPC_LEVEL_SCALER_MACRO_NAME,
            icon: "fa-solid fa-arrow-up-right-dots"
        },
        position: {
            width: 480,
            height: "auto"
        },
        content,
        buttons: [
            {
                action: "apply",
                label: "Scale NPC",
                icon: "fa-solid fa-check",
                default: true,
                callback: async (_event, button, dlg) => {
                    const root = dialog.element ?? button?.form ?? dlg?.element;
                    const targetLevel = clampLevel(root?.querySelector("#nls-target-level")?.value ?? defaultTargetLevel);
                    const options = {
                        scaleSkills: Boolean(root?.querySelector("#nls-opt-skills")?.checked),
                        scaleAbilityDCs: Boolean(root?.querySelector("#nls-opt-dcs")?.checked),
                        scaleDefenses: Boolean(root?.querySelector("#nls-opt-defenses")?.checked),
                        scaleSpells: Boolean(root?.querySelector("#nls-opt-spells")?.checked),
                        addHigherSpells: Boolean(root?.querySelector("#nls-opt-add-spells")?.checked),
                        cloneActor: Boolean(root?.querySelector("#nls-opt-clone")?.checked),
                        postSummary: Boolean(root?.querySelector("#nls-opt-chat")?.checked)
                    };
                    savePreferences(options);

                    for (const actor of targetActors) {
                        await scaleNpcActor(actor, targetLevel, options);
                    }
                }
            },
            {
                action: "cancel",
                label: "Cancel",
                icon: "fa-solid fa-times"
            }
        ]
    });

    activeDialog = dialog;
    dialog.addEventListener(
        "close",
        () => {
            if (activeDialog === dialog) activeDialog = null;
        },
        { once: true }
    );

    await dialog.render({ force: true });

    const root = dialog.element;
    if (!root) return;

    const levelInput = root.querySelector("#nls-target-level");
    const fmtSign = (n) => (n >= 0 ? `+${n}` : `${n}`);

    const updatePreview = () => {
        const nextLevel = clampLevel(levelInput.value);
        const d = computeLevelDeltas(currentLevel, nextLevel);
        const oldAc = Number(primarySrc?.attributes?.ac?.value ?? 10);
        const oldHp = Number(primarySrc?.attributes?.hp?.max ?? 10);
        const oldFort = Number(primarySrc?.saves?.fortitude?.value ?? 0);
        const oldRef = Number(primarySrc?.saves?.reflex?.value ?? 0);
        const oldWill = Number(primarySrc?.saves?.will?.value ?? 0);

        const nextHp = computeScaledHp(oldHp, currentLevel, nextLevel);
        root.querySelector("#nls-prev-ac").textContent = `${oldAc} → ${Math.max(10, oldAc + d.acDelta)}`;
        root.querySelector("#nls-prev-hp").textContent = `${oldHp} → ${nextHp}`;
        root.querySelector("#nls-prev-atk").textContent = `${fmtSign(d.attackDelta)} / ${fmtSign(d.dcDelta)}`;
        root.querySelector("#nls-prev-fort").textContent = `${fmtSign(oldFort)} → ${fmtSign(oldFort + d.saveDelta)}`;
        root.querySelector("#nls-prev-ref").textContent = `${fmtSign(oldRef)} → ${fmtSign(oldRef + d.saveDelta)}`;
        root.querySelector("#nls-prev-will").textContent = `${fmtSign(oldWill)} → ${fmtSign(oldWill + d.saveDelta)}`;
    };

    root.querySelector("#nls-step-down")?.addEventListener("click", () => {
        levelInput.value = String(clampLevel(Number(levelInput.value) - 1));
        updatePreview();
    });

    root.querySelector("#nls-step-up")?.addEventListener("click", () => {
        levelInput.value = String(clampLevel(Number(levelInput.value) + 1));
        updatePreview();
    });

    root.querySelectorAll(".nls-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            const delta = Number(pill.dataset.delta);
            levelInput.value = String(clampLevel(currentLevel + delta));
            updatePreview();
        });
    });

    levelInput?.addEventListener("input", updatePreview);

    root.querySelector("#nls-btn-restore")?.addEventListener("click", async () => {
        for (const actor of targetActors) {
            if (actor.getFlag(MODULE_ID, SNAPSHOT_FLAG)) {
                await restoreOriginalNpc(actor);
            }
        }
        await dialog.close();
    });

    updatePreview();
}

// --- NPC SHEET HEADER BUTTON HOOK ---

/**
 * Injects a "Scale Level" button into the PF2e NPC sheet window header bar for GMs.
 */
export function registerNpcScalerHooks() {
    ensureStylesheetLoaded();
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("renderNPCSheetPF2e", (sheet, html) => {
        if (!game.user.isGM) return;
        const actor = sheet?.actor;
        if (!actor || actor.type !== "npc") return;

        const root = html instanceof HTMLElement ? html : (html?.[0] ?? sheet?.element?.[0] ?? sheet?.element);
        if (!(root instanceof HTMLElement)) return;

        const header = root.querySelector(".window-header") || root.closest?.(".application, .window-app")?.querySelector(".window-header");
        if (!header || header.querySelector(".npc-scaler-header-btn")) return;

        // Match AppV2 <button class="header-control"> or AppV1 <a class="header-button">
        const isAppV2Header = Boolean(header.querySelector("button.header-control"));
        const btn = document.createElement(isAppV2Header ? "button" : "a");
        if (isAppV2Header) {
            btn.type = "button";
            btn.className = "header-control icon fa-solid fa-arrow-up-right-dots npc-scaler-header-btn";
            btn.setAttribute("data-tooltip", "Scale NPC Level");
            btn.setAttribute("aria-label", "Scale NPC Level");
        } else {
            btn.className = "header-button control npc-scaler-header-btn";
            btn.innerHTML = `<i class="fas fa-arrow-up-right-dots"></i> Scale`;
        }
        btn.title = "Scale NPC Level";

        btn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openNpcScalerDialog(actor);
        });

        const closeBtn = header.querySelector('[data-action="close"], a.close, button.close');
        if (closeBtn) {
            closeBtn.insertAdjacentElement("beforebegin", btn);
        } else {
            header.appendChild(btn);
        }
    });
}
