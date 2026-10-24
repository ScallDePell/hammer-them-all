/* Out of the combat is out of the round. Rule Them'All rerolls the initiative of every combatant of the RWF Ruleset at
   each new round, the defeated ones too, and their turns kept coming. Here a defeated combatant rolls no initiative (it
   loses the one it had, so it goes to the end of the order) and the active GM passes its turn when it comes. */
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

/** Active GM: a defeated combatant's turn passes at once (a pursuit passes its own). */
export function installDefeatedTurns({hooks = globalThis.Hooks, delay = 300} = {}) {
  let timer = null;
  const passed = new Set();
  const check = async () => {
    const game = globalThis.game, combat = game.combat;
    if (!game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user) || !combat?.started) return;
    if (combat.getFlag?.(MODULE_ID, "pursuit")) return;
    const active = combat.combatant ? {id: combat.combatant.id, defeated: Boolean(combat.combatant.isDefeated)} : null;
    if (!passOutTurn({active, combatants: rows(combat)})) return;
    // Once per turn: a combat that will not move on is not pushed again and again.
    const key = `${combat.id}|${combat.round}|${combat.turn}|${combat.getFlag?.("rule-them-all", "initiativePass") ?? 1}`;
    if (passed.has(key)) return;
    passed.add(key);
    try { await combat.nextTurn(); } catch (error) { console.error(`${MODULE_ID} | Defeated turn not passed`, error); }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(check, delay); };
  for (const hook of ["combatStart", "combatTurnChange", "updateCombat", "updateCombatant"]) hooks.on(hook, later);
  later();
  return check;
}
