/* The combat HUD in Foundry: one window per client that follows the combatant this user plays (the GM: the one
   acting), with its resources, its target, an action card per weapon, power and physical action, and the button that
   ends its pass or its round. Every Action is the RWF Ruleset's, run through Rule Them'All. */
import {MODULE_ID, SOCKET} from "./test-request-model.mjs";
import {hudRuleset, followedCombatant, waitForTurn, yourTurn, keptTarget, staleTargets, aimingCombatant, opposingSide, hits, edgeDistance, combatantView, endTurnLabel, readWhole, isOut, knockedOut} from "./hud-model.mjs";
import {renderCombatHTML} from "./hud-markup.mjs";
import {t, rta, notifyError, ApplicationV2, diceMode, setDiceMode, contentNamer, runAction} from "./hud-common.mjs";

export const COMBAT_HUD_ID = "rwf-combat-hud";
const PASS_FLAG = ["rule-them-all", "initiativePass"];
const TARGETS = "targets";
const MAX_COVER = 10;

const tokenBox = doc => doc ? {x: Number(doc.x ?? 0), y: Number(doc.y ?? 0), width: Number(doc.width ?? 1), height: Number(doc.height ?? 1)} : null;
const gridOf = () => { const c = globalThis.canvas; const size = c?.grid?.size ?? c?.scene?.grid?.size; const distance = c?.grid?.distance ?? c?.scene?.grid?.distance ?? 1; return size ? {size, distance} : null; };
const onScene = combatant => Boolean(combatant?.token) && (combatant.sceneId ?? combatant.token.parent?.id) === globalThis.canvas?.scene?.id;
const distanceBetween = (a, b) => { const grid = gridOf(); return grid && a && b ? edgeDistance(tokenBox(a), tokenBox(b), grid) : null; };

export function createCombatHud() {
  return class CombatHud extends ApplicationV2() {
    static DEFAULT_OPTIONS = {id: COMBAT_HUD_ID, classes: ["hammer-them-all-app", "rwf-hud-app"], position: {width: 400, height: "auto"}, window: {title: "RWFTOOLS.Combat.Title", icon: "fa-solid fa-khanda", resizable: true}};
    #view = null;
    #picking = false;
    #pending = null;
    #error = null;
    #message = null;
    #cover = new Map();
    #busy = false;

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      try { this.#view = await this.#read(); } catch (error) { console.error("Hammer Them'All |", error); this.#view = {reason: "RWFTOOLS.Error.HudFailed"}; }
      return context;
    }
    async #read() {
      await rta()?.configuratorReady;
      const found = hudRuleset(rta()?.configurator);
      if (found.reason) return {reason: found.reason};
      const game = globalThis.game, combat = game.combat;
      if (!combat?.started) return {reason: "RWFTOOLS.Combat.NoCombat"};
      if (combat.getFlag?.(MODULE_ID, "pursuit")) return {reason: "RWFTOOLS.Combat.InPursuit"};
      const {versionId, ruleset} = found, runtime = rta().runtime, isGM = Boolean(game.user.isGM);
      const turns = [...(combat.turns ?? [])];
      const rows = turns.map(c => ({id: c.id, actorUuid: c.actor?.uuid ?? null, owned: Boolean(c.isOwner), defeated: Boolean(c.isDefeated), combatant: c}));
      const followed = followedCombatant({combatants: rows.filter(r => r.actorUuid), activeId: combat.combatant?.id ?? null, isGM, characterUuid: game.user.character?.uuid ?? null});
      if (!followed) return {reason: "RWFTOOLS.Combat.NotInCombat"};
      const state = await runtime.getContainerState(followed.actorUuid);
      if (state?.rulesetVersionId !== versionId) return {reason: "RWFTOOLS.Combat.NotRwfActor"};
      const me = followed.combatant, playerOwned = Boolean(me.actor?.hasPlayerOwner);
      // The target this combatant keeps in the combat, seen the same by every client (the GM sees the player's).
      const targetId = keptTarget({targets: combat.getFlag?.(MODULE_ID, TARGETS), combatantId: followed.id, combatants: rows});
      const aimed = targetId ? rows.find(r => r.id === targetId).combatant : null;
      const target = aimed?.actor?.uuid ? {uuid: aimed.actor.uuid, name: aimed.name ?? "", combatantId: aimed.id, tokenId: aimed.token?.id ?? null,
        distance: onScene(me) && onScene(aimed) ? distanceBetween(me.token, aimed.token) : null} : null;
      const cover = target ? this.#cover.get(target.uuid) ?? 0 : 0;
      const read = await combatantView(runtime, {versionId, ruleset, actorUuid: followed.actorUuid, target, cover, isGM, userId: game.user.id, contentName: contentNamer(ruleset, followed.actorUuid)});
      // Only the combatant acting can act: the others see their cards, every button off. Out of the combat (defeated,
      // or Vitality 0 before the tracker marks it), no one can act, even on its turn.
      const active = combat.combatant ?? null, acting = active?.id === followed.id;
      const out = isOut({defeated: me.isDefeated, vitality: read.pools.vitalite?.value});
      const combatant = out ? knockedOut(read) : acting ? read : waitForTurn(read);
      const pass = Number(combat.getFlag?.(...PASS_FLAG) ?? 1) || 1, passes = Math.max(pass, combatant.attacks.best);
      // "À vous de jouer" only for whoever plays the combatant acting: its owner, or the GM for a combatant no player owns.
      const myTurn = Boolean(active) && yourTurn({isGM, owned: Boolean(active.isOwner), playerOwned: Boolean(active.actor?.hasPlayerOwner ?? active.hasPlayer)});
      const view = {versionId, ruleset, round: combat.round, pass, passes, turnName: combat.combatant?.name ?? null, myTurn, name: me.name, actorUuid: followed.actorUuid, combatantId: followed.id,
        combatant, target, cover, isGM, canEndTurn: acting && (isGM || followed.owned), endLabel: endTurnLabel({pass, passes: combatant.attacks.best})};
      // The other side only: a player character aims at the others, anyone else at the player characters.
      if (this.#picking) view.targets = opposingSide(rows.filter(r => r.id !== followed.id && r.actorUuid && !r.defeated && onScene(r.combatant)).map(r => ({...r, playerOwned: Boolean(r.combatant.actor?.hasPlayerOwner)})), playerOwned)
        .map(r => ({id: r.id, name: r.combatant.name, img: r.combatant.img ?? null, current: r.id === target?.combatantId, distance: onScene(me) ? distanceBetween(me.token, r.combatant.token) : null}))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.name.localeCompare(b.name));
      return view;
    }
    async _renderHTML() {
      const view = this.#view ?? {reason: "RWFTOOLS.Combat.NoCombat"};
      return renderCombatHTML({...view, mode: diceMode(), pending: this.#pending, error: this.#error, message: this.#message}, t);
    }
    _replaceHTML(result, content) { content.innerHTML = result; }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element, on = (selector, handler, type = "click") => { for (const el of root.querySelectorAll(selector)) el.addEventListener(type, handler); };
      on("[data-rwf-mode]", async event => { await setDiceMode(event.currentTarget.dataset.rwfMode); this.#pending = null; this.render(); });
      on("[data-rwf-pick]", () => { this.#picking = true; this.render(); });
      on("[data-rwf-pick-done]", () => { this.#picking = false; this.render(); });
      on("[data-rwf-target]", event => this.#target(event.currentTarget.dataset.rwfTarget));
      on("[data-rwf-untarget]", () => this.#target(null));
      on("[data-rwf-cover]", event => {
        const uuid = this.#view?.target?.uuid;
        if (!uuid) return;
        this.#cover.set(uuid, Math.min(MAX_COVER, Math.max(0, (this.#cover.get(uuid) ?? 0) + Number(event.currentTarget.dataset.rwfCover))));
        this.render();
      });
      on("[data-rwf-action]", event => this.#act(event.currentTarget.dataset.rwfAction, event.currentTarget.dataset.rwfContent));
      on("[data-rwf-table-cancel]", () => { this.#pending = null; this.#error = null; this.render(); });
      on("[data-rwf-table]", event => { event.preventDefault(); this.#submitTable(new FormData(event.currentTarget)); }, "submit");
      on("[data-rwf-end-turn]", () => this.#endTurn());
      root.querySelector("[data-rwf-autofocus]")?.focus();
    }

    /** The target picked in the HUD (a combatant id, or null for none) is kept in the combat for the combatant followed. */
    async #target(targetId) {
      const view = this.#view;
      this.#picking = false;
      if (view?.combatantId) await setCombatTarget(view.combatantId, targetId || null);
      this.render();
    }

    /** The button's Action: in TABLE mode a Test waits for the d20 read on the table, anything else runs now. */
    #act(actionId, cardKey) {
      const view = this.#view, card = view?.combatant?.cards.find(c => c.key === cardKey), button = card?.buttons.find(b => b.actionId === actionId);
      if (!button?.allowed || this.#busy) return;
      this.#message = null; this.#error = null;
      if (button.needsTarget && !view.target) { this.#message = "RWFTOOLS.Combat.NeedTarget"; return this.render(); }
      const contentKey = card.kind === "weapon" || card.kind === "power" ? card.key : null;
      const request = {actionId, contentKey, input: view.target ? {couverture: view.cover} : {}};
      if (diceMode() === "table" && button.d20) {
        const dice = card.details.find(d => d.label === "RWFTOOLS.Combat.Damage" || d.label === "RWFTOOLS.Combat.Dice")?.value ?? null;
        this.#pending = {...request, stage: "d20", label: button.label, subject: card.name, required: button.required ?? null, damage: button.damage, dice, heal: actionId === "pouvoir-soins"};
        return this.render();
      }
      return this.#run(request);
    }
    /** TABLE mode, in two steps: the d20 read on the table; when it hits and the Action deals damage (or heals), the
     * total of its dice read on the table too. A miss runs at once. */
    #submitTable(form) {
      const pending = this.#pending;
      if (!pending) return;
      if (pending.stage === "damage") {
        const degats = readWhole(form.get("degats"), 0, 9999);
        if (degats === null) { this.#error = "RWFTOOLS.Hud.DamageInvalid"; return this.render(); }
        this.#pending = null; this.#error = null;
        return this.#run({...pending, input: {...pending.input, de: pending.de, degats}});
      }
      const de = readWhole(form.get("de"));
      if (de === null) { this.#error = "RWFTOOLS.Prompt.Invalid"; return this.render(); }
      this.#error = null;
      if (pending.damage && hits(de, pending.required)) { this.#pending = {...pending, stage: "damage", de}; return this.render(); }
      this.#pending = null;
      return this.#run({...pending, input: {...pending.input, de}});
    }
    async #run({actionId, contentKey, input}) {
      const view = this.#view;
      this.#busy = true;
      const combatant = view.combatantId ? globalThis.game.combat?.combatants?.get?.(view.combatantId) ?? null : null;
      try { await runAction({versionId: view.versionId, ruleset: view.ruleset, actorUuid: view.actorUuid, actionId, targetUuid: view.target?.uuid ?? null, contentKey, input, combatant}); }
      catch (error) { this.#message = error?.message ?? String(error); notifyError(error); }
      finally { this.#busy = false; }
      this.render();
    }

    /** The GM moves the combat on; a player asks the GM's client (only the GM writes the next pass). */
    async #endTurn() {
      const view = this.#view, game = globalThis.game, combat = game.combat;
      if (!view?.canEndTurn || !combat) return;
      try {
        if (game.user.isGM) await combat.nextTurn();
        else game.socket.emit(SOCKET, {type: "hud.endTurn", combatId: combat.id, combatantId: view.combatantId, userId: game.user.id});
      } catch (error) { notifyError(error); }
    }
  };
}

/** Active GM client: a player ends the turn of the combatant they own, when it is that combatant's turn. */
export async function serveEndTurn(message, senderId) {
  const game = globalThis.game;
  if (message?.type !== "hud.endTurn" || !game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user)) return;
  const combat = game.combats?.get?.(message.combatId), user = game.users.get(senderId ?? message.userId);
  if (!combat || !user || combat.combatant?.id !== message.combatantId) return;
  if (!combat.combatant.testUserPermission?.(user, "OWNER")) return;
  try { await combat.nextTurn(); } catch (error) { notifyError(error); }
}

/** Keep a combatant's target in the current combat: the GM writes it, a player asks the active GM's client. */
export async function setCombatTarget(combatantId, targetId) {
  const game = globalThis.game, combat = game.combat;
  if (!combat || !combatantId) return;
  if (!game.user.isGM) return game.socket.emit(SOCKET, {type: "hud.target", combatId: combat.id, combatantId, targetId, userId: game.user.id});
  try { await writeTarget(combat, combatantId, targetId); } catch (error) { notifyError(error); }
}
const writeTarget = (combat, combatantId, targetId) => targetId
  ? combat.update({[`flags.${MODULE_ID}.${TARGETS}.${combatantId}`]: targetId})
  : combat.update({[`flags.${MODULE_ID}.${TARGETS}.-=${combatantId}`]: null});

/** Active GM client: a player sets the target of a combatant they own, among the combatants of that combat. */
export async function serveTarget(message, senderId) {
  const game = globalThis.game;
  if (message?.type !== "hud.target" || !game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user)) return;
  const combat = game.combats?.get?.(message.combatId), user = game.users.get(senderId ?? message.userId);
  const combatant = combat?.combatants?.get?.(message.combatantId);
  if (!combatant || !user || !combatant.testUserPermission?.(user, "OWNER")) return;
  if (message.targetId && !combat.combatants.get(message.targetId)) return;
  try { await writeTarget(combat, combatant.id, message.targetId ?? null); } catch (error) { notifyError(error); }
}

/** Targets follow the combat: none when it starts; a combatant targeted on the canvas becomes the target of the
 * combatant this user aims for; the GM drops targets of or at combatants gone or out of combat. */
export function installCombatTargets(hooks = globalThis.Hooks) {
  const activeGM = () => { const game = globalThis.game; return game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user); };
  hooks.on("combatStart", combat => { if (activeGM() && combat.getFlag?.(MODULE_ID, TARGETS)) combat.unsetFlag(MODULE_ID, TARGETS).catch(notifyError); });
  hooks.on("targetToken", (user, token, targeted) => {
    const game = globalThis.game, combat = game.combat;
    if (!targeted || user?.id !== game.user.id || !combat?.started) return;
    const aimed = [...combat.combatants].find(c => c.tokenId === (token.id ?? token.document?.id));
    if (!aimed) return;
    const rows = [...(combat.turns ?? [])].map(c => ({id: c.id, actorUuid: c.actor?.uuid ?? null, owned: Boolean(c.isOwner) && !game.user.isGM, playerOwned: Boolean(c.actor?.hasPlayerOwner), defeated: Boolean(c.isDefeated)}));
    const from = aimingCombatant({combatants: rows, activeId: combat.combatant?.id ?? null, isGM: game.user.isGM, characterUuid: game.user.character?.uuid ?? null});
    if (from && from.id !== aimed.id && combat.getFlag?.(MODULE_ID, TARGETS)?.[from.id] !== aimed.id) setCombatTarget(from.id, aimed.id);
  });
  const tidy = combat => {
    if (!combat?.started || !activeGM()) return;
    const stale = staleTargets({targets: combat.getFlag?.(MODULE_ID, TARGETS), combatants: [...combat.combatants].map(c => ({id: c.id, defeated: Boolean(c.isDefeated)}))});
    if (stale.length) combat.update(Object.fromEntries(stale.map(id => [`flags.${MODULE_ID}.${TARGETS}.-=${id}`, null]))).catch(notifyError);
  };
  for (const hook of ["updateCombatant", "deleteCombatant"]) hooks.on(hook, combatant => tidy(combatant.parent ?? combatant.combat));
}

let CombatHud = null;
export function openCombatHud() {
  CombatHud ??= createCombatHud();
  const open = globalThis.foundry.applications.instances.get(COMBAT_HUD_ID);
  return (open ?? new CombatHud()).render({force: true});
}
