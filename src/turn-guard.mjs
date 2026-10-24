/* The pass of the combatant acting, kept right by the active GM. The RWF Ruleset lets a combatant attack, sprint or
   reload once per pass, from the pass Rule Them'All announces at the start of its turn; when that announcement is lost
   or undone (a combat start, a new round, an initiative roll arriving after it), or when counters stay from an earlier
   combat, the combatant could do nothing until the turn was moved back and forth. After any change to the combat or to
   an Actor, the active GM checks the combatant acting: not in combat yet, it enters it; its pass is not the combat's,
   its turn is announced again; a round it did not count (RWF 2.4.0) is announced to it; its turn just began with this pass's attack already marked spent, the stale counters
   go back to what they are at the start of a pass. */
import {MODULE_ID} from "./test-request-model.mjs";
import {hudRuleset} from "./hud-model.mjs";

const PASS_FLAG = ["rule-them-all", "initiativePass"];
const counter = (state, id) => Number(state?.definitionStates?.[id]?.capabilityStates?.value?.base ?? 0) || 0;
// "En combat" is applied as a state instance; its capability state stays false.
const inCombat = state => Boolean(state?.stateInstances?.some(instance => instance.definitionId === "en-combat" && instance.active !== false) || state?.definitionStates?.["en-combat"]?.capabilityStates?.state?.active);

/** What to write for the combatant acting, from its state: no events and no values when it can play the combat's pass.
    `fresh` says its turn has just begun, so no attack of this pass can have been made yet. */
export function turnRepairs({combatId, round, turn, pass, actorUuid, state, fresh = false}) {
  const none = {events: [], values: {}};
  if (!actorUuid || !(round >= 1) || !(pass >= 1) || !state) return none;
  const events = [], values = {};
  // Entering the combat resets every counter; a new round is not announced again, it would wind the combatant twice.
  const entering = !inCombat(state);
  if (entering) events.push({eventTypeId: "rta.combat.start", payload: {combatId, round}, refs: [actorUuid]});
  // RWF 2.4.0 notes the round it counted: a round it missed is announced to it (its effort counted, its attacks reset).
  const missedRound = !entering && Boolean(state.definitionStates?.["round-en-cours"]) && counter(state, "round-en-cours") < round;
  if (missedRound) events.push({eventTypeId: "rta.combat.round", payload: {combatId, round}, refs: [actorUuid]});
  if (entering || missedRound || counter(state, "passe-en-cours") !== pass) events.push({eventTypeId: "rta.combat.turn", payload: {combatId, round, turn, pass}, refs: [actorUuid]});
  if (!entering && !missedRound && fresh && counter(state, "derniere-passe-attaque") >= pass) {
    values["derniere-passe-attaque"] = pass - 1;
    if (pass === 1 && counter(state, "attaques-utilisees") > 0) values["attaques-utilisees"] = 0;
  }
  return {events, values};
}

const COUNTERS = ["round-en-cours", "passe-en-cours", "derniere-passe-attaque", "attaques-utilisees", "effort-physique"];
/** Whether an Actor still carries the marks of a combat: "En combat" or a combat counter above 0. */
export function combatMarks(state) { return Boolean(state) && (inCombat(state) || COUNTERS.some(id => counter(state, id) > 0)); }

export function installTurnGuard({hooks = globalThis.Hooks, delay = 400, endDelay = 1500} = {}) {
  // One repair per turn and pass: a Ruleset that refuses the pass is not asked again and again. The turn running when
  // the GM logs in is not fresh: its combatant may already have attacked.
  let timer = null, running = false, again = false, first = true;
  const seen = new Set(), repaired = new Set();
  const check = async () => {
    const game = globalThis.game, rta = game.ruleThemAll, combat = game.combat;
    if (!game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user) || !combat?.started || !rta?.runtime) return;
    if (running) { again = true; return; }
    running = true;
    try {
      await rta.configuratorReady;
      const found = hudRuleset(rta.configurator), actorUuid = combat.combatant?.actor?.uuid;
      if (found.reason || !actorUuid) return;
      const state = await rta.runtime.getContainerState(actorUuid);
      if (state?.rulesetVersionId !== found.versionId) return;
      const pass = Number(combat.getFlag?.(...PASS_FLAG) ?? 1) || 1;
      const key = `${combat.id}|${combat.round}|${combat.combatant.id}|${pass}`;
      const fresh = !first && !seen.has(key);
      first = false; seen.add(key);
      if (repaired.has(key)) return;
      const {events, values} = turnRepairs({combatId: combat.id, round: Number(combat.round), turn: Number(combat.turn ?? 0), pass, actorUuid, state, fresh});
      if (!events.length && !Object.keys(values).length) return;
      repaired.add(key);
      console.info(`${MODULE_ID} | ${combat.combatant.name}: pass ${counter(state, "passe-en-cours")} → ${pass}, last attack pass ${counter(state, "derniere-passe-attaque")}; repaired`, {events: events.map(e => e.eventTypeId), values});
      for (const {eventTypeId, payload, refs} of events) await rta.runtime.emitSystemEvent(eventTypeId, payload, refs);
      for (const [id, base] of Object.entries(values)) await rta.runtime.setDefinitionState(found.versionId, actorUuid, id, {base});
    } catch (error) { console.error(`${MODULE_ID} | Turn check failed`, error); }
    finally {
      running = false;
      if (again) { again = false; later(); }
    }
  };
  // Rule Them'All writes its events a moment after the change: the check waits for the burst to settle.
  const later = () => { clearTimeout(timer); timer = setTimeout(check, delay); };
  // A combat removed: every Actor of it still marked leaves the combat, whether or not the combat had started.
  hooks.on("deleteCombat", async combat => {
    const game = globalThis.game, rta = game.ruleThemAll;
    if (!game.user.isGM || (game.users.activeGM && game.users.activeGM !== game.user) || !rta?.runtime) return;
    try {
      const found = hudRuleset(rta.configurator);
      if (found.reason) return;
      const elsewhere = new Set([...(game.combats ?? [])].filter(c => c.id !== combat.id && c.started).flatMap(c => [...c.combatants].map(x => x.actor?.uuid)));
      const uuids = [...new Set([...(combat.combatants ?? [])].map(c => c.actor?.uuid).filter(uuid => uuid && !elsewhere.has(uuid)))];
      // Rule Them'All sends its own end for a started combat: it goes first, and only the Actors it left marked get
      // this one (both at once wrote the same Actor twice, and one failed with "Runtime container changed").
      if (combat.started && uuids.length) await new Promise(resolve => setTimeout(resolve, endDelay));
      const marked = [];
      for (const uuid of uuids) { const state = await rta.runtime.getContainerState(uuid); if (state?.rulesetVersionId === found.versionId && combatMarks(state)) marked.push(uuid); }
      if (marked.length) await rta.runtime.emitSystemEvent("rta.combat.end", {combatId: combat.id, round: Number(combat.round ?? 0)}, marked);
    } catch (error) { console.error(`${MODULE_ID} | Combat end failed`, error); }
  });
  for (const hook of ["combatStart", "combatTurnChange", "updateCombat", "createCombatant", "updateCombatant", "deleteCombatant", "updateActor"]) hooks.on(hook, later);
  later();
  return check;
}
