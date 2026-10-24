import test from "node:test";
import assert from "node:assert/strict";
import {initiativeRolls, passOutTurn, installDefeatedInitiative, combatOver, missingStatus} from "../src/out-of-combat.mjs";
import {hudToOpen} from "../src/hud-open.mjs";
import {combatCues, cueFile} from "../src/sounds.mjs";
import {isOut, knockedOut} from "../src/hud-model.mjs";
import {renderCombatHTML} from "../src/hud-markup.mjs";

test("a defeated combatant rolls no initiative and loses the one it had", () => {
  const combatants = [{id: "a", defeated: false, initiative: 12}, {id: "b", defeated: true, initiative: 23.22}, {id: "c", defeated: true, initiative: null}];
  assert.deepEqual(initiativeRolls(combatants, ["a", "b", "c"]), {roll: ["a"], clear: ["b"]});
  assert.deepEqual(initiativeRolls(combatants, ["z"]), {roll: ["z"], clear: []}, "an unknown id is left to Foundry");
});

test("the initiative wrap leaves the defeated out of the roll it hands on", async () => {
  const calls = [];
  class Combat {
    constructor() { this.combatants = [{id: "a", isDefeated: false, initiative: 3}, {id: "b", isDefeated: true, initiative: 9}]; }
    async rollInitiative(ids) { calls.push(["roll", ids]); return this; }
    async updateEmbeddedDocuments(type, updates) { calls.push(["update", updates]); }
  }
  installDefeatedInitiative(Combat);
  installDefeatedInitiative(Combat);
  await new Combat().rollInitiative(["a", "b"]);
  assert.deepEqual(calls, [["update", [{_id: "b", initiative: null}]], ["roll", ["a"]]]);
  calls.length = 0;
  await new Combat().rollInitiative("b");
  assert.deepEqual(calls, [["update", [{_id: "b", initiative: null}]]], "no one left to roll");
});

test("a defeated combatant's turn passes, unless no one is left standing", () => {
  assert.equal(passOutTurn({active: {id: "b", defeated: true}, combatants: [{id: "a", defeated: false}, {id: "b", defeated: true}]}), true);
  assert.equal(passOutTurn({active: {id: "a", defeated: false}, combatants: [{id: "a", defeated: false}]}), false);
  assert.equal(passOutTurn({active: {id: "b", defeated: true}, combatants: [{id: "b", defeated: true}]}), false);
});

test("out of the combat at Vitality 0, the HUD lets it do nothing, even on its turn", () => {
  assert.equal(isOut({vitality: 0}), true);
  assert.equal(isOut({defeated: true, vitality: 5}), true);
  assert.equal(isOut({vitality: 3}), false);
  assert.equal(isOut({vitality: null}), false);
  const combatant = {pools: {vitalite: {value: 0, max: 11}}, defense: 12, attacks: {used: 0, best: 1}, efforts: 0, cards: [{kind: "unarmed", key: "u", name: "Mains nues", details: [], buttons: [{actionId: "attaquer-mains-nues", label: "RWFTOOLS.Combat.Attack", allowed: true}]}]};
  const out = knockedOut(combatant);
  assert.equal(out.cards[0].buttons[0].allowed, false);
  const html = renderCombatHTML({combatant: out, round: 1, pass: 1, passes: 1, name: "Criminel", turnName: "Criminel", cover: 0, mode: "foundry"}, key => key);
  assert.match(html, /RWFTOOLS\.Combat\.OutOfCombat/);
  assert.doesNotMatch(html, /RWFTOOLS\.Combat\.WaitTurn/);
  assert.match(html, /data-rwf-action="attaquer-mains-nues"[^>]* disabled/);
});

test("the HUD opens for the players in a combat or a pursuit that runs", () => {
  const mine = [{owned: true, playerOwned: true}], theirs = [{owned: false, playerOwned: true}];
  assert.equal(hudToOpen({started: true, pursuit: false, combatants: mine}), "combat");
  assert.equal(hudToOpen({started: true, pursuit: true, combatants: mine}), "pursuit");
  assert.equal(hudToOpen({started: false, combatants: mine}), null, "not before it starts");
  assert.equal(hudToOpen({started: true, combatants: theirs}), null);
  assert.equal(hudToOpen({started: true, combatants: mine, isGM: true}), null, "the GM opens it with the macro");
});

test("combat sounds: the start, your turn, next up; none when Foundry's theme plays them", () => {
  const at = (round, combatantId) => ({round, combatantId});
  assert.deepEqual(combatCues({before: at(0, null), after: at(1, "a")}), ["startEncounter"]);
  assert.deepEqual(combatCues({before: null, after: at(1, "a"), mine: true}), ["startEncounter", "yourTurn"]);
  assert.deepEqual(combatCues({before: at(1, "a"), after: at(1, "b"), mine: true}), ["yourTurn"]);
  assert.deepEqual(combatCues({before: at(1, "a"), after: at(1, "b"), mineNext: true}), ["nextUp"]);
  assert.deepEqual(combatCues({before: at(1, "b"), after: at(2, "b"), mine: true}), ["yourTurn"], "a new round");
  assert.deepEqual(combatCues({before: at(1, "a"), after: at(1, "a"), mine: true}), [], "nothing moved");
  assert.deepEqual(combatCues({before: at(0, null), after: at(1, "a"), mine: true, themeOwnsTurns: true}), []);
  assert.deepEqual(combatCues({before: at(1, "a"), after: at(0, null)}), [], "back to before the start");
  assert.equal(cueFile({yourTurn: ["x.ogg", "y.ogg"]}, "yourTurn", 0.9), "y.ogg");
  assert.equal(cueFile({yourTurn: "x.ogg"}, "yourTurn"), "x.ogg");
  assert.equal(cueFile({}, "nextUp"), null);
});

test("a flag key is removed with Foundry 14's ForcedDeletion when it exists", async () => {
  const {deletion} = await import("../src/hud-common.mjs");
  assert.deepEqual(deletion("flags.x.targets", "a"), {"flags.x.targets.-=a": null});
  class ForcedDeletion {}
  globalThis.foundry = {data: {operators: {ForcedDeletion}}};
  try { assert.ok(deletion("flags.x.targets", "a")["flags.x.targets.a"] instanceof ForcedDeletion); }
  finally { delete globalThis.foundry; }
});

test("a combat is over once a side has no one left standing", () => {
  const pc = (defeated = false) => ({playerOwned: true, defeated}), npc = (defeated = false) => ({playerOwned: false, defeated});
  assert.equal(combatOver([pc(), npc(true), npc(true)]), "players");
  assert.equal(combatOver([pc(true), npc()]), "others");
  assert.equal(combatOver([pc(true), npc(true)]), "none");
  assert.equal(combatOver([pc(), npc(), npc(true)]), null);
  assert.equal(combatOver([pc(), pc(true)]), null, "no other side: the GM ends it");
  assert.equal(combatOver([]), null);
});

test("a defeated combatant without the status on its token gets it", () => {
  assert.deepEqual(missingStatus([{id: "a", defeated: true, hasStatus: false}, {id: "b", defeated: true, hasStatus: true}, {id: "c", defeated: false, hasStatus: false}]), ["a"]);
});
