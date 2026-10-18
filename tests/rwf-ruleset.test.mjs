// The requested test against the real RWF Ruleset, through the Rule Them'All engine (memory adapter).
// RTA_REPO: a Rule Them'All checkout (default ../rule-them-all), whose Rulesets/rwf holds RWF 2.1.0 or later.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {requestRuleset, skillOptions, ddOptions, defaultDD, requestCandidates, isRwfPlayerCharacter, requestMessage, requestedTestContext} from "../src/test-request-model.mjs";

const repo = resolve(process.env.RTA_REPO ?? new URL("../../rule-them-all", import.meta.url).pathname);
const rwfDir = `${repo}/Rulesets/rwf`;
const file = existsSync(rwfDir) ? readdirSync(rwfDir).filter(name => /^rwf-ruleset-.*\.json$/.test(name)).sort().at(-1) : null;

test("a test the GM asks for gives practice to the player character; a free roll does not", {skip: !file && "no Rule Them'All checkout"}, async () => {
  const imp = path => import(pathToFileURL(`${repo}/src/${path}`).href);
  const {createConfiguratorAPI} = await imp("configurator/configurator-api.mjs");
  const {emptyStorageSnapshot} = await imp("configurator/configurator-storage.mjs");
  const {MemoryRuntimeAdapter} = await imp("runtime/memory-runtime-adapter.mjs");
  const {createRuntimeAPI} = await imp("runtime/runtime-api.mjs");
  class Storage { data = emptyStorageSnapshot(); async load() { return structuredClone(this.data); } async save(d) { this.data = structuredClone(d); } }
  class Adapter extends MemoryRuntimeAdapter {
    rolls = [];
    async roll(formula) { this.rolls.push(formula); const total = /^\d+$/.test(formula) ? Number(formula) : 1; return {formula, result: String(total), total, natural: total}; }
  }
  const configurator = await createConfiguratorAPI(new Storage());
  const {versionId} = await configurator.importRuleset(readFileSync(`${rwfDir}/${file}`, "utf8"), "NEW");
  await configurator.setActiveVersionId(versionId);
  const adapter = new Adapter(), runtime = createRuntimeAPI(configurator, {adapter, hooks: null});

  const found = requestRuleset(configurator);
  assert.equal(found.versionId, versionId);
  const skills = skillOptions(found.ruleset), dds = ddOptions(found.ruleset);
  assert.equal(skills.length, 15, "the 15 skills, no masteries");
  assert.deepEqual(dds.map(d => d.value), [10, 13, 16, 19, 22]);
  assert.equal(defaultDD(dds).value, 13);

  const pc = {kind: "actor", id: "marc"}, npc = {kind: "actor", id: "garde"};
  await runtime.initializeContainer(versionId, pc);
  await runtime.setDefinitionState(versionId, pc, "personnage-joueur", {active: true});
  await runtime.initializeContainer(versionId, npc);
  const actors = [{uuid: "marc", name: "Marc", ownership: {b: 3}, ref: pc}, {uuid: "garde", name: "Garde", ownership: {b: 3}, ref: npc}];
  const rows = await requestCandidates({users: [{id: "b", name: "Bruno", active: true}], actors,
    isPlayerCharacter: async actor => isRwfPlayerCharacter(await runtime.getContainerState(actor.ref), versionId)});
  assert.deepEqual(rows.map(r => r.actorName), ["Marc"]);

  const skill = skills.find(s => s.id === "vigilance"), request = requestMessage({requestId: "r1", gmId: "gm", row: rows[0], skill, dd: defaultDD(dds)});
  const practice = async () => (await runtime.getContainerState(pc)).definitionStates["pratique-vigilance"].capabilityStates.value.base;
  const context = d20 => { const c = requestedTestContext(request, d20); return {...c, roles: {self: pc}}; };

  const free = await runtime.executeAction(versionId, "tester-competence", {roles: {self: pc}, variables: {definition: {objectKind: "definition", objectId: "vigilance"}, input: {dd: 13}}});
  assert.equal(free.allowed, true);
  assert.equal(await practice(), 0, "a free roll gives nothing");

  const success = await runtime.executeAction(versionId, "test-demande", context(18));
  assert.equal(success.testResult.roll.total, 18, "the announced d20, not a new roll");
  assert.equal(success.testResult.target, 13);
  assert.equal(await practice(), 1);
  await runtime.executeAction(versionId, "test-demande", context(20));
  assert.equal(await practice(), 3, "a natural 20 is a critical: 2 more");
  await runtime.executeAction(versionId, "test-demande", context(1));
  assert.equal(await practice(), 3, "a 1 is a complication: nothing");
  assert.deepEqual(adapter.rolls.filter(f => f === "1d20").length, 1, "only the free roll threw a d20");
});
