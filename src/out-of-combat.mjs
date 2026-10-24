/* Out of the combat is out of the round, and out of sight. Rule Them'All rerolls the initiative of every combatant of the RWF Ruleset at
   each new round, the defeated ones too, and their turns kept coming. Here a defeated combatant rolls no initiative (it
   loses the one it had, so it goes to the end of the order) and the active GM passes its turn when it comes. The active
   GM also puts the defeated status on its token when Rule Them'All marked it in the tracker only, and ends the combat
   once a side has no one left standing. */
import {MODULE_ID} from "./test-request-model.mjs";

const hasInitiative = c => c?.initiative !== null && c?.initiative !== undefined && c?.initiative !== "" && Number.isFinite(Number(c.initiative));

/** Of the combatants asked to roll (ids), those who roll and those who lose their initiative instead (defeated).
 * combatants: [{id, defeated, initiative}]. */
export function initiativeRolls(combatants, ids) {
  const byId = new Map(combatants.map(c => [c.id, c])), roll = [], clear = [];
  for (const id of ids) {
    const c = byId.get(id);
    if (!c?.defeated) roll.push(id);
    else if (hasInitiative(c)) clear.push(id);
  }
  return {roll, clear};
}

/** Whether the turn running is to pass: its combatant is defeated and someone in the combat is not. */
export const passOutTurn = ({active = null, combatants = []}) => Boolean(active?.defeated) && combatants.some(c => !c.defeated);

const rows = combat => [...(combat?.combatants ?? [])].map(c => ({id: c.id, defeated: Boolean(c.isDefeated ?? c.defeated), initiative: c.initiative}));

/** Whether the combat is over: it has player characters and others, and every one of a side is defeated.
 * combatants: [{playerOwned, defeated}]. Returns the side left standing ("players" | "others"), else null. */
export function combatOver(combatants = []) {
  const players = combatants.filter(c => c.playerOwned), others = combatants.filter(c => !c.playerOwned);
  if (!players.length || !others.length) return null;
  const playersDown = players.every(c => c.defeated), othersDown = others.every(c => c.defeated);
  if (othersDown && !playersDown) return "players";
  if (playersDown && !othersDown) return "others";
  return playersDown && othersDown ? "none" : null;
}

/** The defeated combatants whose token lacks the defeated status. combatants: [{id, defeated, hasStatus}]. */
export const missingStatus = combatants => combatants.filter(c => c.defeated && !c.hasStatus).map(c => c.id);

/** Wrap Combat#rollInitiative once, over Rule Them'All's own wrap: the defeated combatants are left out of the roll. */
export function installDefeatedInitiative(CombatClass = globalThis.CONFIG?.Combat?.documentClass) {
  const proto = CombatClass?.prototype, original = proto?.rollInitiative;
  if (!original || original.htmOutOfCombat) return;
  async function rollInitiative(ids, options = {}) {
    const list = typeof ids === "string" ? [ids] : [...(ids ?? [])];
    const {roll, clear} = initiativeRolls(rows(this), list);
    if (clear.length) await this.updateEmbeddedDocuments("Combatant", clear.map(id => ({_id: id, initiative: null})));
    return roll.length ? original.call(this, roll, options) : this;
  }
  rollInitiative.htmOutOfCombat = true;
  proto.rollInitiative = rollInitiative;
}

/** Active GM, outside a pursuit (it has its own): a defeated combatant gets the defeated status on its token and its
 * turn passes at once; a combat with a side all defeated ends. */
export function installDefeatedTurns({hooks = globalThis.Hooks, delay = 300, endDelay = 2000, t = key => globalThis.game?.i18n?.localize?.(key) ?? key} = {}) {
  let timer = null, endTimer = null;
  const passed = new Set();
  const activeGM = () => { const game = globalThis.game; return game.user.isGM && (!game.users.activeGM || game.users.activeGM === game.user); };
  const check = async () => {
    const game = globalThis.game, combat = game.combat;
    if (!activeGM() || !combat?.started) return;
    if (combat.getFlag?.(MODULE_ID, "pursuit")) return;
    await markTokens(combat);
    const over = combatOver([...combat.combatants].map(c => ({playerOwned: Boolean(c.actor?.hasPlayerOwner), defeated: Boolean(c.isDefeated)})));
    if (over) { clearTimeout(endTimer); endTimer = setTimeout(() => endIfOver(combat.id), endDelay); return; }
    const active = combat.combatant ? {id: combat.combatant.id, defeated: Boolean(combat.combatant.isDefeated)} : null;
    if (!passOutTurn({active, combatants: rows(combat)})) return;
    // Once per turn: a combat that will not move on is not pushed again and again.
    const key = `${combat.id}|${combat.round}|${combat.turn}|${combat.getFlag?.("rule-them-all", "initiativePass") ?? 1}`;
    if (passed.has(key)) return;
    passed.add(key);
    try { await combat.nextTurn(); } catch (error) { console.error(`${MODULE_ID} | Defeated turn not passed`, error); }
  };
  // The defeated status on the token, as the tracker's own toggle puts it (Rule Them'All's own toggle sometimes misses).
  const markTokens = async combat => {
    const status = globalThis.CONFIG?.specialStatusEffects?.DEFEATED;
    if (!status) return;
    const all = [...combat.combatants], ids = missingStatus(all.map(c => ({id: c.id, defeated: Boolean(c.isDefeated), hasStatus: Boolean(c.actor?.statuses?.has?.(status))})));
    for (const id of ids) {
      try { await all.find(c => c.id === id)?.actor?.toggleStatusEffect?.(status, {overlay: true, active: true}); }
      catch (error) { console.error(`${MODULE_ID} | Defeated status not set`, error); }
    }
  };
  // A moment later, still over: the combat ends (the last card and sound first), with a line in the chat.
  const endIfOver = async combatId => {
    const game = globalThis.game, combat = game.combats?.get?.(combatId);
    if (!activeGM() || !combat?.started || combat.getFlag?.(MODULE_ID, "pursuit")) return;
    const over = combatOver([...combat.combatants].map(c => ({playerOwned: Boolean(c.actor?.hasPlayerOwner), defeated: Boolean(c.isDefeated)})));
    if (!over) return;
    try {
      const key = over === "players" ? "RWFTOOLS.Combat.EndedPlayers" : over === "others" ? "RWFTOOLS.Combat.EndedOthers" : "RWFTOOLS.Combat.EndedNone";
      await globalThis.ChatMessage?.create?.({content: `<p><strong>${t("RWFTOOLS.Combat.Title")}</strong> · ${t(key)}</p>`});
      await combat.delete();
    } catch (error) { console.error(`${MODULE_ID} | Combat not ended`, error); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(check, delay); };
  for (const hook of ["combatStart", "combatTurnChange", "updateCombat", "updateCombatant", "updateActor", "updateActorDelta"]) hooks.on(hook, later);
  later();
  return check;
}
