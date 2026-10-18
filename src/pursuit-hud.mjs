/* The pursuit HUD in Foundry. The GM starts a pursuit with the tokens selected and targeted, sets each participant's
   role and means (on foot or one of its vehicles) and the reference of speed; the pursuit is kept in the world so every
   client shows it. Each participant has its own gauge (the RWF Ruleset's "Progression de poursuite"), and the player
   who plays it runs its moves; the speed advantage against the reference is worked out here. */
import {MODULE_ID} from "./test-request-model.mjs";
import {RWF, FOOT, ROLES, hudRuleset, readPursuit, addParticipants, emptyPursuit, pursuitView, actionContext, readWhole} from "./hud-model.mjs";
import {renderPursuitHTML} from "./hud-markup.mjs";
import {t, rta, notifyError, ApplicationV2, diceMode, setDiceMode, contentNamer, runAction} from "./hud-common.mjs";

export const PURSUIT_HUD_ID = "rwf-pursuit-hud";

export const storedPursuit = () => { try { return readPursuit(globalThis.game.settings.get(MODULE_ID, "pursuit")); } catch { return emptyPursuit(); } };
const savePursuit = pursuit => globalThis.game.settings.set(MODULE_ID, "pursuit", readPursuit(pursuit));

/** The tokens the GM selected and targeted, as pursuit candidates. */
function sceneCandidates() {
  const game = globalThis.game, tokens = [...(globalThis.canvas?.tokens?.controlled ?? []), ...(game.user.targets ?? [])];
  const seen = new Set(), out = [];
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    out.push({uuid: actor.uuid, name: token.name ?? actor.name, playerOwned: Boolean(actor.hasPlayerOwner)});
  }
  return out;
}

export function createPursuitHud() {
  return class PursuitHud extends ApplicationV2() {
    static DEFAULT_OPTIONS = {id: PURSUIT_HUD_ID, classes: ["rwf-tools-app", "rwf-hud-app"], position: {width: 420, height: "auto"}, window: {title: "RWFTOOLS.Pursuit.Title", icon: "fa-solid fa-gauge-high", resizable: true}};
    #view = null;
    #pending = null;
    #error = null;
    #message = null;
    #busy = false;

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      try { this.#view = await this.#read(); } catch (error) { console.error("RWF tools |", error); this.#view = {reason: "RWFTOOLS.Error.HudFailed"}; }
      return context;
    }
    async #read() {
      await rta()?.configuratorReady;
      const found = hudRuleset(rta()?.configurator);
      if (found.reason) return {reason: found.reason};
      const game = globalThis.game, isGM = Boolean(game.user.isGM), pursuit = storedPursuit();
      if (!pursuit.active) return {active: false, isGM};
      const {versionId, ruleset} = found;
      const owner = uuid => isGM || Boolean(globalThis.fromUuidSync?.(uuid)?.isOwner);
      const view = await pursuitView(rta().runtime, {versionId, ruleset, pursuit, canAct: owner, isGM, userId: game.user.id, contentName: (row, uuid) => contentNamer(ruleset, uuid)(row)});
      return {...view, active: true, isGM, versionId, ruleset, pursuit};
    }
    async _renderHTML() {
      const view = this.#view ?? {active: false, isGM: Boolean(globalThis.game.user?.isGM)};
      return renderPursuitHTML({...view, mode: diceMode(), pending: this.#pending, error: this.#error, message: this.#message}, t);
    }
    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element, on = (selector, handler, type = "click") => { for (const el of root.querySelectorAll(selector)) el.addEventListener(type, handler); };
      on("[data-rwf-mode]", async event => { await setDiceMode(event.currentTarget.dataset.rwfMode); this.#pending = null; this.render(); });
      on("[data-rwf-move]", event => this.#move(event.currentTarget.dataset.rwfWho, event.currentTarget.dataset.rwfMove));
      on("[data-rwf-table-cancel]", () => { this.#pending = null; this.#error = null; this.render(); });
      on("[data-rwf-table]", event => { event.preventDefault(); this.#submitTable(new FormData(event.currentTarget)); }, "submit");
      // The GM's controls.
      on("[data-rwf-start]", () => this.#start());
      on("[data-rwf-add]", () => this.#add());
      on("[data-rwf-end]", () => this.#end());
      on("[data-rwf-cap]", event => this.#edit(p => ({...p, cap: Math.max(0, Number(event.currentTarget.value) || 0)})), "change");
      on("[data-rwf-role]", event => { const uuid = event.currentTarget.dataset.rwfRole, role = event.currentTarget.value; if (ROLES.includes(role)) this.#edit(p => ({...p, participants: p.participants.map(x => x.uuid === uuid ? {...x, role} : x)})); }, "change");
      on("[data-rwf-means]", event => { const uuid = event.currentTarget.dataset.rwfMeans, means = event.currentTarget.value || FOOT; this.#edit(p => ({...p, participants: p.participants.map(x => x.uuid === uuid ? {...x, means} : x)})); }, "change");
      on("[data-rwf-reference]", event => { const uuid = event.currentTarget.dataset.rwfReference; this.#edit(p => ({...p, referenceUuid: uuid})); });
      on("[data-rwf-remove]", event => { const uuid = event.currentTarget.dataset.rwfRemove; this.#edit(p => ({...p, participants: p.participants.filter(x => x.uuid !== uuid)})); });
      root.querySelector("[data-rwf-autofocus]")?.focus();
    }

    async #edit(change) {
      if (!globalThis.game.user.isGM) return;
      try { await savePursuit(change(storedPursuit())); } catch (error) { notifyError(error); }
    }
    /** A participant's gauge starts again from 0 (the RWF Action "Nouvelle poursuite"); no chat card. */
    async #reset(uuids) {
      const view = this.#view, found = hudRuleset(rta()?.configurator);
      for (const uuid of uuids) {
        try { await rta().runtime.executeAction(found.versionId ?? view?.versionId, RWF.reset, actionContext({actorUuid: uuid, isGM: true, userId: globalThis.game.user.id})); }
        catch (error) { console.warn("RWF tools | Gauge not reset", uuid, error); }
      }
    }
    async #start() {
      const candidates = sceneCandidates();
      if (!candidates.length) { this.#message = "RWFTOOLS.Pursuit.SelectFirst"; return this.render(); }
      this.#message = null;
      const pursuit = {...addParticipants(emptyPursuit(), candidates), active: true};
      await this.#reset(pursuit.participants.map(p => p.uuid));
      await savePursuit(pursuit);
      await globalThis.ChatMessage.create({content: `<p><strong>${t("RWFTOOLS.Pursuit.Title")}</strong> · ${t("RWFTOOLS.Pursuit.Started")}</p>`});
    }
    async #add() {
      const current = storedPursuit(), candidates = sceneCandidates().filter(c => !current.participants.some(p => p.uuid === c.uuid));
      if (!candidates.length) { this.#message = "RWFTOOLS.Pursuit.SelectFirst"; return this.render(); }
      this.#message = null;
      await this.#reset(candidates.map(c => c.uuid));
      await savePursuit({...addParticipants(current, candidates), active: true});
    }
    async #end() {
      await savePursuit(emptyPursuit());
      this.#pending = null;
      await globalThis.ChatMessage.create({content: `<p><strong>${t("RWFTOOLS.Pursuit.Title")}</strong> · ${t("RWFTOOLS.Pursuit.Ended")}</p>`});
    }

    #move(uuid, move) {
      const view = this.#view, row = view?.rows?.find(r => r.uuid === uuid), m = row?.moves.find(x => x.move === move);
      if (!m?.allowed || this.#busy) return;
      this.#message = null; this.#error = null;
      const request = {uuid, name: row.name, actionId: m.actionId, contentKey: m.contentKey, input: move === "stop" ? {} : {vitesse: row.advantage}};
      if (move !== "stop" && diceMode() === "table") { this.#pending = {...request, label: m.label, subject: row.name, damage: false}; return this.render(); }
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
    async #run({uuid, name, actionId, contentKey, input}) {
      const view = this.#view;
      this.#busy = true;
      try {
        await runAction({versionId: view.versionId, ruleset: view.ruleset, actorUuid: uuid, actionId, contentKey, input});
        // The gauge after the move: a bound reached ends the pursuit for that participant, which the chat says once.
        const after = await pursuitView(rta().runtime, {versionId: view.versionId, ruleset: view.ruleset, pursuit: {...view.pursuit, participants: view.pursuit.participants.filter(p => p.uuid === uuid)}, canAct: () => false});
        const status = after.rows[0]?.status;
        if (status?.done) await globalThis.ChatMessage.create({content: `<p><strong>${t("RWFTOOLS.Pursuit.Title")}</strong> · ${name} : ${t(status.key)}</p>`});
      } catch (error) { this.#message = error?.message ?? String(error); notifyError(error); }
      finally { this.#busy = false; }
      this.render();
    }
  };
}

let PursuitHud = null;
export function openPursuitHud() {
  PursuitHud ??= createPursuitHud();
  const open = globalThis.foundry.applications.instances.get(PURSUIT_HUD_ID);
  return (open ?? new PursuitHud()).render({force: true});
}
