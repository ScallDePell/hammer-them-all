/* The combat HUD in Foundry: one window per client that follows the combatant this user plays (the GM: the one
   acting), with its resources, its target, an action card per weapon, power and physical action, and the button that
   ends its pass or its round. Every Action is the RWF Ruleset's, run through Rule Them'All. */
import {SOCKET} from "./test-request-model.mjs";
import {hudRuleset, followedCombatant, yourTurn, targetingUser, opposingSide, hits, edgeDistance, combatantView, endTurnLabel, readWhole} from "./hud-model.mjs";
import {renderCombatHTML} from "./hud-markup.mjs";
import {t, rta, notifyError, ApplicationV2, diceMode, setDiceMode, contentNamer, runAction} from "./hud-common.mjs";

export const COMBAT_HUD_ID = "rwf-combat-hud";
const PASS_FLAG = ["rule-them-all", "initiativePass"];
const MAX_COVER = 10;

const tokenBox = doc => doc ? {x: Number(doc.x ?? 0), y: Number(doc.y ?? 0), width: Number(doc.width ?? 1), height: Number(doc.height ?? 1)} : null;
const gridOf = () => { const c = globalThis.canvas; const size = c?.grid?.size ?? c?.scene?.grid?.size; const distance = c?.grid?.distance ?? c?.scene?.grid?.distance ?? 1; return size ? {size, distance} : null; };
const onScene = combatant => Boolean(combatant?.token) && (combatant.sceneId ?? combatant.token.parent?.id) === globalThis.canvas?.scene?.id;
const distanceBetween = (a, b) => { const grid = gridOf(); return grid && a && b ? edgeDistance(tokenBox(a), tokenBox(b), grid) : null; };

export function createCombatHud() {
  return class CombatHud extends ApplicationV2() {
    static DEFAULT_OPTIONS = {id: COMBAT_HUD_ID, classes: ["rwf-tools-app", "rwf-hud-app"], position: {width: 400, height: "auto"}, window: {title: "RWFTOOLS.Combat.Title", icon: "fa-solid fa-khanda", resizable: true}};
    #view = null;
    #picking = false;
    #pending = null;
    #error = null;
    #message = null;
    #cover = new Map();
    #picked = new Map();
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
      const game = globalThis.game, combat = game.combat;
      if (!combat?.started) return {reason: "RWFTOOLS.Combat.NoCombat"};
      const {versionId, ruleset} = found, runtime = rta().runtime, isGM = Boolean(game.user.isGM);
      const turns = [...(combat.turns ?? [])];
      const rows = turns.map(c => ({id: c.id, actorUuid: c.actor?.uuid ?? null, owned: Boolean(c.isOwner), defeated: Boolean(c.isDefeated), combatant: c}));
      const followed = followedCombatant({combatants: rows.filter(r => r.actorUuid), activeId: combat.combatant?.id ?? null, isGM, characterUuid: game.user.character?.uuid ?? null});
      if (!followed) return {reason: "RWFTOOLS.Combat.NotInCombat"};
      const state = await runtime.getContainerState(followed.actorUuid);
      if (state?.rulesetVersionId !== versionId) return {reason: "RWFTOOLS.Combat.NotRwfActor"};
      const me = followed.combatant, playerOwned = Boolean(me.actor?.hasPlayerOwner);
      // The GM following a player character reads its player's targets (Foundry shares them), unless the GM picked one here.
      const aimerId = targetingUser({viewerId: game.user.id, isGM, playerOwned, actorUuid: followed.actorUuid,
        users: [...(game.users ?? [])].map(u => ({id: u.id, isGM: u.isGM, active: u.active, characterUuid: u.character?.uuid ?? null, owner: Boolean(me.actor?.testUserPermission?.(u, "OWNER"))}))});
      const aimer = game.users.get(aimerId) ?? game.user, aimed = [...(aimer.targets ?? [])].map(token => token.id).sort().join(",");
      const picked = this.#picked.get(followed.id);
      if (picked && picked.aimed !== aimed) this.#picked.delete(followed.id);
      const pick = this.#picked.get(followed.id);
      const targetToken = pick ? (pick.tokenId ? globalThis.canvas?.tokens?.get(pick.tokenId) ?? null : null)
        : [...(aimer.targets ?? [])].find(token => token.actor?.uuid && token.actor.uuid !== followed.actorUuid) ?? null;
      const target = targetToken ? {uuid: targetToken.actor.uuid, name: targetToken.name ?? targetToken.document?.name ?? "", tokenId: targetToken.id, distance: onScene(me) ? distanceBetween(me.token, targetToken.document) : null} : null;
      const cover = target ? this.#cover.get(target.uuid) ?? 0 : 0;
      const combatant = await combatantView(runtime, {versionId, ruleset, actorUuid: followed.actorUuid, target, cover, isGM, userId: game.user.id, contentName: contentNamer(ruleset, followed.actorUuid)});
      const pass = Number(combat.getFlag?.(...PASS_FLAG) ?? 1) || 1, passes = Math.max(pass, combatant.attacks.best);
      // "À vous de jouer" only for whoever plays the combatant acting: its owner, or the GM for a combatant no player owns.
      const active = combat.combatant ?? null, acting = active?.id === followed.id;
      const myTurn = Boolean(active) && yourTurn({isGM, owned: Boolean(active.isOwner), playerOwned: Boolean(active.actor?.hasPlayerOwner ?? active.hasPlayer)});
      const view = {versionId, ruleset, round: combat.round, pass, passes, turnName: combat.combatant?.name ?? null, myTurn, name: me.name, actorUuid: followed.actorUuid, combatantId: followed.id,
        combatant, target, cover, isGM, canEndTurn: acting && (isGM || followed.owned), endLabel: endTurnLabel({pass, passes: combatant.attacks.best})};
      view.aimed = aimed; view.aimerId = aimer.id;
      // The other side only: a player character aims at the others, anyone else at the player characters.
      if (this.#picking) view.targets = opposingSide(rows.filter(r => r.id !== followed.id && r.actorUuid && !r.defeated && onScene(r.combatant)).map(r => ({...r, playerOwned: Boolean(r.combatant.actor?.hasPlayerOwner)})), playerOwned)
        .map(r => ({tokenId: r.combatant.token.id, name: r.combatant.name, img: r.combatant.img ?? null, current: r.combatant.token.id === target?.tokenId, distance: onScene(me) ? distanceBetween(me.token, r.combatant.token) : null}))
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

    #target(tokenId) {
      const game = globalThis.game, tokens = globalThis.canvas?.tokens, view = this.#view;
      // Picked for another user's character (the GM for a player character): kept here until that player aims again.
      if (view?.aimerId && view.aimerId !== game.user.id) {
        this.#picked.set(view.combatantId, {tokenId: tokenId ?? null, aimed: view.aimed});
      } else if (tokenId) tokens?.get(tokenId)?.setTarget(true, {releaseOthers: true, groupSelection: false});
      else for (const token of [...(game.user.targets ?? [])]) token.setTarget(false, {releaseOthers: false, groupSelection: false});
      this.#picking = false;
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
      try { await runAction({versionId: view.versionId, ruleset: view.ruleset, actorUuid: view.actorUuid, actionId, targetUuid: view.target?.uuid ?? null, contentKey, input}); }
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

let CombatHud = null;
export function openCombatHud() {
  CombatHud ??= createCombatHud();
  const open = globalThis.foundry.applications.instances.get(COMBAT_HUD_ID);
  return (open ?? new CombatHud()).render({force: true});
}
