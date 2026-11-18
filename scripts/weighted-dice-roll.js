/**
 * PF2e Weighted Dice Roll Macro
 * Quickly select a random PC target from selected, targeted, or party tokens
 * using customizable weights for combat target selection.
 */

export const WEIGHTED_DICE_ROLL_MACRO_NAME = "Weighted Dice Roll";
export const WEIGHTED_DICE_ROLL_MACRO_ICON = "icons/tools/navigation/compass-worn-copper.webp";

const MODULE_ID = "pf2e-awesome-macros-for-gms";
const PREFS_STORAGE_KEY = "pf2e-awesome-macros.weightedDiceRollPrefs";
const STYLESHEET_HREF = `modules/${MODULE_ID}/styles/weighted-dice-roll.css`;
const QUICK_WEIGHTS = [1, 2, 3, 5];

let hooksRegistered = false;
let activeDialog = null;

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
 * Loads persisted user preferences for the macro.
 * @returns {{ whisperOnly: boolean, autoTarget: boolean }}
 */
function loadPreferences() {
    const defaults = { whisperOnly: true, autoTarget: true };
    try {
        const raw = globalThis.localStorage?.getItem(PREFS_STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return {
            whisperOnly: typeof parsed.whisperOnly === "boolean" ? parsed.whisperOnly : defaults.whisperOnly,
            autoTarget: typeof parsed.autoTarget === "boolean" ? parsed.autoTarget : defaults.autoTarget
        };
    } catch {
        return defaults;
    }
}

/**
 * Persists user preferences for the macro.
 * @param {{ whisperOnly: boolean, autoTarget: boolean }} prefs
 */
function savePreferences(prefs) {
    try {
        globalThis.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // Ignore storage errors (e.g. private browsing restrictions)
    }
}

/**
 * Determines whether an actor is a PC / party-aligned candidate.
 * @param {Actor|null|undefined} actor
 * @returns {boolean}
 */
function isPartyActor(actor) {
    if (!actor) return false;
    if (["party", "loot", "hazard", "vehicle"].includes(actor.type)) return false;
    return (
        actor.type === "character" ||
        actor.alliance === "party" ||
        actor.system?.details?.alliance === "party" ||
        Boolean(actor.hasPlayerOwner)
    );
}

/**
 * Checks whether an actor is currently incapacitated or defeated.
 * @param {Actor|null|undefined} actor
 * @returns {{ isDead: boolean, isDown: boolean, statusText: string }}
 */
function getActorStatus(actor) {
    if (!actor) return { isDead: false, isDown: false, statusText: "" };

    const hp = actor.system?.attributes?.hp;
    const hasCondition = (slug) => Boolean(actor.hasCondition?.(slug));

    const isDead = hasCondition("dead");
    const isDying = hasCondition("dying");
    const isUnconscious = hasCondition("unconscious");
    const isZeroHp = typeof hp?.value === "number" && hp.value <= 0;
    const isDown = isDead || isDying || isUnconscious || isZeroHp;

    const tags = [];
    if (typeof hp?.value === "number" && typeof hp?.max === "number" && hp.max > 0) {
        tags.push(`${hp.value}/${hp.max} HP`);
    }
    if (isDead) tags.push("Dead");
    else if (isDying) tags.push("Dying");
    else if (isUnconscious) tags.push("Unconscious");

    if (hasCondition("prone")) tags.push("Prone");
    if (hasCondition("off-guard") || hasCondition("flat-footed")) tags.push("Off-Guard");

    return {
        isDead,
        isDown,
        statusText: tags.join(" · ")
    };
}

/**
 * Builds a normalized candidate descriptor from a Token or Actor.
 * @param {Token|null} token
 * @param {Actor|null} actor
 * @param {number} weight
 * @returns {object}
 */
function buildCandidate(token, actor, weight = 1) {
    const resolvedActor = actor ?? token?.actor ?? null;
    const status = getActorStatus(resolvedActor);
    const key = token ? `token:${token.id}` : `actor:${resolvedActor?.id ?? foundry.utils.randomID()}`;

    return {
        key,
        tokenId: token?.id ?? null,
        actorId: resolvedActor?.id ?? null,
        name: token?.name || resolvedActor?.name || "Unknown",
        img: token?.document?.texture?.src || resolvedActor?.img || "icons/svg/mystery-man.svg",
        weight,
        lastWeight: weight > 0 ? weight : 1,
        isDead: status.isDead,
        isDown: status.isDown,
        statusText: status.statusText
    };
}

/**
 * Gathers initial candidate PCs from controlled tokens, targeted tokens, scene tokens, or party actors.
 * @param {object|null} presetState Optional state passed when reopening from a chat card.
 * @returns {{ candidates: object[], extraCandidates: object[], sourceLabel: string }|null}
 */
function gatherCandidates(presetState = null) {
    if (presetState?.candidates?.length) {
        const candidates = presetState.candidates.map((saved) => {
            const liveToken = saved.tokenId ? canvas?.tokens?.get(saved.tokenId) : null;
            const liveActor = liveToken?.actor ?? (saved.actorId ? game.actors.get(saved.actorId) : null);
            const status = getActorStatus(liveActor);
            const numericWeight = normalizeWeight(saved.weight);
            return {
                key: saved.key || (liveToken ? `token:${liveToken.id}` : `actor:${saved.actorId ?? foundry.utils.randomID()}`),
                tokenId: saved.tokenId ?? liveToken?.id ?? null,
                actorId: saved.actorId ?? liveActor?.id ?? null,
                name: liveToken?.name || liveActor?.name || saved.name || "Unknown",
                img: liveToken?.document?.texture?.src || liveActor?.img || saved.img || "icons/svg/mystery-man.svg",
                weight: numericWeight,
                lastWeight: numericWeight > 0 ? numericWeight : 1,
                isDead: status.isDead,
                isDown: status.isDown,
                statusText: status.statusText
            };
        });
        return {
            candidates,
            extraCandidates: [],
            sourceLabel: "Loaded from previous roll"
        };
    }

    const sceneTokens = canvas?.ready ? (canvas.tokens?.placeables ?? []) : [];
    const scenePartyTokens = sceneTokens.filter((t) => isPartyActor(t.actor));

    const controlledAll = (canvas?.tokens?.controlled ?? []).filter(
        (t) => t.actor && !["party", "loot", "hazard", "vehicle"].includes(t.actor.type)
    );
    const controlledParty = controlledAll.filter((t) => isPartyActor(t.actor));
    const targetedParty = Array.from(game.user.targets ?? []).filter((t) => isPartyActor(t.actor));

    let primaryTokens = [];
    let sourceLabel = "";
    let explicitlyChosen = false;

    if (controlledParty.length >= 2) {
        primaryTokens = controlledParty;
        sourceLabel = `${controlledParty.length} selected PC tokens`;
        explicitlyChosen = true;
    } else if (controlledAll.length >= 2 && controlledParty.length === 0) {
        primaryTokens = controlledAll;
        sourceLabel = `${controlledAll.length} selected tokens`;
        explicitlyChosen = true;
    } else if (targetedParty.length >= 2) {
        primaryTokens = targetedParty;
        sourceLabel = `${targetedParty.length} targeted PC tokens`;
        explicitlyChosen = true;
    } else if (scenePartyTokens.length > 0) {
        primaryTokens = scenePartyTokens;
        sourceLabel = `${scenePartyTokens.length} party tokens on scene`;
    }

    if (primaryTokens.length > 0) {
        const primaryIds = new Set(primaryTokens.map((t) => t.id));
        const candidates = primaryTokens.map((t) => {
            const candidate = buildCandidate(t, t.actor, 1);
            if (!explicitlyChosen && candidate.isDown) {
                candidate.weight = 0;
            }
            return candidate;
        });

        // If fallback excluded every token because all are down, enable non-dead (or all)
        if (!candidates.some((c) => c.weight > 0)) {
            const nonDead = candidates.filter((c) => !c.isDead);
            const toEnable = nonDead.length > 0 ? nonDead : candidates;
            for (const c of toEnable) c.weight = 1;
        }

        const extraCandidates = explicitlyChosen
            ? scenePartyTokens
                .filter((t) => !primaryIds.has(t.id))
                .map((t) => buildCandidate(t, t.actor, 0))
            : [];

        return { candidates, extraCandidates, sourceLabel };
    }

    // Fallback: no tokens on canvas, pull from Party / Character actors
    let fallbackActors = [];
    if (game.actors.party?.members?.size) {
        fallbackActors = Array.from(game.actors.party.members).filter((a) => isPartyActor(a));
    }
    if (fallbackActors.length === 0) {
        fallbackActors = game.actors.filter((a) => isPartyActor(a));
    }

    if (fallbackActors.length === 0) {
        ui.notifications.warn("No PC or party tokens found on the scene or in the party.");
        return null;
    }

    const candidates = fallbackActors.map((actor) => {
        const candidate = buildCandidate(null, actor, 1);
        if (candidate.isDown) candidate.weight = 0;
        return candidate;
    });

    if (!candidates.some((c) => c.weight > 0)) {
        for (const c of candidates) c.weight = 1;
    }

    return {
        candidates,
        extraCandidates: [],
        sourceLabel: `${candidates.length} party actors`
    };
}

/**
 * Sanitizes a user-supplied weight into a non-negative finite number.
 * @param {*} raw
 * @returns {number}
 */
function normalizeWeight(raw) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return Math.min(9999, Math.round(num * 100) / 100);
}

/**
 * Computes integer die sides and exact hit ranges for all active candidates.
 * Scales fractional weights by powers of 10 so every roll maps cleanly to a Foundry 1dN roll.
 * @param {object[]} candidates
 * @returns {{ active: object[], dieSides: number, totalWeight: number, scale: number }}
 */
function computeWeightedRanges(candidates) {
    const activeRaw = candidates.filter((c) => c.weight > 0);
    if (activeRaw.length === 0) {
        return { active: [], dieSides: 0, totalWeight: 0, scale: 1 };
    }

    let scale = 1;
    for (const candidate of activeRaw) {
        const str = String(candidate.weight);
        const dotIdx = str.indexOf(".");
        if (dotIdx !== -1) {
            const decimals = Math.min(2, str.length - dotIdx - 1);
            scale = Math.max(scale, 10 ** decimals);
        }
    }

    let cursor = 1;
    let totalWeight = 0;
    const active = [];

    for (const candidate of activeRaw) {
        const scaledWeight = Math.max(1, Math.round(candidate.weight * scale));
        const start = cursor;
        const end = cursor + scaledWeight - 1;
        cursor = end + 1;
        totalWeight += candidate.weight;
        active.push({
            ...candidate,
            scaledWeight,
            start,
            end
        });
    }

    const dieSides = cursor - 1;
    for (const entry of active) {
        entry.chancePct = dieSides > 0 ? Math.round((entry.scaledWeight / dieSides) * 1000) / 10 : 0;
        entry.rangeLabel = entry.start === entry.end ? `${entry.start}` : `${entry.start}–${entry.end}`;
    }

    return { active, dieSides, totalWeight, scale };
}

/**
 * Formats a percentage cleanly (e.g. 50% or 33.3%).
 * @param {number} pct
 * @returns {string}
 */
function formatPercent(pct) {
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/**
 * Targets the winning token on the active canvas if it exists.
 * @param {string|null} tokenId
 * @param {string} fallbackName
 * @returns {boolean}
 */
function targetTokenOnCanvas(tokenId, fallbackName) {
    if (!tokenId || !canvas?.ready) return false;
    const token = canvas.tokens.get(tokenId);
    if (!token) return false;
    token.setTarget(true, { releaseOthers: true });
    ui.notifications.info(`Targeted ${token.name || fallbackName}.`);
    return true;
}

/**
 * Executes a weighted Foundry dice roll, posts the result to chat, and optionally targets the winner.
 * @param {object[]} candidates
 * @param {{ whisperOnly: boolean, autoTarget: boolean }} options
 * @returns {Promise<{ winner: object, roll: Roll, dieSides: number }|null>}
 */
async function executeWeightedRoll(candidates, options) {
    const { active, dieSides, totalWeight } = computeWeightedRanges(candidates);
    if (active.length === 0 || dieSides <= 0) {
        ui.notifications.warn("Enable at least one target with a weight greater than 0.");
        return null;
    }

    const roll = await new Roll(`1d${dieSides}`).evaluate();
    const rolledValue = roll.total;
    const winner = active.find((entry) => rolledValue >= entry.start && rolledValue <= entry.end) ?? active[0];

    const rowsHtml = active
        .map((entry) => {
            const isWinner = entry.key === winner.key;
            const rowStyle = isWinner
                ? "background: rgba(0, 0, 0, 0.08); border-left: 3px solid #191813; font-weight: bold;"
                : "border-left: 3px solid transparent; opacity: 0.85;";
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; margin-bottom: 2px; border-radius: 3px; font-size: 0.88em; ${rowStyle}">
                    <span style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                        <img src="${escapeHtml(entry.img)}" width="20" height="20" style="border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); object-fit: cover; flex-shrink: 0;" />
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(entry.name)}</span>
                    </span>
                    <span style="white-space: nowrap; font-variant-numeric: tabular-nums; margin-left: 8px;">
                        w:${entry.weight} · ${formatPercent(entry.chancePct)} <span style="opacity: 0.7;">[${entry.rangeLabel}]</span>
                    </span>
                </div>
            `;
        })
        .join("");

    const canTargetOnScene = Boolean(winner.tokenId && canvas?.tokens?.get(winner.tokenId));

    const content = `
        <div class="wdr-chat-card" style="font-family: 'Signika', sans-serif; border: 1px solid #7a7971; border-radius: 6px; padding: 8px; background: rgba(0, 0, 0, 0.04); color: #191813;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #b5b3a4; padding-bottom: 4px; margin-bottom: 8px;">
                <strong style="color: #191813; font-size: 1.05em;">
                    <i class="fas fa-crosshairs"></i> Weighted Target Roll
                </strong>
                <span style="font-size: 0.85em; font-weight: bold; padding: 1px 7px; border-radius: 10px; background: rgba(0, 0, 0, 0.08); border: 1px solid #7a7971; color: #191813;">
                    1d${dieSides} = ${rolledValue}
                </span>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px; margin-bottom: 8px; border-radius: 5px; background: rgba(255, 255, 255, 0.45); border: 1px solid #7a7971;">
                <img src="${escapeHtml(winner.img)}" width="36" height="36" style="border-radius: 4px; border: 1px solid #7a7971; object-fit: cover; flex-shrink: 0;" />
                <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.04em; color: #4b4a44;">Selected Target</div>
                    <div style="font-size: 1.15em; font-weight: bold; color: #191813; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(winner.name)}</div>
                    <div style="font-size: 0.82em; color: #4b4a44;">
                        Chance: ${formatPercent(winner.chancePct)} (Weight ${winner.weight}/${Math.round(totalWeight * 100) / 100} · Range ${winner.rangeLabel})
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 6px;">
                ${rowsHtml}
            </div>

            <div class="wdr-chat-actions" style="display: flex; gap: 6px; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0, 0, 0, 0.12);">
                <button type="button" class="wdr-chat-btn" data-wdr-action="reroll" style="flex: 1; padding: 3px 6px; font-size: 0.85em; cursor: pointer;">
                    <i class="fas fa-redo"></i> Reroll
                </button>
                ${canTargetOnScene ? `
                <button type="button" class="wdr-chat-btn" data-wdr-action="target" style="flex: 1; padding: 3px 6px; font-size: 0.85em; cursor: pointer;">
                    <i class="fas fa-crosshairs"></i> Target
                </button>` : ""}
                <button type="button" class="wdr-chat-btn" data-wdr-action="edit" style="flex: 1; padding: 3px 6px; font-size: 0.85em; cursor: pointer;">
                    <i class="fas fa-sliders-h"></i> Weights
                </button>
            </div>
        </div>
    `;

    const whisperIds = options.whisperOnly
        ? game.users.filter((u) => u.isGM).map((u) => u.id)
        : [];

    const flagPayload = {
        candidates: candidates.map((c) => ({
            key: c.key,
            tokenId: c.tokenId,
            actorId: c.actorId,
            name: c.name,
            img: c.img,
            weight: c.weight
        })),
        winner: {
            key: winner.key,
            tokenId: winner.tokenId,
            name: winner.name
        },
        options: {
            whisperOnly: Boolean(options.whisperOnly),
            autoTarget: Boolean(options.autoTarget)
        }
    };

    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ alias: WEIGHTED_DICE_ROLL_MACRO_NAME }),
        content,
        rolls: [roll],
        sound: CONFIG.sounds.dice,
        whisper: whisperIds,
        blind: options.whisperOnly,
        flags: {
            [MODULE_ID]: {
                weightedRoll: flagPayload
            }
        }
    });

    if (options.autoTarget && winner.tokenId) {
        const targeted = targetTokenOnCanvas(winner.tokenId, winner.name);
        if (!targeted) {
            ui.notifications.info(`Target Roll (1d${dieSides} = ${rolledValue}): ${winner.name}`);
        }
    } else {
        ui.notifications.info(`Target Roll (1d${dieSides} = ${rolledValue}): ${winner.name}`);
    }

    return { winner, roll, dieSides };
}

/**
 * Registers the Foundry v14 renderChatMessageHTML hook so Reroll, Target, and Weights buttons
 * on posted Weighted Dice Roll chat cards stay interactive across the session and after reloads.
 */
export function registerWeightedDiceRollHooks() {
    ensureStylesheetLoaded();
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("renderChatMessageHTML", (message, html) => {
        const flagData = message.getFlag?.(MODULE_ID, "weightedRoll");
        if (!flagData) return;

        const actionsBar = html.querySelector(".wdr-chat-actions");
        if (!actionsBar) return;

        if (!game.user.isGM) {
            actionsBar.remove();
            return;
        }

        actionsBar.addEventListener("click", async (event) => {
            const btn = event.target.closest("button[data-wdr-action]");
            if (!btn) return;
            event.preventDefault();

            const action = btn.dataset.wdrAction;
            if (action === "reroll") {
                await executeWeightedRoll(flagData.candidates, flagData.options);
            } else if (action === "target") {
                const targeted = targetTokenOnCanvas(flagData.winner?.tokenId, flagData.winner?.name ?? "target");
                if (!targeted) {
                    ui.notifications.warn("That token is not on the active scene.");
                }
            } else if (action === "edit") {
                await openWeightedDiceRollDialog({
                    candidates: flagData.candidates,
                    options: flagData.options
                });
            }
        });
    });
}

/**
 * Opens the Weighted Dice Roll dialog for fast combat target selection.
 * @param {object|null} presetState Optional state from a previous chat card.
 */
export async function openWeightedDiceRollDialog(presetState = null) {
    registerWeightedDiceRollHooks();

    const gathered = gatherCandidates(presetState);
    if (!gathered) return;

    if (activeDialog) {
        try {
            await activeDialog.close();
        } catch {
            // Ignore if already closed
        }
        activeDialog = null;
    }

    const prefs = presetState?.options
        ? { ...loadPreferences(), ...presetState.options }
        : loadPreferences();

    const state = {
        candidates: gathered.candidates,
        extraCandidates: gathered.extraCandidates,
        sourceLabel: gathered.sourceLabel,
        whisperOnly: Boolean(prefs.whisperOnly),
        autoTarget: Boolean(prefs.autoTarget)
    };

    const renderRowsMarkup = (list) =>
        list
            .map((c) => {
                const checked = c.weight > 0 ? "checked" : "";
                const rowClasses = [
                    "wdr-row",
                    c.weight <= 0 ? "wdr-row-disabled" : "",
                    c.isDown ? "wdr-row-down" : ""
                ]
                    .filter(Boolean)
                    .join(" ");

                const quickPills = QUICK_WEIGHTS.map(
                    (w) =>
                        `<button type="button" class="wdr-pill ${c.weight === w ? "active" : ""}" data-key="${escapeHtml(c.key)}" data-weight="${w}" title="Set weight to ${w}">${w}x</button>`
                ).join("");

                return `
                    <div class="${rowClasses}" data-key="${escapeHtml(c.key)}">
                        <label class="wdr-check-wrap" title="Include or exclude target">
                            <input type="checkbox" class="wdr-enable-cb" data-key="${escapeHtml(c.key)}" ${checked} />
                        </label>
                        <img class="wdr-avatar" src="${escapeHtml(c.img)}" width="32" height="32" alt="" />
                        <div class="wdr-info">
                            <div class="wdr-name">${escapeHtml(c.name)}</div>
                            ${c.statusText ? `<div class="wdr-status">${escapeHtml(c.statusText)}</div>` : ""}
                        </div>
                        <div class="wdr-pills">
                            ${quickPills}
                        </div>
                        <div class="wdr-stepper">
                            <button type="button" class="wdr-step-btn" data-key="${escapeHtml(c.key)}" data-delta="-1" title="Decrease weight">−</button>
                            <input type="number" class="wdr-weight-input" data-key="${escapeHtml(c.key)}" value="${c.weight}" min="0" max="9999" step="1" />
                            <button type="button" class="wdr-step-btn" data-key="${escapeHtml(c.key)}" data-delta="1" title="Increase weight">+</button>
                        </div>
                        <div class="wdr-odds" data-key="${escapeHtml(c.key)}">
                            <span class="wdr-pct">0%</span>
                            <span class="wdr-range">—</span>
                        </div>
                    </div>
                `;
            })
            .join("");

    const content = `
        <div class="wdr-dialog">
            <div class="wdr-toolbar">
                <div>
                    <div class="wdr-summary" id="wdr-summary">Roll: —</div>
                    <div class="wdr-source-note" id="wdr-source-note">${escapeHtml(state.sourceLabel)}</div>
                </div>
                <div class="wdr-toolbar-actions">
                    <button type="button" class="wdr-mini-btn" id="wdr-btn-equal" title="Reset active targets to weight 1">Equalize (1x)</button>
                    <button type="button" class="wdr-mini-btn" id="wdr-btn-all" title="Enable all listed targets">All</button>
                    <button type="button" class="wdr-mini-btn" id="wdr-btn-none" title="Set all weights to 0">None</button>
                    ${state.extraCandidates.length > 0 ? `<button type="button" class="wdr-mini-btn" id="wdr-btn-expand" title="Include remaining party tokens on scene">+ Party (${state.extraCandidates.length})</button>` : ""}
                </div>
            </div>

            <div class="wdr-list" id="wdr-list">
                ${renderRowsMarkup(state.candidates)}
            </div>

            <div class="wdr-inline-result" id="wdr-inline-result"></div>

            <div class="wdr-footer-options">
                <div class="wdr-opt-group">
                    <label class="wdr-opt-label" title="Send the roll privately to GMs only">
                        <input type="checkbox" id="wdr-opt-whisper" ${state.whisperOnly ? "checked" : ""} />
                        Whisper to GM
                    </label>
                    <label class="wdr-opt-label" title="Automatically set the rolled token as your canvas target">
                        <input type="checkbox" id="wdr-opt-target" ${state.autoTarget ? "checked" : ""} />
                        Target winner
                    </label>
                </div>
                <button type="button" class="wdr-keep-open-btn" id="wdr-btn-roll-stay" title="Roll target without closing this window">
                    Roll &amp; Keep Open
                </button>
            </div>
        </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
        classes: ["wdr-window"],
        window: {
            title: WEIGHTED_DICE_ROLL_MACRO_NAME,
            icon: "fa-solid fa-dice"
        },
        position: {
            width: 560,
            height: "auto"
        },
        content,
        buttons: [
            {
                action: "roll",
                label: "Roll Target",
                icon: "fa-solid fa-dice",
                default: true,
                callback: async () => {
                    await executeWeightedRoll(state.candidates, {
                        whisperOnly: state.whisperOnly,
                        autoTarget: state.autoTarget
                    });
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
    dialog.addEventListener("close", () => {
        if (activeDialog === dialog) activeDialog = null;
    }, { once: true });
    await dialog.render({ force: true });

    const root = dialog.element;
    if (!root) return;

    const listEl = root.querySelector("#wdr-list");
    const summaryEl = root.querySelector("#wdr-summary");
    const sourceNoteEl = root.querySelector("#wdr-source-note");
    const inlineResultEl = root.querySelector("#wdr-inline-result");
    const rollStayBtn = root.querySelector("#wdr-btn-roll-stay");
    const primaryRollBtn = root.querySelector('footer button[data-action="roll"]') || root.querySelector('button[data-action="roll"]');

    const findCandidate = (key) => state.candidates.find((c) => c.key === key);

    const syncUI = () => {
        const { active, dieSides } = computeWeightedRanges(state.candidates);
        const activeByKey = new Map(active.map((a) => [a.key, a]));

        summaryEl.textContent =
            active.length > 0
                ? `Roll: 1d${dieSides} · ${active.length} active target${active.length === 1 ? "" : "s"}`
                : "Roll: Select at least 1 target";

        const noTargets = active.length === 0 || dieSides <= 0;
        if (rollStayBtn) rollStayBtn.disabled = noTargets;
        if (primaryRollBtn) primaryRollBtn.disabled = noTargets;

        for (const candidate of state.candidates) {
            const row = listEl.querySelector(`.wdr-row[data-key="${CSS.escape(candidate.key)}"]`);
            if (!row) continue;

            row.classList.toggle("wdr-row-disabled", candidate.weight <= 0);

            const cb = row.querySelector(".wdr-enable-cb");
            if (cb) cb.checked = candidate.weight > 0;

            const input = row.querySelector(".wdr-weight-input");
            if (input && document.activeElement !== input) {
                input.value = String(candidate.weight);
            }

            row.querySelectorAll(".wdr-pill").forEach((pill) => {
                const pillVal = Number(pill.dataset.weight);
                pill.classList.toggle("active", candidate.weight === pillVal);
            });

            const oddsEl = row.querySelector(".wdr-odds");
            const activeInfo = activeByKey.get(candidate.key);
            if (oddsEl) {
                const pctEl = oddsEl.querySelector(".wdr-pct");
                const rangeEl = oddsEl.querySelector(".wdr-range");
                if (activeInfo) {
                    pctEl.textContent = formatPercent(activeInfo.chancePct);
                    rangeEl.textContent = `[${activeInfo.rangeLabel}]`;
                } else {
                    pctEl.textContent = "0%";
                    rangeEl.textContent = "—";
                }
            }
        }
    };

    const setCandidateWeight = (key, nextWeight) => {
        const candidate = findCandidate(key);
        if (!candidate) return;
        const normalized = normalizeWeight(nextWeight);
        if (normalized > 0) {
            candidate.lastWeight = normalized;
        }
        candidate.weight = normalized;
        syncUI();
    };

    // Delegated interactions inside the candidate list
    listEl.addEventListener("click", (event) => {
        const pill = event.target.closest(".wdr-pill");
        if (pill) {
            event.preventDefault();
            setCandidateWeight(pill.dataset.key, Number(pill.dataset.weight));
            return;
        }

        const stepBtn = event.target.closest(".wdr-step-btn");
        if (stepBtn) {
            event.preventDefault();
            const candidate = findCandidate(stepBtn.dataset.key);
            if (!candidate) return;
            const delta = Number(stepBtn.dataset.delta);
            setCandidateWeight(candidate.key, Math.max(0, candidate.weight + delta));
        }
    });

    listEl.addEventListener("change", (event) => {
        const cb = event.target.closest(".wdr-enable-cb");
        if (cb) {
            const candidate = findCandidate(cb.dataset.key);
            if (!candidate) return;
            const restored = candidate.lastWeight > 0 ? candidate.lastWeight : 1;
            setCandidateWeight(candidate.key, cb.checked ? restored : 0);
        }
    });

    listEl.addEventListener("input", (event) => {
        const input = event.target.closest(".wdr-weight-input");
        if (!input) return;
        const candidate = findCandidate(input.dataset.key);
        if (!candidate) return;
        const rawVal = input.value.trim();
        if (rawVal === "") {
            candidate.weight = 0;
            syncUI();
            return;
        }
        setCandidateWeight(candidate.key, rawVal);
    });

    // Toolbar quick actions
    root.querySelector("#wdr-btn-equal")?.addEventListener("click", () => {
        const hasActive = state.candidates.some((c) => c.weight > 0);
        for (const c of state.candidates) {
            if (!hasActive || c.weight > 0) {
                c.weight = 1;
                c.lastWeight = 1;
            }
        }
        syncUI();
    });

    root.querySelector("#wdr-btn-all")?.addEventListener("click", () => {
        for (const c of state.candidates) {
            if (c.weight <= 0) {
                c.weight = c.lastWeight > 0 ? c.lastWeight : 1;
            }
        }
        syncUI();
    });

    root.querySelector("#wdr-btn-none")?.addEventListener("click", () => {
        for (const c of state.candidates) {
            if (c.weight > 0) c.lastWeight = c.weight;
            c.weight = 0;
        }
        syncUI();
    });

    const expandBtn = root.querySelector("#wdr-btn-expand");
    expandBtn?.addEventListener("click", () => {
        if (state.extraCandidates.length === 0) return;
        state.candidates.push(...state.extraCandidates);
        state.extraCandidates = [];
        listEl.innerHTML = renderRowsMarkup(state.candidates);
        if (sourceNoteEl) sourceNoteEl.textContent = `${state.candidates.length} targets listed`;
        expandBtn.remove();
        syncUI();
        dialog.setPosition?.({ height: "auto" });
    });

    // Option toggles
    root.querySelector("#wdr-opt-whisper")?.addEventListener("change", (event) => {
        state.whisperOnly = Boolean(event.currentTarget.checked);
        savePreferences({ whisperOnly: state.whisperOnly, autoTarget: state.autoTarget });
    });

    root.querySelector("#wdr-opt-target")?.addEventListener("change", (event) => {
        state.autoTarget = Boolean(event.currentTarget.checked);
        savePreferences({ whisperOnly: state.whisperOnly, autoTarget: state.autoTarget });
    });

    // Roll & Keep Open action
    rollStayBtn?.addEventListener("click", async () => {
        const result = await executeWeightedRoll(state.candidates, {
            whisperOnly: state.whisperOnly,
            autoTarget: state.autoTarget
        });
        if (!result || !inlineResultEl) return;

        inlineResultEl.innerHTML = `
            <span>
                <i class="fas fa-crosshairs"></i>
                <strong>${escapeHtml(result.winner.name)}</strong>
                (${formatPercent(result.winner.chancePct)})
            </span>
            <span style="opacity: 0.85; font-variant-numeric: tabular-nums;">
                1d${result.dieSides} = <strong>${result.roll.total}</strong>
            </span>
        `;
        inlineResultEl.classList.add("visible");
        dialog.setPosition?.({ height: "auto" });
    });

    syncUI();
}
