/**
 * PF2e Session Hero Points
 * Tracks ephemeral per-session Hero Points separately from permanent Hero Points
 * using PF2e's native heroPoints pool (session points are spent first), highlights
 * session pips on character sheets, and provides a GM manager macro + world setting.
 */

export const SESSION_HERO_POINTS_MACRO_NAME = "Session Hero Points";
export const SESSION_HERO_POINTS_MACRO_ICON = "icons/svg/aura.svg";

const MODULE_ID = "pf2e-awesome-macros-for-gms";
const SETTING_KEY = "enableSessionHeroPoints";
const FLAG_KEY = "sessionHeroPoints";
const STYLESHEET_HREF = `modules/${MODULE_ID}/styles/session-hero-points.css`;

let settingsRegistered = false;
let hooksRegistered = false;
let activeDialog = null;
let refreshOpenManagerDialog = null;

/**
 * Escapes HTML special characters to prevent markup injection.
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
 * Ensures the module stylesheet is attached to the document head.
 */
function ensureStylesheetLoaded() {
    if (typeof document === "undefined" || !document.head) return;
    const existing = document.head.querySelector(`link[href*="${STYLESHEET_HREF}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET_HREF;
    document.head.appendChild(link);
}

/**
 * Returns whether the Session Hero Points feature is enabled in Module Settings.
 * @returns {boolean}
 */
export function isSessionHeroPointsEnabled() {
    try {
        return Boolean(game.settings.get(MODULE_ID, SETTING_KEY));
    } catch {
        return true;
    }
}

/**
 * Re-decorates or refreshes any currently open character sheets when the setting or flags change.
 */
function refreshOpenCharacterSheets() {
    if (typeof foundry === "undefined") return;

    const instances = foundry.applications?.instances;
    if (instances instanceof Map) {
        for (const app of instances.values()) {
            if (app?.actor?.type === "character" && app.rendered) {
                decorateCharacterSheet(app, app.element);
            }
        }
    }

    if (typeof ui !== "undefined" && ui.windows) {
        for (const win of Object.values(ui.windows)) {
            if (win?.actor?.type === "character" && win.rendered) {
                decorateCharacterSheet(win, win.element);
            }
        }
    }
}

/**
 * Registers the world setting allowing the GM to enable or disable Session Hero Points.
 */
export function registerSessionHeroPointsSettings() {
    if (settingsRegistered) return;
    settingsRegistered = true;

    game.settings.register(MODULE_ID, SETTING_KEY, {
        name: "Enable Session Hero Points",
        hint: "Tracks ephemeral per-session Hero Points separately from permanent Hero Points, highlights them on character sheets, and consumes session points first when Hero Points are spent.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            refreshOpenCharacterSheets();
        }
    });
}

/**
 * Reads an actor's clamped permanent and session Hero Point breakdown.
 * @param {Actor} actor
 * @returns {{ total: number, max: number, permanent: number, session: number }}
 */
export function getHeroPointBreakdown(actor) {
    const max = Math.max(1, Number(actor?.system?.resources?.heroPoints?.max ?? 3));
    const total = Math.max(0, Math.min(max, Number(actor?.system?.resources?.heroPoints?.value ?? 0)));
    const rawSession = Math.max(0, Number(actor?.getFlag?.(MODULE_ID, FLAG_KEY) || 0));
    const session = Math.min(total, rawSession);
    const permanent = Math.max(0, total - session);

    return { total, max, permanent, session };
}

/**
 * Updates an actor's permanent and session Hero Points atomically.
 * @param {Actor} actor
 * @param {number} permanent
 * @param {number} session
 */
async function setHeroPointBreakdown(actor, permanent, session) {
    const max = Math.max(1, Number(actor?.system?.resources?.heroPoints?.max ?? 3));
    const nextPerm = Math.max(0, Math.min(max, Math.round(permanent)));
    const nextSession = Math.max(0, Math.min(max - nextPerm, Math.round(session)));
    const nextTotal = nextPerm + nextSession;

    await actor.update(
        {
            "system.resources.heroPoints.value": nextTotal,
            [`flags.${MODULE_ID}.${FLAG_KEY}`]: nextSession
        },
        { sessionHeroPointManaged: true }
    );
}

/**
 * Locates the Hero Points dots element on a PF2e character sheet and highlights session pips.
 * @param {Application} sheet
 * @param {HTMLElement|JQuery} html
 */
function decorateCharacterSheet(sheet, html) {
    const actor = sheet?.actor;
    if (!actor || actor.type !== "character") return;

    const root = html instanceof HTMLElement ? html : (html?.[0] ?? sheet?.element?.[0] ?? sheet?.element);
    if (!(root instanceof HTMLElement)) return;

    // Clean up any previous decorations first
    root.querySelectorAll(".shpm-session-pip").forEach((el) => el.classList.remove("shpm-session-pip"));
    root.querySelectorAll(".shpm-session-badge").forEach((el) => el.remove());

    const dotsContainer =
        root.querySelector('[data-action="adjust-hero-points"]') ||
        root.querySelector(".hero-points .dots") ||
        root.querySelector(".hero-points");

    if (!isSessionHeroPointsEnabled()) {
        if (dotsContainer?.dataset.shpmModified) {
            dotsContainer.removeAttribute("title");
            if (dotsContainer.dataset.shpmOrigTooltip !== undefined) {
                dotsContainer.setAttribute("data-tooltip", dotsContainer.dataset.shpmOrigTooltip);
            } else {
                dotsContainer.removeAttribute("data-tooltip");
            }
            delete dotsContainer.dataset.shpmModified;
            delete dotsContainer.dataset.shpmOrigTooltip;
        }
        return;
    }

    ensureStylesheetLoaded();

    if (!dotsContainer) return;

    if (!dotsContainer.dataset.shpmModified) {
        dotsContainer.dataset.shpmModified = "1";
        if (dotsContainer.hasAttribute("data-tooltip")) {
            dotsContainer.dataset.shpmOrigTooltip = dotsContainer.getAttribute("data-tooltip") || "";
        }
    }

    const { total, max, permanent, session } = getHeroPointBreakdown(actor);
    const tooltipText =
        session > 0
            ? `Hero Points: ${total}/${max} (${permanent} Permanent, ${session} Session — Session spent first)`
            : `Hero Points: ${total}/${max} (${permanent} Permanent)`;

    dotsContainer.setAttribute("data-tooltip", tooltipText);
    dotsContainer.setAttribute("title", tooltipText);

    if (session <= 0) return;

    // Highlight the ephemeral session pips (ordered after permanent pips)
    const pipElements = Array.from(
        dotsContainer.querySelectorAll(":scope > i, :scope > svg, :scope > span > i, :scope > span > svg, .dots > i, .dots > svg")
    );

    if (pipElements.length > 0) {
        for (let i = permanent; i < total && i < pipElements.length; i++) {
            pipElements[i].classList.add("shpm-session-pip");
        }
    }

    const badge = document.createElement("span");
    badge.className = "shpm-session-badge";
    badge.title = tooltipText;
    badge.textContent = `${session}S`;

    const heroPointsRow = dotsContainer.closest(".hero-points") || dotsContainer.parentElement;
    if (heroPointsRow && heroPointsRow !== dotsContainer) {
        dotsContainer.insertAdjacentElement("afterend", badge);
    } else {
        dotsContainer.appendChild(badge);
    }
}

/**
 * Registers actor update and sheet render hooks for Session Hero Points.
 */
export function registerSessionHeroPointsHooks() {
    ensureStylesheetLoaded();
    registerSessionHeroPointsSettings();

    if (hooksRegistered) return;
    hooksRegistered = true;

    // Consume Session Hero Points before Permanent Hero Points whenever heroPoints.value drops
    Hooks.on("preUpdateActor", (actor, changed, options) => {
        if (!isSessionHeroPointsEnabled()) return;
        if (!actor || actor.type !== "character") return;
        if (options?.sessionHeroPointManaged) return;
        if (!foundry.utils.hasProperty(changed, "system.resources.heroPoints.value")) return;
        if (foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`)) return;

        const oldTotal = Math.max(0, Number(actor.system?.resources?.heroPoints?.value ?? 0));
        const newTotal = Math.max(0, Number(foundry.utils.getProperty(changed, "system.resources.heroPoints.value")));
        const oldSession = Math.max(0, Math.min(oldTotal, Number(actor.getFlag(MODULE_ID, FLAG_KEY) || 0)));

        let nextSession = oldSession;
        if (newTotal < oldTotal) {
            const spent = oldTotal - newTotal;
            nextSession = Math.max(0, oldSession - spent);
        } else if (oldSession > newTotal) {
            nextSession = newTotal;
        }

        if (nextSession !== oldSession) {
            foundry.utils.setProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`, nextSession);
        }
    });

    // Keep open sheets & manager dialog synced when hero points or session flags update
    Hooks.on("updateActor", (actor, changed) => {
        if (!actor || actor.type !== "character") return;
        const heroChanged = foundry.utils.hasProperty(changed, "system.resources.heroPoints.value");
        const flagChanged = foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.${FLAG_KEY}`);
        if (!heroChanged && !flagChanged) return;

        if (flagChanged && !heroChanged) {
            refreshOpenCharacterSheets();
        }
        refreshOpenManagerDialog?.();
    });

    Hooks.on("renderCharacterSheetPF2e", (sheet, html) => {
        decorateCharacterSheet(sheet, html);
    });
}

/**
 * Resolves target PC actors from controlled tokens or the active party.
 * @returns {Actor[]}
 */
function gatherPartyCharacters() {
    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length > 0) {
        const seen = new Set();
        const selected = [];
        for (const token of controlled) {
            const actor = token.actor;
            if (actor && actor.type === "character" && !seen.has(actor.id)) {
                seen.add(actor.id);
                selected.push(actor);
            }
        }
        if (selected.length > 0) return selected;
    }

    if (game.actors.party?.members?.size) {
        return Array.from(game.actors.party.members).filter((a) => a.type === "character");
    }

    let partyChars = game.actors.filter(
        (a) => a.type === "character" && (a.system?.details?.alliance === "party" || a.alliance === "party")
    );
    if (partyChars.length === 0) {
        partyChars = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
    }
    return partyChars;
}

/**
 * Starts a new session for the given characters: clears any unspent session points
 * from the previous session while keeping permanent points, then grants 1 session point (up to max).
 * @param {Actor[]} actors
 * @param {boolean} postToChat
 */
async function startNewSession(actors, postToChat) {
    const summaryLines = [];

    for (const actor of actors) {
        const { max, permanent, session } = getHeroPointBreakdown(actor);
        const nextSession = permanent < max ? 1 : 0;
        const nextTotal = Math.min(max, permanent + nextSession);

        await setHeroPointBreakdown(actor, permanent, nextSession);

        const expiredNote = session > 0 ? ` <em>(expired ${session} old session)</em>` : "";
        const cappedNote = nextSession === 0 && permanent >= max ? " <em>(at max permanent)</em>" : "";
        summaryLines.push(
            `<li><strong>${escapeHtml(actor.name)}</strong>: ${nextTotal}/${max} (${permanent} Perm, ${nextSession} Session)${expiredNote}${cappedNote}</li>`
        );
    }

    if (postToChat && summaryLines.length > 0) {
        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ alias: SESSION_HERO_POINTS_MACRO_NAME }),
            content: `
                <div style="font-family: 'Signika', sans-serif; border: 1px solid #7a7971; border-radius: 5px; padding: 8px; background: rgba(0, 0, 0, 0.04); color: #191813;">
                    <strong style="display: block; border-bottom: 1px solid #b5b3a4; padding-bottom: 4px; margin-bottom: 6px;">
                        New Session Hero Points Granted
                    </strong>
                    <ul style="margin: 0; padding-left: 18px; font-size: 0.9em;">
                        ${summaryLines.join("")}
                    </ul>
                </div>
            `
        });
    }

    ui.notifications.info(`Started new session Hero Points for ${actors.length} character(s).`);
}

/**
 * Clears all unspent ephemeral Session Hero Points while keeping Permanent Hero Points intact.
 * @param {Actor[]} actors
 * @param {boolean} postToChat
 */
async function clearSessionPoints(actors, postToChat) {
    const summaryLines = [];

    for (const actor of actors) {
        const { max, permanent, session } = getHeroPointBreakdown(actor);
        if (session > 0) {
            await setHeroPointBreakdown(actor, permanent, 0);
        }
        summaryLines.push(
            `<li><strong>${escapeHtml(actor.name)}</strong>: ${permanent}/${max} Permanent kept (${session} Session cleared)</li>`
        );
    }

    if (postToChat && summaryLines.length > 0) {
        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ alias: SESSION_HERO_POINTS_MACRO_NAME }),
            content: `
                <div style="font-family: 'Signika', sans-serif; border: 1px solid #7a7971; border-radius: 5px; padding: 8px; background: rgba(0, 0, 0, 0.04); color: #191813;">
                    <strong style="display: block; border-bottom: 1px solid #b5b3a4; padding-bottom: 4px; margin-bottom: 6px;">
                        Session Hero Points Cleared
                    </strong>
                    <ul style="margin: 0; padding-left: 18px; font-size: 0.9em;">
                        ${summaryLines.join("")}
                    </ul>
                </div>
            `
        });
    }

    ui.notifications.info(`Cleared unspent Session Hero Points for ${actors.length} character(s).`);
}

/**
 * Opens the Session Hero Points GM manager dialog.
 */
export async function openSessionHeroPointsDialog() {
    registerSessionHeroPointsHooks();

    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can manage Session Hero Points.");
        return;
    }

    if (!isSessionHeroPointsEnabled()) {
        ui.notifications.warn(
            "Session Hero Points is currently disabled. Enable it in Configure Settings -> Module Settings -> PF2e Awesome Macros for GMs."
        );
        return;
    }

    const actors = gatherPartyCharacters();
    if (actors.length === 0) {
        ui.notifications.warn("No player characters found (none selected and no party members).");
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

    const buildPipDotsMarkup = (permanent, session, max) => {
        let html = "";
        for (let i = 0; i < max; i++) {
            const cls = i < permanent ? "perm" : i < permanent + session ? "sess" : "";
            html += `<span class="shpm-pip-dot ${cls}"></span>`;
        }
        return html;
    };

    const rowsHtml = actors
        .map((actor) => {
            const { max, permanent, session } = getHeroPointBreakdown(actor);
            return `
                <div class="shpm-row" data-actor-id="${escapeHtml(actor.id)}">
                    <img class="shpm-avatar" src="${escapeHtml(actor.img || "icons/svg/mystery-man.svg")}" width="32" height="32" alt="" />
                    <div class="shpm-info">
                        <div class="shpm-name">${escapeHtml(actor.name)}</div>
                        <div class="shpm-pips-row">
                            <span class="shpm-pip-preview">${buildPipDotsMarkup(permanent, session, max)}</span>
                            <span class="shpm-breakdown-text">${permanent} Perm · ${session} Session</span>
                        </div>
                    </div>

                    <div class="shpm-control-group">
                        <span class="shpm-control-label">Permanent</span>
                        <div class="shpm-stepper">
                            <button type="button" class="shpm-step-btn" data-actor-id="${escapeHtml(actor.id)}" data-pool="perm" data-delta="-1" title="Remove 1 Permanent Hero Point">−</button>
                            <span class="shpm-count-val shpm-perm-val">${permanent}</span>
                            <button type="button" class="shpm-step-btn" data-actor-id="${escapeHtml(actor.id)}" data-pool="perm" data-delta="1" title="Add 1 Permanent Hero Point">+</button>
                        </div>
                    </div>

                    <div class="shpm-control-group">
                        <span class="shpm-control-label sess">Session</span>
                        <div class="shpm-stepper sess">
                            <button type="button" class="shpm-step-btn" data-actor-id="${escapeHtml(actor.id)}" data-pool="sess" data-delta="-1" title="Remove 1 Session Hero Point">−</button>
                            <span class="shpm-count-val sess shpm-sess-val">${session}</span>
                            <button type="button" class="shpm-step-btn" data-actor-id="${escapeHtml(actor.id)}" data-pool="sess" data-delta="1" title="Add 1 Session Hero Point">+</button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");

    const content = `
        <div class="shpm-dialog">
            <div class="shpm-toolbar">
                <div class="shpm-legend">
                    <span class="shpm-legend-item"><span class="shpm-dot-sample perm"></span> Permanent</span>
                    <span class="shpm-legend-item"><span class="shpm-dot-sample sess"></span> Session (spent first)</span>
                </div>
                <div class="shpm-bulk-actions">
                    <button type="button" class="shpm-action-btn primary" id="shpm-new-session" title="Expire unspent old session points and grant 1 new Session Hero Point">
                        New Session (+1S)
                    </button>
                    <button type="button" class="shpm-action-btn" id="shpm-clear-session" title="Remove all unspent Session Hero Points while keeping Permanent points">
                        Clear Session
                    </button>
                </div>
            </div>

            <div class="shpm-list" id="shpm-list">
                ${rowsHtml}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.84rem; cursor: pointer; margin: 0;">
                    <input type="checkbox" id="shpm-post-chat" checked />
                    Post bulk session updates to chat
                </label>
                <span class="shpm-note">Native PF2e Hero Point rerolls spend Session points first.</span>
            </div>
        </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
        classes: ["shpm-window"],
        window: {
            title: SESSION_HERO_POINTS_MACRO_NAME,
            icon: "fa-solid fa-star"
        },
        position: {
            width: 540,
            height: "auto"
        },
        content,
        buttons: [
            {
                action: "close",
                label: "Close",
                default: true
            }
        ]
    });

    activeDialog = dialog;
    dialog.addEventListener(
        "close",
        () => {
            if (activeDialog === dialog) {
                activeDialog = null;
                refreshOpenManagerDialog = null;
            }
        },
        { once: true }
    );

    await dialog.render({ force: true });

    const root = dialog.element;
    if (!root) return;

    const listEl = root.querySelector("#shpm-list");
    const postChatCheckbox = root.querySelector("#shpm-post-chat");

    const syncUI = () => {
        for (const actor of actors) {
            const row = listEl?.querySelector(`.shpm-row[data-actor-id="${CSS.escape(actor.id)}"]`);
            if (!row) continue;

            const { total, max, permanent, session } = getHeroPointBreakdown(actor);
            const pipPreview = row.querySelector(".shpm-pip-preview");
            const textEl = row.querySelector(".shpm-breakdown-text");
            const permValEl = row.querySelector(".shpm-perm-val");
            const sessValEl = row.querySelector(".shpm-sess-val");

            if (pipPreview) pipPreview.innerHTML = buildPipDotsMarkup(permanent, session, max);
            if (textEl) textEl.textContent = `${permanent} Perm · ${session} Session`;
            if (permValEl) permValEl.textContent = String(permanent);
            if (sessValEl) sessValEl.textContent = String(session);

            const permMinus = row.querySelector('button[data-pool="perm"][data-delta="-1"]');
            const permPlus = row.querySelector('button[data-pool="perm"][data-delta="1"]');
            const sessMinus = row.querySelector('button[data-pool="sess"][data-delta="-1"]');
            const sessPlus = row.querySelector('button[data-pool="sess"][data-delta="1"]');

            if (permMinus) permMinus.disabled = permanent <= 0;
            if (permPlus) permPlus.disabled = permanent >= max;
            if (sessMinus) sessMinus.disabled = session <= 0;
            if (sessPlus) sessPlus.disabled = total >= max;
        }
    };

    refreshOpenManagerDialog = syncUI;

    listEl?.addEventListener("click", async (event) => {
        const btn = event.target.closest("button.shpm-step-btn");
        if (!btn) return;
        event.preventDefault();

        const actor = actors.find((a) => a.id === btn.dataset.actorId);
        if (!actor) return;

        const pool = btn.dataset.pool;
        const delta = Number(btn.dataset.delta);
        const { max, permanent, session } = getHeroPointBreakdown(actor);

        if (pool === "perm") {
            const nextPerm = Math.max(0, Math.min(max, permanent + delta));
            // If adding a permanent point while capped by an ephemeral session point, convert the session slot
            const nextSession = Math.min(session, max - nextPerm);
            await setHeroPointBreakdown(actor, nextPerm, nextSession);
        } else if (pool === "sess") {
            const nextSession = Math.max(0, Math.min(max - permanent, session + delta));
            await setHeroPointBreakdown(actor, permanent, nextSession);
        }

        syncUI();
    });

    root.querySelector("#shpm-new-session")?.addEventListener("click", async () => {
        await startNewSession(actors, Boolean(postChatCheckbox?.checked));
        syncUI();
    });

    root.querySelector("#shpm-clear-session")?.addEventListener("click", async () => {
        await clearSessionPoints(actors, Boolean(postChatCheckbox?.checked));
        syncUI();
    });

    syncUI();
}
