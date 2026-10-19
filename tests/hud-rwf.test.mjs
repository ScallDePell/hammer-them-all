// The two HUDs against the real RWF Ruleset, through the Rule Them'All engine (memory adapter).
// RTA_REPO: a Rule Them'All checkout (default ../rule-them-all), whose Rulesets/rwf holds RWF 2.2.0 or later.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {hudRuleset, combatantView, actionContext, pursuitView, setupView, addParticipants, emptyPursuit, assignTargets} from "../src/hud-model.mjs";
import {renderCombatHTML, renderPursuitHTML} from "../src/hud-markup.mjs";

const repo = resolve(process.env.RTA_REPO ?? new URL("../../rule-them-all", import.meta.url).pathname);
const rwfDir = `${repo}/Rulesets/rwf`;
const file = existsSync(rwfDir) ? readdirSync(rwfDir).filter(name => /^rwf-ruleset-.*\.json$/.test(name)).sort().at(-1) : null;
const lang = JSON.parse(readFileSync(new URL("../lang/fr.json", import.meta.url), "utf8"));
const t = key => key.startsWith("RWFTOOLS.") ? (assert.ok(key in lang, `missing ${key}`), lang[key]) : key;

async function setup() {
  const imp = path => import(pathToFileURL(`${repo}/src/${path}`).href);
  const {createConfiguratorAPI} = await imp("configurator/configurator-api.mjs");
  const {emptyStorageSnapshot} = await imp("configurator/configurator-storage.mjs");
  const {MemoryRuntimeAdapter} = await imp("runtime/memory-runtime-adapter.mjs");
  const {createRuntimeAPI} = await imp("runtime/runtime-api.mjs");
  class Storage { data = emptyStorageSnapshot(); async load() { return structuredClone(this.data); } async save(d) { this.data = structuredClone(d); } }
  class Adapter extends MemoryRuntimeAdapter {
    rolls = []; natural = 10;
    async roll(formula) { this.rolls.push(formula); const total = /^\d+$/.test(formula) ? Number(formula) : formula === "1d20" ? this.natural : 1; return {formula, result: String(total), total, natural: total}; }
  }
  const configurator = await createConfiguratorAPI(new Storage());
  const {versionId} = await configurator.importRuleset(readFileSync(`${rwfDir}/${file}`, "utf8"), "NEW");
  await configurator.setActiveVersionId(versionId);
  const adapter = new Adapter(), runtime = createRuntimeAPI(configurator, {adapter, hooks: null});
  const found = hudRuleset(configurator);
  const give = async (uuid, contents) => {
    const state = await adapter.load({uuid});
    for (const [key, templateId] of Object.entries(contents)) {
      const template = found.ruleset.contentTemplates.find(tpl => tpl.id === templateId);
      state.contents[key] = {templateId, contentTypeId: template.contentTypeId, fields: {}};
    }
    await adapter.write({uuid}, {state, ledger: await adapter.loadLedger({uuid})});
  };
  return {configurator, versionId, adapter, runtime, found, give};
}

test("the combat HUD shows the RWF combatant's cards and runs its Actions", {skip: !file && "no Rule Them'All checkout"}, async () => {
  const {versionId, adapter, runtime, found, give} = await setup();
  assert.equal(found.versionId, versionId);
  const pc = "Actor.marc", foe = "Actor.garde";
  for (const uuid of [pc, foe]) await runtime.initializeContainer(versionId, uuid);
  await give(pc, {pistolet: "arme-pistolet-9-mm", couteau: "arme-couteau-poignard", tk: "pouvoir-telekinesie"});
  const view = async (distance, cover = 0) => combatantView(runtime, {versionId, ruleset: found.ruleset, actorUuid: pc, target: {uuid: foe, name: "Garde", distance}, cover, isGM: true, userId: "gm"});

  let v = await view(5);
  assert.deepEqual(v.cards.map(c => `${c.kind}:${c.key}`), ["unarmed:unarmed", "weapon:pistolet", "weapon:couteau", "power:tk", "physical:physical"]);
  assert.deepEqual([v.pools.vitalite.max > 0, v.attacks, v.efforts], [true, {used: 0, best: 1}, 0]);
  const card = key => v.cards.find(c => c.key === key), button = (key, id) => card(key).buttons.find(b => b.actionId === id);
  assert.equal(button("pistolet", "attaquer").allowed, true, "a target 5 m away, in the pistol's 20 m");
  assert.equal(button("pistolet", "attaquer").label, "RWFTOOLS.Combat.Shoot");
  assert.deepEqual(card("pistolet").ammo, {loaded: 15, magazine: 15, reserve: 30});
  assert.deepEqual(card("pistolet").buttons.map(b => b.actionId), ["attaquer", "recharger"], "a pistol has no burst");
  assert.equal(button("pistolet", "recharger").allowed, false, "a full magazine");
  assert.equal(button("couteau", "attaquer").allowed, false, "a knife needs contact");
  assert.equal(button("couteau", "attaquer").range.key, "RWFTOOLS.Combat.Contact");
  assert.equal(card("tk").latent, true, "a latent power, shown to the GM");
  const required = button("pistolet", "attaquer").required;
  v = await view(5, 2);
  assert.equal(button("pistolet", "attaquer").required, required + 2, "cover raises the d20 needed");
  v = await view(30);
  assert.equal(button("pistolet", "attaquer").allowed, false, "30 m: out of the pistol's range");
  v = await view(0);
  assert.equal(button("couteau", "attaquer").allowed, true, "in contact");

  // The markup, every word translated.
  const html = renderCombatHTML({combatant: v, round: 1, pass: 1, passes: 1, myTurn: true, turnName: "Marc", name: "Marc", target: {uuid: foe, name: "Garde", distance: 0}, cover: 0, mode: "table", canEndTurn: true, endLabel: "RWFTOOLS.Combat.EndRound",
    pending: {label: "RWFTOOLS.Combat.Shoot", subject: "pistolet", required: 10, damage: true}}, t);
  assert.match(html, /data-rwf-action="attaquer" data-rwf-content="pistolet"/);
  assert.match(html, /name="de"/);
  assert.match(html, /Fin du round/);

  // A shot with the d20 and the damage read on the table: the foe loses the announced damage, the magazine one round.
  // The combat starts and it is Marc's first pass, as Rule Them'All signals it in Foundry.
  await runtime.emitSystemEvent("rta.combat.start", {combatId: "c", round: 1}, [pc, foe]);
  await runtime.emitSystemEvent("rta.combat.round", {combatId: "c", round: 1}, [pc, foe]);
  await runtime.emitSystemEvent("rta.combat.turn", {combatId: "c", round: 1, turn: 0, pass: 1}, [pc]);
  const vitality = async () => (await runtime.tokenBarValue(versionId, foe, "rta.vitalite.points")).value;
  const before = await vitality();
  const shot = await runtime.executeAction(versionId, "attaquer", actionContext({actorUuid: pc, targetUuid: foe, contentKey: "pistolet", input: {couverture: 0, de: 19, degats: 3}, userId: "gm", isGM: true}));
  assert.notEqual(shot.allowed, false, JSON.stringify(shot).slice(0, 300));
  assert.equal(shot.testResult.roll.total, 19, "the announced d20");
  if (process.env.DUMP) console.log(JSON.stringify({changes: shot.changes, dice: shot.use?.dice, test: shot.testResult}, null, 1).slice(0, 5000));
  assert.equal(await vitality(), before - 3);
  assert.ok(!adapter.rolls.includes("1d20"), "no d20 thrown by Foundry");
  v = await view(5);
  assert.equal(card("pistolet").ammo.loaded, 14);
  assert.equal(v.attacks.used, 1);
  assert.equal(button("pistolet", "attaquer").allowed, false, "one attack per round at mastery 0");
  assert.equal(button("pistolet", "recharger").allowed, false, "the pass's attack is spent");
});

test("the pursuit HUD: a gap gauge per fugitive, pursuers on their quarry, moves for the one whose turn it is", {skip: !file && "no Rule Them'All checkout"}, async () => {
  const {versionId, runtime, found, give} = await setup();
  const runner = "Actor.marc", driver = "Actor.lea", thug = "Actor.garde";
  for (const uuid of [runner, driver, thug]) await runtime.initializeContainer(versionId, uuid);
  await give(driver, {auto: "vehicule-citadine"});
  const draft = addParticipants(emptyPursuit(), [{uuid: runner, name: "Marc", playerOwned: true}, {uuid: driver, name: "Léa", playerOwned: true}, {uuid: thug, name: "Garde", playerOwned: false}]);
  const prepared = await setupView(runtime, {versionId, ruleset: found.ruleset, pursuit: draft});
  assert.deepEqual(prepared.rows.find(r => r.uuid === driver).vehicles.map(v => v.key), ["auto"], "the GM picks among the vehicles it owns");
  assert.deepEqual(prepared.fugitives.map(f => f.uuid), [thug]);
  assert.equal(prepared.rows.find(r => r.uuid === runner).targetUuid, thug, "each pursuer chases a fugitive");
  assert.equal(prepared.canLaunch, true);
  const pursuit = {cap: 0, outcomes: {}, participants: assignTargets(draft.participants).map((p, i) => ({...p, combatantId: `c${i}`, means: p.uuid === driver ? "auto" : p.means}))};
  const read = (p, activeUuid) => pursuitView(runtime, {versionId, ruleset: found.ruleset, pursuit: p, order: [thug, driver, runner], activeUuid, isGM: true, userId: "gm"});
  let v = await read(pursuit, driver);
  const row = uuid => v.rows.find(r => r.uuid === uuid);
  assert.deepEqual(v.rows.map(r => r.uuid), [thug, driver, runner], "turn order");
  assert.deepEqual(v.sides.fuyard.map(r => r.uuid), [thug]);
  assert.deepEqual(v.sides.poursuivant.map(r => r.uuid), [driver, runner]);
  assert.deepEqual([row(thug).gauge, row(driver).gauge, row(runner).gauge], [0, null, null], "only a fugitive has a gauge");
  assert.deepEqual(row(thug).chasers.map(r => r.uuid), [driver, runner]);
  assert.equal(row(driver).target.uuid, thug);
  assert.deepEqual([row(runner).speed, row(driver).speed, row(thug).speed], [-1, 1, -1]);
  assert.deepEqual([row(runner).advantage, row(driver).advantage, row(thug).advantage], [0, 1, -1], "a fugitive against its fastest chaser, a pursuer against its quarry");
  assert.equal(v.current.uuid, driver);
  assert.deepEqual(v.current.targets.map(r => r.uuid), [thug]);
  assert.deepEqual(v.current.moves.map(m => m.actionId), ["poursuite-vehicule-continuer", "poursuite-vehicule-risque", "poursuite-vehicule-raccourci", "poursuite-arret"]);
  assert.ok(v.current.moves.every(m => m.targetUuid === thug && m.sens === -1), "a pursuer's moves work on its quarry's gauge");
  assert.equal(row(runner).moves, undefined, "only the one whose turn it is has moves");
  assert.deepEqual(v.current.moves.slice(0, 3).map(m => m.modifier), [0, -2, 2], "a risk costs 2, a shortcut gives 2");
  assert.equal(v.dd, 13);
  const [keep, risk, cut] = v.current.moves;
  assert.ok(Number.isInteger(keep.required) && risk.required === Math.min(20, keep.required + 2) && cut.required === Math.max(2, keep.required - 2), "the d20 each move needs");
  assert.equal((await read({...pursuit, cap: 0.5}, driver)).rows.find(r => r.uuid === driver).speed, 0.5, "the terrain caps the car");
  assert.equal((await pursuitView(runtime, {versionId, ruleset: found.ruleset, pursuit, order: [], activeUuid: driver, canAct: () => false})).current.moves.length, 0, "not this user's to play");

  // Léa keeps going with a good d20: the Garde's gap shrinks.
  const move = await runtime.executeAction(versionId, keep.actionId, actionContext({actorUuid: driver, targetUuid: thug, contentKey: "auto", input: {vitesse: 1, sens: -1, de: 18}, userId: "gm", isGM: true}));
  assert.notEqual(move.allowed, false, JSON.stringify(move).slice(0, 300));
  v = await read(pursuit, thug);
  assert.ok(row(thug).gauge < 0, "the pursuer pulled the fugitive's gauge down");
  assert.ok(v.current.moves.every(m => m.targetUuid === thug && m.sens === 1), "a fugitive's moves work on its own gauge");
  const html = renderPursuitHTML({...v, isGM: true, round: 1, myTurn: true, mode: "foundry"}, t);
  assert.match(html, /data-rwf-move="continuer"/);
  assert.match(html, /data-rwf-end-turn/);
  assert.match(html, /rwf-pursuit__runner--active/);
  assert.equal((html.match(/rwf-hud__step--bad/g) ?? []).length, -row(thug).gauge, "the gauge fills red from 0 to where the Garde is");
  assert.match(html, /Poursuivi par Léa, Marc/);
  assert.match(html, /Chasse Garde/);
  assert.equal(v.over, false);

  // Marc runs out of breath: out of the race, and the pursuit goes on with Léa.
  await runtime.setDefinitionState(versionId, runner, "endurance", {pools: {points: 0}});
  v = await read(pursuit, runner);
  assert.equal(row(runner).status.key, "RWFTOOLS.Pursuit.Status.Exhausted");
  assert.equal(v.current.moves.length, 0, "an exhausted runner has no move");
  assert.deepEqual(row(thug).chasers.map(r => r.uuid), [driver]);
  assert.equal(v.over, false);
  v = await read({...pursuit, outcomes: {[thug]: "RWFTOOLS.Pursuit.Status.CaughtUp"}}, driver);
  assert.equal(row(thug).status.done, true);
  assert.equal(v.over, true, "no one left fleeing");
  assert.equal(row(driver).target, null, "no one left to chase");
});

test("the turn guard frees a first combatant left with the counters of an earlier combat", {skip: !file && "no Rule Them'All checkout"}, async () => {
  const {turnRepairs} = await import("../src/turn-guard.mjs");
  const {versionId, runtime, found, give} = await setup();
  const pc = "Actor.marc", foe = "Actor.garde";
  for (const uuid of [pc, foe]) await runtime.initializeContainer(versionId, uuid);
  await give(pc, {pistolet: "arme-pistolet-9-mm"});
  const shoot = async () => runtime.executeAction(versionId, "attaquer", actionContext({actorUuid: pc, targetUuid: foe, contentKey: "pistolet", input: {couverture: 0, de: 19, degats: 1}, userId: "gm", isGM: true}));
  // An earlier combat, never ended: Marc shot in its first pass.
  await runtime.emitSystemEvent("rta.combat.start", {combatId: "old", round: 1}, [pc, foe]);
  await runtime.emitSystemEvent("rta.combat.round", {combatId: "old", round: 1}, [pc, foe]);
  await runtime.emitSystemEvent("rta.combat.turn", {combatId: "old", round: 1, turn: 0, pass: 1}, [pc]);
  assert.notEqual((await shoot()).allowed, false);
  // The new combat's start and round never reached Marc: his attack of pass 1 reads as spent.
  assert.equal((await shoot()).allowed, false, "stuck, as Luca saw it");
  const {events, values} = turnRepairs({combatId: "new", round: 1, turn: 0, pass: 1, actorUuid: pc, state: await runtime.getContainerState(pc), fresh: true});
  for (const e of events) await runtime.emitSystemEvent(e.eventTypeId, e.payload, e.refs);
  for (const [id, base] of Object.entries(values)) await runtime.setDefinitionState(found.versionId, pc, id, {base});
  assert.notEqual((await shoot()).allowed, false, "freed by the guard");
  const after = await runtime.getContainerState(pc);
  assert.deepEqual(turnRepairs({combatId: "new", round: 1, turn: 0, pass: 1, actorUuid: pc, state: after, fresh: false}), {events: [], values: {}}, "nothing more once it has shot");
});

test("a round lost on the way is counted once when the turn guard announces it", {skip: !file && "no Rule Them'All checkout"}, async () => {
  const {turnRepairs} = await import("../src/turn-guard.mjs");
  const {versionId, runtime, found} = await setup();
  if (!found.ruleset.definitions.some(d => d.id === "round-en-cours")) return;
  const pc = "Actor.marc", foe = "Actor.garde";
  for (const uuid of [pc, foe]) await runtime.initializeContainer(versionId, uuid);
  const read = async id => { const s = await runtime.getContainerState(pc), c = s.definitionStates[id]?.capabilityStates; return c?.value?.base ?? c?.pool?.points?.current; };
  const play = async (round, {lost = false} = {}) => {
    if (!lost) await runtime.emitSystemEvent("rta.combat.round", {combatId: "c", round}, [pc, foe]);
    const {events} = turnRepairs({combatId: "c", round, turn: 0, pass: 1, actorUuid: pc, state: await runtime.getContainerState(pc), fresh: true});
    for (const e of events) await runtime.emitSystemEvent(e.eventTypeId, e.payload, e.refs);
    // Rule Them'All's own round, arriving late, is not counted twice.
    if (lost) await runtime.emitSystemEvent("rta.combat.round", {combatId: "c", round}, [pc, foe]);
    const shot = await runtime.executeAction(versionId, "attaquer-mains-nues", actionContext({actorUuid: pc, targetUuid: foe, input: {couverture: 0}, userId: "gm", isGM: true}));
    assert.notEqual(shot.allowed, false, `round ${round}`);
  };
  const endurance = await read("endurance");
  await runtime.emitSystemEvent("rta.combat.start", {combatId: "c", round: 1}, [pc, foe]);
  await play(1);
  await play(2, {lost: true});
  await play(3);
  await play(4, {lost: true});
  assert.equal(await read("endurance"), endurance - 1, "three physical rounds, one Endurance");
  assert.equal(await read("round-en-cours"), 4);
});
