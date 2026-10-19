/* The pursuit HUD in Foundry. The GM prepares a pursuit from the tokens selected and targeted (who flees, who pursues,
   on foot or in which vehicle; the draft is kept in the world), then launches it as a Foundry combat flagged as a
   pursuit, with one pass per round: initiative sets the order of play, rerolled each round by the RWF Ruleset, and
   the fleeing side gets a bonus in the first round. On its turn a participant moves its own gauge (the RWF Ruleset's
   "Progression de poursuite"), then the turn passes. The active GM notes who reached a bound, skips their turns and
   ends the pursuit once a side has no one left running. */
import {MODULE_ID, SOCKET} from "./test-request-model.mjs";
import {RWF, ROLES, FOOT, FLEE_BONUS, hudRuleset, readPursuit, readRunningPursuit, runningPursuitFlag, addParticipants, assignTargets, setFleeing, canLaunch, emptyPursuit, setupView, pursuitView, actionContext, readWhole, yourTurn, splitCheck} from "./hud-model.mjs";
import {renderPursuitHTML} from "./hud-markup.mjs";
import {t, rta, notifyError, ApplicationV2, diceMode, setDiceMode, contentNamer, runAction} from "./hud-common.mjs";

export const PURSUIT_HUD_ID = "rwf-pursuit-hud";
export const PURSUIT_FLAG = "pursuit";

export const storedPursuit = () => { try { return readPursuit(globalThis.game.settings.get(MODULE_ID, "pursuit")); } catch { return emptyPursuit(); } };
const savePursuit = pursuit => globalThis.game.settings.set(MODULE_ID, "pursuit", readPursuit(pursuit));

export const isPursuitCombat = combat => Boolean(combat?.getFlag?.(MODULE_ID, PURSUIT_FLAG));
/** The pursuits running in the world (a pursuit split in two runs as two combats). */
export const pursuitCombats = () => [...(globalThis.game.combats ?? [])].filter(c => isPursuitCombat(c) && c.started);
/** The combat of the pursuit to show: the one asked for (combatId) while it runs, else the current combat when it is a
 * pursuit, else (a player) one where this user plays someone, else the first running, else any pursuit combat. */
export function pursuitCombat(combatId = null) {
  const game = globalThis.game, list = pursuitCombats();
  const asked = combatId ? list.find(c => c.id === combatId) : null;
  if (asked) return asked;
  if (isPursuitCombat(game.combat) && game.combat.started) return game.combat;
  const mine = game.user?.isGM ? null : list.find(c => [...(c.combatants ?? [])].some(x => x.isOwner || x.actor?.isOwner));
  return mine ?? list[0] ?? [...(game.combats ?? [])].find(isPursuitCombat) ?? null;
}
const running = combat => readRunningPursuit(combat.getFlag(MODULE_ID, PURSUIT_FLAG));
const saveRunning = (combat, pursuit) => combat.update({[`flags.${MODULE_ID}.${PURSUIT_FLAG}`]: runningPursuitFlag(pursuit)});
const chat = text => globalThis.ChatMessage.create({content: `<p><strong>${t("RWFTOOLS.Pursuit.Title")}</strong> · ${text}</p>`});
const activeGM = () => { const game = globalThis.game; return game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user); };

/** The tokens the GM selected and targeted on the scene, as pursuit candidates. */
function sceneCandidates() {
  const game = globalThis.game, tokens = [...(globalThis.canvas?.tokens?.controlled ?? []), ...(game.user.targets ?? [])];
  const seen = new Set(), out = [];
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    out.push({uuid: actor.uuid, tokenId: token.document?.id ?? token.id, name: token.name ?? actor.name, playerOwned: Boolean(actor.hasPlayerOwner)});
  }
  return out;
}

/** Every token of a scene whose Actor plays under the RWF Ruleset, once per Actor. */
async function sceneTokens(scene, versionId) {
  const seen = new Set(), out = [];
  for (const token of scene?.tokens ?? []) {
    const actor = token.actor;
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    let state = null;
    try { state = await rta().runtime.getContainerState(actor.uuid); } catch { state = null; }
    if (state?.rulesetVersionId === versionId) out.push({uuid: actor.uuid, tokenId: token.id, name: token.name ?? actor.name, playerOwned: Boolean(actor.hasPlayerOwner)});
  }
  return out;
}

/** A participant's gauge goes back to 0 (the RWF Action "Nouvelle poursuite"); no chat card. */
async function resetGauges(versionId, uuids) {
  for (const uuid of uuids) {
    try { await rta().runtime.executeAction(versionId, RWF.reset, actionContext({actorUuid: uuid, isGM: true, userId: globalThis.game.user.id})); }
    catch (error) { console.warn("RWF tools | Gauge not reset", uuid, error); }
  }
}

/** Combatants for participants whose token is on the combat's scene, with their initiative rolled; returns the
 * participants with their combatant. */
async function joinCombat(combat, participants) {
  const scene = combat.scene ?? globalThis.canvas?.scene, joined = [];
  for (const p of participants) {
    const token = scene?.tokens?.get?.(p.tokenId);
    if (token) joined.push({p, data: {tokenId: token.id, sceneId: scene.id, actorId: token.actorId, hidden: token.hidden}});
    else globalThis.ui?.notifications?.warn?.(`${p.name} : ${t("RWFTOOLS.Pursuit.NotOnScene")}`);
  }
  if (!joined.length) return [];
  const created = await combat.createEmbeddedDocuments("Combatant", joined.map(j => j.data));
  await combat.rollInitiative(created.map(c => c.id));
  return created.map((c, i) => ({...joined[i].p, uuid: c.actor?.uuid ?? joined[i].p.uuid, combatantId: c.id}));
}

/** Once the pursuit has started, the fugitives get their +2: each fugitive's initiative is read again from the combat
 * (rolled first if it still has none), raised, and the round starts with the best initiative. */
async function raiseFugitives(combat, joined) {
  const fugitives = () => joined.filter(p => p.role === "fuyard").map(p => combat.combatants.get(p.combatantId)).filter(Boolean);
  const unrolled = fugitives().filter(c => !Number.isFinite(Number(c.initiative)) || c.initiative === null || c.initiative === "");
  if (unrolled.length) await combat.rollInitiative(unrolled.map(c => c.id));
  const rolled = new Map(), raised = [];
  for (const c of fugitives()) if (Number.isFinite(Number(c.initiative)) && c.initiative !== null) { rolled.set(c.id, Number(c.initiative)); raised.push({_id: c.id, initiative: Number(c.initiative) + FLEE_BONUS}); }
  if (raised.length) await combat.updateEmbeddedDocuments("Combatant", raised);
  if (Number(combat.turn) !== 0) await combat.update({turn: 0});
  // The order, each fugitive's initiative shown with its bonus: "Luca 13.33 + 2 = 15.33 · Vilain 15.32".
  const order = (combat.turns ?? []).map(c => rolled.has(c.id) ? `${escapeHTML(c.name)} ${rolled.get(c.id)} + ${FLEE_BONUS} = <strong>${c.initiative}</strong>` : `${escapeHTML(c.name)} <strong>${c.initiative}</strong>`);
  console.info("RWF tools | Pursuit initiative", (combat.turns ?? []).map(c => `${c.name} ${c.initiative}`).join(" · "));
  return order.join(" · ");
}
const escapeHTML = text => String(text ?? "").replace(/[&<>"]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[ch]);

export function createPursuitHud() {
  return class PursuitHud extends ApplicationV2() {
    static DEFAULT_OPTIONS = {id: PURSUIT_HUD_ID, classes: ["rwf-tools-app", "rwf-hud-app"], position: {width: 440, height: "auto"}, window: {title: "RWFTOOLS.Pursuit.Title", icon: "fa-solid fa-gauge-high", resizable: true}};
    #view = null;
    #pending = null;
    #error = null;
    #message = null;
    #busy = false;
    #settingsOpen = false;
    #combatId = null;
    #split = new Set();
    /** The pursuit this window shows (several run once a pursuit is split). */
    #combat() { return pursuitCombat(this.#combatId); }
    show(combatId) { this.#combatId = combatId ?? null; this.#split.clear(); return this; }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      try { this.#view = await this.#read(); } catch (error) { console.error("RWF tools |", error); this.#view = {reason: "RWFTOOLS.Error.HudFailed"}; }
      return context;
    }
    async #read() {
      await rta()?.configuratorReady;
      const found = hudRuleset(rta()?.configurator);
      if (found.reason) return {reason: found.reason};
      const game = globalThis.game, isGM = Boolean(game.user.isGM), {versionId, ruleset} = found, runtime = rta().runtime;
      const contentName = (row, uuid) => contentNamer(ruleset, uuid)(row);
      const combat = this.#combat();
      if (combat?.started) {
        this.#combatId = combat.id;
        const pursuit = running(combat), turns = [...(combat.turns ?? [])];
        const byCombatant = new Map(pursuit.participants.map(p => [p.combatantId, p]));
        const order = turns.map(c => byCombatant.get(c.id)?.uuid).filter(Boolean);
        const active = combat.combatant ?? null, activeUuid = active ? byCombatant.get(active.id)?.uuid ?? null : null;
        // Whether this user plays a participant: its token's actor, else the Actor behind the token (a player's client
        // may not have the token's actor ready yet).
        const owns = combatant => Boolean(combatant?.isOwner || combatant?.actor?.isOwner || game.actors?.get?.(combatant?.actorId)?.isOwner);
        const byUuid = new Map(pursuit.participants.map(p => [p.uuid, p]));
        const owner = uuid => isGM || owns(combat.combatants.get(byUuid.get(uuid)?.combatantId)) || Boolean(globalThis.fromUuidSync?.(uuid)?.isOwner);
        const view = await pursuitView(runtime, {versionId, ruleset, pursuit, order, activeUuid, canAct: owner, isGM, userId: game.user.id, contentName});
        const myTurn = Boolean(active) && yourTurn({isGM, owned: owns(active), playerOwned: Boolean(active.actor?.hasPlayerOwner ?? game.actors?.get?.(active.actorId)?.hasPlayerOwner)});
        const others = isGM ? (await sceneTokens(combat.scene, versionId)).filter(c => !pursuit.participants.some(p => p.uuid === c.uuid)) : [];
        // Several pursuits: one tab each, named after its fugitives.
        const all = pursuitCombats(), pursuits = all.length > 1 ? all.map(c => ({id: c.id, current: c.id === combat.id,
          label: running(c).participants.filter(p => p.role === "fuyard").map(p => p.name).join(", ") || c.id})) : [];
        const split = isGM ? {picked: [...this.#split].filter(uuid => byUuid.has(uuid)), ...splitCheck(view.rows, this.#split)} : null;
        return {...view, isGM, myTurn, round: combat.round, combatId: combat.id, combatantId: active?.id ?? null, versionId, ruleset, available: others, pursuits, split};
      }
      const draft = storedPursuit();
      if (draft.phase === "setup") {
        const others = isGM ? (await sceneTokens(globalThis.canvas?.scene, versionId)).filter(c => !draft.participants.some(p => p.uuid === c.uuid)) : [];
        return {...(await setupView(runtime, {versionId, ruleset, pursuit: draft, contentName})), isGM, fleeBonus: FLEE_BONUS, versionId, ruleset, available: others};
      }
      return {phase: "none", isGM};
    }
    async _renderHTML() {
      const view = this.#view ?? {phase: "none", isGM: Boolean(globalThis.game.user?.isGM)};
      return renderPursuitHTML({...view, mode: diceMode(), pending: this.#pending, error: this.#error, message: this.#message, settingsOpen: this.#settingsOpen}, t);
    }
    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element, on = (selector, handler, type = "click") => { for (const el of root.querySelectorAll(selector)) el.addEventListener(type, handler); };
      on("[data-rwf-mode]", async event => { await setDiceMode(event.currentTarget.dataset.rwfMode); this.#pending = null; this.render(); });
      on("[data-rwf-move]", event => this.#move(event.currentTarget.dataset.rwfMove));
      on("[data-rwf-end-turn]", () => this.#endTurn());
      on("[data-rwf-table-cancel]", () => { this.#pending = null; this.#error = null; this.render(); });
      on("[data-rwf-table]", event => { event.preventDefault(); this.#submitTable(new FormData(event.currentTarget)); }, "submit");
      on("[data-rwf-settings]", event => { this.#settingsOpen = event.currentTarget.open; }, "toggle");
      // The GM's controls, for the pursuit being prepared or the one running.
      on("[data-rwf-start]", () => this.#prepare());
      on("[data-rwf-fleeing]", event => this.#editDraft(p => setFleeing(p, event.currentTarget.dataset.rwfFleeing)));
      on("[data-rwf-launch]", () => this.#launch());
      on("[data-rwf-cancel]", () => this.#editDraft(() => emptyPursuit()));
      on("[data-rwf-join]", event => this.#join(event.currentTarget.dataset.rwfJoin, event.currentTarget.dataset.rwfSide));
      on("[data-rwf-end]", () => this.#finish());
      on("[data-rwf-cap]", event => this.#edit(p => ({...p, cap: Math.max(0, Number(event.currentTarget.value) || 0)})), "change");
      on("[data-rwf-role]", event => { const {rwfRole: uuid, rwfTo: role} = event.currentTarget.dataset; if (ROLES.includes(role)) this.#edit(p => ({...p, participants: assignTargets(p.participants.map(x => x.uuid === uuid ? {...x, role} : x))})); });
      on("[data-rwf-target]", event => { const uuid = event.currentTarget.dataset.rwfTarget, targetUuid = event.currentTarget.value; this.#edit(p => ({...p, participants: p.participants.map(x => x.uuid === uuid ? {...x, targetUuid} : x)})); }, "change");
      on("[data-rwf-chase]", event => this.#chase(event.currentTarget.dataset.rwfChase, event.currentTarget.value), "change");
      on("[data-rwf-means]", event => { const uuid = event.currentTarget.dataset.rwfMeans, means = event.currentTarget.value || FOOT; this.#edit(p => ({...p, participants: p.participants.map(x => x.uuid === uuid ? {...x, means} : x)})); }, "change");
      on("[data-rwf-remove]", event => this.#remove(event.currentTarget.dataset.rwfRemove));
      on("[data-rwf-pursuit]", event => this.#showPursuit(event.currentTarget.dataset.rwfPursuit));
      on("[data-rwf-split-pick]", event => { const uuid = event.currentTarget.dataset.rwfSplitPick; if (event.currentTarget.checked) this.#split.add(uuid); else this.#split.delete(uuid); this.render(); }, "change");
      on("[data-rwf-split]", () => this.#splitPursuit());
      root.querySelector("[data-rwf-autofocus]")?.focus();
    }

    /** A change to the pursuit, prepared or running (the GM only). */
    async #edit(change) {
      if (!globalThis.game.user.isGM) return;
      const combat = this.#combat();
      try {
        if (combat?.started) await saveRunning(combat, change(running(combat)));
        else await savePursuit(change(storedPursuit()));
      } catch (error) { notifyError(error); }
    }
    async #editDraft(change) {
      if (!globalThis.game.user.isGM) return;
      try { await savePursuit(change(storedPursuit())); } catch (error) { notifyError(error); }
    }
    /** The GM prepares a pursuit: the tokens selected (or targeted) take part, else every RWF token of the scene. */
    async #prepare() {
      const found = hudRuleset(rta()?.configurator);
      if (found.reason) return;
      const selected = sceneCandidates(), candidates = selected.length ? selected : await sceneTokens(globalThis.canvas?.scene, found.versionId);
      this.#message = candidates.length ? null : "RWFTOOLS.Pursuit.NoTokens";
      if (!candidates.length) return this.render();
      await savePursuit({...addParticipants(emptyPursuit(), candidates), phase: "setup"});
    }
    /** A token of the scene joins one side. In a running pursuit: its gauge from 0, its initiative rolled. */
    async #join(uuid, role) {
      const candidate = this.#view?.available?.find(c => c.uuid === uuid);
      if (!globalThis.game.user.isGM || !candidate || !ROLES.includes(role)) return;
      const combat = this.#combat();
      if (!combat?.started) return this.#editDraft(p => addParticipants(p, [{...candidate, role}]));
      const pursuit = running(combat);
      try {
        const added = addParticipants({fleeing: "pnj", participants: []}, [{...candidate, role}]).participants;
        await resetGauges(this.#view?.versionId, added.map(p => p.uuid));
        const joined = await joinCombat(combat, added);
        await saveRunning(combat, {...pursuit, participants: assignTargets([...pursuit.participants, ...joined], uuid => !pursuit.outcomes[uuid])});
      } catch (error) { notifyError(error); }
    }
    async #remove(uuid) {
      const combat = this.#combat();
      if (!combat?.started) return this.#editDraft(p => ({...p, participants: p.participants.filter(x => x.uuid !== uuid)}));
      const pursuit = running(combat), gone = pursuit.participants.find(p => p.uuid === uuid);
      try {
        await saveRunning(combat, {...pursuit, participants: pursuit.participants.filter(p => p.uuid !== uuid)});
        if (gone?.combatantId && combat.combatants.get(gone.combatantId)) await combat.deleteEmbeddedDocuments("Combatant", [gone.combatantId]);
        // Out of the pursuit is out of the combat: "En combat" and the round counters go.
        await rta().runtime.emitSystemEvent("rta.combat.end", {combatId: combat.id, round: Number(combat.round ?? 0)}, [uuid]);
      } catch (error) { notifyError(error); }
    }

    /** The prepared pursuit becomes a combat: one pass per round, initiative rolled, the fleeing side's raised. */
    async #launch() {
      const game = globalThis.game, draft = storedPursuit(), scene = globalThis.canvas?.scene;
      if (!game.user.isGM || !canLaunch(draft) || !scene || this.#busy) return;
      this.#busy = true;
      try {
        await resetGauges(this.#view?.versionId, draft.participants.map(p => p.uuid));
        const CombatClass = globalThis.CONFIG?.Combat?.documentClass ?? globalThis.Combat;
        const combat = await CombatClass.create({scene: scene.id, active: true, flags: {[MODULE_ID]: {[PURSUIT_FLAG]: {cap: draft.cap, participants: [], outcomes: []}}, "rule-them-all": {singlePass: true}}});
        const joined = await joinCombat(combat, assignTargets(draft.participants));
        await saveRunning(combat, {cap: draft.cap, participants: joined, outcomes: {}});
        await combat.startCombat();
        const order = await raiseFugitives(combat, joined);
        await savePursuit(emptyPursuit());
        await chat(`${t("RWFTOOLS.Pursuit.Started")} ${fmtText(t("RWFTOOLS.Pursuit.FleeBonus"), {n: FLEE_BONUS})}${order ? `<br>${fmtText(t("RWFTOOLS.Pursuit.Order"), {list: order})}` : ""}`);
        // The players with a character in it see the pursuit open on their screen.
        game.socket.emit(SOCKET, {type: "pursuit.open", combatId: combat.id});
      } catch (error) { this.#message = error?.message ?? String(error); notifyError(error); }
      finally { this.#busy = false; }
      this.render();
    }
    /** Another pursuit in this window; the GM's combat tracker follows it. */
    async #showPursuit(combatId) {
      const combat = pursuitCombats().find(c => c.id === combatId);
      if (!combat) return;
      this.show(combat.id);
      if (globalThis.game.user.isGM && !combat.active) { try { await combat.activate(); } catch (error) { notifyError(error); } }
      this.render();
    }
    /** The GM splits the pursuit: the participants picked run on in a combat of their own, keeping their initiative,
     * gauge and outcome; each pursuer of either part chases a fugitive of its part. */
    async #splitPursuit() {
      const game = globalThis.game, combat = this.#combat();
      if (!game.user.isGM || !combat?.started || this.#busy) return;
      const pursuit = running(combat), rows = this.#view?.rows ?? [];
      if (!splitCheck(rows, this.#split).canSplit) return;
      this.#busy = true;
      try {
        const leaving = pursuit.participants.filter(p => this.#split.has(p.uuid)), staying = pursuit.participants.filter(p => !this.#split.has(p.uuid));
        const gaps = new Map(rows.map(r => [r.uuid, r.gauge])), running_ = uuid => !pursuit.outcomes[uuid], gap = uuid => gaps.get(uuid);
        const CombatClass = globalThis.CONFIG?.Combat?.documentClass ?? globalThis.Combat;
        const other = await CombatClass.create({scene: combat.scene?.id ?? globalThis.canvas?.scene?.id, active: true, flags: {[MODULE_ID]: {[PURSUIT_FLAG]: {cap: pursuit.cap, participants: [], outcomes: []}}, "rule-them-all": {singlePass: true}}});
        const old = leaving.map(p => combat.combatants.get(p.combatantId)).filter(Boolean);
        const created = await other.createEmbeddedDocuments("Combatant", old.map(c => ({tokenId: c.tokenId, sceneId: c.sceneId, actorId: c.actorId, hidden: c.hidden, initiative: c.initiative, defeated: c.defeated})));
        const moved = leaving.map(p => { const i = old.findIndex(c => c.id === p.combatantId); return i < 0 ? null : {...p, combatantId: created[i].id}; }).filter(Boolean);
        const outcomes = Object.fromEntries(Object.entries(pursuit.outcomes).filter(([uuid]) => moved.some(p => p.uuid === uuid)));
        await saveRunning(other, {cap: pursuit.cap, participants: assignTargets(moved, running_, gap), outcomes});
        await saveRunning(combat, {...pursuit, participants: assignTargets(staying, running_, gap), outcomes: Object.fromEntries(Object.entries(pursuit.outcomes).filter(([uuid]) => !this.#split.has(uuid)))});
        if (old.length) await combat.deleteEmbeddedDocuments("Combatant", old.map(c => c.id));
        await other.startCombat();
        const names = list => list.map(p => escapeHTML(p.name)).join(", ");
        await chat(fmtText(t("RWFTOOLS.Pursuit.SplitDone"), {a: names(staying), b: names(moved)}));
        game.socket.emit(SOCKET, {type: "pursuit.open", combatId: other.id});
        this.show(other.id);
      } catch (error) { this.#message = error?.message ?? String(error); notifyError(error); }
      finally { this.#busy = false; }
      this.render();
    }
    async #finish() {
      const combat = this.#combat();
      if (!globalThis.game.user.isGM || !combat) return;
      this.#pending = null;
      await endPursuit(combat);
    }

    #move(move) {
      const view = this.#view, row = view?.current, m = row?.moves?.find(x => x.move === move);
      if (!m?.allowed || this.#busy) return;
      this.#message = null; this.#error = null;
      // A fugitive acts on its own gap, a pursuer on its target's (sens −1).
      const request = {uuid: row.uuid, combatantId: view.combatantId, actionId: m.actionId, contentKey: m.contentKey, targetUuid: m.targetUuid, input: move === "stop" ? {sens: m.sens} : {vitesse: row.advantage, sens: m.sens}};
      if (move !== "stop" && diceMode() === "table") { this.#pending = {...request, label: m.label, subject: row.name}; return this.render(); }
      return this.#run(request);
    }
    #submitTable(form) {
      const pending = this.#pending;
      if (!pending) return;
      const de = readWhole(form.get("de"));
      if (de === null) { this.#error = "RWFTOOLS.Prompt.Invalid"; return this.render(); }
      this.#pending = null; this.#error = null;
      return this.#run({...pending, input: {...pending.input, de}});
    }
    /** The move, then the turn passes: one move per turn. */
    async #run({uuid, combatantId, actionId, contentKey, targetUuid, input}) {
      const view = this.#view;
      this.#busy = true;
      try {
        const combatant = globalThis.game.combats?.get?.(view.combatId)?.combatants?.get?.(combatantId) ?? null;
        await runAction({versionId: view.versionId, ruleset: view.ruleset, actorUuid: uuid, actionId, contentKey, targetUuid, input, combatant});
        await passTurn(view.combatId, combatantId);
      } catch (error) { this.#message = error?.message ?? String(error); notifyError(error); }
      finally { this.#busy = false; }
      this.render();
    }
    /** The fugitive a pursuer chases, picked on its turn: the GM writes it, a player asks the active GM's client. */
    async #chase(uuid, targetUuid) {
      const game = globalThis.game, combat = this.#combat();
      if (!combat || !targetUuid) return;
      if (game.user.isGM) return this.#edit(p => ({...p, participants: p.participants.map(x => x.uuid === uuid ? {...x, targetUuid} : x)}));
      game.socket.emit(SOCKET, {type: "pursuit.target", combatId: combat.id, uuid, targetUuid, userId: game.user.id});
    }
    async #endTurn() {
      const view = this.#view;
      if (!view?.current?.moves?.length) return;
      try { await passTurn(view.combatId, view.combatantId); } catch (error) { notifyError(error); }
    }
  };
}

const fmtText = (text, data) => Object.entries(data).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), text);

/** The turn of this combatant passes, if it is still its turn: the GM moves the combat on, a player asks the GM's client. */
async function passTurn(combatId, combatantId) {
  const game = globalThis.game, combat = game.combats?.get?.(combatId);
  if (!combat || combat.combatant?.id !== combatantId) return;
  if (game.user.isGM) await combat.nextTurn();
  else game.socket.emit(SOCKET, {type: "hud.endTurn", combatId, combatantId, userId: game.user.id});
}

/** The pursuit ends: who got where, in the chat, and its combat goes (every participant leaves the combat). */
async function endPursuit(combat) {
  const pursuit = running(combat), found = hudRuleset(rta()?.configurator);
  let summary = "";
  if (!found.reason) {
    const view = await pursuitView(rta().runtime, {versionId: found.versionId, ruleset: found.ruleset, pursuit, canAct: () => false});
    summary = view.rows.map(r => `${r.name} : ${t(r.status.key)}`).join(" · ");
  }
  await chat(`${t("RWFTOOLS.Pursuit.Ended")}${summary ? ` ${summary}` : ""}`);
  await combat.delete();
}

/** Active GM: notes the participants who reached a bound (in the chat, defeated in the tracker), passes their turns,
 * and ends the pursuit once a side has no one left running. */
/** Active GM client: a player picks the fugitive a pursuer they own chases, among the pursuit's running fugitives. */
export async function servePursuitTarget(message, senderId) {
  const game = globalThis.game;
  if (message?.type !== "pursuit.target" || !activeGM()) return;
  const combat = game.combats?.get?.(message.combatId), user = game.users.get(senderId ?? message.userId);
  if (!combat || !user || !isPursuitCombat(combat)) return;
  const pursuit = running(combat), chaser = pursuit.participants.find(p => p.uuid === message.uuid && p.role === "poursuivant");
  const target = pursuit.participants.find(p => p.uuid === message.targetUuid && p.role === "fuyard" && !pursuit.outcomes[p.uuid]);
  if (!chaser || !target || !combat.combatants.get(chaser.combatantId)?.testUserPermission?.(user, "OWNER")) return;
  try { await saveRunning(combat, {...pursuit, participants: pursuit.participants.map(p => p.uuid === chaser.uuid ? {...p, targetUuid: target.uuid} : p)}); } catch (error) { notifyError(error); }
}

/** Player client: the GM launched a pursuit; its HUD opens when one of this user's characters takes part. */
export function servePursuitOpen(message) {
  const game = globalThis.game;
  if (message?.type !== "pursuit.open" || game.user.isGM) return;
  const combat = game.combats?.get?.(message.combatId);
  if (!combat || !isPursuitCombat(combat)) return;
  const owns = c => Boolean(c?.isOwner || c?.actor?.isOwner || game.actors?.get?.(c?.actorId)?.isOwner);
  if (running(combat).participants.some(p => owns(combat.combatants.get(p.combatantId)))) openPursuitHud(combat.id);
}

export function installPursuitKeeper({hooks = globalThis.Hooks, delay = 300} = {}) {
  let timer = null, busy = false, again = false;
  const check = async () => {
    if (!activeGM() || !rta()?.runtime || !pursuitCombats().length) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      await rta().configuratorReady;
      const found = hudRuleset(rta().configurator);
      if (found.reason) return;
      for (const combat of pursuitCombats()) await keep(combat, found);
    } catch (error) { console.error(`${MODULE_ID} | Pursuit check failed`, error); }
    finally {
      busy = false;
      if (again) { again = false; later(); }
    }
  };
  /** One pursuit: outcomes noted, targets kept on running fugitives, done turns skipped, the end. */
  const keep = async (combat, found) => {
    try {
      const pursuit = running(combat), view = await pursuitView(rta().runtime, {versionId: found.versionId, ruleset: found.ruleset, pursuit, canAct: () => false});
      const reached = view.rows.filter(r => r.status.done && !pursuit.outcomes[r.uuid]);
      if (reached.length) {
        await saveRunning(combat, {...pursuit, outcomes: {...pursuit.outcomes, ...Object.fromEntries(reached.map(r => [r.uuid, r.status.key]))}});
        for (const r of reached) {
          const by = r.role === "fuyard" && r.status.key === "RWFTOOLS.Pursuit.Status.CaughtUp" && r.chasers?.length ? ` (${r.chasers.map(c => c.name).join(", ")})` : "";
          await chat(`${r.name} : ${t(r.status.key)}${by}`);
          const combatant = combat.combatants.get(r.combatantId);
          if (combatant && !combatant.isDefeated) await combatant.update({defeated: true});
        }
      }
      if (view.over) return endPursuit(combat);
      // A pursuer whose fugitive is out of the pursuit chases another one still running.
      const gaps = new Map(view.rows.map(r => [r.uuid, r.gauge]));
      const after = running(combat), retargeted = assignTargets(after.participants, uuid => !after.outcomes[uuid], uuid => gaps.get(uuid));
      if (JSON.stringify(retargeted) !== JSON.stringify(after.participants)) await saveRunning(combat, {...after, participants: retargeted});
      const done = new Set(view.rows.filter(r => r.status.done).map(r => r.combatantId));
      if (combat.combatant && done.has(combat.combatant.id)) await passTurn(combat.id, combat.combatant.id);
    } catch (error) { console.error(`${MODULE_ID} | Pursuit check failed`, combat.id, error); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(check, delay); };
  for (const hook of ["combatStart", "combatTurnChange", "updateCombat", "updateCombatant", "updateActor", "updateToken"]) hooks.on(hook, later);
  later();
  return check;
}

let PursuitHud = null;
export function openPursuitHud(combatId = null) {
  PursuitHud ??= createPursuitHud();
  const open = globalThis.foundry.applications.instances.get(PURSUIT_HUD_ID) ?? new PursuitHud();
  if (combatId) open.show(combatId);
  return open.render({force: true});
}
