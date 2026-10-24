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
  const progress = waiting.length ? `<section class="rwf-request__pending"><header class="rwf-request__pending-head"><h3>${e(t("RWFTOOLS.Request.Pending"))}</h3>
      <button type="button" data-rwf-clear title="${e(t("RWFTOOLS.Request.ClearHint"))}">${e(t("RWFTOOLS.Request.Clear"))}</button></header><ul>${waiting.map(p => `<li class="rwf-request__status rwf-request__status--${e(p.status)}">
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
      <label>${e(t("RWFTOOLS.Prompt.Manual"))}<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="1–20" data-rwf-d20></label>
      <button type="button" data-rwf-submit>${e(t("RWFTOOLS.Prompt.Submit"))}</button>
    </div>
    ${error ? `<p class="rwf-prompt__error">${e(t(error))}</p>` : ""}</div>`;
}

/** Chat card of a requested test, read at a glance: the d20 (rolled with the Foundry dice or on the table), plus the
 * skill bonus, the total against the DD, and the outcome. */
export function renderTestCardHTML({actorName, skillLabel, ddLabel, dd, d20, manual, total, outcome = "", success = null}, t) {
  const bonus = Number.isFinite(Number(total)) ? Number(total) - Number(d20) : null;
  const signed = n => `${n < 0 ? "−" : "+"} ${Math.abs(n)}`;
  const tone = success === true ? " rwf-card__outcome--good" : success === false ? " rwf-card__outcome--bad" : "";
  return `<div class="rwf-card">
    <header class="rwf-card__head"><strong>${e(skillLabel)}</strong><span>${e(t("RWFTOOLS.Request.DD"))} ${e(ddLabel)}</span></header>
    <p class="rwf-card__who">${e(actorName)} · ${e(t("RWFTOOLS.Prompt.Title"))}</p>
    <dl class="rwf-card__lines">
      <dt>${e(t("RWFTOOLS.Card.D20"))}</dt><dd>${e(d20)} <span class="rwf-card__how">(${e(t(manual ? "RWFTOOLS.Card.Table" : "RWFTOOLS.Card.Foundry"))})</span></dd>
      ${bonus === null ? "" : `<dt>${e(t("RWFTOOLS.Card.Bonus"))}</dt><dd>${e(signed(bonus))}</dd>`}
      <dt>${e(t("RWFTOOLS.Card.Total"))}</dt><dd><strong>${e(total ?? "?")}</strong> ${e(t("RWFTOOLS.Card.Against"))} ${e(dd)}</dd>
    </dl>
    ${outcome ? `<p class="rwf-card__outcome${tone}">${e(outcome)}</p>` : ""}</div>`;
}
