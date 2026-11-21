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
        addExtraSkills: false,
        addThematicActions: false,
        addTypeDefenses: false,
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

// --- CHARACTERISTIC-BASED EXTRA SKILLS, ACTIONS, PASSIVES & DEFENSES ---

const PF2E_LEVEL_DCS = {
    "-1": 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22,
    7: 23, 8: 24, 9: 26, 10: 27, 11: 28, 12: 30, 13: 31, 14: 32,
    15: 34, 16: 35, 17: 36, 18: 38, 19: 39, 20: 40, 21: 42,
    22: 44, 23: 46, 24: 48
};

/**
 * Returns the standard PF2e level-based DC for a creature's level.
 * @param {number} level
 * @returns {number}
 */
function computeLevelDC(level) {
    const clamped = Math.max(-1, Math.min(24, Math.round(Number(level) || 0)));
    return PF2E_LEVEL_DCS[clamped] ?? Math.round(14 + clamped * 1.4);
}

/**
 * Returns a level-scaled PF2e damage dice formula for minor/moderate bonus abilities.
 * @param {number} level
 * @param {"minor"|"moderate"} tier
 * @returns {string}
 */
function computeScaledDice(level, tier = "minor") {
    const lv = Math.max(0, Number(level) || 0);
    if (tier === "moderate") {
        const count = Math.max(1, Math.min(8, Math.floor(lv / 3) + 1));
        return `${count}d6`;
    }
    const count = Math.max(1, Math.min(5, Math.floor(lv / 5) + 1));
    return `${count}d6`;
}

/**
 * Inspects an NPC's name, traits, attacks, damage types, spells, and skills to detect themes.
 * @param {Actor} baseActor
 * @param {string} roleKey
 * @param {string} keyword
 * @returns {string[]} Ordered list of matched theme keys (most specific first)
 */
function analyzeNpcCharacteristics(baseActor, roleKey, keyword) {
    const themes = [];
    const addTheme = (key) => {
        if (key && !themes.includes(key)) themes.push(key);
    };

    const nameLower = String(baseActor.name || "").toLowerCase();
    const kwLower = String(keyword || "").toLowerCase();
    const combinedText = `${nameLower} ${kwLower}`;
    const traits = (baseActor.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());

    // Inspect attacks (weapons, ranged vs melee, damage types)
    const attackItems = (baseActor.items ?? []).filter((i) => i.type === "melee");
    const attackNames = attackItems.map((i) => String(i.name || "").toLowerCase());
    const attackTraits = attackItems.flatMap((i) => (i.system?.traits?.value ?? []).map((t) => String(t).toLowerCase()));
    const attackDamageTypes = [];
    for (const atk of attackItems) {
        for (const roll of Object.values(atk.system?.damageRolls ?? {})) {
            if (roll?.damageType) attackDamageTypes.push(String(roll.damageType).toLowerCase());
        }
    }

    const hasBowOrRanged =
        roleKey === "ranger" ||
        attackNames.some((n) => /\b(bow|longbow|shortbow|crossbow|sling|blowgun|javelin|dart)\b/.test(n)) ||
        attackTraits.some((t) => t.startsWith("range-increment") || t === "ranged") ||
        /\b(ranger|archer|hunter|sniper|scout|marksman|bowman|trapper)\b/.test(combinedText);

    const sysSkills = baseActor.system?.skills ?? {};
    const stealthMod = Number(sysSkills.stealth?.base ?? sysSkills.stealth?.value ?? 0);
    const thieveryMod = Number(sysSkills.thievery?.base ?? sysSkills.thievery?.value ?? 0);
    const hasShadowOrStealth =
        roleKey === "rogue" ||
        traits.includes("shadow") ||
        traits.includes("darkness") ||
        /\b(shadow|assassin|thief|rogue|bandit|spy|stalker|ninja|cutthroat|burglar|smuggler|night|shade|drow|skulk)\b/.test(combinedText) ||
        stealthMod >= 6 ||
        thieveryMod >= 6;

    const hasNaturalAttack = attackNames.some((n) => /\b(jaws|bite|claw|fang|talon|horn|stinger|tail|beak|tentacle|hoof|tusk)\b/.test(n));
    const hasMartialWeapon =
        roleKey === "fighter" ||
        attackNames.some((n) => /\b(sword|axe|spear|halberd|glaive|hammer|mace|flail|shield|lance|pike|greatsword|warhammer|morningstar)\b/.test(n)) ||
        /\b(guard|soldier|knight|warrior|fighter|mercenary|captain|gladiator|barbarian|berserker|veteran|watch)\b/.test(combinedText);

    const spellEntries = (baseActor.items ?? []).filter((i) => i.type === "spellcastingEntry");
    const traditions = spellEntries.map((e) => String(e.system?.tradition?.value || "").toLowerCase());

    const isDivine =
        roleKey === "cleric" ||
        traditions.includes("divine") ||
        traits.includes("holy") ||
        traits.includes("celestial") ||
        /\b(cleric|priest|acolyte|healer|paladin|champion|oracle|monk|templar|chaplain|inquisitor)\b/.test(combinedText);

    const isCaster =
        roleKey === "caster" ||
        spellEntries.length > 0 ||
        traits.some((t) => ["arcane", "occult", "primal"].includes(t)) ||
        /\b(wizard|mage|sorcerer|witch|druid|bard|alchemist|arcanist|necromancer|scholar|sage|enchanter)\b/.test(combinedText);

    const isSocial =
        roleKey === "civilian" ||
        /\b(merchant|noble|commoner|barkeep|bartender|innkeeper|artisan|diplomat|courtier|entertainer|smith|apothecary|barrister|judge)\b/.test(combinedText);

    // Specific elemental / creature-type themes first
    if (traits.includes("fire") || attackDamageTypes.includes("fire") || /\b(fire|flame|pyro|cinder|ember)\b/.test(combinedText)) addTheme("fire");
    if (traits.includes("cold") || attackDamageTypes.includes("cold") || /\b(frost|ice|cold|winter|rime)\b/.test(combinedText)) addTheme("cold");
    if (traits.includes("electricity") || attackDamageTypes.includes("electricity") || /\b(storm|lightning|spark|thunder)\b/.test(combinedText)) addTheme("electricity");
    if (traits.includes("acid") || attackDamageTypes.includes("acid") || /\b(acid|ooze|caustic)\b/.test(combinedText)) addTheme("acid");
    if (traits.includes("poison") || attackDamageTypes.includes("poison") || /\b(venom|poison|viper|spider|assassin)\b/.test(combinedText)) addTheme("poison");
    if (traits.includes("undead") || attackDamageTypes.includes("void")) addTheme("undead");
    if (traits.includes("fey")) addTheme("fey");
    if (traits.includes("fiend")) addTheme("fiend");
    if (traits.includes("celestial")) addTheme("celestial");
    if (traits.includes("construct")) addTheme("construct");
    if (traits.includes("plant")) addTheme("plant");
    if (traits.includes("dragon")) addTheme("dragon");

    // Combat style & role themes
    if (hasShadowOrStealth) addTheme("stealth-shadow");
    if (hasBowOrRanged) addTheme("ranged-bow");
    if (isDivine) addTheme("divine-healer");
    if (isCaster) addTheme("spellcaster");
    if (hasMartialWeapon) addTheme("martial-melee");
    if (traits.includes("beast") || traits.includes("animal") || hasNaturalAttack) addTheme("beast-predator");
    if (isSocial) addTheme("social-civilian");

    if (themes.length === 0) {
        addTheme("humanoid");
    }

    return themes;
}

const THEME_EXTRA_SKILLS = {
    "stealth-shadow": ["stealth", "thievery", "deception", "acrobatics", "occultism"],
    "ranged-bow": ["stealth", "survival", "acrobatics", "nature", "athletics"],
    "martial-melee": ["athletics", "intimidation", "acrobatics", "society"],
    "divine-healer": ["religion", "medicine", "diplomacy", "intimidation"],
    "spellcaster": ["arcana", "occultism", "nature", "crafting", "society"],
    "social-civilian": ["diplomacy", "deception", "society", "performance", "crafting"],
    "beast-predator": ["athletics", "stealth", "survival", "acrobatics", "intimidation"],
    fire: ["intimidation", "acrobatics", "athletics"],
    cold: ["survival", "stealth", "athletics"],
    electricity: ["acrobatics", "stealth", "intimidation"],
    acid: ["crafting", "stealth", "athletics"],
    poison: ["stealth", "nature", "medicine", "thievery"],
    undead: ["intimidation", "stealth", "religion", "occultism"],
    fey: ["deception", "nature", "performance", "stealth"],
    fiend: ["intimidation", "deception", "religion", "arcana"],
    celestial: ["diplomacy", "religion", "medicine", "intimidation"],
    construct: ["athletics", "crafting", "intimidation"],
    plant: ["nature", "stealth", "survival", "athletics"],
    dragon: ["intimidation", "arcana", "athletics", "diplomacy"],
    humanoid: ["diplomacy", "athletics", "stealth", "survival", "society"]
};

const THEME_BONUS_LORES = {
    "stealth-shadow": "Shadow Lore",
    "ranged-bow": "Archery Lore",
    "martial-melee": "Tactics Lore",
    "divine-healer": "Theology Lore",
    "spellcaster": "Esoteric Lore",
    "social-civilian": "Mercantile Lore",
    "beast-predator": "Hunting Lore",
    undead: "Necromancy Lore",
    fey: "First World Lore",
    dragon: "Draconic Lore"
};

/**
 * Adds 1-2 missing characteristic-matched standard PF2e skills (and a niche Lore if applicable).
 * @param {object} actorData
 * @param {Actor} baseActor
 * @param {number} baseLevel
 * @param {string[]} themes
 * @returns {string[]} Human-readable list of added skills
 */
function applyExtraThematicSkills(actorData, baseActor, baseLevel, themes) {
    actorData.system = actorData.system || {};
    actorData.system.skills = actorData.system.skills || {};

    const candidateSlugs = [];
    for (const theme of themes) {
        for (const slug of THEME_EXTRA_SKILLS[theme] ?? []) {
            if (!candidateSlugs.includes(slug)) candidateSlugs.push(slug);
        }
    }

    const missingSlugs = candidateSlugs.filter((slug) => {
        const existing = actorData.system.skills[slug];
        const baseVal = Number(existing?.base ?? existing?.value ?? 0);
        return !Number.isFinite(baseVal) || baseVal === 0;
    });

    const added = [];
    const baseMod = computeLoreModifier(baseActor, baseLevel);
    const toAddCount = Math.min(2, missingSlugs.length);

    // Shuffle missing candidates slightly while keeping primary theme priority
    const pool = missingSlugs.slice(0, Math.min(5, missingSlugs.length));
    for (let i = 0; i < toAddCount && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const slug = pool.splice(idx, 1)[0];
        const skillMod = Math.max(2, baseMod - i);
        actorData.system.skills[slug] = { base: skillMod };
        const label = slug.charAt(0).toUpperCase() + slug.slice(1);
        added.push(`${label} +${skillMod}`);
    }

    // Add a thematic Lore if a primary theme defines one and it doesn't exist yet
    for (const theme of themes) {
        const loreName = THEME_BONUS_LORES[theme];
        if (!loreName) continue;
        const alreadyHas = (actorData.items ?? []).some(
            (i) => i.type === "lore" && String(i.name || "").toLowerCase() === loreName.toLowerCase()
        );
        if (!alreadyHas) {
            const loreMod = Math.max(2, baseMod);
            actorData.items = actorData.items || [];
            actorData.items.push({
                name: loreName,
                type: "lore",
                system: { mod: { value: loreMod } }
            });
            added.push(`${loreName} +${loreMod}`);
            break;
        }
    }

    return added;
}

/**
 * Returns themed PF2e action/reaction/passive blueprints scaled to the NPC's level.
 * @param {string} theme
 * @param {number} level
 * @returns {Array<object>}
 */
let conditionIndexPromise = null;

/**
 * Loads and caches the PF2e conditionitems compendium index for real @UUID condition links.
 * @returns {Promise<Map<string, string>>} Map of lowercase condition name -> Compendium UUID
 */
async function getConditionUuidMap() {
    if (conditionIndexPromise) return conditionIndexPromise;

    conditionIndexPromise = (async () => {
        const map = new Map();
        const pack = game.packs.get("pf2e.conditionitems");
        if (!pack) return map;
        try {
            const index = await pack.getIndex();
            for (const entry of index) {
                if (!entry?.name) continue;
                const uuid = entry.uuid || `Compendium.pf2e.conditionitems.Item.${entry._id}`;
                map.set(entry.name.toLowerCase(), uuid);
            }
        } catch {
            // Fall back to plain bold condition names
        }
        return map;
    })();

    return conditionIndexPromise;
}

/**
 * Formats a PF2e condition as a real clickable/draggable @UUID link (or bold text fallback).
 * @param {Map<string, string>} condUuidMap
 * @param {string} condName Display name (e.g. "Concealed", "Off-Guard", "Frightened")
 * @param {number|null} value Optional rank value
 * @returns {string}
 */
function formatConditionLink(condUuidMap, condName, value = null) {
    const label = value !== null && value !== undefined ? `${condName} ${value}` : condName;
    const uuid = condUuidMap?.get(condName.toLowerCase());
    if (uuid) {
        return `@UUID[${uuid}]{${label}}`;
    }
    return `<strong>${label.toLowerCase()}</strong>`;
}

/**
 * Returns themed PF2e action/reaction/passive blueprints scaled to the NPC's level.
 * @param {string} theme
 * @param {number} level
 * @param {Map<string, string>} condUuidMap
 * @returns {Array<object>}
 */
function getThemeActionBlueprints(theme, level, condUuidMap) {
    const dc = computeLevelDC(level);
    const minorDice = computeScaledDice(level, "minor");
    const modDice = computeScaledDice(level, "moderate");
    const tempHp = Math.max(4, Math.round(Math.max(0, level) * 2 + 4));
    const cond = (name, val = null) => formatConditionLink(condUuidMap, name, val);

    const catalog = {
        "stealth-shadow": [
            {
                name: "Shadow Slip",
                actionType: "action",
                actions: 1,
                category: "defensive",
                traits: ["shadow"],
                description: `<p>While in dim light, darkness, or adjacent to cover, the creature Strides up to half its Speed and attempts to Hide. It becomes ${cond("Concealed")} until the start of its next turn.</p>`
            },
            {
                name: "Gloom Ambush",
                actionType: "passive",
                actions: null,
                category: "offensive",
                traits: ["shadow"],
                description: `<p>The creature's Strikes deal an extra @Damage[${minorDice}[precision]] damage to ${cond("Off-Guard")} targets. Once per round on a hit against an off-guard foe, the target must succeed at a @Check[fortitude|dc:${dc}] save or become ${cond("Dazzled")} until the end of its next turn.</p>`
            },
            {
                name: "Smoke Veil Escape",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: ["shadow"],
                description: `<p><strong>Trigger</strong> The creature takes damage from a melee Strike. <strong>Effect</strong> It releases a brief puff of dark smoke, Stepping 5 feet away and becoming ${cond("Concealed")} until the start of its next turn.</p>`
            }
        ],
        "ranged-bow": [
            {
                name: "Pinning Shot",
                actionType: "action",
                actions: 2,
                category: "offensive",
                traits: [],
                description: `<p>The creature makes a ranged Strike. On a hit, the target takes normal damage and must attempt a @Check[reflex|dc:${dc}] save or become ${cond("Immobilized")} (Escape DC ${dc}) as the projectile pins its clothing or limb.</p>`
            },
            {
                name: "Skirmisher's Volley",
                actionType: "action",
                actions: 2,
                category: "offensive",
                traits: [],
                description: `<p>The creature makes two ranged Strikes against two different targets within its first range increment. Both attacks count toward multiple attack penalty, but the penalty doesn't increase until after both Strikes.</p>`
            },
            {
                name: "Keen-Eyed Marksman",
                actionType: "passive",
                actions: null,
                category: "offensive",
                traits: [],
                description: `<p>The creature's ranged Strikes ignore the ${cond("Concealed")} condition from dim light or foliage and reduce a target's circumstance bonus from lesser or standard cover by 1.</p>`
            }
        ],
        "martial-melee": [
            {
                name: "Crushing Blow",
                actionType: "action",
                actions: 2,
                category: "offensive",
                traits: [],
                description: `<p>The creature makes a melee Strike. On a hit, it deals an extra @Damage[${minorDice}[bludgeoning]] damage and the target must succeed at a @Check[fortitude|dc:${dc}] save or be knocked ${cond("Prone")}.</p>`
            },
            {
                name: "Press the Advantage",
                actionType: "reaction",
                actions: null,
                category: "offensive",
                traits: [],
                description: `<p><strong>Trigger</strong> An adjacent enemy critically misses the creature with a melee Strike. <strong>Effect</strong> The creature makes a melee Strike against the triggering enemy.</p>`
            },
            {
                name: "Bracing Guard",
                actionType: "action",
                actions: 1,
                category: "defensive",
                traits: [],
                description: `<p>The creature plants its feet and raises its guard, gaining a +1 circumstance bonus to AC and to its Fortitude DC against Shove and Trip until the start of its next turn.</p>`
            }
        ],
        "divine-healer": [
            {
                name: "Mending Prayer",
                actionType: "action",
                actions: 2,
                category: "defensive",
                traits: ["divine", "healing"],
                description: `<p><strong>Frequency</strong> once per encounter. The creature touches itself or an adjacent ally, restoring @Damage[${modDice}[healing]] Hit Points and granting a +1 status bonus to saving throws until the start of the creature's next turn.</p>`
            },
            {
                name: "Sanctified Rebuke",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: ["divine"],
                description: `<p><strong>Trigger</strong> An enemy within 15 feet damages an ally. <strong>Effect</strong> The triggering enemy must attempt a @Check[will|dc:${dc}] save or become ${cond("Enfeebled", 1)} until the end of its next turn.</p>`
            },
            {
                name: "Zealous Resolve",
                actionType: "passive",
                actions: null,
                category: "defensive",
                traits: ["divine"],
                description: `<p>Once per encounter, when reduced to half its maximum Hit Points or fewer, the creature gains ${tempHp} temporary Hit Points for 1 minute.</p>`
            }
        ],
        spellcaster: [
            {
                name: "Arcane Ward",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: ["magical"],
                description: `<p><strong>Frequency</strong> once per minute. <strong>Trigger</strong> The creature is targeted by an attack or spell. <strong>Effect</strong> It conjures a shimmering barrier, gaining a +2 circumstance bonus to AC or its Reflex save against the triggering effect.</p>`
            },
            {
                name: "Volatile Surge",
                actionType: "action",
                actions: 1,
                category: "offensive",
                traits: ["concentrate", "magical"],
                description: `<p>The creature channels unstable energy into its next offensive spell or Strike this turn, adding @Damage[${minorDice}[force]] damage on a hit or failed save.</p>`
            }
        ],
        "social-civilian": [
            {
                name: "Silver-Tongued Deflection",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: ["auditory", "linguistic"],
                description: `<p><strong>Trigger</strong> A creature targets this NPC with an attack or Intimidation check. <strong>Effect</strong> The NPC offers a sharp distraction or plea; the attacker must succeed at a @Check[will|dc:${dc}] save or take a -1 circumstance penalty to the triggering check.</p>`
            },
            {
                name: "Appraiser's Eye",
                actionType: "passive",
                actions: null,
                category: "interaction",
                traits: [],
                description: `<p>The NPC automatically spots obvious forgeries and estimates the value of mundane gear on sight, gaining a +2 circumstance bonus to Perception checks to Sense Motive.</p>`
            }
        ],
        "beast-predator": [
            {
                name: "Pouncing Lunge",
                actionType: "action",
                actions: 2,
                category: "offensive",
                traits: [],
                description: `<p>The creature Strides up to its Speed and makes a melee Strike. If it moved at least 10 feet, the target is ${cond("Off-Guard")} against this Strike.</p>`
            },
            {
                name: "Predator's Instinct",
                actionType: "passive",
                actions: null,
                category: "defensive",
                traits: [],
                description: `<p>The creature cannot be flanked by creatures of equal or lower level unless those creatures are ${cond("Hidden")} or ${cond("Undetected")}.</p>`
            }
        ],
        fire: [
            {
                name: "Cinder Burst",
                actionType: "action",
                actions: 2,
                category: "offensive",
                traits: ["fire"],
                description: `<p><strong>Frequency</strong> once per encounter. A burst of embers erupts in a 10-foot emanation, dealing @Damage[${modDice}[fire]] damage (@Check[reflex|dc:${dc}|basic:true] save).</p>`
            }
        ],
        cold: [
            {
                name: "Rime Chill",
                actionType: "passive",
                actions: null,
                category: "defensive",
                traits: ["cold"],
                description: `<p>Creatures that begin their turn adjacent to this creature must succeed at a @Check[fortitude|dc:${dc}] save or take a -5-foot status penalty to Speed until the end of their turn.</p>`
            }
        ],
        electricity: [
            {
                name: "Static Arc",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: ["electricity"],
                description: `<p><strong>Trigger</strong> A creature hits this creature with a melee Strike using a metal weapon or unarmed attack. <strong>Effect</strong> The attacker takes @Damage[${minorDice}[electricity]] damage (@Check[reflex|dc:${dc}|basic:true] save).</p>`
            }
        ],
        poison: [
            {
                name: "Venomous Coating",
                actionType: "action",
                actions: 1,
                category: "offensive",
                traits: ["poison"],
                description: `<p>The creature coats its next Strike this turn with toxin. On a hit, the target must succeed at a @Check[fortitude|dc:${dc}] save or take @Damage[${minorDice}[poison,persistent]] damage.</p>`
            }
        ],
        undead: [
            {
                name: "Chilling Dread",
                actionType: "action",
                actions: 1,
                category: "offensive",
                traits: ["emotion", "fear", "mental"],
                description: `<p>One living creature within 30 feet must attempt a @Check[will|dc:${dc}] save or become ${cond("Frightened", 1)} (${cond("Frightened", 2)} on a critical failure). The target is then temporarily immune for 1 minute.</p>`
            }
        ],
        fey: [
            {
                name: "Fey Blink",
                actionType: "action",
                actions: 1,
                category: "defensive",
                traits: ["primal", "teleportation"],
                description: `<p><strong>Frequency</strong> once per encounter. The creature vanishes in a shimmer of leaves or starlight and teleports up to 15 feet to an unoccupied space it can see.</p>`
            }
        ],
        construct: [
            {
                name: "Reinforced Plating",
                actionType: "passive",
                actions: null,
                category: "defensive",
                traits: [],
                description: `<p>The construct's layered plates cushion vital joints, reducing extra damage from critical hits by ${Math.max(2, Math.round(Math.max(1, level)))}.</p>`
            }
        ],
        plant: [
            {
                name: "Grasping Roots",
                actionType: "action",
                actions: 1,
                category: "offensive",
                traits: ["plant"],
                description: `<p>Roots and vines erupt in a 10-foot burst within 30 feet, turning the area into difficult terrain until the start of the creature's next turn.</p>`
            }
        ],
        humanoid: [
            {
                name: "Quick Improvisation",
                actionType: "reaction",
                actions: null,
                category: "defensive",
                traits: [],
                description: `<p><strong>Frequency</strong> once per encounter. <strong>Trigger</strong> The NPC fails a Reflex or Will saving throw. <strong>Effect</strong> It gains a +1 circumstance bonus to the triggering save.</p>`
            }
        ]
    };

    return catalog[theme] ?? [];
}

/**
 * Adds 1-2 characteristic-matched PF2e action/reaction/passive items to the NPC.
 * @param {object} actorData
 * @param {number} baseLevel
 * @param {string[]} themes
 * @returns {Promise<string[]>} Names of added abilities
 */
async function applyThematicActionsAndPassives(actorData, baseLevel, themes) {
    actorData.items = actorData.items || [];
    const existingNames = new Set(actorData.items.map((i) => String(i.name || "").toLowerCase()));
    const condUuidMap = await getConditionUuidMap();

    const pool = [];
    for (const theme of themes) {
        for (const bp of getThemeActionBlueprints(theme, baseLevel, condUuidMap)) {
            if (!existingNames.has(bp.name.toLowerCase()) && !pool.some((p) => p.name === bp.name)) {
                pool.push(bp);
            }
        }
    }

    if (pool.length === 0) return [];

    const addedLabels = [];
    const count = Math.min(2, pool.length);
    // Prioritize first matched theme for #1, then vary across remaining pool for #2
    const chosen = [];
    chosen.push(pool.shift());
    if (count > 1 && pool.length > 0) {
        chosen.push(pickRandom(pool));
    }

    for (const bp of chosen) {
        if (!bp) continue;
        actorData.items.push({
            name: bp.name,
            type: "action",
            system: {
                description: { value: bp.description },
                actionType: { value: bp.actionType },
                actions: { value: bp.actions },
                category: bp.category,
                traits: { value: bp.traits }
            }
        });
        const costTag = bp.actionType === "action"
            ? `${bp.actions}A`
            : bp.actionType === "reaction"
                ? "Reaction"
                : "Passive";
        addedLabels.push(`${bp.name} (${costTag})`);
    }

    return addedLabels;
}

const THEME_DEFENSE_OPTIONS = {
    fire: [{ kind: "resistance", type: "fire" }, { kind: "immunity", type: "fire", minLevel: 7 }],
    cold: [{ kind: "resistance", type: "cold" }, { kind: "immunity", type: "cold", minLevel: 7 }],
    electricity: [{ kind: "resistance", type: "electricity" }, { kind: "immunity", type: "electricity", minLevel: 7 }],
    acid: [{ kind: "resistance", type: "acid" }, { kind: "immunity", type: "acid", minLevel: 7 }],
    poison: [{ kind: "resistance", type: "poison" }, { kind: "immunity", type: "poison", minLevel: 6 }],
    "stealth-shadow": [{ kind: "resistance", type: "void" }, { kind: "resistance", type: "cold" }, { kind: "resistance", type: "mental" }],
    undead: [{ kind: "immunity", type: "bleed" }, { kind: "immunity", type: "poison" }, { kind: "resistance", type: "void" }, { kind: "resistance", type: "cold" }],
    construct: [{ kind: "immunity", type: "bleed" }, { kind: "immunity", type: "poison" }, { kind: "resistance", type: "physical", exceptions: ["adamantine"] }],
    fey: [{ kind: "resistance", type: "mental" }, { kind: "resistance", type: "cold" }, { kind: "resistance", type: "physical", exceptions: ["cold-iron"] }],
    fiend: [{ kind: "resistance", type: "fire" }, { kind: "resistance", type: "poison" }],
    celestial: [{ kind: "resistance", type: "fire" }, { kind: "resistance", type: "vitality" }, { kind: "resistance", type: "mental" }],
    plant: [{ kind: "resistance", type: "poison" }, { kind: "resistance", type: "bludgeoning" }, { kind: "resistance", type: "piercing" }],
    dragon: [{ kind: "resistance", type: "fire" }, { kind: "resistance", type: "cold" }, { kind: "resistance", type: "acid" }, { kind: "resistance", type: "electricity" }],
    "beast-predator": [{ kind: "resistance", type: "cold" }, { kind: "resistance", type: "poison" }, { kind: "resistance", type: "bludgeoning" }],
    "martial-melee": [{ kind: "resistance", type: "bludgeoning" }, { kind: "resistance", type: "slashing" }, { kind: "resistance", type: "piercing" }],
    "ranged-bow": [{ kind: "resistance", type: "piercing" }, { kind: "resistance", type: "cold" }, { kind: "resistance", type: "poison" }],
    "divine-healer": [{ kind: "resistance", type: "void" }, { kind: "resistance", type: "mental" }, { kind: "immunity", type: "disease", minLevel: 4 }],
    spellcaster: [{ kind: "resistance", type: "force" }, { kind: "resistance", type: "mental" }, { kind: "resistance", type: "fire" }],
    "social-civilian": [{ kind: "resistance", type: "mental" }, { kind: "resistance", type: "poison" }],
    humanoid: [{ kind: "resistance", type: "mental" }, { kind: "resistance", type: "poison" }]
};

/**
 * Adds 1 type- or characteristic-appropriate resistance or immunity to the NPC.
 * @param {object} actorData
 * @param {number} baseLevel
 * @param {string[]} themes
 * @returns {string} Human-readable summary of added defense (or empty string)
 */
function applyTypeResistancesOrImmunities(actorData, baseLevel, themes) {
    actorData.system = actorData.system || {};
    actorData.system.attributes = actorData.system.attributes || {};
    const resistances = Array.isArray(actorData.system.attributes.resistances)
        ? actorData.system.attributes.resistances
        : (actorData.system.attributes.resistances = []);
    const immunities = Array.isArray(actorData.system.attributes.immunities)
        ? actorData.system.attributes.immunities
        : (actorData.system.attributes.immunities = []);

    const existingTypes = new Set([
        ...resistances.map((r) => String(r?.type || "").toLowerCase()),
        ...immunities.map((i) => String(i?.type || "").toLowerCase())
    ]);

    const candidates = [];
    for (const theme of themes) {
        for (const opt of THEME_DEFENSE_OPTIONS[theme] ?? []) {
            if (opt.minLevel !== undefined && baseLevel < opt.minLevel) continue;
            if (existingTypes.has(opt.type)) continue;
            if (!candidates.some((c) => c.kind === opt.kind && c.type === opt.type)) {
                candidates.push(opt);
            }
        }
    }

    const picked = pickRandom(candidates.slice(0, 4));
    if (!picked) return "";

    if (picked.kind === "immunity") {
        immunities.push({
            type: picked.type,
            exceptions: picked.exceptions ?? []
        });
        return `Immunity: ${picked.type}`;
    }

    const resValue = Math.max(2, Math.min(15, Math.round(2 + Math.max(0, baseLevel) * 0.75)));
    resistances.push({
        type: picked.type,
        value: resValue,
        exceptions: picked.exceptions ?? [],
        doubleVs: []
    });
    const exNote = picked.exceptions?.length ? ` (except ${picked.exceptions.join(", ")})` : "";
    return `Resistance: ${picked.type} ${resValue}${exNote}`;
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

    // Optional characteristic-matched extras (skills, actions/passives, resistances/immunities)
    const detectedThemes = analyzeNpcCharacteristics(baseActor, options.role, options.keyword);
    const addedExtraSkills = options.addExtraSkills
        ? applyExtraThematicSkills(actorData, baseActor, baseLevel, detectedThemes)
        : [];
    const addedActions = options.addThematicActions
        ? await applyThematicActionsAndPassives(actorData, baseLevel, detectedThemes)
        : [];
    const addedDefense = options.addTypeDefenses
        ? applyTypeResistancesOrImmunities(actorData, baseLevel, detectedThemes)
        : "";

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
    }

    const hasProfileExtras = Boolean(
        options.addFlavorAndLore ||
        addedExtraSkills.length > 0 ||
        addedActions.length > 0 ||
        addedDefense
    );

    if (hasProfileExtras) {
        const flavorBlock = `
            <hr />
            <h3>Generated NPC Profile</h3>
            <p><strong>Base Statblock:</strong> ${escapeHtml(baseActor.name)} (Level ${baseLevel} · ${escapeHtml(picked.pack.metadata?.label || picked.pack.collection)})</p>
            ${personality ? `<p><strong>Personality:</strong> ${escapeHtml(personality)}</p>` : ""}
            ${mannerism ? `<p><strong>Mannerism:</strong> ${escapeHtml(mannerism)}</p>` : ""}
            ${motivation ? `<p><strong>Motivation:</strong> ${escapeHtml(motivation)}</p>` : ""}
            ${addedLoreText ? `<p><strong>Added Role Lore:</strong> ${escapeHtml(addedLoreText)}</p>` : ""}
            ${addedExtraSkills.length > 0 ? `<p><strong>Added Extra Skills:</strong> ${escapeHtml(addedExtraSkills.join(", "))}</p>` : ""}
            ${addedActions.length > 0 ? `<p><strong>Added Abilities:</strong> ${escapeHtml(addedActions.join(", "))}</p>` : ""}
            ${addedDefense ? `<p><strong>Added Defense:</strong> ${escapeHtml(addedDefense)}</p>` : ""}
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
                ${addedExtraSkills.length > 0 ? `<div><strong>Bonus Skills:</strong> ${escapeHtml(addedExtraSkills.join(", "))}</div>` : ""}
                ${addedActions.length > 0 ? `<div><strong>Bonus Abilities:</strong> ${escapeHtml(addedActions.join(", "))}</div>` : ""}
                ${addedDefense ? `<div><strong>Bonus Defense:</strong> ${escapeHtml(addedDefense)}</div>` : ""}
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
                    <label class="rng-npc-check-label" title="Adds 1–2 missing PF2e skills matched to the creature's name, weapons, or traits">
                        <input type="checkbox" id="rng-npc-extra-skills" ${prefs.addExtraSkills ? "checked" : ""} />
                        Add extra thematic skills
                    </label>
                    <label class="rng-npc-check-label" title="Adds 1–2 characteristic-matched PF2e actions, reactions, or passives (e.g. bow shots, shadow tricks)">
                        <input type="checkbox" id="rng-npc-extra-actions" ${prefs.addThematicActions ? "checked" : ""} />
                        Add thematic action / passive
                    </label>
                    <label class="rng-npc-check-label" title="Adds a level-scaled resistance or immunity matched to the creature's type or theme">
                        <input type="checkbox" id="rng-npc-extra-defenses" ${prefs.addTypeDefenses ? "checked" : ""} />
                        Add type resistance / immunity
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
                        addExtraSkills: Boolean(root?.querySelector("#rng-npc-extra-skills")?.checked),
                        addThematicActions: Boolean(root?.querySelector("#rng-npc-extra-actions")?.checked),
                        addTypeDefenses: Boolean(root?.querySelector("#rng-npc-extra-defenses")?.checked),
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
