// Screenshots of the two windows' markup with the module's stylesheet, in a stand-in Foundry frame.
// Usage: node qa/render-windows.mjs <outDir>   (RTA_CHROMIUM / PLAYWRIGHT_CORE as for Rule Them'All's QA)
import {readFileSync, mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {renderRequestHTML, renderPromptHTML} from "../src/test-request-markup.mjs";

const out = process.argv[2] ?? "qa-out";
mkdirSync(out, {recursive: true});
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const fr = JSON.parse(readFileSync(new URL("../lang/fr.json", import.meta.url)));
const t = key => fr[key] ?? key, css = readFileSync(new URL("../styles/rwf-tools.css", import.meta.url), "utf8");
const skills = ["Athlétisme", "Discrétion", "Vigilance", "Investigation"].map(label => ({id: label, label}));
const dds = [["dd-facile", "Facile (10)"], ["dd-standard", "Standard (13)"], ["dd-difficile", "Difficile (16)"], ["dd-extreme", "Extrême (19)"], ["dd-heroique", "Héroïque (22)"]].map(([id, label]) => ({id, label}));
const rows = [["Alice", "Léa Martin"], ["Bruno", "Marc Durand"], ["Chloé", "Inès Garcia"]].map(([userName, actorName], i) => ({userId: `u${i}`, userName, actorUuid: `Actor.${i}`, actorName, img: null}));
const request = {requestId: "r1", actorName: "Marc Durand", skillLabel: "Vigilance", ddLabel: "Standard (13)"};
const pending = new Map([["r1", {request, status: "waiting"}], ["r2", {request: {...request, requestId: "r2", actorName: "Léa Martin"}, status: "done", summary: "17 (jet sur table) → 21 · Réussite"}]]);
const frame = (title, body, cls, width) => `<section class="application rwf-tools-app ${cls}" style="width:${width}px"><header class="window-header"><h1 class="window-title">${title}</h1><button data-action="close">✕</button></header><div class="window-content">${body}</div></section>`;
const page = body => `<!doctype html><meta charset="utf-8"><style>body{font-family:sans-serif;background:#2b2b2b;color:#eee;padding:16px;display:flex;gap:24px;align-items:flex-start}
.application{background:#1f1f1f;border:1px solid #555;border-radius:6px}.window-header{display:flex;justify-content:space-between;padding:4px 8px;background:#111}.window-title{font-size:14px;margin:0}
select,input,button{font:inherit;padding:4px}button{width:100%}${css}</style>${body}`;
const browser = await chromium.launch({executablePath: process.env.RTA_CHROMIUM ?? "/opt/pw-browsers/chromium"});
const tab = await browser.newPage({viewport: {width: 1000, height: 640}});
await tab.setContent(page(
  frame(t("RWFTOOLS.Request.Title"), renderRequestHTML({rows, selected: new Set(["Actor.1"]), skills, dds, skillId: "Vigilance", ddId: "dd-standard", pending, canSend: true}, t), "", 420) +
  frame(t("RWFTOOLS.Prompt.Title"), renderPromptHTML({request, error: "RWFTOOLS.Prompt.Invalid"}, t), "rwf-test-prompt", 340)));
await tab.screenshot({path: `${out}/fenetres.png`});
const closeHidden = await tab.$eval(".rwf-test-prompt [data-action=close]", el => getComputedStyle(el).display === "none");
console.log(JSON.stringify({closeHidden}));
await browser.close();
