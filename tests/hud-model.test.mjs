import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {yourTurn, keptTarget, staleTargets, aimingCombatant, opposingSide, hits, followedCombatant, edgeDistance, outOfRange, requiredD20, readWhole, readPursuit, readRunningPursuit, runningPursuitFlag, addParticipants, setFleeing, canLaunch, pursuitOver, emptyPursuit, speedAdvantage, pursuitStatus, assignTargets, endTurnLabel, moveAction, hudRuleset} from "../src/hud-model.mjs";
import {renderCombatHTML, renderPursuitHTML} from "../src/hud-markup.mjs";

test("each user's HUD follows the combatant acting when it is theirs, else their own character", () => {
  const combatants = [{id: "a", actorUuid: "A", owned: false}, {id: "b", actorUuid: "B", owned: true}, {id: "c", actorUuid: "C", owned: true}];
  assert.equal(followedCombatant({combatants, activeId: "a", isGM: true}).id, "a");
  assert.equal(followedCombatant({combatants, activeId: "a", characterUuid: "C"}).id, "c");
  assert.equal(followedCombatant({combatants, activeId: "a"}).id, "b");
  assert.equal(followedCombatant({combatants, activeId: "c"}).id, "c");
  assert.equal(followedCombatant({combatants: combatants.slice(0, 1), activeId: "a"}), null);
});

test("only who plays the combatant acting is told it is their turn", () => {
  assert.equal(yourTurn({isGM: false, owned: true, playerOwned: true}), true, "the player of the acting PC");
  assert.equal(yourTurn({isGM: false, owned: false, playerOwned: true}), false, "another player");
  assert.equal(yourTurn({isGM: false, owned: false, playerOwned: false}), false, "a player, on an NPC's turn");
  assert.equal(yourTurn({isGM: true, owned: true, playerOwned: false}), true, "the GM, on an NPC's turn");
  assert.equal(yourTurn({isGM: true, owned: true, playerOwned: true}), false, "the GM, on a PC's turn");
});

test("each combatant keeps its target until it picks another one or that one is out of combat", () => {
  const combatants = [{id: "pc"}, {id: "npc"}, {id: "dog", defeated: true}];
  assert.equal(keptTarget({targets: undefined, combatantId: "pc", combatants}), null, "a new combat: no target");
  assert.equal(keptTarget({targets: {pc: "npc"}, combatantId: "pc", combatants}), "npc");
  assert.equal(keptTarget({targets: {pc: "npc"}, combatantId: "npc", combatants}), null, "another combatant's target is not its own");
  assert.equal(keptTarget({targets: {pc: "dog"}, combatantId: "pc", combatants}), null, "defeated");
  assert.equal(keptTarget({targets: {pc: "gone"}, combatantId: "pc", combatants}), null, "left the combat");
  assert.deepEqual(staleTargets({targets: {pc: "npc", npc: "dog", gone: "pc", x: "gone"}, combatants}), ["npc", "gone", "x"]);
  const rows = [{id: "pc", owned: true, playerOwned: true, actorUuid: "Actor.pc"}, {id: "npc", playerOwned: false}];
  assert.equal(aimingCombatant({combatants: rows, activeId: "npc", isGM: true})?.id, "npc", "the GM aims for the NPC acting");
  assert.equal(aimingCombatant({combatants: rows, activeId: "pc", isGM: true}), null, "not for a player character");
  assert.equal(aimingCombatant({combatants: rows, activeId: "npc", characterUuid: "Actor.pc"})?.id, "pc", "a player aims for their own character");
});

test("the target picker lists the other side", () => {
  const rows = [{id: "a", playerOwned: true}, {id: "b", playerOwned: false}, {id: "c", playerOwned: false}];
  assert.deepEqual(opposingSide(rows, true).map(r => r.id), ["b", "c"]);
  assert.deepEqual(opposingSide(rows, false).map(r => r.id), ["a"]);
  assert.deepEqual([hits(12, 12), hits(11, 12), hits(1, 2), hits(20, 20), hits(20, null), hits(15, null)], [true, false, false, true, true, false]);
});

test("distances run edge to edge, in scene units", () => {
  const grid = {size: 100, distance: 1.5};
  assert.equal(edgeDistance({x: 0, y: 0, width: 1, height: 1}, {x: 100, y: 0, width: 1, height: 1}, grid), 0, "side by side");
  assert.equal(edgeDistance({x: 0, y: 0, width: 1, height: 1}, {x: 400, y: 0, width: 2, height: 2}, grid), 4.5);
  assert.equal(edgeDistance(null, {x: 0, y: 0, width: 1, height: 1}, grid), null);
  assert.equal(outOfRange({range: 0, distance: 0, melee: true}), null);
  assert.equal(outOfRange({range: 0, distance: 1.5, melee: true}).key, "RWFTOOLS.Combat.Contact");
  assert.equal(outOfRange({range: 20, distance: 20, melee: false}), null);
  assert.deepEqual(outOfRange({range: 20, distance: 21, melee: false}), {key: "RWFTOOLS.Combat.OutOfRange", distance: 21, range: 20});
  assert.equal(outOfRange({range: 20, distance: null, melee: false}), null, "unknown distance: no block");
});

test("the d20 needed and the d20 announced", () => {
  assert.equal(requiredD20(13, 3), 10);
  assert.equal(requiredD20(5, 8), 2, "a 1 always fails");
  assert.equal(requiredD20(30, 0), 20, "a 20 always succeeds");
  assert.equal(requiredD20(null, 0), null);
  assert.deepEqual(["1", " 20 ", "0", "21", "4.5", "x", ""].map(v => readWhole(v)), [1, 20, null, null, null, null, null]);
  assert.equal(endTurnLabel({pass: 1, passes: 2}), "RWFTOOLS.Combat.EndPass");
  assert.equal(endTurnLabel({pass: 2, passes: 2}), "RWFTOOLS.Combat.EndRound");
});

test("the HUD asks for RWF 2.5.0 or later", () => {
  const configurator = actions => ({getActiveVersionId: () => "v", getRuntimeRuleset: () => ({actions: actions.map(id => ({id}))})});
  assert.equal(hudRuleset({getActiveVersionId: () => null}).reason, "RWFTOOLS.Error.NoRuleset");
  assert.equal(hudRuleset(configurator(["recharger"])).reason, "RWFTOOLS.Error.NotRwfHud");
  assert.equal(hudRuleset(configurator(["reprendre-son-souffle", "recharger", "poursuite-a-pied-continuer"])).reason, "RWFTOOLS.Error.NotRwfHud", "2.4.0 has no exhaustion");
  assert.equal(hudRuleset(configurator(["reprendre-son-souffle", "recharger", "poursuite-a-pied-continuer", "epuisement"])).versionId, "v");
});

test("a pursuit is prepared in the world: who flees, each side, each means", () => {
  assert.deepEqual(readPursuit(null), emptyPursuit());
  assert.deepEqual(readPursuit({phase: "setup", fleeing: "x", participants: [{uuid: "a", role: "x", tokenId: "t"}, {uuid: "a"}, {name: "no uuid"}], cap: -2}),
    {phase: "setup", fleeing: "pnj", cap: 0, participants: [{uuid: "a", name: "", role: "poursuivant", means: "pied", playerOwned: false, tokenId: "t"}]});
  assert.equal(readPursuit({active: true, participants: [{uuid: "a"}]}).phase, "none", "a pursuit of the earlier version is not resumed");
  let p = addParticipants(emptyPursuit(), [{uuid: "pc", name: "Marc", playerOwned: true}, {uuid: "npc", name: "Garde", playerOwned: false}]);
  assert.deepEqual(p.participants.map(x => x.role), ["poursuivant", "fuyard"], "by default the NPCs flee");
  assert.equal(addParticipants(p, [{uuid: "pc", name: "Marc", playerOwned: true}]).participants.length, 2, "no one twice");
  p = setFleeing(p, "pj");
  assert.deepEqual(p.participants.map(x => x.role), ["fuyard", "poursuivant"]);
  assert.equal(addParticipants(p, [{uuid: "pc2", name: "Léa", playerOwned: true}]).participants[2].role, "fuyard", "newcomers follow who flees");
  assert.equal(addParticipants(p, [{uuid: "pc2", name: "Léa", playerOwned: true, role: "poursuivant"}]).participants[2].role, "poursuivant", "a side given wins");
  assert.equal(canLaunch(p), true);
  assert.equal(canLaunch({...p, participants: p.participants.slice(0, 1)}), false, "someone on each side");
  const stored = runningPursuitFlag({cap: 2, participants: [{uuid: "Scene.s.Token.t.Actor.a", combatantId: "c", role: "fuyard"}], outcomes: {"Scene.s.Token.t.Actor.a": "RWFTOOLS.Pursuit.Status.Escaped"}});
  assert.ok(Array.isArray(stored.outcomes), "no uuid as a key: Foundry would split it at its dots");
  assert.deepEqual(readRunningPursuit({...stored, outcomes: [...stored.outcomes, {uuid: "b", key: 3}]}),
    {cap: 2, participants: [{uuid: "Scene.s.Token.t.Actor.a", name: "", role: "fuyard", means: "pied", playerOwned: false, combatantId: "c"}], outcomes: {"Scene.s.Token.t.Actor.a": "RWFTOOLS.Pursuit.Status.Escaped"}});
  assert.deepEqual([speedAdvantage(2, 1), speedAdvantage(-1, -1), speedAdvantage(-1, 1), speedAdvantage(1, null)], [1, 0, -1, 0]);
  assert.equal(pursuitStatus(3, 3).key, "RWFTOOLS.Pursuit.Status.Escaped");
  assert.equal(pursuitStatus(-3, 3).key, "RWFTOOLS.Pursuit.Status.CaughtUp");
  assert.equal(pursuitStatus(-4, 4).done, true, "the bound comes from the Ruleset");
  assert.equal(pursuitStatus(2, 3).done, false);
  const crowd = [{uuid: "f1", role: "fuyard", targetUuid: "x"}, {uuid: "f2", role: "fuyard"}, {uuid: "p1", role: "poursuivant", targetUuid: "f2"}, {uuid: "p2", role: "poursuivant"}, {uuid: "p3", role: "poursuivant", targetUuid: "gone"}];
  assert.deepEqual(assignTargets(crowd).map(p => p.targetUuid), [undefined, undefined, "f2", "f1", "f1"], "a pursuer keeps its quarry, the others go to the least chased");
  assert.deepEqual(assignTargets(crowd, uuid => uuid !== "f2").map(p => p.targetUuid), [undefined, undefined, "f1", "f1", "f1"], "a fugitive out of the race is chased no more");
  assert.deepEqual(assignTargets(crowd, () => false).map(p => p.targetUuid), [undefined, undefined, undefined, undefined, undefined], "no one left to chase");
  const row = (role, done) => ({role, status: {done}});
  assert.equal(pursuitOver([row("fuyard", false), row("poursuivant", false), row("poursuivant", true)]), false);
  assert.equal(pursuitOver([row("fuyard", true), row("poursuivant", false)]), true, "no one left fleeing");
  assert.equal(pursuitOver([row("fuyard", false), row("poursuivant", true)]), true, "no one left pursuing");
  assert.equal(moveAction("risque", "pied"), "poursuite-a-pied-risque");
  assert.equal(moveAction("risque", "auto"), "poursuite-vehicule-risque");
});

test("every word of the HUDs is translated, in French and in English", () => {
  const sources = ["hud-model", "hud-markup", "combat-hud", "pursuit-hud", "hud-common", "test-request"].map(f => readFileSync(new URL(`../src/${f}.mjs`, import.meta.url), "utf8")).join("\n");
  const fixed = [...sources.matchAll(/RWFTOOLS\.[A-Za-z0-9.]*[A-Za-z0-9]/g)].map(m => m[0]);
  const prefixed = {"RWFTOOLS.Combat.Action": ["tirer-rafale", "tirer-full-auto", "recharger", "utiliser-pouvoir", "pouvoir-degats", "pouvoir-soins", "sprinter", "reprendre-son-souffle"],
    "RWFTOOLS.Hud.Mode": ["foundry", "table"], "RWFTOOLS.Pursuit.Move": ["continuer", "risque", "raccourci", "stop"], "RWFTOOLS.Pursuit.Roles": ["poursuivant", "fuyard"], "RWFTOOLS.Pursuit.Side": ["poursuivant", "fuyard"], "RWFTOOLS.Pursuit.Fleeing": ["pnj", "pj"], "RWFTOOLS.Pursuit.MoveHelp": ["continuer", "risque", "raccourci", "stop"]};
  const keys = new Set([...fixed.filter(k => !(k in prefixed)), ...Object.entries(prefixed).flatMap(([p, ids]) => ids.map(id => `${p}.${id}`))]);
  for (const file of ["fr", "en"]) {
    const lang = JSON.parse(readFileSync(new URL(`../lang/${file}.json`, import.meta.url), "utf8")), names = Object.keys(lang);
    for (const key of keys) assert.ok(key in lang, `${file}: ${key}`);
    assert.deepEqual(names.filter(a => names.some(b => b.startsWith(`${a}.`))), [], "Foundry merges dotted keys: none can be both a word and a group");
  }
});

test("the HUD markup escapes names and disables what cannot be done", () => {
  const t = k => k === "RWFTOOLS.Combat.TurnOf" ? "Tour de {name}" : k;
  const html = renderCombatHTML({round: 2, pass: 1, passes: 2, myTurn: false, turnName: "<b>Bob</b>", name: "Marc", mode: "foundry", cover: 0, target: null, canEndTurn: false,
    combatant: {pools: {vitalite: {value: 3, max: 7}}, defense: 11, attacks: {used: 0, best: 2}, efforts: 1,
      cards: [{kind: "weapon", key: "w", name: "Pistolet", details: [], buttons: [{actionId: "attaquer", label: "RWFTOOLS.Combat.Shoot", allowed: false, reason: "Chargeur vide"}]}]}}, t);
  assert.match(html, /&lt;b&gt;Bob&lt;\/b&gt;/);
  assert.match(html, /data-rwf-action="attaquer" data-rwf-content="w" disabled title="Chargeur vide"/);
  assert.doesNotMatch(html, /data-rwf-end-turn/, "not this user's turn");
  const stage = pending => renderCombatHTML({round: 1, pass: 1, passes: 1, name: "Marc", mode: "table", cover: 0, target: null, combatant: {pools: {}, attacks: {used: 0, best: 1}, efforts: 0, cards: []}, pending}, t);
  assert.match(stage({stage: "d20", label: "Tirer", damage: true, required: 10}), /name="de"/);
  assert.doesNotMatch(stage({stage: "d20", label: "Tirer", damage: true, required: 10}), /name="degats"/, "damage only once it hits");
  const damage = stage({stage: "damage", label: "Tirer", damage: true, de: 20, dice: "2d6"});
  assert.match(damage, /name="degats"[^>]*required/);
  assert.match(damage, /\(2d6\)/);
  assert.match(damage, /RWFTOOLS\.Hud\.Critical/);
  assert.match(renderCombatHTML({round: 1, pass: 1, passes: 1, name: "M", mode: "table", cover: 0, target: null, combatant: {pools: {}, attacks: {used: 0, best: 1}, efforts: 0, cards: []}}, t), /aria-checked="true" class="rwf-hud__mode-option rwf-hud__mode-option--on"/);
  assert.match(renderPursuitHTML({phase: "none", isGM: true}, t), /data-rwf-start/);
  assert.doesNotMatch(renderPursuitHTML({phase: "none", isGM: false}, t), /data-rwf-start/);
  const setup = {phase: "setup", isGM: true, fleeing: "pnj", cap: 0, fleeBonus: 2, canLaunch: false, rows: [{uuid: "a", name: "<i>Garde</i>", role: "fuyard", means: "pied", vehicles: []}]};
  assert.match(renderPursuitHTML(setup, t), /data-rwf-launch disabled/, "no pursuer yet");
  assert.match(renderPursuitHTML(setup, t), /&lt;i&gt;Garde/);
  assert.match(renderPursuitHTML(setup, t), /data-rwf-role="a" data-rwf-to="poursuivant"/);
  assert.doesNotMatch(renderPursuitHTML({...setup, isGM: false}, t), /data-rwf-launch/, "players wait for the GM");
});

test("outside its turn a combatant's buttons are all off, for one reason shown once", async () => {
  const {waitForTurn} = await import("../src/hud-model.mjs");
  const {renderCombatHTML} = await import("../src/hud-markup.mjs");
  const combatant = {pools: {}, defense: 10, attacks: {used: 0, best: 1}, efforts: 0, cards: [{kind: "weapon", key: "p", name: "Pistolet", details: [], buttons: [{actionId: "attaquer", label: "RWFTOOLS.Combat.Shoot", allowed: true}]}]};
  const waiting = waitForTurn(combatant);
  assert.equal(waiting.cards[0].buttons[0].allowed, false);
  assert.equal(combatant.cards[0].buttons[0].allowed, true, "the view read stays as it was");
  const html = renderCombatHTML({combatant: waiting, round: 1, pass: 1, passes: 1, name: "Marc", turnName: "Garde", cover: 0, mode: "foundry"}, key => key);
  assert.equal(html.match(/RWFTOOLS\.Combat\.WaitTurn/g).length, 2, "the hint once, the button's title once");
  assert.match(html, /data-rwf-action="attaquer"[^>]* disabled/);
});
