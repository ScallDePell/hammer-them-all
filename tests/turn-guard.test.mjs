import test from "node:test";
import assert from "node:assert/strict";
import {turnRepairs} from "../src/turn-guard.mjs";

const state = ({combat = true, pass = 0, last = 0, used = 0} = {}) => ({stateInstances: combat ? [{definitionId: "en-combat", active: true}] : [], definitionStates: {
  "en-combat": {capabilityStates: {state: {active: false}}},
  "passe-en-cours": {capabilityStates: {value: {base: pass}}},
  "derniere-passe-attaque": {capabilityStates: {value: {base: last}}},
  "attaques-utilisees": {capabilityStates: {value: {base: used}}}}});
const turn = {combatId: "c", round: 1, turn: 0, pass: 1, actorUuid: "Actor.a"};
const ids = r => r.events.map(e => e.eventTypeId);

test("a combatant already playing the combat's pass needs nothing", () => {
  assert.deepEqual(turnRepairs({...turn, state: state({pass: 1}), fresh: true}), {events: [], values: {}});
  assert.deepEqual(turnRepairs({...turn, round: 0, state: state()}).events, [], "combat not started");
});

test("a lost turn announcement is made again; a combatant outside the combat enters it", () => {
  assert.deepEqual(ids(turnRepairs({...turn, state: state({pass: 0})})), ["rta.combat.turn"]);
  assert.deepEqual(turnRepairs({...turn, pass: 2, state: state({pass: 1})}).events[0].payload, {combatId: "c", round: 1, turn: 0, pass: 2});
  assert.deepEqual(ids(turnRepairs({...turn, state: state({combat: false, pass: 1})})), ["rta.combat.start", "rta.combat.turn"], "no second round: it would wind the combatant twice");
});

test("a turn that just began with its attack marked spent gets the counters of a new pass", () => {
  assert.deepEqual(turnRepairs({...turn, state: state({pass: 1, last: 1, used: 1}), fresh: true}).values, {"derniere-passe-attaque": 0, "attaques-utilisees": 0});
  assert.deepEqual(turnRepairs({...turn, pass: 2, state: state({pass: 2, last: 2, used: 1}), fresh: true}).values, {"derniere-passe-attaque": 1}, "the first pass's attack still counts");
  assert.deepEqual(turnRepairs({...turn, state: state({pass: 1, last: 1, used: 1})}).values, {}, "not fresh: it may have just attacked");
});
