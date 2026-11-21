/**
 * PF2e Random NPC Generator Macro (Foundry VTT v14)
 * Generates ready-to-run PF2e NPCs from available NPC Core, NPC Gallery,
 * Monster Core, Bestiary, or installed Actor compendiums with:
 * - Level & Role/Creature-Type filtering (plus optional ±2 level fallback)
 * - Automatic Pathfinder Tokens: Character Gallery art matching when installed
 * - Fantasy & PF2e compendium-inspired naming
 * - Role-matched bonus Lore skill & RP personality/voice/motivation notes
 * - Optional folder organization, scene token placement, and whispered GM card
 */

export const RANDOM_NPC_MACRO_NAME = "Random NPC Generator";
export const RANDOM_NPC_MACRO_ICON = "icons/magic/control/silhouette-grow-shrink-blue.webp";

const MODULE_ID = "pf2e-awesome-macros-for-gms";
const STYLESHEET_HREF = `modules/${MODULE_ID}/styles/random-npc-generator.css`;
const PREFS_STORAGE_KEY = "pf2e-awesome-macros.randomNpcPrefs";
const CHARACTER_GALLERY_MODULE_ID = "pf2e-tokens-characters";
const GENERATED_FOLDER_NAME = "Generated NPCs";

const NPC_CORE_PACKS = [
    "pf2e.pathfinder-npc-core",
    "pf2e.npc-gallery"
];

const BESTIARY_PACKS = [
    "pf2e.pathfinder-monster-core",
    "pf2e.pathfinder-monster-core-2",
    "pf2e.pathfinder-bestiary",
    "pf2e.pathfinder-bestiary-2",
    "pf2e.pathfinder-bestiary-3"
];

const FANTASY_FIRST_NAMES = [
    "Aelwyn", "Alaric", "Bram", "Briar", "Caelen", "Calista", "Corvus", "Darius",
    "Dorian", "Elara", "Elowen", "Faelar", "Fenris", "Freya", "Gareth", "Gideon",
    "Gorim", "Haldor", "Helena", "Ilyana", "Isolde", "Jareth", "Jorik", "Kael",
    "Kaelen", "Kira", "Korik", "Leander", "Lira", "Lucian", "Lyra", "Maeve",
    "Malrik", "Maren", "Merrick", "Mira", "Nadia", "Nia", "Nolan", "Orik",
    "Orla", "Oswin", "Phaedra", "Pippin", "Quinn", "Ronan", "Rowan", "Sabine",
    "Seraphina", "Soren", "Sylas", "Talia", "Tamsin", "Thalia", "Theron", "Torin",
    "Urien", "Vael", "Valen", "Varis", "Vesper", "Willem", "Wren", "Wynne",
    "Xander", "Yara", "Yorin", "Zara", "Zephyr", "Bryn", "Cedric", "Edda",
    "Fiora", "Garrick", "Hestia", "Ivor", "Kestrel", "Linden", "Morwen", "Roderick"
];

const FANTASY_SURNAMES = [
    "Ashford", "Barrow", "Blackthorn", "Briarwood", "Copperkettle", "Crestfall",
    "Crowley", "Dawnstrider", "Deepdelver", "Dunmore", "Fairwind", "Fenwick",
    "Flintlock", "Gale", "Greymane", "Harrow", "Hawthorne", "Holloway",
    "Ironwood", "Kestrel", "Larkspur", "Mire", "Mossfoot", "Northwood",
    "Oakhaven", "Pendleton", "Ravenscroft", "Redbrook", "Riverstone", "Silverleaf",
    "Stonebridge", "Stormwatch", "Sunweaver", "Thistle", "Thorne", "Underhill",
    "Vane", "Whitaker", "Wilder", "Winterbourne"
];

const RP_PERSONALITIES = [
    "Warm and talkative, eager to trade local gossip.",
    "Guarded and blunt, watches everyone's hands before speaking.",
    "Dryly sarcastic with an unexpected streak of kindness.",
    "Nervous and over-polite, apologizes even when not at fault.",
    "Boisterous and proud, loves bragging about past deeds.",
    "Calm, observant, and methodical; pauses before answering.",
    "Impatient and practical—values coin and time above small talk.",
    "Superstitious; mutters small wards or knocks on wood.",
    "Cheerfully eccentric with a habit of humming off-key.",
    "Weary and cynical, but fiercely loyal to their own.",
    "Curiously inquisitive—asks as many questions as they answer.",
    "Formal and deferential, insists on proper titles and manners."
];

const RP_MANNERISMS = [
    "Taps fingers rhythmically on hilt, counter, or knee.",
    "Speaks in a hushed, measured cadence.",
    "Constantly adjusts a worn clasp, hat, or scarf.",
    "Clears throat sharply before making an important point.",
    "Squints with one eye as if appraising value.",
    "Gestures broadly with both hands while describing anything.",
    "Keeps a lucky coin or charm rolling across their knuckles.",
    "Laughs softly at the end of serious statements.",
    "Maintains unblinking eye contact when negotiating.",
    "Glances frequently toward the nearest exit or window."
];

const RP_MOTIVATIONS = [
    "Trying to pay off an old debt before the collector arrives.",
    "Looking for reliable adventurers to handle a delicate errand.",
    "Protecting a local secret or hiding a minor past mistake.",
    "Hoping to earn enough coin to retire somewhere quiet.",
    "Searching for a missing friend, sibling, or lost heirloom.",
    "Trying to impress a local guild, temple, or noble patron.",
    "Keeping the peace so trouble doesn't ruin their livelihood.",
    "Quietly gathering rumors to sell to the highest bidder.",
    "Just trying to finish today's shift without getting dragged into heroics.",
    "Seeking proof of a strange omen or creature spotted nearby."
];

const ROLE_DEFINITIONS = {
    any: {
        label: "Any Role / Creature",
        keywords: [],
        traits: [],
        galleryTags: [],
        lores: ["Local Lore", "Settlement Lore", "Labor Lore", "Scouting Lore"],
        autoIncludeBestiaries: false
    },
    cleric: {
        label: "Cleric / Priest / Healer",
        keywords: ["cleric", "priest", "acolyte", "healer", "chaplain", "paladin", "champion", "oracle", "cultist", "monk", "templar", "inquisitor", "shaman"],
        traits: ["divine"],
        galleryTags: ["cleric", "priest", "champion", "oracle", "monk", "holy", "staff", "mace", "robe"],
        lores: ["Religion Lore", "Temple Lore", "Herbalism Lore", "Deity Lore"],
        autoIncludeBestiaries: false
    },
    ranger: {
        label: "Ranger / Hunter / Scout",
        keywords: ["ranger", "hunter", "scout", "tracker", "archer", "sniper", "trapper", "warden", "guide", "woodsman", "forester", "poacher", "stalker"],
        traits: [],
        galleryTags: ["ranger", "archer", "bow", "hunter", "scout", "cloak", "hood", "druid"],
        lores: ["Forest Lore", "Hunting Lore", "Tracking Lore", "Terrain Lore"],
        autoIncludeBestiaries: false
    },
    fighter: {
        label: "Fighter / Guard / Soldier",
        keywords: ["fighter", "guard", "soldier", "warrior", "knight", "mercenary", "captain", "watch", "gladiator", "berserker", "barbarian", "duelist", "cavalier", "veteran", "bodyguard", "sentry", "pikeman"],
        traits: [],
        galleryTags: ["fighter", "warrior", "knight", "guard", "barbarian", "sword", "shield", "armor", "axe"],
        lores: ["Warfare Lore", "Guard Lore", "Gladiatorial Lore", "Weapon Lore"],
        autoIncludeBestiaries: false
    },
    rogue: {
        label: "Rogue / Thief / Bandit",
        keywords: ["rogue", "thief", "bandit", "assassin", "burglar", "spy", "smuggler", "cutthroat", "pirate", "brigand", "highwayman", "pickpocket", "scoundrel", "ruffian", "swashbuckler", "charlatan"],
        traits: [],
        galleryTags: ["rogue", "thief", "assassin", "dagger", "hood", "pirate", "swashbuckler", "leather"],
        lores: ["Underworld Lore", "Guild Lore", "Sailing Lore", "Street Lore"],
        autoIncludeBestiaries: false
    },
    caster: {
        label: "Wizard / Mage / Scholar",
        keywords: ["wizard", "mage", "sorcerer", "witch", "druid", "bard", "alchemist", "arcanist", "necromancer", "illusionist", "evoker", "conjurer", "scholar", "sage", "enchanter", "magus", "psychic", "thaumaturge"],
        traits: ["arcane", "occult", "primal"],
        galleryTags: ["wizard", "sorcerer", "witch", "mage", "bard", "alchemist", "druid", "staff", "book", "robe"],
        lores: ["Academia Lore", "Arcane Lore", "Library Lore", "Alchemical Lore"],
        autoIncludeBestiaries: false
    },
    civilian: {
        label: "Merchant / Noble / Commoner",
        keywords: ["merchant", "commoner", "noble", "artisan", "barkeep", "bartender", "innkeeper", "smith", "blacksmith", "apothecary", "diplomat", "courtier", "entertainer", "beggar", "laborer", "farmer", "servant", "sailor", "carpenter", "scribe", "barrister", "judge", "tax", "chef", "baker", "shopkeeper"],
        traits: [],
        galleryTags: ["noble", "merchant", "commoner", "bard", "investigator", "civilian", "clothes"],
        lores: ["Mercantile Lore", "Guild Lore", "Accounting Lore", "Legal Lore", "Cooking Lore", "Farming Lore"],
        autoIncludeBestiaries: false
    },
    humanoid: {
        label: "Trait: Humanoid",
        keywords: [],
        traits: ["humanoid"],
        galleryTags: ["human", "elf", "dwarf", "gnome", "halfling", "goblin", "orc"],
        lores: ["Local Lore", "Settlement Lore"],
        autoIncludeBestiaries: false
    },
    beast: {
        label: "Trait: Beast / Animal",
        keywords: ["beast", "wolf", "bear", "hound", "stag", "eagle"],
        traits: ["beast", "animal"],
        galleryTags: [],
        lores: ["Forest Lore", "Wilderness Lore"],
        autoIncludeBestiaries: true
    },
    fey: {
        label: "Trait: Fey",
        keywords: ["fey", "sprite", "dryad", "satyr", "nymph"],
        traits: ["fey"],
        galleryTags: ["fey", "elf", "gnome", "druid"],
        lores: ["Fey Lore", "First World Lore"],
        autoIncludeBestiaries: true
    },
    undead: {
        label: "Trait: Undead",
        keywords: ["undead", "skeleton", "zombie", "ghost", "vampire", "ghoul", "lich"],
        traits: ["undead"],
        galleryTags: ["undead", "skeleton", "vampire", "necromancer"],
        lores: ["Undead Lore", "Graveyard Lore"],
        autoIncludeBestiaries: true
    },
    dragon: {
        label: "Trait: Dragon",
        keywords: ["dragon", "drake", "wyvern", "kobold"],
        traits: ["dragon"],
        galleryTags: ["kobold", "dragon"],
        lores: ["Dragon Lore", "Hoard Lore"],
        autoIncludeBestiaries: true
    },
    fiend: {
        label: "Trait: Fiend / Celestial / Monitor",
        keywords: ["demon", "devil", "angel", "archon", "aeon", "azata", "fiend", "celestial"],
        traits: ["fiend", "celestial", "monitor"],
        galleryTags: ["tiefling", "aasimar", "nephilim"],
        lores: ["Plane Lore", "Hell Lore", "Heaven Lore"],
        autoIncludeBestiaries: true
    },
    construct: {
        label: "Trait: Construct / Elemental / Plant",
        keywords: ["construct", "golem", "elemental", "leshy", "plant", "automaton"],
        traits: ["construct", "elemental", "plant"],
        galleryTags: ["automaton", "leshy", "conrasu"],
        lores: ["Engineering Lore", "Elemental Lore", "Herbalism Lore"],
        autoIncludeBestiaries: true
    },
    aberration: {
        label: "Trait: Aberration / Giant / Spirit",
        keywords: ["aberration", "giant", "troll", "ogre", "spirit"],
        traits: ["aberration", "giant", "spirit"],
        galleryTags: [],
        lores: ["Occult Lore", "Mountain Lore", "Spirit Lore"],
        autoIncludeBestiaries: true
    }
};

let activeDialog = null;
let galleryCachePromise = null;
let compendiumNamesCache = null;

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
 * Picks a random element from a non-empty array.
 * @template T
 * @param {T[]} list
 * @returns {T|undefined}
 */
function pickRandom(list) {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list[Math.floor(Math.random() * list.length)];
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
 * Loads saved user preferences from localStorage.
 * @returns {object}
 */
function loadPreferences() {
    const defaults = {
        level: 1,
        levelFlex: true,
        role: "any",
        keyword: "",
        nameMode: "fantasy-full",
        disposition: "neutral",
        useNpcPacks: true,
        useBestiaries: false,
        useOtherPacks: false,
        artMode: "auto",
        addFlavorAndLore: true,
        useFolder: true,
        placeToken: false,
        openSheet: true
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
 * Saves user preferences to localStorage.
 * @param {object} prefs
 */
function savePreferences(prefs) {
    try {
        globalThis.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore storage restrictions
    }
}

// --- PATHFINDER TOKENS: CHARACTER GALLERY INTEGRATION ---

/**
 * Detects whether Pathfinder Tokens: Character Gallery (or another galleryDatasheets module) is active.
 * @returns {{ available: boolean, modules: Module[] }}
 */
function detectGalleryModules() {
    const galleryModules = [];
    const primary = game.modules.get(CHARACTER_GALLERY_MODULE_ID);
    if (primary?.active) {
        galleryModules.push(primary);
    }

    for (const mod of game.modules.values()) {
        if (!mod.active || mod.id === CHARACTER_GALLERY_MODULE_ID) continue;
        if (mod.flags?.galleryDatasheets) {
            galleryModules.push(mod);
        }
    }

    return {
        available: galleryModules.length > 0,
        modules: galleryModules
    };
}

/**
 * Extracts lowercase searchable words from a path or label.
 * @param {string} value
 * @returns {string[]}
 */
function tokenizeForTags(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/\.[^.]+$/, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && !["pc", "npc", "pf2e", "token", "portrait", "subject", "assets", "modules", "webp", "png", "jpg"].includes(w));
}

/**
 * Resolves a datasheet image path relative to a module root when needed.
 * @param {string|null|undefined} rawPath
 * @param {string} moduleId
 * @returns {string|null}
 */
function normalizeGalleryAssetPath(rawPath, moduleId) {
    if (!rawPath || typeof rawPath !== "string") return null;
    const trimmed = rawPath.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("modules/") || trimmed.startsWith("systems/") || trimmed.startsWith("icons/") || /^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    const cleanRel = trimmed.replace(/^\/+/, "");
    if (cleanRel.startsWith("assets/")) {
        return `modules/${moduleId}/${cleanRel}`;
    }
    if (/^(portraits|tokens|subject|subjects)\//i.test(cleanRel)) {
        return `modules/${moduleId}/assets/${cleanRel}`;
    }
    return `modules/${moduleId}/${cleanRel}`;
}

/**
 * Parses arbitrary datasheet.json formats from Character Gallery / galleryDatasheets modules.
 * @param {*} data
 * @param {string} moduleId
 * @returns {Array<{ portrait: string|null, token: string|null, subject: string|null, tags: Set<string> }>}
 */
function parseGalleryDatasheet(data, moduleId) {
    const entries = [];
    const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.entries)
            ? data.entries
            : Array.isArray(data?.items)
                ? data.items
                : Array.isArray(data?.tokens)
                    ? data.tokens
                    : data && typeof data === "object"
                        ? Object.entries(data).map(([key, val]) => (typeof val === "object" && val !== null ? { _key: key, ...val } : null)).filter(Boolean)
                        : [];

    for (const item of rawItems) {
        if (!item || typeof item !== "object") continue;

        const portrait = normalizeGalleryAssetPath(
            item.portrait ?? item.portraits ?? item.actor ?? item.img ?? item.image,
            moduleId
        );
        const token = normalizeGalleryAssetPath(
            item.token ?? item.tokens ?? item.pog,
            moduleId
        );
        const subject = normalizeGalleryAssetPath(
            item.subject ?? item.subjects ?? item.ringSubject,
            moduleId
        );

        if (!portrait && !token) continue;

        const tags = new Set();
        const addTagWords = (val) => {
            if (!val) return;
            if (Array.isArray(val)) {
                val.forEach(addTagWords);
            } else if (typeof val === "object") {
                Object.keys(val).forEach(addTagWords);
                Object.values(val).forEach(addTagWords);
            } else if (typeof val === "string") {
                tokenizeForTags(val).forEach((t) => tags.add(t));
            }
        };

        addTagWords(item.tags);
        addTagWords(item.name);
        addTagWords(item.label);
        addTagWords(item.ancestry);
        addTagWords(item.class);
        addTagWords(item.categories);
        addTagWords(item.traits);
        addTagWords(item._key);
        addTagWords(portrait?.split("/").pop());
        addTagWords(token?.split("/").pop());

        entries.push({
            portrait: portrait || token,
            token: token || portrait,
            subject,
            tags
        });
    }

    return entries;
}

/**
 * Recursively collects image files using Foundry v14's namespaced FilePicker.implementation.browse.
 * @param {string} targetDir
 * @param {number} maxDepth
 * @returns {Promise<string[]>}
 */
async function browseImagesRecursive(targetDir, maxDepth = 2) {
    const FilePickerImpl = foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FilePickerImpl?.browse) return [];

    const results = [];
    const walk = async (dir, depth) => {
        try {
            const res = await FilePickerImpl.browse("data", dir);
            for (const file of res.files ?? []) {
                if (/\.(webp|png|jpg|jpeg|avif|svg)$/i.test(file)) {
                    results.push(file);
                }
            }
            if (depth < maxDepth) {
                for (const subDir of res.dirs ?? []) {
                    await walk(subDir, depth + 1);
                }
            }
        } catch {
            // Directory does not exist or cannot be browsed
        }
    };

    await walk(targetDir, 0);
    return results;
}

/**
 * Loads and caches artwork entries from Pathfinder Tokens: Character Gallery (datasheet + FilePicker fallback).
 * @returns {Promise<Array<{ portrait: string, token: string, subject: string|null, tags: Set<string> }>>}
 */
async function loadCharacterGalleryEntries() {
    if (galleryCachePromise) return galleryCachePromise;

    galleryCachePromise = (async () => {
        const { available, modules } = detectGalleryModules();
        if (!available) return [];

        const collected = [];

        // 1. Try reading registered galleryDatasheets JSON files
        for (const mod of modules) {
            const sheetsObj = mod.flags?.galleryDatasheets;
            const sheetPaths = [];
            if (sheetsObj && typeof sheetsObj === "object") {
                for (const cfg of Object.values(sheetsObj)) {
                    if (typeof cfg?.sheet === "string") sheetPaths.push(cfg.sheet);
                }
            }
            if (mod.id === CHARACTER_GALLERY_MODULE_ID && sheetPaths.length === 0) {
                sheetPaths.push(`modules/${CHARACTER_GALLERY_MODULE_ID}/data/datasheet.json`);
            }

            for (const path of sheetPaths) {
                try {
                    const resp = await fetch(path);
                    if (!resp.ok) continue;
                    const json = await resp.json();
                    collected.push(...parseGalleryDatasheet(json, mod.id));
                } catch {
                    // Fall through to FilePicker browse if datasheet fetch fails
                }
            }
        }

        // 2. Fallback: browse Character Gallery assets folders directly via FilePicker
        if (collected.length === 0 && game.modules.get(CHARACTER_GALLERY_MODULE_ID)?.active) {
            const baseRoots = [
                `modules/${CHARACTER_GALLERY_MODULE_ID}/assets`,
                `modules/${CHARACTER_GALLERY_MODULE_ID}`
            ];

            for (const root of baseRoots) {
                const [portraits, tokens, subjects] = await Promise.all([
                    browseImagesRecursive(`${root}/portraits`, 2),
                    browseImagesRecursive(`${root}/tokens`, 2),
                    browseImagesRecursive(`${root}/subject`, 2)
                ]);

                if (portraits.length === 0 && tokens.length === 0) continue;

                const baseNameOf = (p) => p.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
                const byName = new Map();

                for (const p of portraits) {
                    const key = baseNameOf(p);
                    byName.set(key, { portrait: p, token: null, subject: null });
                }
                for (const t of tokens) {
                    const key = baseNameOf(t);
                    const entry = byName.get(key) || { portrait: null, token: null, subject: null };
                    entry.token = t;
                    byName.set(key, entry);
                }
                for (const s of subjects) {
                    const key = baseNameOf(s);
                    const entry = byName.get(key);
                    if (entry) entry.subject = s;
                }

                for (const [key, entry] of byName.entries()) {
                    const portrait = entry.portrait || entry.token;
                    const token = entry.token || entry.portrait;
                    if (!portrait && !token) continue;
                    collected.push({
                        portrait,
                        token,
                        subject: entry.subject,
                        tags: new Set(tokenizeForTags(key))
                    });
                }

                if (collected.length > 0) break;
            }
        }

        return collected;
    })();

    return galleryCachePromise;
}

/**
 * Selects the best-matching Character Gallery portrait/token pair for an NPC.
 * @param {Array} galleryEntries
 * @param {object} roleDef
 * @param {Actor} baseActor
 * @param {string} keyword
 * @returns {object|null}
 */
function pickGalleryArtwork(galleryEntries, roleDef, baseActor, keyword) {
    if (!galleryEntries || galleryEntries.length === 0) return null;

    const queryTags = new Set();
    const addWords = (str) => tokenizeForTags(str).forEach((w) => queryTags.add(w));

    (roleDef?.galleryTags ?? []).forEach((t) => queryTags.add(t.toLowerCase()));
    (roleDef?.keywords ?? []).forEach((t) => queryTags.add(t.toLowerCase()));
    (baseActor.system?.traits?.value ?? []).forEach((t) => addWords(t));
    addWords(baseActor.name);
    addWords(keyword);

    // Score each entry by matching tags
    let bestScore = 0;
    const scored = galleryEntries.map((entry) => {
        let score = 0;
        for (const tag of queryTags) {
            if (entry.tags.has(tag)) score += 2;
        }
        if (score > bestScore) bestScore = score;
        return { entry, score };
    });

    if (bestScore > 0) {
        const minAccept = Math.max(2, bestScore - 2);
        const topPool = scored.filter((s) => s.score >= minAccept).map((s) => s.entry);
        return pickRandom(topPool);
    }

    return pickRandom(galleryEntries);
}

// --- COMPENDIUM SCANNING & NAMING ---

/**
 * Returns available Actor compendium packs matching the user's source checkboxes.
 * @param {{ useNpcPacks: boolean, useBestiaries: boolean, useOtherPacks: boolean }} sources
 * @returns {CompendiumCollection[]}
 */
function resolveSelectedPacks(sources) {
    const packIds = new Set();
    const packs = [];

    const addIfPresent = (id) => {
        if (packIds.has(id)) return;
        const pack = game.packs.get(id);
        if (pack && pack.documentName === "Actor") {
            packIds.add(id);
            packs.push(pack);
        }
    };

    if (sources.useNpcPacks) {
        NPC_CORE_PACKS.forEach(addIfPresent);
    }
    if (sources.useBestiaries) {
        BESTIARY_PACKS.forEach(addIfPresent);
    }
    if (sources.useOtherPacks) {
        for (const pack of game.packs.values()) {
            if (pack.documentName !== "Actor") continue;
            if (packIds.has(pack.collection)) continue;
            if (NPC_CORE_PACKS.includes(pack.collection) || BESTIARY_PACKS.includes(pack.collection)) continue;
            // Skip iconic PC packs or party packs if clearly labeled
            if (/iconic|pregen/i.test(pack.metadata?.label || "")) continue;
            packIds.add(pack.collection);
            packs.push(pack);
        }
    }

    return packs;
}

/**
 * Pulls candidate inspiration names/titles from available PF2e NPC & Bestiary compendiums.
 * @returns {Promise<string[]>}
 */
async function getCompendiumNamePool() {
    if (Array.isArray(compendiumNamesCache) && compendiumNamesCache.length > 0) {
        return compendiumNamesCache;
    }

    const pool = [];
    const allPreferred = [...NPC_CORE_PACKS, ...BESTIARY_PACKS];
    for (const id of allPreferred) {
        const pack = game.packs.get(id);
        if (!pack || pack.documentName !== "Actor") continue;
        try {
            const index = await pack.getIndex({ fields: ["type", "system.traits.value", "system.traits.rarity"] });
            for (const entry of index) {
                if (entry.type !== "npc" || !entry.name) continue;
                const traits = (entry.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());
                if (traits.includes("troop")) continue;
                // Unique NPCs or named titles are great inspiration; keep clean names
                const name = entry.name.trim();
                if (name && name.length <= 36) {
                    pool.push(name);
                }
            }
        } catch {
            // Skip unavailable index
        }
    }

    compendiumNamesCache = pool;
    return pool;
}

/**
 * Generates an NPC name according to the chosen naming mode.
 * @param {object} options
 * @param {Actor} baseActor
 * @returns {Promise<string>}
 */
async function generateNpcName(options, baseActor) {
    const custom = (options.customName || "").trim();
    if (custom) return custom;

    const first = pickRandom(FANTASY_FIRST_NAMES) || "Rowan";
    const surname = pickRandom(FANTASY_SURNAMES) || "Thorne";

    if (options.nameMode === "fantasy-first") {
        return first;
    }
    if (options.nameMode === "fantasy-with-title") {
        return `${first} (${baseActor.name})`;
    }
    if (options.nameMode === "compendium") {
        const compPool = await getCompendiumNamePool();
        const inspiration = pickRandom(compPool);
        if (inspiration && inspiration.toLowerCase() !== baseActor.name.toLowerCase()) {
            return `${first} the ${inspiration}`;
        }
        return `${first} ${surname}`;
    }

    // Default: "fantasy-full"
    return `${first} ${surname}`;
}

/**
 * Checks whether an indexed compendium NPC entry matches the chosen role and optional keyword.
 * @param {object} entry
 * @param {object} roleDef
 * @param {string} keyword
 * @returns {boolean}
 */
function matchesRoleAndKeyword(entry, roleDef, keyword) {
    const nameLower = String(entry.name || "").toLowerCase();
    const traits = (entry.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());
    const cleanKeyword = String(keyword || "").trim().toLowerCase();

    // Exclude multi-segment Troop creatures unless explicitly requested via keyword
    if (traits.includes("troop") && !cleanKeyword.includes("troop")) {
        return false;
    }

    if (roleDef && (roleDef.keywords.length > 0 || roleDef.traits.length > 0)) {
        const traitHit = roleDef.traits.some((t) => traits.includes(t));
        const keywordHit = roleDef.keywords.some((k) => nameLower.includes(k) || traits.includes(k));
        if (!traitHit && !keywordHit) return false;
    }

    if (cleanKeyword) {
        const kwParts = cleanKeyword.split(/[\s,]+/).filter(Boolean);
        const matchesAll = kwParts.every((part) => nameLower.includes(part) || traits.some((t) => t.includes(part)));
        if (!matchesAll) return false;
    }

    return true;
}

/**
 * Finds matching compendium NPCs at the target level (with optional ±2 level flex fallback).
 * @param {CompendiumCollection[]} packs
 * @param {number} targetLevel
 * @param {boolean} allowLevelFlex
 * @param {object} roleDef
 * @param {string} keyword
 * @returns {Promise<{ matches: Array<{ pack: CompendiumCollection, entry: object, levelDiff: number }>, usedFlex: boolean }>}
 */
async function findMatchingCandidates(packs, targetLevel, allowLevelFlex, roleDef, keyword) {
    const exactMatches = [];
    const nearMatches = [];

    for (const pack of packs) {
        let index;
        try {
            index = await pack.getIndex({
                fields: ["type", "system.details.level.value", "system.traits.value", "system.traits.rarity"]
            });
        } catch (err) {
            console.warn(`Random NPC Generator | Could not index pack ${pack.collection}:`, err);
            continue;
        }

        for (const entry of index) {
            if (entry.type !== "npc") continue;
            const entryLevel = Number(entry.system?.details?.level?.value);
            if (!Number.isFinite(entryLevel)) continue;

            const diff = Math.abs(entryLevel - targetLevel);
            if (diff > (allowLevelFlex ? 2 : 0)) continue;

            if (!matchesRoleAndKeyword(entry, roleDef, keyword)) continue;

            if (diff === 0) {
                exactMatches.push({ pack, entry, levelDiff: 0 });
            } else if (allowLevelFlex) {
                nearMatches.push({ pack, entry, levelDiff: diff });
            }
        }
    }

    if (exactMatches.length > 0) {
        return { matches: exactMatches, usedFlex: false };
    }

    if (nearMatches.length > 0) {
        const minDiff = Math.min(...nearMatches.map((m) => m.levelDiff));
        return {
            matches: nearMatches.filter((m) => m.levelDiff === minDiff),
            usedFlex: true
        };
    }

    return { matches: [], usedFlex: false };
}

/**
 * Computes a PF2e-appropriate bonus Lore skill modifier for an NPC of the given level.
 * @param {Actor} baseActor
 * @param {number} level
 * @returns {number}
 */
function computeLoreModifier(baseActor, level) {
    const existingLores = (baseActor.items ?? []).filter((i) => i.type === "lore");
    if (existingLores.length > 0) {
        const mods = existingLores
            .map((i) => Number(i.system?.mod?.value))
            .filter((n) => Number.isFinite(n));
        if (mods.length > 0) {
            return Math.max(...mods);
        }
    }
    // Standard PF2e Moderate Skill progression (~5 + level + floor(level / 3))
    const safeLevel = Number.isFinite(level) ? level : 0;
    return Math.max(2, Math.round(5 + safeLevel + Math.floor(safeLevel / 3)));
}

/**
 * Gets or creates the "Generated NPCs" Actor folder.
 * @returns {Promise<Folder|null>}
 */
async function getOrCreateNpcFolder() {
    let folder = game.folders.find((f) => f.type === "Actor" && f.name === GENERATED_FOLDER_NAME);
    if (!folder) {
        try {
            folder = await Folder.create({
                name: GENERATED_FOLDER_NAME,
                type: "Actor",
                parent: null,
                color: "#5549fd"
            });
        } catch (err) {
            console.warn("Random NPC Generator | Failed to create Generated NPCs folder:", err);
            return null;
        }
    }
    return folder;
}

/**
 * Places a token for the newly created NPC near the center of the current viewport.
 * @param {Actor} actor
 * @returns {Promise<boolean>}
 */
async function placeTokenOnActiveScene(actor) {
    const scene = canvas?.scene;
    if (!scene || !canvas?.ready) return false;

    const gridSize = scene.grid?.size || 100;
    const pivot = canvas.stage?.pivot;
    let x = pivot?.x ?? (scene.dimensions?.width ?? 1000) / 2;
    let y = pivot?.y ?? (scene.dimensions?.height ?? 1000) / 2;

    if (scene.grid?.type !== CONST.GRID_TYPES.NONE) {
        x = Math.floor(x / gridSize) * gridSize;
        y = Math.floor(y / gridSize) * gridSize;
    }

    const tokenDoc = await actor.getTokenDocument({
        x: Math.round(x),
        y: Math.round(y)
    });

    await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
    return true;
}

/**
 * Core NPC generation pipeline.
 * @param {object} options
 */
async function executeNpcGeneration(options) {
    const roleDef = ROLE_DEFINITIONS[options.role] || ROLE_DEFINITIONS.any;

    // Automatically include bestiaries if the user selected a monster creature trait (Beast, Dragon, etc.)
    const effectiveSources = {
        useNpcPacks: options.useNpcPacks,
        useBestiaries: options.useBestiaries || Boolean(roleDef.autoIncludeBestiaries),
        useOtherPacks: options.useOtherPacks
    };

    const packs = resolveSelectedPacks(effectiveSources);
    if (packs.length === 0) {
        ui.notifications.warn("No matching Actor compendiums are selected or available in this world.");
        return;
    }

    ui.notifications.info(`Searching ${packs.length} compendium(s) for Level ${options.level} NPC...`);

    const { matches, usedFlex } = await findMatchingCandidates(
        packs,
        options.level,
        options.levelFlex,
        roleDef,
        options.keyword
    );

    if (matches.length === 0) {
        ui.notifications.warn(
            `No NPCs matched Level ${options.level}${options.role !== "any" ? ` (${roleDef.label})` : ""}${options.keyword ? ` with "${options.keyword}"` : ""}. Try enabling Monster Core / Bestiaries or broadening the filter.`
        );
        return;
    }

    const picked = pickRandom(matches);
    const baseActor = await picked.pack.getDocument(picked.entry._id);
    if (!baseActor) {
        ui.notifications.error("Failed to load the selected compendium actor.");
        return;
    }

    const baseLevel = Number(baseActor.system?.details?.level?.value ?? options.level);
    const npcName = await generateNpcName(options, baseActor);
    const actorData = baseActor.toObject();
    delete actorData._id;

    actorData.name = npcName;

    // Disposition mapping
    const dispositionMap = {
        friendly: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        neutral: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        hostile: CONST.TOKEN_DISPOSITIONS.HOSTILE
    };
    const tokenDisposition = dispositionMap[options.disposition] ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;

    actorData.prototypeToken = actorData.prototypeToken || {};
    actorData.prototypeToken.name = npcName;
    actorData.prototypeToken.disposition = tokenDisposition;

    // Optional Character Gallery art replacement
    let usedGalleryArt = false;
    const baseTraits = (baseActor.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());
    const isHumanoidOrNpcPack = baseTraits.includes("humanoid") || NPC_CORE_PACKS.includes(picked.pack.collection);
    const shouldTryGallery =
        options.artMode === "always" ||
        (options.artMode === "auto" && isHumanoidOrNpcPack);

    if (shouldTryGallery) {
        const galleryEntries = await loadCharacterGalleryEntries();
        const chosenArt = pickGalleryArtwork(galleryEntries, roleDef, baseActor, options.keyword);
        if (chosenArt) {
            actorData.img = chosenArt.portrait;
            actorData.prototypeToken.texture = actorData.prototypeToken.texture || {};
            actorData.prototypeToken.texture.src = chosenArt.token;

            // Keep Dynamic Token Rings in sync so old base actor subject art doesn't bleed through
            if (chosenArt.subject && actorData.prototypeToken.ring?.enabled) {
                actorData.prototypeToken.ring.subject = actorData.prototypeToken.ring.subject || {};
                actorData.prototypeToken.ring.subject.texture = chosenArt.subject;
            } else if (actorData.prototypeToken.ring) {
                actorData.prototypeToken.ring.enabled = false;
            }
            usedGalleryArt = true;
        }
    }

    // Optional RP personality + relevant bonus Lore skill
    let personality = "";
    let mannerism = "";
    let motivation = "";
    let addedLoreText = "";

    if (options.addFlavorAndLore) {
        personality = pickRandom(RP_PERSONALITIES) || "";
        mannerism = pickRandom(RP_MANNERISMS) || "";
        motivation = pickRandom(RP_MOTIVATIONS) || "";

        const roleLoreName = pickRandom(roleDef.lores) || "Local Lore";
        const hasSameLore = (actorData.items ?? []).some(
            (i) => i.type === "lore" && String(i.name || "").toLowerCase() === roleLoreName.toLowerCase()
        );

        if (!hasSameLore) {
            const loreMod = computeLoreModifier(baseActor, baseLevel);
            actorData.items = actorData.items || [];
            actorData.items.push({
                name: roleLoreName,
                type: "lore",
                system: {
                    mod: { value: loreMod }
                }
            });
            addedLoreText = `${roleLoreName} +${loreMod}`;
        }

        const flavorBlock = `
            <hr />
            <h3>Generated NPC Profile</h3>
            <p><strong>Base Statblock:</strong> ${escapeHtml(baseActor.name)} (Level ${baseLevel} · ${escapeHtml(picked.pack.metadata?.label || picked.pack.collection)})</p>
            <p><strong>Personality:</strong> ${escapeHtml(personality)}</p>
            <p><strong>Mannerism:</strong> ${escapeHtml(mannerism)}</p>
            <p><strong>Motivation:</strong> ${escapeHtml(motivation)}</p>
            ${addedLoreText ? `<p><strong>Added Skill:</strong> ${escapeHtml(addedLoreText)}</p>` : ""}
        `;

        actorData.system = actorData.system || {};
        actorData.system.details = actorData.system.details || {};
        const existingNotes = actorData.system.details.privateNotes || "";
        actorData.system.details.privateNotes = `${existingNotes}${flavorBlock}`;
    }

    if (options.useFolder) {
        const folder = await getOrCreateNpcFolder();
        if (folder) {
            actorData.folder = folder.id;
        }
    }

    const newActor = await Actor.create(actorData);
    if (!newActor) {
        ui.notifications.error("Failed to create the generated NPC actor.");
        return;
    }

    let placedToken = false;
    if (options.placeToken) {
        placedToken = await placeTokenOnActiveScene(newActor);
    }

    // Gather top skills (both standard NPC skills and Lore items) for the GM chat summary
    const collectedSkills = [];
    const seenSkillNames = new Set();

    const sysSkills = newActor.system?.skills ?? {};
    for (const [slug, data] of Object.entries(sysSkills)) {
        const mod = Number(data?.base ?? data?.value ?? data?.mod);
        if (!Number.isFinite(mod) || mod === 0) continue;
        const label = data?.label || slug.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const key = label.toLowerCase();
        if (!seenSkillNames.has(key)) {
            seenSkillNames.add(key);
            collectedSkills.push({ name: label, mod });
        }
    }

    for (const item of newActor.items.filter((i) => i.type === "lore")) {
        const mod = Number(item.system?.mod?.value);
        if (!Number.isFinite(mod)) continue;
        const key = item.name.toLowerCase();
        if (!seenSkillNames.has(key)) {
            seenSkillNames.add(key);
            collectedSkills.push({ name: item.name, mod });
        }
    }

    const skillItems = collectedSkills.sort((a, b) => b.mod - a.mod).slice(0, 5);

    const skillSummary = skillItems.length > 0
        ? skillItems.map((s) => `${escapeHtml(s.name)} ${s.mod >= 0 ? "+" : ""}${s.mod}`).join(", ")
        : "See character sheet";

    const traitsDisplay = (newActor.system?.traits?.value ?? []).slice(0, 6).join(", ");
    const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);

    const chatContent = `
        <div style="font-family: 'Signika', sans-serif; border: 1px solid #7a7971; border-radius: 6px; padding: 8px; background: rgba(0, 0, 0, 0.04); color: #191813;">
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #b5b3a4; padding-bottom: 6px; margin-bottom: 6px;">
                <img src="${escapeHtml(newActor.img)}" width="42" height="42" style="border-radius: 4px; border: 1px solid #7a7971; object-fit: cover; flex-shrink: 0;" />
                <div style="min-width: 0;">
                    <div style="font-size: 1.1em; font-weight: bold;">${escapeHtml(npcName)}</div>
                    <div style="font-size: 0.82em; color: #4b4a44;">
                        Level ${baseLevel} · Base: ${escapeHtml(baseActor.name)}${usedFlex ? " (flex)" : ""}
                    </div>
                </div>
            </div>
            <div style="font-size: 0.86em; line-height: 1.45;">
                <div><strong>Disposition:</strong> ${escapeHtml(options.disposition.charAt(0).toUpperCase() + options.disposition.slice(1))}${traitsDisplay ? ` · <strong>Traits:</strong> ${escapeHtml(traitsDisplay)}` : ""}</div>
                <div><strong>Key Skills:</strong> ${skillSummary}</div>
                ${personality ? `<div><strong>Personality:</strong> ${escapeHtml(personality)}</div>` : ""}
                ${mannerism ? `<div><strong>Mannerism:</strong> ${escapeHtml(mannerism)}</div>` : ""}
                ${motivation ? `<div><strong>Motivation:</strong> ${escapeHtml(motivation)}</div>` : ""}
                <div style="font-size: 0.82em; color: #4b4a44; margin-top: 4px;">
                    Source: ${escapeHtml(picked.pack.metadata?.label || picked.pack.collection)}${usedGalleryArt ? " · Art: Character Gallery" : ""}${placedToken ? " · Placed on scene" : ""}
                </div>
            </div>
        </div>
    `;

    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ alias: RANDOM_NPC_MACRO_NAME }),
        content: chatContent,
        whisper: gmIds,
        blind: true
    });

    ui.notifications.info(
        `Created ${npcName} (Level ${baseLevel} ${baseActor.name})${placedToken ? " and placed token on scene" : ""}.`
    );

    if (options.openSheet) {
        newActor.sheet?.render(true);
    }
}

// --- DIALOG LAUNCH (FOUNDRY V14 DIALOGV2) ---

export async function openRandomNpcDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the Game Master can generate random NPCs.");
        return;
    }

    ensureStylesheetLoaded();

    if (activeDialog) {
        try {
            await activeDialog.close();
        } catch {
            // Ignore if already closed
        }
        activeDialog = null;
    }

    const prefs = loadPreferences();
    const galleryInfo = detectGalleryModules();

    const availableNpcCount = NPC_CORE_PACKS.filter((id) => game.packs.has(id)).length;
    const availableBestiaryCount = BESTIARY_PACKS.filter((id) => game.packs.has(id)).length;

    const roleOptionsHtml = Object.entries(ROLE_DEFINITIONS)
        .map(([key, def]) => `<option value="${escapeHtml(key)}" ${prefs.role === key ? "selected" : ""}>${escapeHtml(def.label)}</option>`)
        .join("");

    const galleryStatusHtml = galleryInfo.available
        ? `<span class="rng-npc-status-pill active">Character Gallery detected (${galleryInfo.modules.map((m) => escapeHtml(m.title || m.id)).join(", ")})</span>`
        : `<span class="rng-npc-status-pill">Character Gallery module not active — using compendium artwork</span>`;

    const content = `
        <div class="rng-npc-dialog">
            <div class="rng-npc-grid-2">
                <div class="rng-npc-field">
                    <label for="rng-npc-level">NPC Level (-1 to 24)</label>
                    <input type="number" id="rng-npc-level" value="${Number.isFinite(prefs.level) ? prefs.level : 1}" min="-1" max="24" step="1" />
                </div>
                <div class="rng-npc-field">
                    <label for="rng-npc-role">Role / Creature Type</label>
                    <select id="rng-npc-role">
                        ${roleOptionsHtml}
                    </select>
                </div>
            </div>

            <div class="rng-npc-grid-2">
                <div class="rng-npc-field">
                    <label for="rng-npc-keyword">Trait / Keyword (Optional)</label>
                    <input type="text" id="rng-npc-keyword" value="${escapeHtml(prefs.keyword)}" placeholder="e.g. dwarf, elf, goblin, pirate..." />
                </div>
                <div class="rng-npc-field">
                    <label for="rng-npc-disposition">Default Disposition</label>
                    <select id="rng-npc-disposition">
                        <option value="neutral" ${prefs.disposition === "neutral" ? "selected" : ""}>Neutral (Indifferent)</option>
                        <option value="friendly" ${prefs.disposition === "friendly" ? "selected" : ""}>Friendly</option>
                        <option value="hostile" ${prefs.disposition === "hostile" ? "selected" : ""}>Hostile</option>
                    </select>
                </div>
            </div>

            <div class="rng-npc-grid-2">
                <div class="rng-npc-field">
                    <label for="rng-npc-name-mode">Name Style</label>
                    <select id="rng-npc-name-mode">
                        <option value="fantasy-full" ${prefs.nameMode === "fantasy-full" ? "selected" : ""}>Fantasy Name (First + Surname)</option>
                        <option value="fantasy-first" ${prefs.nameMode === "fantasy-first" ? "selected" : ""}>Fantasy First Name Only</option>
                        <option value="fantasy-with-title" ${prefs.nameMode === "fantasy-with-title" ? "selected" : ""}>Name + Statblock Role</option>
                        <option value="compendium" ${prefs.nameMode === "compendium" ? "selected" : ""}>PF2e Compendium Title Mix</option>
                    </select>
                </div>
                <div class="rng-npc-field">
                    <label for="rng-npc-custom-name">Custom Name (Optional)</label>
                    <input type="text" id="rng-npc-custom-name" value="" placeholder="Leave blank for random..." />
                </div>
            </div>

            <div class="rng-npc-section">
                <div class="rng-npc-section-title">Compendium Sources</div>
                <div class="rng-npc-checks-2">
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-src-npc" ${prefs.useNpcPacks ? "checked" : ""} ${availableNpcCount === 0 ? "disabled" : ""} />
                        NPC Core &amp; Gallery (${availableNpcCount})
                    </label>
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-src-bestiary" ${prefs.useBestiaries ? "checked" : ""} ${availableBestiaryCount === 0 ? "disabled" : ""} />
                        Monster Core &amp; Bestiaries (${availableBestiaryCount})
                    </label>
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-src-other" ${prefs.useOtherPacks ? "checked" : ""} />
                        Other installed Actor packs
                    </label>
                    <label class="rng-npc-check-label" title="If no exact level match exists, search within ±2 levels">
                        <input type="checkbox" id="rng-npc-level-flex" ${prefs.levelFlex ? "checked" : ""} />
                        Allow ±2 level fallback
                    </label>
                </div>
            </div>

            <div class="rng-npc-section">
                <div class="rng-npc-section-title">Artwork &amp; Details</div>
                <div>${galleryStatusHtml}</div>
                <div class="rng-npc-field" style="margin-top: 2px;">
                    <label for="rng-npc-art-mode">Portrait &amp; Token Art</label>
                    <select id="rng-npc-art-mode" ${!galleryInfo.available ? "disabled" : ""}>
                        <option value="auto" ${prefs.artMode === "auto" ? "selected" : ""}>Auto (Use Character Gallery for humanoids/NPCs)</option>
                        <option value="always" ${prefs.artMode === "always" ? "selected" : ""}>Always use Character Gallery</option>
                        <option value="compendium" ${prefs.artMode === "compendium" ? "selected" : ""}>Keep compendium artwork</option>
                    </select>
                </div>
                <div class="rng-npc-checks-2" style="margin-top: 2px;">
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-flavor" ${prefs.addFlavorAndLore ? "checked" : ""} />
                        Add RP flavor &amp; bonus Lore
                    </label>
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-folder" ${prefs.useFolder ? "checked" : ""} />
                        Save in "Generated NPCs" folder
                    </label>
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-place" ${prefs.placeToken ? "checked" : ""} ${!canvas?.scene ? "disabled" : ""} />
                        Place token on current scene
                    </label>
                    <label class="rng-npc-check-label">
                        <input type="checkbox" id="rng-npc-open-sheet" ${prefs.openSheet ? "checked" : ""} />
                        Open NPC sheet when created
                    </label>
                </div>
            </div>
        </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
        classes: ["rng-npc-window"],
        window: {
            title: RANDOM_NPC_MACRO_NAME,
            icon: "fa-solid fa-user-plus"
        },
        position: {
            width: 510,
            height: "auto"
        },
        content,
        buttons: [
            {
                action: "generate",
                label: "Generate NPC",
                icon: "fa-solid fa-dice",
                default: true,
                callback: async (_event, button, dlg) => {
                    const root = dialog.element ?? button?.form ?? dlg?.element;
                    let level = parseInt(root?.querySelector("#rng-npc-level")?.value ?? "1", 10);
                    if (Number.isNaN(level)) level = 1;
                    level = Math.max(-1, Math.min(24, level));

                    const options = {
                        level,
                        levelFlex: Boolean(root?.querySelector("#rng-npc-level-flex")?.checked),
                        role: root?.querySelector("#rng-npc-role")?.value || "any",
                        keyword: root?.querySelector("#rng-npc-keyword")?.value?.trim() || "",
                        disposition: root?.querySelector("#rng-npc-disposition")?.value || "neutral",
                        nameMode: root?.querySelector("#rng-npc-name-mode")?.value || "fantasy-full",
                        customName: root?.querySelector("#rng-npc-custom-name")?.value?.trim() || "",
                        useNpcPacks: Boolean(root?.querySelector("#rng-npc-src-npc")?.checked),
                        useBestiaries: Boolean(root?.querySelector("#rng-npc-src-bestiary")?.checked),
                        useOtherPacks: Boolean(root?.querySelector("#rng-npc-src-other")?.checked),
                        artMode: galleryInfo.available
                            ? (root?.querySelector("#rng-npc-art-mode")?.value || "auto")
                            : "compendium",
                        addFlavorAndLore: Boolean(root?.querySelector("#rng-npc-flavor")?.checked),
                        useFolder: Boolean(root?.querySelector("#rng-npc-folder")?.checked),
                        placeToken: Boolean(root?.querySelector("#rng-npc-place")?.checked),
                        openSheet: Boolean(root?.querySelector("#rng-npc-open-sheet")?.checked)
                    };

                    const { customName: _ignored, ...prefsToSave } = options;
                    savePreferences(prefsToSave);
                    await executeNpcGeneration(options);
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
}
