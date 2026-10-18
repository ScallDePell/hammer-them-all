/* The GM's test request in play. The GM picks connected players' characters, a skill and a DD; each player gets a window
   they cannot close until they answer, with the Foundry dice or the d20 rolled on the table. The answer comes back to
   the GM's client, which runs the RWF Ruleset's "Test demandé par le MJ" (the only test that gives practice) and posts
   its chat card. */
import {SOCKET, MODULE_ID, REQUESTED_TEST_ACTION, requestRuleset, skillOptions, ddOptions, defaultDD, requestCandidates, isRwfPlayerCharacter,
  readD20, canSend, requestMessage, answerMessage, cancelMessage, acceptAnswer, requestedTestContext} from "./test-request-model.mjs";
import {renderRequestHTML, renderPromptHTML} from "./test-request-markup.mjs";

const t = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const rta = () => globalThis.game?.ruleThemAll;
const notifyError = error => { console.error("RWF tools |", error); globalThis.ui?.notifications?.error?.(error?.message ?? String(error)); };
const REQUEST_APP_ID = "rwf-test-request";

/** Requests this GM sent and not yet answered or cancelled: requestId -> {request, status, summary}. */
const pending = new Map();
/** Prompt windows open on this player's client: requestId -> window. */
const prompts = new Map();

const emit = message => globalThis.game.socket.emit(SOCKET, message);
const refreshRequest = () => globalThis.foundry?.applications?.instances?.get?.(REQUEST_APP_ID)?.render();

export function createRequestWindow({ApplicationV2}) {
  return class TestRequestWindow extends ApplicationV2 {
    static DEFAULT_OPTIONS = {id: REQUEST_APP_ID, classes: ["rwf-tools-app"], position: {width: 420, height: "auto"}, window: {title: "RWFTOOLS.Request.Title", icon: "fa-solid fa-dice-d20", resizable: true}};
    #selected = new Set();
    #skillId = null;
    #ddId = null;
    #view = null;

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      await rta()?.configuratorReady;
      const found = requestRuleset(rta()?.configurator);
      if (found.reason) { this.#view = {reason: found.reason}; return context; }
      const {versionId, ruleset} = found, runtime = rta().runtime, game = globalThis.game;
      const skills = skillOptions(ruleset, t), dds = ddOptions(ruleset, t);
      const rows = await requestCandidates({users: [...game.users], actors: [...game.actors], ownerLevel: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
        isPlayerCharacter: async actor => { try { return isRwfPlayerCharacter(await runtime.getContainerState({uuid: actor.uuid}), versionId); } catch { return false; } }});
      // A character whose player left is no longer selected.
      for (const uuid of [...this.#selected]) if (!rows.some(row => row.actorUuid === uuid)) this.#selected.delete(uuid);
      if (!dds.some(d => d.id === this.#ddId)) this.#ddId = defaultDD(dds)?.id ?? null;
      if (!skills.some(s => s.id === this.#skillId)) this.#skillId = null;
      this.#view = {versionId, rows, skills, dds};
      return context;
    }
    async _renderHTML() {
      const view = this.#view ?? {reason: "RWFTOOLS.Error.NoRuleset"};
      if (view.reason) return renderRequestHTML({reason: view.reason}, t);
      const choice = {selected: [...this.#selected], skillId: this.#skillId, ddId: this.#ddId};
      return renderRequestHTML({...view, selected: this.#selected, skillId: this.#skillId, ddId: this.#ddId, pending, canSend: canSend(choice, view)}, t);
    }
    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      const sync = () => { const send = root.querySelector("[data-rwf-send]"); if (send) send.disabled = !canSend({selected: [...this.#selected], skillId: this.#skillId, ddId: this.#ddId}, this.#view); };
      for (const box of root.querySelectorAll("[data-rwf-pick]")) box.addEventListener("change", event => {
        const uuid = event.currentTarget.dataset.rwfPick;
        if (event.currentTarget.checked) this.#selected.add(uuid); else this.#selected.delete(uuid);
        sync();
      });
      root.querySelector("[data-rwf-skill]")?.addEventListener("change", event => { this.#skillId = event.currentTarget.value || null; sync(); });
      root.querySelector("[data-rwf-dd]")?.addEventListener("change", event => { this.#ddId = event.currentTarget.value || null; sync(); });
      root.querySelector("[data-rwf-send]")?.addEventListener("click", () => this.#send());
      for (const button of root.querySelectorAll("[data-rwf-cancel]")) button.addEventListener("click", event => cancelRequest(event.currentTarget.dataset.rwfCancel));
      root.querySelector("[data-rwf-clear]")?.addEventListener("click", () => clearRequests());
    }
    #send() {
      const view = this.#view, skill = view.skills.find(s => s.id === this.#skillId), dd = view.dds.find(d => d.id === this.#ddId);
      if (!canSend({selected: [...this.#selected], skillId: this.#skillId, ddId: this.#ddId}, view)) return;
      for (const row of view.rows.filter(row => this.#selected.has(row.actorUuid))) {
        const request = {...requestMessage({requestId: globalThis.foundry.utils.randomID(), gmId: globalThis.game.user.id, row, skill, dd}), versionId: view.versionId};
        pending.set(request.requestId, {request, status: "waiting", summary: ""});
        emit(request);
      }
      this.#selected.clear();
      this.render();
    }
  };
}

function cancelRequest(requestId) {
  const entry = pending.get(requestId);
  if (!entry || entry.status !== "waiting") return;
  pending.delete(requestId);
  emit(cancelMessage(entry.request));
  refreshRequest();
}

/** Empty the list: finished tests go, tests still waiting are withdrawn from their player's screen. */
function clearRequests() {
  for (const {request, status} of pending.values()) if (status === "waiting") emit(cancelMessage(request));
  for (const [requestId, {status}] of pending) if (status !== "running") pending.delete(requestId);
  refreshRequest();
}

/** GM client: run the requested test with the d20 the player announced, then post its chat card. */
async function resolveAnswer(accepted) {
  const {request, d20, manual} = accepted, entry = pending.get(request.requestId);
  entry.status = "running";
  try {
    const result = await rta().runtime.executeAction(request.versionId, REQUESTED_TEST_ACTION, requestedTestContext(request, d20));
    if (!result?.allowed) throw new Error(result?.reason ?? t("RWFTOOLS.Error.NotAllowed"));
    const actor = globalThis.fromUuidSync?.(request.actorUuid);
    await rta().chat.postActionCard(result, request.versionId, {speaker: globalThis.ChatMessage.getSpeaker({actor})});
    const outcome = result.testResult?.outcome, label = outcome ? t(outcome.labelKey || outcome.nameKey) : "";
    entry.status = "done";
    entry.summary = `${d20}${manual ? ` (${t("RWFTOOLS.Request.Manual")})` : ""} → ${result.testResult?.total ?? "?"}${label ? ` · ${label}` : ""}`;
  } catch (error) {
    entry.status = "failed";
    entry.summary = error?.message ?? String(error);
    notifyError(error);
  }
  refreshRequest();
}

export function createPromptWindow({ApplicationV2}) {
  return class TestPromptWindow extends ApplicationV2 {
    static DEFAULT_OPTIONS = {classes: ["rwf-tools-app", "rwf-test-prompt"], position: {width: 340, height: "auto"}, window: {title: "RWFTOOLS.Prompt.Title", icon: "fa-solid fa-dice-d20", minimizable: false, resizable: false}};
    #request;
    #sent = null;
    #error = null;
    #cancelled = false;
    constructor(request, options = {}) { super({...options, id: `rwf-test-prompt-${request.requestId}`}); this.#request = request; }

    async _renderHTML() { return renderPromptHTML({request: this.#request, sent: this.#sent, error: this.#error}, t); }
    _replaceHTML(result, content) { content.innerHTML = result; }
    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      root.querySelector("[data-rwf-roll]")?.addEventListener("click", event => { event.currentTarget.disabled = true; this.#rollFoundryDice(); });
      const input = root.querySelector("[data-rwf-d20]");
      const submit = () => this.#answer(input?.value, true);
      root.querySelector("[data-rwf-submit]")?.addEventListener("click", submit);
      input?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); submit(); } });
    }
    /** The window stays until the test is answered, or the GM withdraws it. */
    async close(options = {}) {
      if (this.#sent === null && !this.#cancelled) return this;
      prompts.delete(this.#request.requestId);
      return super.close(options);
    }
    withdraw() { this.#cancelled = true; return this.close(); }

    async #rollFoundryDice() {
      try {
        const roll = await new globalThis.Roll("1d20").evaluate();
        await globalThis.game.dice3d?.showForRoll?.(roll, globalThis.game.user, true);
        await this.#answer(roll.total, false);
      } catch (error) { notifyError(error); this.render(); }
    }
    async #answer(value, manual) {
      const d20 = readD20(value);
      if (d20 === null) { this.#error = "RWFTOOLS.Prompt.Invalid"; return this.render(); }
      emit(answerMessage({request: this.#request, d20, manual}));
      this.#sent = d20;
      await this.render();
      setTimeout(() => this.close(), 1500);
    }
  };
}

let RequestWindow = null, PromptWindow = null;
const ApplicationV2 = () => globalThis.foundry.applications.api.ApplicationV2;

/** The GM's macro opens this window. */
export function openTestRequest() {
  if (!globalThis.game.user?.isGM) return globalThis.ui?.notifications?.warn?.(t("RWFTOOLS.Error.GMOnly"));
  RequestWindow ??= createRequestWindow({ApplicationV2: ApplicationV2()});
  const open = globalThis.foundry.applications.instances.get(REQUEST_APP_ID);
  return (open ?? new RequestWindow()).render({force: true});
}

function openPrompt(request) {
  if (prompts.has(request.requestId)) return;
  PromptWindow ??= createPromptWindow({ApplicationV2: ApplicationV2()});
  const window = new PromptWindow(request);
  prompts.set(request.requestId, window);
  window.render({force: true});
}

/** Every client listens; each message names the user it is for. */
export function installTestRequests({hooks = globalThis.Hooks} = {}) {
  const game = globalThis.game;
  game.socket.on(SOCKET, (message, senderId) => {
    if (message?.type === "request" && message.userId === game.user.id) openPrompt(message);
    else if (message?.type === "cancel" && message.userId === game.user.id) prompts.get(message.requestId)?.withdraw();
    else if (message?.type === "answer" && game.user.isGM) {
      const accepted = acceptAnswer(message, pending, game.user.id, typeof senderId === "string" ? senderId : null);
      if (accepted && pending.get(accepted.request.requestId)?.status === "waiting") resolveAnswer(accepted);
    }
  });
  // The list follows the players who connect, leave, or get a character; a player who reloads is asked again.
  hooks.on("userConnected", (user, connected) => {
    if (connected && game.user.isGM) for (const {request, status} of pending.values()) if (status === "waiting" && request.userId === user.id) emit(request);
    refreshRequest();
  });
  for (const hook of ["updateUser", "createActor", "updateActor", "deleteActor"]) hooks.on(hook, refreshRequest);
  hooks.on("updateSetting", setting => { if (String(setting?.key ?? "").startsWith("rule-them-all.")) refreshRequest(); });
}

/** The module's macros, made once by the active GM: "Demander un test" for the GM only, the two HUDs for everyone
 * (Observer, so players can run them). Each client puts the macros it can run on its own hotbar, once. */
const MACROS = [
  {flag: "testRequest", name: "RWFTOOLS.Macro.Name", img: "icons/svg/d20-highlight.svg", api: "openTestRequest", ownership: {default: 0}},
  {flag: "combatHud", name: "RWFTOOLS.Macro.Combat", img: "icons/svg/sword.svg", api: "openCombatHud", ownership: {default: 2}},
  {flag: "pursuitHud", name: "RWFTOOLS.Macro.Pursuit", img: "icons/svg/wing.svg", api: "openPursuitHud", ownership: {default: 2}}
];
export async function ensureMacros() {
  const game = globalThis.game, find = flag => game.macros.find(m => m.getFlag?.(MODULE_ID, flag));
  if (game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user)) {
    for (const spec of MACROS) if (!find(spec.flag)) await globalThis.Macro.create({name: t(spec.name), type: "script", img: spec.img, ownership: spec.ownership,
      command: `game.modules.get("${MODULE_ID}")?.api?.${spec.api}();`, flags: {[MODULE_ID]: {[spec.flag]: true}}});
  }
  // A macro the user removed from the hotbar stays removed: each one is placed once per user.
  const placed = game.user.getFlag?.(MODULE_ID, "hotbarPlaced") ?? {};
  let changed = false;
  for (const spec of MACROS) {
    const macro = find(spec.flag);
    if (!macro || placed[spec.flag] || !(macro.canExecute ?? macro.testUserPermission?.(game.user, "LIMITED"))) continue;
    if (!Object.values(game.user.hotbar ?? {}).includes(macro.id)) await game.user.assignHotbarMacro(macro, null);
    placed[spec.flag] = true; changed = true;
  }
  if (changed) await game.user.setFlag(MODULE_ID, "hotbarPlaced", placed);
}
