/**
 * PF2e Journal to HTML Export Macro (Foundry VTT v14)
 * Exports Foundry Journal Entries to a clean, self-contained HTML file
 * tailored for offline GM prep on desktop browsers and e-readers (Kindle).
 *
 * Features:
 * - Cleans PF2e & Foundry enrichers (@UUID, @Compendium, @Check, @Damage,
 *   @Template, @Condition, @Localize, @Embed, inline rolls [[/r ...]], [[/act ...]])
 * - Eliminates duplicate headers, empty spacing artifacts, broken inline styles,
 *   and orphaned FontAwesome icon boxes
 * - Preserves folder & page sort order (including nested folders and image pages)
 * - Optionally embeds images directly as Base64 Data URIs (Kindle-optimized or full-res)
 * - Optional Table of Contents, GM Secret blocks, and page breaks
 */

export const JOURNAL_EXPORT_MACRO_NAME = "Export Journals";
export const JOURNAL_EXPORT_MACRO_ICON = "icons/svg/door-exit.svg";

const MODULE_ID = "pf2e-awesome-macros-for-gms";
const STYLESHEET_HREF = `modules/${MODULE_ID}/styles/journal-to-html-export.css`;
const PREFS_STORAGE_KEY = "pf2e-awesome-macros.journalExportPrefs";

const KNOWN_ENRICHERS = new Set([
    "uuid",
    "compendium",
    "check",
    "damage",
    "template",
    "condition",
    "localize",
    "embed",
    "actor",
    "item",
    "journalentry",
    "journalentrypage",
    "rolltable",
    "scene",
    "macro",
    "playlist",
    "action"
]);

let activeDialog = null;

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
 * Normalizes a heading string for duplicate-header comparison.
 * @param {string} text
 * @returns {string}
 */
function normalizeTitle(text) {
    return String(text || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase();
}

/**
 * Converts a hyphenated/slugged identifier into readable Title Case.
 * @param {string} slug
 * @returns {string}
 */
function humanizeSlug(slug) {
    const cleaned = String(slug || "").trim();
    if (!cleaned) return "";
    return cleaned
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
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
 * Loads saved export preferences from localStorage.
 * @returns {{ imageMode: string, includeToc: boolean, includeSecrets: boolean, pageBreaks: boolean }}
 */
function loadPreferences() {
    const defaults = {
        imageMode: "none",
        includeToc: true,
        includeSecrets: true,
        pageBreaks: false
    };
    try {
        const raw = globalThis.localStorage?.getItem(PREFS_STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
            imageMode: ["none", "kindle", "original"].includes(parsed.imageMode) ? parsed.imageMode : defaults.imageMode,
            includeToc: typeof parsed.includeToc === "boolean" ? parsed.includeToc : defaults.includeToc,
            includeSecrets: typeof parsed.includeSecrets === "boolean" ? parsed.includeSecrets : defaults.includeSecrets,
            pageBreaks: typeof parsed.pageBreaks === "boolean" ? parsed.pageBreaks : defaults.pageBreaks
        };
    } catch {
        return defaults;
    }
}

/**
 * Persists export preferences to localStorage.
 * @param {object} prefs
 */
function savePreferences(prefs) {
    try {
        globalThis.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Triggers a browser file download.
 * @param {string} content
 * @param {string} contentType
 * @param {string} fileName
 */
function saveDataToFile(content, contentType, fileName) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// --- ENRICHER & TEXT CLEANING HELPERS ---

/**
 * Resolves a human-readable document name from a Foundry UUID or legacy reference synchronously.
 * @param {string} tag Lowercase tag name
 * @param {string} target Raw target string inside brackets
 * @returns {string}
 */
function resolveDocumentName(tag, target, relativeDoc = null) {
    const cleanTarget = String(target || "").trim();
    if (!cleanTarget) return "";

    try {
        if (tag === "uuid" || tag === "embed") {
            const doc = typeof fromUuidSync === "function"
                ? fromUuidSync(cleanTarget, relativeDoc ? { relative: relativeDoc } : undefined)
                : null;
            if (doc?.name) return doc.name;
        } else if (tag === "compendium") {
            const uuid = cleanTarget.startsWith("Compendium.") ? cleanTarget : `Compendium.${cleanTarget}`;
            const doc = typeof fromUuidSync === "function" ? fromUuidSync(uuid) : null;
            if (doc?.name) return doc.name;

            const parts = cleanTarget.split(".");
            if (parts.length >= 3) {
                const packId = `${parts[0]}.${parts[1]}`;
                const entryKey = parts.slice(2).join(".");
                const pack = game.packs?.get(packId);
                const indexEntry = pack?.index?.get(entryKey) || pack?.index?.find((e) => e.name === entryKey);
                if (indexEntry?.name) return indexEntry.name;
            }
        } else {
            const collectionMap = {
                actor: game.actors,
                item: game.items,
                journalentry: game.journal,
                rolltable: game.tables,
                scene: game.scenes,
                macro: game.macros,
                playlist: game.playlists
            };
            const collection = collectionMap[tag];
            if (collection) {
                const doc = collection.get(cleanTarget) || collection.getName?.(cleanTarget);
                if (doc?.name) return doc.name;
            }
        }
    } catch {
        // Ignore lookup failures
    }

    // Fallback: if the last segment looks like a human name (not a 16-char alphanumeric Foundry ID), use it
    const lastSeg = cleanTarget.split(".").pop()?.trim() || "";
    if (lastSeg && !/^[A-Za-z0-9]{16}$/.test(lastSeg)) {
        return lastSeg;
    }
    return "";
}

/**
 * Splits a string by a top-level delimiter, ignoring nested brackets/braces/parentheses.
 * @param {string} input
 * @param {string} delimiter Single character delimiter
 * @returns {string[]}
 */
function splitTopLevel(input, delimiter) {
    const parts = [];
    let current = "";
    let sqDepth = 0;
    let curlyDepth = 0;
    let parenDepth = 0;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "[") sqDepth++;
        else if (ch === "]" && sqDepth > 0) sqDepth--;
        else if (ch === "{") curlyDepth++;
        else if (ch === "}" && curlyDepth > 0) curlyDepth--;
        else if (ch === "(") parenDepth++;
        else if (ch === ")" && parenDepth > 0) parenDepth--;

        if (ch === delimiter && sqDepth === 0 && curlyDepth === 0 && parenDepth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.length > 0 || parts.length > 0) {
        parts.push(current);
    }
    return parts;
}

/**
 * Formats a single PF2e damage expression such as "(2d8+4)[piercing,silver]" or "1d6[bleed,persistent]".
 * @param {string} rawTerm
 * @returns {string}
 */
function formatSingleDamageTerm(rawTerm) {
    const trimmed = String(rawTerm || "").trim();
    if (!trimmed) return "";

    if (!trimmed.includes("[")) {
        return trimmed.replace(/^\(([^()]+)\)$/, "$1");
    }

    return trimmed.replace(/(\([^)]+\)|[^\s+\-,[\]]+)\[([^\]]+)\]/g, (_match, rawFormula, rawTagList) => {
        const formula = rawFormula.trim().replace(/^\(([^()]+)\)$/, "$1").trim();
        const rawTags = rawTagList
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t && t !== "untyped");

        const modifiers = [];
        const types = [];
        for (const tag of rawTags) {
            if (tag === "persistent" || tag === "splash" || tag === "precision") {
                modifiers.push(tag);
            } else {
                types.push(tag.replaceAll("-", " "));
            }
        }

        const descriptor = [...modifiers, ...types].join(" ").trim();
        return descriptor ? `${formula} ${descriptor}` : formula;
    });
}

/**
 * Formats a PF2e @Damage[...] inner expression into clean prose.
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatDamageEnricher(inner, label) {
    if (label) return `<span class="enricher-text">${escapeHtml(label)}</span>`;

    // Strip pipe options like |options:area-damage or |shortLabel
    const mainExpr = splitTopLevel(inner, "|")[0].trim();
    if (!mainExpr) return "";

    let body = mainExpr;
    if (body.startsWith("{") && body.endsWith("}")) {
        body = body.slice(1, -1).trim();
    }

    const terms = splitTopLevel(body, ",")
        .map((part) => formatSingleDamageTerm(part))
        .filter(Boolean);

    const formatted = terms.join(" plus ");
    return formatted ? `<span class="enricher-text">${escapeHtml(formatted)}</span>` : "";
}

/**
 * Formats a PF2e @Check[...] enricher into clean prose (e.g., "DC 22 basic Reflex").
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatCheckEnricher(inner, label) {
    const parts = splitTopLevel(inner, "|").map((p) => p.trim()).filter(Boolean);
    let checkType = "";
    let dc = "";
    let isBasic = false;
    let isSecret = false;

    for (const part of parts) {
        const colonIdx = part.indexOf(":");
        if (colonIdx === -1) {
            if (!checkType) checkType = part;
            else if (part.toLowerCase() === "basic") isBasic = true;
            continue;
        }
        const key = part.slice(0, colonIdx).trim().toLowerCase();
        const val = part.slice(colonIdx + 1).trim();

        if (key === "type") checkType = val;
        else if (key === "dc") dc = val;
        else if (key === "basic") isBasic = val.toLowerCase() !== "false";
        else if (key === "traits" && val.toLowerCase().includes("secret")) isSecret = true;
    }

    const lowerType = checkType.toLowerCase();
    let checkPhrase = "";
    if (lowerType === "flat") {
        checkPhrase = dc ? `DC ${dc} flat check` : "flat check";
    } else {
        const prettyType = humanizeSlug(checkType);
        const tokens = [];
        if (dc) tokens.push(`DC ${dc}`);
        if (isBasic) tokens.push("basic");
        if (prettyType) tokens.push(prettyType);
        checkPhrase = tokens.join(" ");
        if (isSecret && checkPhrase) {
            checkPhrase = `${checkPhrase} (secret)`;
        }
    }

    if (label) {
        const cleanLabel = label.trim();
        if (dc && !/\bDC\s*\d+/i.test(cleanLabel) && checkPhrase) {
            return `<span class="enricher-text">${escapeHtml(cleanLabel)} (${escapeHtml(checkPhrase)})</span>`;
        }
        return `<span class="enricher-text">${escapeHtml(cleanLabel)}</span>`;
    }

    return checkPhrase ? `<span class="enricher-text">${escapeHtml(checkPhrase)}</span>` : "";
}

/**
 * Formats a PF2e @Template[...] enricher (e.g., "30-foot cone").
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatTemplateEnricher(inner, label) {
    if (label) return `<span class="enricher-text">${escapeHtml(label)}</span>`;

    const parts = splitTopLevel(inner, "|").map((p) => p.trim()).filter(Boolean);
    let shape = "";
    let distance = "";

    for (const part of parts) {
        const colonIdx = part.indexOf(":");
        if (colonIdx === -1) {
            if (!shape) shape = part;
            continue;
        }
        const key = part.slice(0, colonIdx).trim().toLowerCase();
        const val = part.slice(colonIdx + 1).trim();
        if (key === "type") shape = val;
        else if (key === "distance") distance = val;
    }

    const phrase = distance && shape ? `${distance}-foot ${shape}` : shape || distance;
    return phrase ? `<span class="enricher-text">${escapeHtml(phrase)}</span>` : "";
}

/**
 * Formats a PF2e @Condition[...] enricher (e.g., "Frightened 2").
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatConditionEnricher(inner, label) {
    if (label) return `<span class="enricher-text">${escapeHtml(label)}</span>`;

    const parts = splitTopLevel(inner, "|").map((p) => p.trim()).filter(Boolean);
    const slug = parts[0] || "";
    let val = "";
    for (const part of parts.slice(1)) {
        const [k, v] = part.split(":");
        if (k?.trim().toLowerCase() === "value" && v) {
            val = v.trim();
        }
    }
    const name = humanizeSlug(slug);
    const phrase = val ? `${name} ${val}` : name;
    return phrase ? `<span class="enricher-text">${escapeHtml(phrase)}</span>` : "";
}

/**
 * Formats a @Localize[key] enricher using Foundry's live i18n table.
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatLocalizeEnricher(inner, label) {
    if (label) return escapeHtml(label);
    const key = inner.trim();
    if (!key) return "";
    const localized = game.i18n?.localize?.(key);
    if (localized && localized !== key) {
        return escapeHtml(localized);
    }
    const fallback = key.split(".").pop() || key;
    return escapeHtml(humanizeSlug(fallback));
}

/**
 * Formats an @Embed[uuid ...] enricher (inlines JournalEntryPage text when safe, otherwise shows title).
 * @param {string} inner
 * @param {string|null} label
 * @param {number} embedDepth
 * @returns {string}
 */
function formatEmbedEnricher(inner, label, embedDepth, relativeDoc = null) {
    const trimmed = inner.trim();
    const uuid = trimmed.split(/\s+/)[0] || "";

    if (embedDepth < 2 && uuid && typeof fromUuidSync === "function") {
        try {
            const doc = fromUuidSync(uuid, relativeDoc ? { relative: relativeDoc } : undefined);
            if (doc?.type === "text" && doc?.text?.content) {
                const embeddedHtml = replaceEnrichersInText(doc.text.content, embedDepth + 1, doc);
                return `<div class="embedded-excerpt">${embeddedHtml}</div>`;
            }
            if (doc?.name) {
                return `<span class="enricher-text">${escapeHtml(label || doc.name)}</span>`;
            }
        } catch {
            // Fall through
        }
    }

    const captionMatch = trimmed.match(/caption="([^"]+)"/i);
    const display = label || captionMatch?.[1] || resolveDocumentName("uuid", uuid, relativeDoc);
    return display ? `<span class="enricher-text">${escapeHtml(display)}</span>` : "";
}

/**
 * Formats an inline roll or PF2e action syntax inside [[...]]{label}.
 * @param {string} inner
 * @param {string|null} label
 * @returns {string}
 */
function formatInlineBracketExpression(inner, label) {
    const trimmed = inner.trim();
    if (!trimmed) return "";

    // PF2e inline action: [[/act demoralize dc=18]]
    if (/^\/act\b/i.test(trimmed)) {
        const rest = trimmed.replace(/^\/act\b/i, "").trim();
        const actionSlug = rest.split(/\s+/)[0] || "";
        const dcMatch = rest.match(/\bdc\s*=\s*(\d+)/i);
        const dcText = dcMatch ? `DC ${dcMatch[1]}` : "";
        const actionName = label || humanizeSlug(actionSlug);
        if (dcText && !/\bDC\s*\d+/i.test(actionName)) {
            return `<span class="enricher-text">${escapeHtml(actionName)} (${dcText})</span>`;
        }
        return `<span class="enricher-text">${escapeHtml(actionName)}</span>`;
    }

    // Strip Foundry roll command prefixes (/r, /roll, /gmr, /br, /pr, /sr, etc.)
    const withoutCmd = trimmed.replace(/^\/(?:gmroll|broll|sroll|proll|roll|gmr|br|pr|sr|r)\b/i, "").trim();
    const [formulaPart, ...flavorParts] = withoutCmd.split("#");
    const flavor = flavorParts.join("#").trim();

    let cleanFormula = formulaPart.trim();
    if (cleanFormula.includes("[")) {
        let expr = cleanFormula;
        if (expr.startsWith("{") && expr.endsWith("}")) {
            expr = expr.slice(1, -1).trim();
        }
        cleanFormula = splitTopLevel(expr, ",")
            .map((term) => formatSingleDamageTerm(term))
            .filter(Boolean)
            .join(" plus ");
    }

    if (label) {
        const cleanLabel = label.trim();
        if (cleanFormula && !cleanLabel.includes(cleanFormula) && /\d+d\d+/i.test(cleanFormula)) {
            return `<span class="enricher-text">${escapeHtml(cleanLabel)} (${escapeHtml(cleanFormula)})</span>`;
        }
        return `<span class="enricher-text">${escapeHtml(cleanLabel)}</span>`;
    }

    const combined = [cleanFormula, flavor].filter(Boolean).join(" ");
    return combined ? `<span class="enricher-text">${escapeHtml(combined)}</span>` : "";
}

/**
 * Replaces all Foundry/PF2e @Tag[...]{...} and [[...]]{...} enrichers using balanced bracket scanning.
 * @param {string} text
 * @param {number} embedDepth
 * @returns {string}
 */
function replaceEnrichersInText(text, embedDepth = 0, relativeDoc = null) {
    if (!text) return "";

    // Pass 1: @TagName[...]{optionalLabel}
    let result = "";
    let i = 0;

    while (i < text.length) {
        if (text[i] === "@") {
            const match = text.slice(i + 1).match(/^([A-Za-z]+)\[/);
            if (match && KNOWN_ENRICHERS.has(match[1].toLowerCase())) {
                const tagName = match[1].toLowerCase();
                const openBracketIdx = i + 1 + match[1].length;
                let depth = 0;
                let closeBracketIdx = -1;

                for (let j = openBracketIdx; j < text.length; j++) {
                    if (text[j] === "[") depth++;
                    else if (text[j] === "]") {
                        depth--;
                        if (depth === 0) {
                            closeBracketIdx = j;
                            break;
                        }
                    }
                }

                if (closeBracketIdx !== -1) {
                    const inner = text.slice(openBracketIdx + 1, closeBracketIdx);
                    let nextIdx = closeBracketIdx + 1;
                    let label = null;

                    if (text[nextIdx] === "{") {
                        let braceDepth = 0;
                        let closeBraceIdx = -1;
                        for (let k = nextIdx; k < text.length; k++) {
                            if (text[k] === "{") braceDepth++;
                            else if (text[k] === "}") {
                                braceDepth--;
                                if (braceDepth === 0) {
                                    closeBraceIdx = k;
                                    break;
                                }
                            }
                        }
                        if (closeBraceIdx !== -1) {
                            label = text.slice(nextIdx + 1, closeBraceIdx);
                            nextIdx = closeBraceIdx + 1;
                        }
                    }

                    let replacement = "";
                    if (tagName === "damage") {
                        replacement = formatDamageEnricher(inner, label);
                    } else if (tagName === "check") {
                        replacement = formatCheckEnricher(inner, label);
                    } else if (tagName === "template") {
                        replacement = formatTemplateEnricher(inner, label);
                    } else if (tagName === "condition") {
                        replacement = formatConditionEnricher(inner, label);
                    } else if (tagName === "localize") {
                        replacement = formatLocalizeEnricher(inner, label);
                    } else if (tagName === "embed") {
                        replacement = formatEmbedEnricher(inner, label, embedDepth, relativeDoc);
                    } else {
                        const display = label?.trim() || resolveDocumentName(tagName, inner, relativeDoc);
                        replacement = display ? `<span class="ref-text">${escapeHtml(display)}</span>` : "";
                    }

                    result += replacement;
                    i = nextIdx;
                    continue;
                }
            }
        }
        result += text[i];
        i++;
    }

    // Pass 2: [[...]]{optionalLabel} inline rolls and /act expressions
    let finalOut = "";
    let idx = 0;
    while (idx < result.length) {
        if (result[idx] === "[" && result[idx + 1] === "[") {
            let depth = 2;
            let endIdx = -1;
            for (let j = idx + 2; j < result.length; j++) {
                if (result[j] === "[") depth++;
                else if (result[j] === "]") {
                    depth--;
                    if (depth === 0) {
                        endIdx = j;
                        break;
                    }
                }
            }

            if (endIdx !== -1 && result[endIdx - 1] === "]") {
                const inner = result.slice(idx + 2, endIdx - 1);
                let nextIdx = endIdx + 1;
                let label = null;

                if (result[nextIdx] === "{") {
                    let braceDepth = 0;
                    let closeBraceIdx = -1;
                    for (let k = nextIdx; k < result.length; k++) {
                        if (result[k] === "{") braceDepth++;
                        else if (result[k] === "}") {
                            braceDepth--;
                            if (braceDepth === 0) {
                                closeBraceIdx = k;
                                break;
                            }
                        }
                    }
                    if (closeBraceIdx !== -1) {
                        label = result.slice(nextIdx + 1, closeBraceIdx);
                        nextIdx = closeBraceIdx + 1;
                    }
                }

                finalOut += formatInlineBracketExpression(inner, label);
                idx = nextIdx;
                continue;
            }
        }
        finalOut += result[idx];
        idx++;
    }

    return finalOut;
}

// --- IMAGE EMBEDDING HELPERS ---

/**
 * Converts a Blob into a Base64 Data URI.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Loads an image Blob onto a canvas, resizes if wider than maxWidth, and exports as Kindle-safe JPEG/PNG.
 * @param {Blob} blob
 * @param {number} maxWidth
 * @param {number} quality
 * @returns {Promise<string>}
 */
function compressBlobForKindle(blob, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            try {
                const natW = img.naturalWidth || img.width || 0;
                const natH = img.naturalHeight || img.height || 0;
                if (!natW || !natH) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error("Empty image dimensions"));
                    return;
                }

                const scale = natW > maxWidth ? maxWidth / natW : 1;
                const outW = Math.max(1, Math.round(natW * scale));
                const outH = Math.max(1, Math.round(natH * scale));

                const canvas = document.createElement("canvas");
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext("2d");

                // White background avoids black boxes when converting transparent PNG/WebP/SVG to JPEG
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, outW, outH);
                ctx.drawImage(img, 0, 0, outW, outH);

                // Keep small icons/diagrams sharp as PNG; larger artwork/maps as compact JPEG
                const usePng = blob.type === "image/svg+xml" || (outW <= 160 && outH <= 160);
                const dataUri = usePng
                    ? canvas.toDataURL("image/png")
                    : canvas.toDataURL("image/jpeg", quality);

                URL.revokeObjectURL(objectUrl);
                resolve(dataUri);
            } catch (err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        img.src = objectUrl;
    });
}

/**
 * Fetches an image URL from Foundry and returns an embedded Base64 Data URI (cached per export).
 * @param {string} rawSrc
 * @param {string} imageMode "kindle" | "original"
 * @param {Map<string, string|null>} imageCache
 * @returns {Promise<string|null>}
 */
async function resolveEmbeddedImage(rawSrc, imageMode, imageCache) {
    const src = String(rawSrc || "").trim();
    if (!src) return null;
    if (src.startsWith("data:")) return src;

    let resolvedUrl;
    try {
        resolvedUrl = new URL(src, window.location.href).href;
    } catch {
        return null;
    }

    const cacheKey = `${imageMode}:${resolvedUrl}`;
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
    }

    try {
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            imageCache.set(cacheKey, null);
            return null;
        }
        const blob = await response.blob();
        let dataUri;
        if (imageMode === "kindle") {
            try {
                dataUri = await compressBlobForKindle(blob, 800, 0.8);
            } catch {
                dataUri = await blobToDataUri(blob);
            }
        } else {
            dataUri = await blobToDataUri(blob);
        }

        imageCache.set(cacheKey, dataUri);
        return dataUri;
    } catch (err) {
        console.warn(`Journal Export | Could not embed image: ${src}`, err);
        imageCache.set(cacheKey, null);
        return null;
    }
}

// --- DOM CLEANUP & HEADING NORMALIZATION ---

/**
 * Cleans a page's HTML content via DOMParser: removes duplicate leading headers,
 * normalizes heading levels, strips broken inline styles & icon glyphs, handles
 * GM secret blocks, removes empty spacing bloat, and optionally embeds images.
 *
 * @param {string} rawHtml
 * @param {object} context
 * @returns {Promise<{ html: string, embeddedImages: number, usedOwnHeading: boolean }>}
 */
async function cleanPageHtml(rawHtml, context) {
    const {
        entryName,
        pageName,
        pageDoc,
        showPageHeading,
        imageMode,
        includeSecrets,
        imageCache
    } = context;

    const enricherCleaned = replaceEnrichersInText(rawHtml, 0, pageDoc);
    const parser = new DOMParser();
    const doc = parser.parseFromString(enricherCleaned, "text/html");
    const body = doc.body;

    // 1. Remove scripts, styles, forms, iframes, and Foundry interactive buttons
    body.querySelectorAll("script, style, iframe, button, input, select, textarea").forEach((el) => el.remove());

    // 2. Handle GM secret sections
    body.querySelectorAll("section.secret, div.secret").forEach((sec) => {
        if (!includeSecrets) {
            sec.remove();
            return;
        }
        sec.removeAttribute("id");
        sec.className = "gm-secret";
        const label = doc.createElement("div");
        label.className = "gm-secret-label";
        label.textContent = "GM Secret";
        sec.insertBefore(label, sec.firstChild);
    });

    // 3. Remove empty FontAwesome icons (prevent missing glyph boxes on Kindle/offline)
    body.querySelectorAll("i, span").forEach((el) => {
        const cls = String(el.className || "");
        const isFontAwesome = /\b(fa|fas|far|fab|fal|fad|fa-solid|fa-regular|fa-brands)\b/.test(cls);
        if (isFontAwesome && !el.textContent.trim() && !el.querySelector("img")) {
            el.remove();
        }
    });

    // 4. Unwrap Foundry entity/content/roll links so they don't show dead blue links
    body.querySelectorAll("a.content-link, a.entity-link, a.inline-roll, a.inline-check").forEach((anchor) => {
        const span = doc.createElement("span");
        span.className = "ref-text";
        span.innerHTML = anchor.innerHTML;
        anchor.replaceWith(span);
    });

    // 5. Handle images (remove or embed as Base64)
    let embeddedImages = 0;
    const imgElements = Array.from(body.querySelectorAll("img"));
    for (const img of imgElements) {
        if (imageMode === "none") {
            const parentFigure = img.closest("figure");
            img.remove();
            if (parentFigure && !parentFigure.textContent.trim() && !parentFigure.querySelector("img")) {
                parentFigure.remove();
            }
            continue;
        }

        const src = img.getAttribute("src") || "";
        const dataUri = await resolveEmbeddedImage(src, imageMode, imageCache);
        if (dataUri) {
            img.setAttribute("src", dataUri);
            img.removeAttribute("width");
            img.removeAttribute("height");
            img.removeAttribute("style");
            img.className = "exported-img";
            embeddedImages++;
        } else {
            const alt = (img.getAttribute("alt") || "").trim();
            if (alt) {
                const fallback = doc.createElement("p");
                fallback.className = "img-fallback";
                fallback.textContent = `[Image: ${alt}]`;
                img.replaceWith(fallback);
            } else {
                img.remove();
            }
        }
    }

    // 6. Strip disruptive inline styles and Foundry-only attributes
    body.querySelectorAll("*").forEach((el) => {
        // Preserve helpful semantic class names only
        const cls = String(el.className || "");
        const preservedClasses = [];
        if (el.classList.contains("gm-secret")) preservedClasses.push("gm-secret");
        if (el.classList.contains("gm-secret-label")) preservedClasses.push("gm-secret-label");
        if (el.classList.contains("ref-text")) preservedClasses.push("ref-text");
        if (el.classList.contains("enricher-text")) preservedClasses.push("enricher-text");
        if (el.classList.contains("exported-img")) preservedClasses.push("exported-img");
        if (el.classList.contains("img-fallback")) preservedClasses.push("img-fallback");
        if (el.classList.contains("embedded-excerpt")) preservedClasses.push("embedded-excerpt");
        if (/\b(read-aloud|boxed-text|callout|aside|sidebar)\b/i.test(cls) || el.tagName === "ASIDE") {
            preservedClasses.push("read-aloud");
        }

        if (preservedClasses.length > 0) {
            el.className = preservedClasses.join(" ");
        } else {
            el.removeAttribute("class");
        }

        // Strip data-* attributes
        for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith("data-")) {
                el.removeAttribute(attr.name);
            }
        }

        // Preserve text-align on table cells only; drop layout/color/font inline styles
        if (el.hasAttribute("style")) {
            const align = (el.tagName === "TD" || el.tagName === "TH") ? el.style.textAlign : "";
            el.removeAttribute("style");
            if (align && ["left", "center", "right"].includes(align)) {
                el.style.textAlign = align;
            }
        }
    });

    // 7. Remove empty paragraphs / divs / headings and collapse redundant <br> tags
    for (let pass = 0; pass < 3; pass++) {
        body.querySelectorAll("p, div, span, h1, h2, h3, h4, h5, h6, section, figure").forEach((el) => {
            if (el.querySelector("img, hr, table, ul, ol")) return;
            const textOnly = el.textContent.replace(/\u00A0/g, " ").trim();
            if (!textOnly) {
                el.remove();
            }
        });
    }

    body.querySelectorAll("p").forEach((p) => {
        while (p.firstChild && (p.firstChild.nodeName === "BR" || (p.firstChild.nodeType === Node.TEXT_NODE && !p.firstChild.textContent.trim()))) {
            if (p.firstChild.nodeName === "BR") p.firstChild.remove();
            else break;
        }
        while (p.lastChild && (p.lastChild.nodeName === "BR" || (p.lastChild.nodeType === Node.TEXT_NODE && !p.lastChild.textContent.trim()))) {
            if (p.lastChild.nodeName === "BR") p.lastChild.remove();
            else break;
        }
    });

    // Collapse multiple consecutive <br> into a single <br>
    body.querySelectorAll("br + br").forEach((br) => br.remove());

    // 8. Detect and remove duplicate leading heading matching entryName or pageName
    const normEntry = normalizeTitle(entryName);
    const normPage = normalizeTitle(pageName);
    let usedOwnHeading = false;

    const firstEl = body.firstElementChild;
    if (firstEl && /^H[1-6]$/.test(firstEl.tagName)) {
        const normFirst = normalizeTitle(firstEl.textContent);
        if (normFirst && (normFirst === normPage || normFirst === normEntry)) {
            if (showPageHeading || normFirst === normEntry) {
                // Avoid double header: drop the redundant leading heading
                firstEl.remove();
            } else {
                // Keep it as the page's heading cleanly
                usedOwnHeading = true;
            }
        }
    }

    // 9. Normalize internal heading levels so they nest cleanly under Journal (h2) and Page (h3)
    const headings = Array.from(body.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    if (headings.length > 0) {
        const minLevel = Math.min(...headings.map((h) => Number(h.tagName.slice(1))));
        const targetMinLevel = showPageHeading ? 4 : 3;
        const shift = targetMinLevel - minLevel;
        if (shift > 0) {
            for (const h of headings) {
                const currentLevel = Number(h.tagName.slice(1));
                const nextLevel = Math.min(6, currentLevel + shift);
                if (nextLevel !== currentLevel) {
                    const replacement = doc.createElement(`h${nextLevel}`);
                    replacement.innerHTML = h.innerHTML;
                    if (h.className) replacement.className = h.className;
                    h.replaceWith(replacement);
                }
            }
        }
    }

    // 10. Clean minor spacing issues around punctuation in text nodes
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        if (!node.nodeValue) continue;
        let v = node.nodeValue.replace(/\u00A0+/g, " ");
        v = v.replace(/[ \t]{2,}/g, " ");
        v = v.replace(/ ([.,;:!?])/g, "$1");
        node.nodeValue = v;
    }

    return {
        html: body.innerHTML.trim(),
        embeddedImages,
        usedOwnHeading
    };
}

// --- FOLDER COLLECTION & EXPORT EXECUTION ---

/**
 * Recursively collects JournalEntry folders in display order for the dropdown.
 * @param {string|null} parentId
 * @param {number} depth
 * @returns {Array<{ folder: Folder, depth: number }>}
 */
function collectFolderTree(parentId = null, depth = 0) {
    const children = game.folders
        .filter((f) => f.type === "JournalEntry" && (f.folder?.id ?? null) === parentId)
        .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));

    const list = [];
    for (const folder of children) {
        list.push({ folder, depth });
        list.push(...collectFolderTree(folder.id, depth + 1));
    }
    return list;
}

/**
 * Builds and downloads the cleaned HTML file for the selected folder and options.
 * @param {string} folderId
 * @param {{ imageMode: string, includeToc: boolean, includeSecrets: boolean, pageBreaks: boolean }} options
 */
async function runJournalExport(folderId, options) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the Game Master can export journals.");
        return;
    }

    const allJournals = Array.from(game.journal.values());
    const orderedSections = []; // Array<{ folderName: string|null, journals: JournalEntry[] }>
    let exportTitle = "All Journals";

    const collectSortedJournals = (parentId, folderPath = null) => {
        const childJournals = allJournals
            .filter((j) => (j.folder?.id ?? null) === parentId)
            .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));

        if (childJournals.length > 0) {
            orderedSections.push({ folderName: folderPath, journals: childJournals });
        }

        const childFolders = game.folders
            .filter((f) => f.type === "JournalEntry" && (f.folder?.id ?? null) === parentId)
            .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));

        for (const folder of childFolders) {
            const nextPath = folderPath ? `${folderPath} / ${folder.name}` : folder.name;
            collectSortedJournals(folder.id, nextPath);
        }
    };

    if (folderId === "all") {
        collectSortedJournals(null, null);
    } else {
        const selectedFolder = game.folders.get(folderId);
        if (!selectedFolder) {
            ui.notifications.error("Could not find the selected folder.");
            return;
        }
        exportTitle = selectedFolder.name;
        collectSortedJournals(folderId, null);
    }

    const totalJournals = orderedSections.reduce((sum, s) => sum + s.journals.length, 0);
    if (totalJournals === 0) {
        ui.notifications.warn("No journals found in the selected folder.");
        return;
    }

    if (options.imageMode !== "none") {
        ui.notifications.info(`Exporting ${totalJournals} journal(s) and embedding images...`);
    }

    const imageCache = new Map();
    let totalPagesExported = 0;
    let totalImagesEmbedded = 0;
    let tocItemsHtml = "";
    let bodyContentHtml = "";

    for (const section of orderedSections) {
        if (section.folderName) {
            tocItemsHtml += `<li class="toc-folder">${escapeHtml(section.folderName)}</li>`;
        }

        for (const journal of section.journals) {
            const entryName = journal.name || "Untitled Journal Entry";
            const entryId = `entry-${journal.id}`;
            const sortedPages = Array.from(journal.pages?.values?.() ?? []).sort(
                (a, b) => (a.sort - b.sort) || (a.name || "").localeCompare(b.name || "")
            );

            let journalPagesHtml = "";
            let exportedPageCountForEntry = 0;

            for (const page of sortedPages) {
                const pageName = page.name || "Untitled Page";
                const normEntry = normalizeTitle(entryName);
                const normPage = normalizeTitle(pageName);

                // Suppress page title if hidden in Foundry OR redundant on a 1-page journal
                const hideRedundantTitle =
                    page.title?.show === false ||
                    (sortedPages.length === 1 && normPage === normEntry);

                if (page.type === "text") {
                    const rawText = page.text?.content || page.text?.markdown || "";
                    if (!rawText.trim()) continue;

                    const cleaned = await cleanPageHtml(rawText, {
                        entryName,
                        pageName,
                        pageDoc: page,
                        showPageHeading: !hideRedundantTitle,
                        imageMode: options.imageMode,
                        includeSecrets: options.includeSecrets,
                        imageCache
                    });

                    if (!cleaned.html) continue;

                    totalImagesEmbedded += cleaned.embeddedImages;
                    totalPagesExported++;
                    exportedPageCountForEntry++;

                    const shouldRenderH3 = !hideRedundantTitle && !cleaned.usedOwnHeading && normPage !== normEntry;
                    journalPagesHtml += `<div class="journal-page">`;
                    if (shouldRenderH3) {
                        journalPagesHtml += `<h3>${escapeHtml(pageName)}</h3>`;
                    }
                    journalPagesHtml += cleaned.html;
                    journalPagesHtml += `</div>`;
                } else if (page.type === "image" && options.imageMode !== "none" && page.src) {
                    const dataUri = await resolveEmbeddedImage(page.src, options.imageMode, imageCache);
                    if (!dataUri) continue;

                    totalImagesEmbedded++;
                    totalPagesExported++;
                    exportedPageCountForEntry++;

                    const caption = page.image?.caption?.trim() || "";
                    const shouldRenderH3 = !hideRedundantTitle && normPage !== normEntry;
                    journalPagesHtml += `<div class="journal-page image-page">`;
                    if (shouldRenderH3) {
                        journalPagesHtml += `<h3>${escapeHtml(pageName)}</h3>`;
                    }
                    journalPagesHtml += `<figure class="image-figure"><img class="exported-img" src="${dataUri}" alt="${escapeHtml(pageName)}" />`;
                    if (caption) {
                        journalPagesHtml += `<figcaption>${escapeHtml(caption)}</figcaption>`;
                    }
                    journalPagesHtml += `</figure></div>`;
                }
            }

            if (exportedPageCountForEntry === 0) continue;

            tocItemsHtml += `<li><a href="#${escapeHtml(entryId)}">${escapeHtml(entryName)}</a></li>`;

            bodyContentHtml += `<article class="journal-entry${options.pageBreaks ? " page-break" : ""}">`;
            bodyContentHtml += `<h2 id="${escapeHtml(entryId)}">${escapeHtml(entryName)}</h2>`;
            bodyContentHtml += journalPagesHtml;
            bodyContentHtml += `</article>`;
        }
    }

    if (totalPagesExported === 0) {
        ui.notifications.warn("No exportable pages were found in the selected journals.");
        return;
    }

    const tocHtml = options.includeToc
        ? `<nav class="toc-section${options.pageBreaks ? " page-break" : ""}">
            <h2>Table of Contents</h2>
            <ul class="toc-list">
                ${tocItemsHtml}
            </ul>
        </nav>`
        : "";

    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(exportTitle)}</title>
    <style>
        body {
            font-family: Georgia, "Times New Roman", serif;
            color: #1a1a1a;
            background: #ffffff;
            line-height: 1.6;
            max-width: 780px;
            margin: 32px auto;
            padding: 0 20px;
        }
        h1 {
            font-size: 1.9em;
            border-bottom: 2px solid #222;
            padding-bottom: 8px;
            margin: 0 0 20px 0;
        }
        h2 {
            font-size: 1.45em;
            border-bottom: 1px solid #888;
            padding-bottom: 4px;
            margin: 28px 0 12px 0;
            page-break-after: avoid;
        }
        h3 {
            font-size: 1.2em;
            margin: 20px 0 8px 0;
            page-break-after: avoid;
        }
        h4, h5, h6 {
            font-size: 1.05em;
            margin: 14px 0 6px 0;
            page-break-after: avoid;
        }
        p {
            margin: 0 0 10px 0;
        }
        ul, ol {
            margin: 0 0 12px 0;
            padding-left: 24px;
        }
        li {
            margin-bottom: 4px;
        }
        .toc-section {
            margin-bottom: 28px;
            padding-bottom: 14px;
            border-bottom: 1px solid #ccc;
        }
        .toc-list {
            list-style-type: none;
            padding-left: 0;
        }
        .toc-list li {
            margin-bottom: 5px;
        }
        .toc-list li.toc-folder {
            font-weight: bold;
            margin-top: 12px;
            margin-bottom: 4px;
            color: #444;
        }
        .toc-list a {
            color: #1a1a1a;
            text-decoration: underline;
        }
        .journal-entry {
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 1px solid #d4d4d4;
        }
        .page-break {
            page-break-after: always;
        }
        .journal-page {
            margin-bottom: 16px;
        }
        .ref-text, .enricher-text {
            font-weight: bold;
        }
        blockquote, .read-aloud {
            margin: 12px 0;
            padding: 10px 14px;
            border-left: 3px solid #555;
            background: #f6f6f6;
            font-style: italic;
        }
        .gm-secret {
            margin: 12px 0;
            padding: 10px 14px;
            border-left: 3px solid #222;
            background: #f2f2f2;
        }
        .gm-secret-label {
            font-weight: bold;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 4px;
        }
        .embedded-excerpt {
            margin: 10px 0;
            padding: 8px 12px;
            border-left: 2px solid #999;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 0.94em;
        }
        th, td {
            border: 1px solid #bbb;
            padding: 6px 8px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #efefef;
            font-weight: bold;
        }
        img.exported-img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 12px auto;
        }
        figure.image-figure {
            margin: 12px 0;
            text-align: center;
        }
        figcaption {
            font-size: 0.88em;
            font-style: italic;
            color: #555;
            margin-top: 4px;
        }
        .img-fallback {
            font-style: italic;
            color: #666;
        }
        hr {
            border: none;
            border-top: 1px solid #ccc;
            margin: 16px 0;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(exportTitle)}</h1>
    ${tocHtml}
    ${bodyContentHtml}
</body>
</html>`;

    const safeFileName = exportTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "journals";

    saveDataToFile(htmlDocument, "text/html;charset=utf-8", `${safeFileName}.html`);

    const imgNote = totalImagesEmbedded > 0 ? ` with ${totalImagesEmbedded} embedded image(s)` : "";
    ui.notifications.info(
        `Exported ${totalJournals} journal(s) (${totalPagesExported} page(s))${imgNote} from "${exportTitle}".`
    );
}

// --- DIALOG POPULATION AND LAUNCH (FOUNDRY V14 DIALOGV2) ---

export async function openJournalExportDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the Game Master can export journals.");
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
    const folderTree = collectFolderTree(null, 0);

    let folderOptions = '<option value="all">-- All Journals --</option>';
    for (const { folder, depth } of folderTree) {
        const prefix = depth > 0 ? `${"&nbsp;&nbsp;&nbsp;".repeat(depth)}↳ ` : "";
        folderOptions += `<option value="${escapeHtml(folder.id)}">${prefix}${escapeHtml(folder.name)}</option>`;
    }

    const content = `
        <div class="jhe-dialog">
            <p class="jhe-intro">Export Foundry journals as a clean, offline-ready HTML file for browser reading or Send-to-Kindle prep.</p>

            <div class="jhe-field">
                <label for="jhe-folder-id">Journal Folder</label>
                <select id="jhe-folder-id" name="folderId">
                    ${folderOptions}
                </select>
            </div>

            <div class="jhe-field">
                <label for="jhe-image-mode">Images</label>
                <select id="jhe-image-mode" name="imageMode">
                    <option value="none" ${prefs.imageMode === "none" ? "selected" : ""}>No images (Text only, smallest file)</option>
                    <option value="kindle" ${prefs.imageMode === "kindle" ? "selected" : ""}>Embed images (Kindle &amp; e-reader optimized, max 800px)</option>
                    <option value="original" ${prefs.imageMode === "original" ? "selected" : ""}>Embed images (Original resolution)</option>
                </select>
            </div>

            <div class="jhe-options-box">
                <label class="jhe-check-label">
                    <input type="checkbox" id="jhe-include-toc" ${prefs.includeToc ? "checked" : ""} />
                    Include Table of Contents
                </label>
                <label class="jhe-check-label">
                    <input type="checkbox" id="jhe-include-secrets" ${prefs.includeSecrets ? "checked" : ""} />
                    Include GM Secret blocks
                </label>
                <label class="jhe-check-label">
                    <input type="checkbox" id="jhe-page-breaks" ${prefs.pageBreaks ? "checked" : ""} />
                    Insert page breaks between journal entries
                </label>
            </div>

            <p class="jhe-hint">For personal offline GM prep only. Do not share or redistribute exported third-party or commercial content; the module author is not responsible for how exported files are used.</p>
        </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
        classes: ["jhe-window"],
        window: {
            title: JOURNAL_EXPORT_MACRO_NAME,
            icon: "fa-solid fa-file-export"
        },
        position: {
            width: 460,
            height: "auto"
        },
        content,
        buttons: [
            {
                action: "export",
                label: "Export HTML",
                icon: "fa-solid fa-file-export",
                default: true,
                callback: async (_event, button, dlg) => {
                    const root = dialog.element ?? button?.form ?? dlg?.element;
                    const folderId = root?.querySelector("#jhe-folder-id")?.value || "all";
                    const options = {
                        imageMode: root?.querySelector("#jhe-image-mode")?.value || "none",
                        includeToc: Boolean(root?.querySelector("#jhe-include-toc")?.checked),
                        includeSecrets: Boolean(root?.querySelector("#jhe-include-secrets")?.checked),
                        pageBreaks: Boolean(root?.querySelector("#jhe-page-breaks")?.checked)
                    };
                    savePreferences(options);
                    await runJournalExport(folderId, options);
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
