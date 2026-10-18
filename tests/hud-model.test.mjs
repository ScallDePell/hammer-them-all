import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {yourTurn, targetingUser, opposingSide, hits, followedCombatant, edgeDistance, outOfRange, requiredD20, readWhole, readPursuit, addParticipants, emptyPursuit, speedAdvantage, pursuitStatus, endTurnLabel, moveAction, hudRuleset} from "../src/hud-model.mjs";
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

test("the GM reads a player character's targets from its player, and picks among the other side", () => {
  const users = [{id: "gm", isGM: true, active: true, owner: true}, {id: "p1", isGM: false, active: true, owner: true, characterUuid: "Actor.other"},
    {id: "p2", isGM: false, active: true, owner: true, characterUuid: "Actor.pc"}, {id: "p3", isGM: false, active: false, owner: true, characterUuid: "Actor.pc"}];
  assert.equal(targetingUser({viewerId: "gm", isGM: true, playerOwned: true, actorUuid: "Actor.pc", users}), "p2", "the connected player whose character it is");
  assert.equal(targetingUser({viewerId: "gm", isGM: true, playerOwned: false, actorUuid: "Actor.npc", users}), "gm", "an NPC: the GM's own");
  assert.equal(targetingUser({viewerId: "gm", isGM: true, playerOwned: true, actorUuid: "Actor.pc", users: users.slice(0, 1)}), "gm", "no player connected");
  assert.equal(targetingUser({viewerId: "p2", isGM: false, playerOwned: true, actorUuid: "Actor.pc", users}), "p2");
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

test("the HUD asks for RWF 2.2.0 or later", () => {
  const configurator = actions => ({getActiveVersionId: () => "v", getRuntimeRuleset: () => ({actions: actions.map(id => ({id}))})});
  assert.equal(hudRuleset({getActiveVersionId: () => null}).reason, "RWFTOOLS.Error.NoRuleset");
  assert.equal(hudRuleset(configurator(["recharger"])).reason, "RWFTOOLS.Error.NotRwfHud");
  assert.equal(hudRuleset(configurator(["reprendre-son-souffle", "recharger", "poursuite-a-pied-continuer"])).versionId, "v");
});

test("a pursuit kept in the world: participants, roles, reference and outcomes", () => {
  assert.deepEqual(readPursuit(null), emptyPursuit());
  assert.deepEqual(readPursuit({active: true, participants: [{uuid: "a", role: "x"}, {uuid: "a"}, {name: "no uuid"}], referenceUuid: "z", cap: -2}),
    {active: true, referenceUuid: null, cap: 0, participants: [{uuid: "a", name: "", role: "poursuivant", means: "pied"}]});
  const p = addParticipants(emptyPursuit(), [{uuid: "pc", name: "Marc", playerOwned: true}, {uuid: "npc", name: "Garde", playerOwned: false}]);
  assert.deepEqual(p.participants.map(x => x.role), ["poursuivant", "fuyard"]);
  assert.equal(p.referenceUuid, "npc");
  assert.equal(addParticipants(p, [{uuid: "pc", name: "Marc", playerOwned: true}]).participants.length, 2, "no one twice");
  assert.deepEqual([speedAdvantage(2, 1), speedAdvantage(-1, -1), speedAdvantage(-1, 1), speedAdvantage(1, null)], [1, 0, -1, 0]);
  assert.equal(pursuitStatus("fuyard", 3).key, "RWFTOOLS.Pursuit.Status.Escaped");
  assert.equal(pursuitStatus("poursuivant", 3).key, "RWFTOOLS.Pursuit.Status.Caught");
  assert.equal(pursuitStatus("fuyard", -3).key, "RWFTOOLS.Pursuit.Status.CaughtUp");
  assert.equal(pursuitStatus("poursuivant", -3).done, true);
  assert.equal(pursuitStatus("poursuivant", 2).done, false);
  assert.equal(moveAction("risque", "pied"), "poursuite-a-pied-risque");
  assert.equal(moveAction("risque", "auto"), "poursuite-vehicule-risque");
});

test("every word of the HUDs is translated, in French and in English", () => {
  const sources = ["hud-model", "hud-markup", "combat-hud", "pursuit-hud", "hud-common", "test-request"].map(f => readFileSync(new URL(`../src/${f}.mjs`, import.meta.url), "utf8")).join("\n");
  const fixed = [...sources.matchAll(/RWFTOOLS\.[A-Za-z0-9.]*[A-Za-z0-9]/g)].map(m => m[0]);
  const prefixed = {"RWFTOOLS.Combat.Action": ["tirer-rafale", "tirer-full-auto", "recharger", "utiliser-pouvoir", "pouvoir-degats", "pouvoir-soins", "sprinter", "reprendre-son-souffle"],
    "RWFTOOLS.Hud.Mode": ["foundry", "table"], "RWFTOOLS.Pursuit.Move": ["continuer", "risque", "raccourci", "stop"], "RWFTOOLS.Pursuit.Roles": ["poursuivant", "fuyard"]};
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
  assert.match(renderPursuitHTML({active: false, isGM: true}, t), /data-rwf-start/);
  assert.doesNotMatch(renderPursuitHTML({active: false, isGM: false}, t), /data-rwf-start/);
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
