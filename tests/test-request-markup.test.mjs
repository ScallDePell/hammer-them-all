import test from "node:test";
import assert from "node:assert/strict";
import {renderRequestHTML, renderPromptHTML} from "../src/test-request-markup.mjs";

const t = key => key;
const skills = [{id: "vigilance", label: "Vigilance"}], dds = [{id: "dd-facile", label: "Facile (10)"}, {id: "dd-standard", label: "Standard (13)"}];
const rows = [{userId: "b", userName: "Bruno <b>", actorUuid: "Actor.1", actorName: "Marc", img: "a.webp"}];
const request = {requestId: "r1", actorName: "Marc", skillLabel: "Vigilance", ddLabel: "Standard (13)"};

test("GM window: players to tick, then the skill and the DD on one line, Send disabled until complete", () => {
  const html = renderRequestHTML({rows, selected: new Set(), skills, dds, skillId: null, ddId: "dd-standard", pending: new Map(), canSend: false}, t);
  assert.match(html, /data-rwf-pick="Actor\.1"/);
  assert.match(html, /Bruno &lt;b&gt;/);
  assert.ok(html.indexOf("rwf-request__players") < html.indexOf("rwf-request__choice"));
  assert.match(html, /<div class="rwf-request__choice">[\s\S]*data-rwf-skill[\s\S]*data-rwf-dd[\s\S]*<\/div>/);
  assert.match(html, /value="dd-standard" selected/);
  assert.match(html, /data-rwf-send disabled/);
  assert.match(renderRequestHTML({rows, selected: new Set(["Actor.1"]), skills, dds, skillId: "vigilance", ddId: "dd-standard", pending: new Map(), canSend: true}, t), /data-rwf-send>/);
});

test("GM window: requests in progress, with Cancel while waiting", () => {
  const pending = new Map([["r1", {request, status: "waiting"}], ["r2", {request: {...request, requestId: "r2"}, status: "done", summary: "17 → 21 · Réussite"}]]);
  const html = renderRequestHTML({rows: [], selected: new Set(), skills, dds, skillId: null, ddId: null, pending, canSend: false}, t);
  assert.match(html, /RWFTOOLS\.Request\.NoPlayers/);
  assert.match(html, /data-rwf-cancel="r1"/);
  assert.doesNotMatch(html, /data-rwf-cancel="r2"/);
  assert.match(html, /17 → 21 · Réussite/);
  assert.match(html, /data-rwf-clear/, "the GM empties the list");
  assert.doesNotMatch(renderRequestHTML({rows: [], selected: new Set(), skills, dds, skillId: null, ddId: null, pending: new Map(), canSend: false}, t), /data-rwf-clear/, "nothing to empty");
});

test("player window: Foundry dice or the table d20, then what was sent", () => {
  const html = renderPromptHTML({request}, t);
  assert.match(html, /data-rwf-roll/);
  assert.match(html, /type="number" min="1" max="20"/);
  assert.match(html, /data-rwf-submit/);
  assert.match(renderPromptHTML({request, error: "RWFTOOLS.Prompt.Invalid"}, t), /RWFTOOLS\.Prompt\.Invalid/);
  const sent = renderPromptHTML({request, sent: 14}, t);
  assert.match(sent, /RWFTOOLS\.Prompt\.Sent 14/);
  assert.doesNotMatch(sent, /data-rwf-roll/);
});
