import test from "node:test";
import assert from "node:assert/strict";
import {requestRuleset, skillOptions, ddOptions, defaultDD, requestCandidates, isRwfPlayerCharacter, readD20, canSend, requestMessage, answerMessage, acceptAnswer, requestedTestContext} from "../src/test-request-model.mjs";

const ruleset = {
  actions: [{id: "test-demande", enabled: true}],
  definitions: [{id: "vigilance", definitionTypeId: "competence", nameKey: "Vigilance", order: 30}, {id: "athletisme", definitionTypeId: "competence", nameKey: "Athlétisme", order: 10},
    {id: "force", definitionTypeId: "caracteristique", nameKey: "Force", order: 5}, {id: "tir", definitionTypeId: "maitrise-combat", nameKey: "Tir", order: 1}, {id: "vieux", definitionTypeId: "competence", nameKey: "Vieux", enabled: false}],
  parameters: [{id: "dd-difficile", nameKey: "DD Difficile", value: 16, tags: ["difficulte"]}, {id: "dd-facile", nameKey: "DD Facile", value: 10, tags: ["difficulte"]},
    {id: "dd-standard", nameKey: "DD Standard", value: 13, tags: ["difficulte"]}, {id: "dd-poursuite", nameKey: "DD d'un test de poursuite", value: 13, tags: []}]
};
const configurator = (r = ruleset, versionId = "rwf-2-1-0") => ({getActiveVersionId: () => versionId, getRuntimeRuleset: () => r});

test("the active Ruleset serves the request only when it has the GM-requested test Action", () => {
  assert.deepEqual(requestRuleset(configurator()).versionId, "rwf-2-1-0");
  assert.equal(requestRuleset(configurator({actions: []})).reason, "RWFTOOLS.Error.NotRwf");
  assert.equal(requestRuleset(configurator(ruleset, null)).reason, "RWFTOOLS.Error.NoRuleset");
});

test("skills only, in the Ruleset's order; DDs from the tagged parameters, lowest first, Standard by default", () => {
  assert.deepEqual(skillOptions(ruleset).map(s => s.id), ["athletisme", "vigilance"]);
  const dds = ddOptions(ruleset);
  assert.deepEqual(dds.map(d => [d.id, d.value, d.label]), [["dd-facile", 10, "Facile (10)"], ["dd-standard", 13, "Standard (13)"], ["dd-difficile", 16, "Difficile (16)"]]);
  assert.equal(defaultDD(dds).id, "dd-standard");
  assert.equal(defaultDD(dds.filter(d => d.id !== "dd-standard")).id, "dd-facile");
});

test("candidates: connected players, not the GM, with an RWF player character they own themselves", async () => {
  const users = [{id: "gm", name: "MJ", active: true, isGM: true}, {id: "b", name: "Bruno", active: true}, {id: "a", name: "Alice", active: true}, {id: "c", name: "Chloé", active: false}];
  const actors = [
    {uuid: "Actor.1", name: "Marc", ownership: {default: 0, b: 3}},
    {uuid: "Actor.2", name: "Léa", ownership: {default: 0, a: 3, b: 2}},
    {uuid: "Actor.3", name: "Garde", ownership: {default: 3}},
    {uuid: "Actor.4", name: "Chien", ownership: {default: 0, a: 3}},
    {uuid: "Actor.5", name: "Zoé", ownership: {default: 0, c: 3}}];
  const pcs = new Set(["Actor.1", "Actor.2", "Actor.3", "Actor.5"]);
  const rows = await requestCandidates({users, actors, isPlayerCharacter: async actor => pcs.has(actor.uuid)});
  assert.deepEqual(rows.map(r => [r.userName, r.actorName]), [["Alice", "Léa"], ["Bruno", "Marc"]]);
});

test("a player character is the RWF version's state with Personnage joueur active", () => {
  const state = {rulesetVersionId: "v", definitionStates: {"personnage-joueur": {capabilityStates: {state: {active: true}}}}};
  assert.equal(isRwfPlayerCharacter(state, "v"), true);
  assert.equal(isRwfPlayerCharacter(state, "other"), false);
  assert.equal(isRwfPlayerCharacter({...state, definitionStates: {}}, "v"), false);
});

test("an announced d20 is a whole number from 1 to 20", () => {
  assert.deepEqual(["1", "20", " 7 ", 12].map(readD20), [1, 20, 7, 12]);
  assert.deepEqual(["0", "21", "3.5", "", "abc", null, "-2"].map(readD20), [null, null, null, null, null, null, null]);
});

test("Send needs a character, a skill and a DD of the lists", () => {
  const lists = {skills: skillOptions(ruleset), dds: ddOptions(ruleset)};
  assert.equal(canSend({selected: ["Actor.1"], skillId: "vigilance", ddId: "dd-standard"}, lists), true);
  assert.equal(canSend({selected: [], skillId: "vigilance", ddId: "dd-standard"}, lists), false);
  assert.equal(canSend({selected: ["Actor.1"], skillId: null, ddId: "dd-standard"}, lists), false);
  assert.equal(canSend({selected: ["Actor.1"], skillId: "force", ddId: "dd-standard"}, lists), false);
});

test("the GM accepts only the answer of the player asked, for a request still pending, with a valid d20", () => {
  const row = {userId: "b", actorUuid: "Actor.1", actorName: "Marc"}, skill = {id: "vigilance", label: "Vigilance"}, dd = {id: "dd-standard", value: 13, label: "Standard (13)"};
  const request = requestMessage({requestId: "r1", gmId: "gm", row, skill, dd}), pending = new Map([["r1", {request, status: "waiting"}]]);
  const answer = answerMessage({request, d20: 17, manual: true});
  assert.deepEqual(acceptAnswer(answer, pending, "gm", "b"), {request, d20: 17, manual: true});
  assert.equal(acceptAnswer(answer, pending, "other-gm"), null, "another GM's request");
  assert.equal(acceptAnswer({...answer, userId: "a"}, pending, "gm"), null, "another player");
  assert.equal(acceptAnswer(answer, pending, "gm", "a"), null, "sent by another user");
  assert.equal(acceptAnswer({...answer, requestId: "r2"}, pending, "gm"), null, "unknown request");
  assert.equal(acceptAnswer({...answer, d20: 25}, pending, "gm"), null, "not a d20");
  assert.deepEqual(requestedTestContext(request, 17), {roles: {self: {uuid: "Actor.1"}}, defaultRole: "self", variables: {definition: {objectKind: "definition", objectId: "vigilance"}, input: {dd: 13, de: 17}}});
});
