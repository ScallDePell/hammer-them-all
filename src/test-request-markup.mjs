/* Markup of the two windows, from plain data, so it can be checked without Foundry. t: localize a key. */
import {escapeHTML as e} from "./html.mjs";

const option = (o, selected) => `<option value="${e(o.id)}"${o.id === selected ? " selected" : ""}>${e(o.label)}</option>`;

/** GM window: the players to ask, then the skill and the DD on one line, Send, and the requests in progress. */
export function renderRequestHTML({rows, selected, skills, dds, skillId, ddId, pending, canSend, reason = null}, t) {
  if (reason) return `<p class="rwf-request__empty">${e(t(reason))}</p>`;
  const players = rows.length
    ? `<ul class="rwf-request__players">${rows.map(row => `<li><label class="rwf-request__player">
        <input type="checkbox" data-rwf-pick="${e(row.actorUuid)}"${selected.has(row.actorUuid) ? " checked" : ""}>
        ${row.img ? `<img src="${e(row.img)}" alt="">` : ""}
        <span class="rwf-request__actor">${e(row.actorName)}</span>
        <span class="rwf-request__user">${e(row.userName)}</span></label></li>`).join("")}</ul>`
    : `<p class="rwf-request__empty">${e(t("RWFTOOLS.Request.NoPlayers"))}</p>`;
  const waiting = [...pending.values()];
  const progress = waiting.length ? `<section class="rwf-request__pending"><h3>${e(t("RWFTOOLS.Request.Pending"))}</h3><ul>${waiting.map(p => `<li class="rwf-request__status rwf-request__status--${e(p.status)}">
      <span>${e(p.request.actorName)} · ${e(p.request.skillLabel)} · ${e(p.request.ddLabel)}</span>
      <span>${e(p.status === "waiting" ? t("RWFTOOLS.Request.Waiting") : p.summary)}</span>
      ${p.status === "waiting" ? `<button type="button" data-rwf-cancel="${e(p.request.requestId)}">${e(t("RWFTOOLS.Request.Cancel"))}</button>` : ""}</li>`).join("")}</ul></section>` : "";
  return `<div class="rwf-request">
    <h3>${e(t("RWFTOOLS.Request.Players"))}</h3>${players}
    <div class="rwf-request__choice">
      <label>${e(t("RWFTOOLS.Request.Skill"))}<select data-rwf-skill><option value="">—</option>${skills.map(s => option(s, skillId)).join("")}</select></label>
      <label>${e(t("RWFTOOLS.Request.DD"))}<select data-rwf-dd>${dds.map(d => option(d, ddId)).join("")}</select></label>
    </div>
    <button type="button" data-rwf-send${canSend ? "" : " disabled"}><i class="fa-solid fa-dice-d20"></i> ${e(t("RWFTOOLS.Request.Send"))}</button>
    ${progress}</div>`;
}

/** Player window: what the GM asks, then roll the Foundry dice or type the d20 rolled on the table. */
export function renderPromptHTML({request, sent = null, error = null}, t) {
  const asked = `<p class="rwf-prompt__asked"><strong>${e(request.actorName)}</strong> · ${e(request.skillLabel)} · ${e(t("RWFTOOLS.Request.DD"))} ${e(request.ddLabel)}</p>`;
  if (sent !== null) return `<div class="rwf-prompt">${asked}<p class="rwf-prompt__sent">${e(t("RWFTOOLS.Prompt.Sent"))} ${e(sent)}</p></div>`;
  return `<div class="rwf-prompt">${asked}
    <button type="button" data-rwf-roll><i class="fa-solid fa-dice-d20"></i> ${e(t("RWFTOOLS.Prompt.Roll"))}</button>
    <div class="rwf-prompt__manual">
      <label>${e(t("RWFTOOLS.Prompt.Manual"))}<input type="number" min="1" max="20" step="1" inputmode="numeric" data-rwf-d20></label>
      <button type="button" data-rwf-submit>${e(t("RWFTOOLS.Prompt.Submit"))}</button>
    </div>
    ${error ? `<p class="rwf-prompt__error">${e(t(error))}</p>` : ""}</div>`;
}
