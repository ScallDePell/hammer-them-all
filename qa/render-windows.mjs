// Screenshots of the two windows' markup with the module's stylesheet, in a stand-in Foundry frame.
// Usage: node qa/render-windows.mjs <outDir>   (RTA_CHROMIUM / PLAYWRIGHT_CORE as for Rule Them'All's QA)
import {readFileSync, mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {renderRequestHTML, renderPromptHTML} from "../src/test-request-markup.mjs";
import {renderCombatHTML, renderPursuitHTML} from "../src/hud-markup.mjs";

const out = process.argv[2] ?? "qa-out";
mkdirSync(out, {recursive: true});
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const fr = JSON.parse(readFileSync(new URL("../lang/fr.json", import.meta.url)));
// RTA_FOUNDRY_CSS: Foundry's own stylesheet, for its theme variables and buttons.
const foundryCss = process.env.RTA_FOUNDRY_CSS ? readFileSync(process.env.RTA_FOUNDRY_CSS, "utf8") : "";
const t = key => fr[key] ?? key, css = readFileSync(new URL("../styles/rwf-tools.css", import.meta.url), "utf8");
const skills = ["Athlétisme", "Discrétion", "Vigilance", "Investigation"].map(label => ({id: label, label}));
const dds = [["dd-facile", "Facile (10)"], ["dd-standard", "Standard (13)"], ["dd-difficile", "Difficile (16)"], ["dd-extreme", "Extrême (19)"], ["dd-heroique", "Héroïque (22)"]].map(([id, label]) => ({id, label}));
const rows = [["Alice", "Léa Martin"], ["Bruno", "Marc Durand"], ["Chloé", "Inès Garcia"]].map(([userName, actorName], i) => ({userId: `u${i}`, userName, actorUuid: `Actor.${i}`, actorName, img: null}));
const request = {requestId: "r1", actorName: "Marc Durand", skillLabel: "Vigilance", ddLabel: "Standard (13)"};
const pending = new Map([["r1", {request, status: "waiting"}], ["r2", {request: {...request, requestId: "r2", actorName: "Léa Martin"}, status: "done", summary: "17 (jet sur table) → 21 · Réussite"}]]);
const frame = (title, body, cls, width) => `<section class="application themed theme-dark rwf-tools-app ${cls}" style="width:${width}px"><header class="window-header"><h1 class="window-title">${title}</h1><button data-action="close">✕</button></header><div class="window-content">${body}</div></section>`;
const page = body => `<!doctype html><meta charset="utf-8"><style>:root{--color-border:#666;--color-border-highlight:#ff6400;--color-shadow-highlight:#ff6400;--color-level-error:#e05050;--color-level-warning:#e0b050;--color-level-success:#60c060;--font-size-11:11px;--font-size-12:12px;--font-size-14:14px}body{font-family:sans-serif;background:#2b2b2b;color:#eee;padding:16px;display:flex;gap:24px;align-items:flex-start}
.application{background:#1f1f1f;border:1px solid #555;border-radius:6px}.window-header{display:flex;justify-content:space-between;padding:4px 8px;background:#111}.window-title{font-size:14px;margin:0}
select,input,button{font:inherit;padding:4px}button{width:100%}</style><style>${foundryCss}</style><style>${css}</style><style>.application{position:relative;flex:none;max-height:none}</style><body class="theme-dark">${body}</body>`;
const browser = await chromium.launch({executablePath: process.env.RTA_CHROMIUM ?? "/opt/pw-browsers/chromium"});
const tab = await browser.newPage({viewport: {width: 1300, height: 640}});
await tab.setContent(page(
  frame(t("RWFTOOLS.Request.Title"), renderRequestHTML({rows, selected: new Set(["Actor.1"]), skills, dds, skillId: "Vigilance", ddId: "dd-standard", pending, canSend: true}, t), "", 420) +
  frame(t("RWFTOOLS.Prompt.Title"), renderPromptHTML({request, error: "RWFTOOLS.Prompt.Invalid"}, t), "rwf-test-prompt", 340)));
await tab.screenshot({path: `${out}/fenetres.png`});
const closeHidden = await tab.$eval(".rwf-test-prompt [data-action=close]", el => getComputedStyle(el).display === "none");
console.log(JSON.stringify({closeHidden}));

// The two HUDs, as a player sees them in a fight and in a chase.
const pools = {vitalite: {value: 5, max: 7}, endurance: {value: 6, max: 7}, energie: {value: 7, max: 7}};
const shoot = {actionId: "attaquer", label: "RWFTOOLS.Combat.Shoot", allowed: true, damage: true, d20: true, needsTarget: true, required: 10};
const combat = {round: 2, pass: 1, passes: 2, myTurn: true, turnName: "Marc Durand", name: "Marc Durand", mode: "table", cover: 2, canEndTurn: true, endLabel: "RWFTOOLS.Combat.EndPass",
  target: {uuid: "g", name: "Garde du corps", distance: 7.5},
  combatant: {pools, defense: 12, attacks: {used: 0, best: 2}, efforts: 1, cards: [
    {kind: "unarmed", key: "unarmed", name: "RWFTOOLS.Combat.Unarmed", required: 12, details: [{label: "RWFTOOLS.Combat.Damage", value: "1d4 + Force"}],
      buttons: [{actionId: "attaquer-mains-nues", label: "RWFTOOLS.Combat.Attack", allowed: false, range: {key: "RWFTOOLS.Combat.Contact", distance: 7.5}}]},
    {kind: "weapon", key: "fa", name: "Fusil d'assaut", required: 10, perRound: 2, ammo: {loaded: 2, magazine: 30, reserve: 60},
      details: [{label: "RWFTOOLS.Combat.Damage", value: "2d8"}, {label: "RWFTOOLS.Combat.Range", value: "60 m"}, {label: "RWFTOOLS.Combat.Piercing", value: "1"}],
      buttons: [shoot, {...shoot, actionId: "tirer-rafale", label: "RWFTOOLS.Combat.Action.tirer-rafale", required: 8, allowed: false, reason: "Munitions pour une rafale"}, {actionId: "recharger", label: "RWFTOOLS.Combat.Action.recharger", allowed: true}]},
    {kind: "power", key: "tk", name: "Télékinésie", latent: false, required: 9, details: [{label: "RWFTOOLS.Combat.Cost", value: "1"}, {label: "RWFTOOLS.Combat.DD", value: "13"}, {label: "RWFTOOLS.Combat.Dice", value: "1d6"}],
      buttons: [{actionId: "pouvoir-degats", label: "RWFTOOLS.Combat.Action.pouvoir-degats", allowed: true, required: 9}]},
    {kind: "physical", key: "physical", name: "RWFTOOLS.Combat.Physical", details: [], buttons: [{actionId: "sprinter", label: "RWFTOOLS.Combat.Action.sprinter", allowed: true}, {actionId: "reprendre-son-souffle", label: "RWFTOOLS.Combat.Action.reprendre-son-souffle", allowed: false, reason: "Aucune attaque ce round"}]}]},
  pending: {stage: "damage", de: 14, dice: "2d8", label: "RWFTOOLS.Combat.Shoot", subject: "Fusil d'assaut", required: 10, damage: true}};
const move = (m, allowed = true) => ({move: m, label: `RWFTOOLS.Pursuit.Move.${m}`, allowed});
const car = {key: "auto", name: "Citadine", speed: 1};
const status = gauge => gauge >= 3 ? {key: "RWFTOOLS.Pursuit.Status.Escaped", done: true} : gauge <= -3 ? {key: "RWFTOOLS.Pursuit.Status.CaughtUp", done: true} : {key: "RWFTOOLS.Pursuit.Status.Running", done: false};
const ENDS = ["RWFTOOLS.Pursuit.Ends.CaughtUp", "RWFTOOLS.Pursuit.Ends.Escaped"];
const runner = (uuid, name, gauge, extra) => ({uuid, name, role: "fuyard", gauge, means: "pied", vehicles: [car], vehicle: null, speed: -1, advantage: 0, endurance: {value: 6, max: 7}, status: status(gauge), ends: ENDS, active: false, ...extra});
const chaser = (uuid, name, target, extra) => ({uuid, name, role: "poursuivant", gauge: null, targetUuid: target?.uuid, target, means: "pied", vehicles: [car], vehicle: null, speed: -1, advantage: 0, endurance: {value: 6, max: 7}, status: {key: "RWFTOOLS.Pursuit.Status.Running", done: false}, ends: ENDS, active: false, ...extra});
const guard = {uuid: "g", name: "Garde du corps", gauge: -2}, driver = {uuid: "c", name: "Chauffeur", gauge: 1};
const lea = chaser("l", "Léa Martin", guard, {rank: 3, means: "auto", vehicle: car, speed: 1, advantage: 1, endurance: null, active: true, playable: true, targets: [guard, driver],
  moves: [["continuer", 0, 11], ["risque", -2, 13], ["raccourci", 2, 9], ["stop", undefined, null]].map(([m, modifier, required]) => ({...move(m), modifier, required}))});
const marc = chaser("m", "Marc Durand", driver, {rank: 4, endurance: {value: 0, max: 7}, status: {key: "RWFTOOLS.Pursuit.Status.Exhausted", done: true}});
const ines = chaser("i", "Inès Garcia", driver, {rank: 5});
const rowsRun = [runner("g", "Garde du corps", -2, {rank: 1, advantage: -1, chasers: [lea]}), runner("c", "Chauffeur", 1, {rank: 2, means: "auto", vehicle: car, speed: 1, advantage: 1, chasers: [ines]}), lea, marc, ines];
const others = [{uuid: "x", name: "Passant"}, {uuid: "y", name: "Chien errant"}];
const pursuits = [{id: "a", label: "Garde du corps, Chauffeur", current: true}, {id: "b", label: "Passant"}];
const split = {picked: ["c", "i"], canSplit: true};
const chase = {pursuits, split, phase: "running", round: 2, bound: 3, dd: 13, available: others, cap: 0, rows: rowsRun, sides: {fuyard: rowsRun.slice(0, 2), poursuivant: rowsRun.slice(2)}, current: lea, over: false, myTurn: true};
const prepared = {phase: "setup", isGM: true, available: others, fleeing: "pnj", cap: 0, fleeBonus: 2, canLaunch: true, fugitives: [guard, driver],
  rows: [runner("g", "Garde du corps", 0), runner("c", "Chauffeur", 0, {means: "auto", vehicle: car}), chaser("l", "Léa Martin", null, {targetUuid: "g"}), chaser("m", "Marc Durand", null, {targetUuid: "c"})]};
await tab.setViewportSize({width: 1000, height: 1100});
await tab.setContent(page(frame(t("RWFTOOLS.Combat.Title"), renderCombatHTML(combat, t), "rwf-hud-app", 400) +
  frame(t("RWFTOOLS.Pursuit.Title"), renderPursuitHTML({...chase, isGM: true, mode: "foundry", settingsOpen: true}, t), "rwf-hud-app", 440)));
await tab.screenshot({path: `${out}/huds.png`, fullPage: true});
await tab.setContent(page(frame(t("RWFTOOLS.Combat.Title"), renderCombatHTML({...combat, pending: null, mode: "foundry", targets: [{id: "1", name: "Garde du corps", current: true, distance: 7.5}, {id: "2", name: "Chien", distance: 3}]}, t), "rwf-hud-app", 400) +
  frame(t("RWFTOOLS.Pursuit.Title"), renderPursuitHTML({...chase, isGM: false, mode: "table", pending: {label: "RWFTOOLS.Pursuit.Move.risque", subject: "Léa Martin"}}, t), "rwf-hud-app", 440)));
await tab.screenshot({path: `${out}/huds-2.png`, fullPage: true});
// The GM prepares the chase; a player's view of someone else's turn, in a wide window (the two sides side by side).
await tab.setContent(page(frame(t("RWFTOOLS.Pursuit.Title"), renderPursuitHTML(prepared, t), "rwf-hud-app", 440) +
  frame(t("RWFTOOLS.Pursuit.Title"), renderPursuitHTML({...chase, isGM: false, myTurn: false, mode: "foundry", current: {...lea, moves: []}}, t), "rwf-hud-app", 760)));
await tab.screenshot({path: `${out}/poursuite.png`, fullPage: true});
await browser.close();
