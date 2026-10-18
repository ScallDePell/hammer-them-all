/* Markup of the combat and pursuit HUDs, from the plain views of hud-model.mjs, so it can be checked without Foundry.
   t: localize a key (a Ruleset name passes through unchanged). */
import {escapeHTML as e} from "./html.mjs";

const words = (t, key) => e(t(key));
const fmt = (t, key, data) => Object.entries(data).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), t(key));
const sign = n => n > 0 ? `+${n}` : String(n);

/** Foundry's dice or the dice rolled on the table, chosen on each client: the one in use is filled. */
function modeSwitch(mode, t) {
  const icons = {foundry: "fa-dice-d20", table: "fa-hand"};
  return `<div class="rwf-hud__mode" role="radiogroup" aria-label="${words(t, "RWFTOOLS.Hud.Dice")}"><span class="rwf-hud__mode-label">${words(t, "RWFTOOLS.Hud.Dice")}</span>${["foundry", "table"].map(m =>
    `<button type="button" role="radio" data-rwf-mode="${m}" aria-checked="${m === mode}" class="rwf-hud__mode-option${m === mode ? " rwf-hud__mode-option--on" : ""}"><i class="fa-solid ${icons[m]}"></i> ${words(t, `RWFTOOLS.Hud.Mode.${m}`)}${m === mode ? ' <i class="fa-solid fa-check"></i>' : ""}</button>`).join("")}</div>`;
}

/** TABLE mode: the d20 the player read on the table, then, when it hits, the total of the damage (or healing) dice. */
function tableForm(pending, t, error) {
  if (!pending) return "";
  const damage = pending.stage === "damage";
  const title = `<strong>${e(t(pending.label))}</strong>${pending.subject ? ` · ${e(t(pending.subject))}` : ""}${!damage && pending.required ? ` · ${e(fmt(t, "RWFTOOLS.Combat.Required", {n: pending.required}))}` : ""}`;
  const field = damage
    ? `<p class="rwf-hud__hit">${e(fmt(t, "RWFTOOLS.Hud.Hit", {d20: pending.de}))}${pending.de === 20 ? ` ${words(t, "RWFTOOLS.Hud.Critical")}` : ""}</p>
    <label>${words(t, pending.heal ? "RWFTOOLS.Hud.Healing" : "RWFTOOLS.Hud.DamageDice")}${pending.dice ? ` (${e(t(pending.dice))})` : ""}<input type="number" name="degats" min="0" step="1" inputmode="numeric" required data-rwf-autofocus></label>`
    : `<label>${words(t, "RWFTOOLS.Hud.D20")}<input type="number" name="de" min="1" max="20" step="1" inputmode="numeric" required data-rwf-autofocus></label>`;
  return `<form class="rwf-hud__table" data-rwf-table>
    <p class="rwf-hud__table-title">${title}</p>
    ${field}
    ${error ? `<p class="rwf-hud__error">${e(t(error))}</p>` : ""}
    <div class="rwf-hud__row"><button type="submit">${words(t, "RWFTOOLS.Hud.Validate")}</button><button type="button" data-rwf-table-cancel>${words(t, "RWFTOOLS.Hud.Cancel")}</button></div></form>`;
}

const message = (text, t) => text ? `<p class="rwf-hud__message" role="status">${e(t(text))}</p>` : "";
const pool = (label, p) => `<span class="rwf-hud__stat"><span>${label}</span><strong>${p ? `${e(p.value)}/${e(p.max)}` : "—"}</strong></span>`;

function actionButton(b, t, cardKey) {
  const reason = b.range ? fmt(t, b.range.key, b.range) : b.reason ? t(b.reason) : "";
  return `<button type="button" class="rwf-hud__action" data-rwf-action="${e(b.actionId)}" data-rwf-content="${e(cardKey)}"${b.allowed ? "" : " disabled"}${reason ? ` title="${e(reason)}"` : ""}>${words(t, b.label)}${b.required ? ` <small>${e(b.required)}+</small>` : ""}</button>`;
}

function card(c, t) {
  const details = c.details.map(d => `<span>${words(t, d.label)} ${e(t(d.value))}</span>`);
  if (c.ammo) details.push(`<span class="rwf-hud__ammo${c.ammo.loaded === 0 ? " rwf-hud__ammo--empty" : ""}">${words(t, "RWFTOOLS.Combat.Ammo")} ${e(c.ammo.loaded)}/${e(c.ammo.magazine)} · ${words(t, "RWFTOOLS.Combat.Reserve")} ${e(c.ammo.reserve)}</span>`);
  if (c.perRound) details.push(`<span>${e(fmt(t, "RWFTOOLS.Combat.PerRound", {n: c.perRound}))}</span>`);
  const blocked = c.buttons.find(b => b.range);
  // Nothing on the card can be used: why, in words (the Condition of the Ruleset that stops its first button).
  const stopped = !blocked && c.kind !== "physical" && c.buttons.length && c.buttons.every(b => !b.allowed) ? c.buttons.find(b => b.reason) : null;
  return `<li class="rwf-hud__card rwf-hud__card--${e(c.kind)}">
    <div class="rwf-hud__card-head"><strong>${e(t(c.name))}</strong>${c.latent ? ` <em>${words(t, "RWFTOOLS.Combat.Latent")}</em>` : ""}${c.required ? `<span class="rwf-hud__required">${e(fmt(t, "RWFTOOLS.Combat.Required", {n: c.required}))}</span>` : ""}</div>
    ${details.length ? `<div class="rwf-hud__details">${details.join("")}</div>` : ""}
    ${blocked ? `<p class="rwf-hud__warning">${e(fmt(t, blocked.range.key, blocked.range))}</p>` : ""}${stopped ? `<p class="rwf-hud__hint">${e(t(stopped.reason))}</p>` : ""}
    <div class="rwf-hud__actions">${c.buttons.map(b => actionButton(b, t, c.key)).join("")}</div></li>`;
}

/** The combat HUD. view: {reason} | {round, pass, passes, turnName, myTurn, name, combatant (combatantView), target, targets?, cover, mode, pending, error, message, canEndTurn, isGM} */
export function renderCombatHTML(view, t) {
  if (view.reason) return `<div class="rwf-hud"><p class="rwf-hud__empty">${words(t, view.reason)}</p></div>`;
  const c = view.combatant;
  const turn = view.myTurn ? `<span class="rwf-hud__turn rwf-hud__turn--mine">${words(t, "RWFTOOLS.Combat.YourTurn")}</span>` : `<span class="rwf-hud__turn">${e(fmt(t, "RWFTOOLS.Combat.TurnOf", {name: view.turnName ?? "—"}))}</span>`;
  const head = `<header class="rwf-hud__head"><span>${e(fmt(t, "RWFTOOLS.Combat.RoundPass", {round: view.round, pass: view.pass, passes: view.passes}))}</span>${turn}</header>`;
  const who = `<section class="rwf-hud__who"><h3>${e(view.name)}</h3><div class="rwf-hud__stats">
    ${pool(words(t, "RWFTOOLS.Combat.Vitality"), c.pools.vitalite)}${pool(words(t, "RWFTOOLS.Combat.Endurance"), c.pools.endurance)}${pool(words(t, "RWFTOOLS.Combat.Energy"), c.pools.energie)}
    <span class="rwf-hud__stat"><span>${words(t, "RWFTOOLS.Combat.Defense")}</span><strong>${e(c.defense ?? "—")}</strong></span>
    <span class="rwf-hud__stat"><span>${words(t, "RWFTOOLS.Combat.Attacks")}</span><strong>${e(c.attacks.used)}/${e(c.attacks.best)}</strong></span>
    <span class="rwf-hud__stat"><span>${words(t, "RWFTOOLS.Combat.Efforts")}</span><strong>${e(c.efforts)}/3</strong></span></div></section>`;
  if (view.targets) {
    const list = view.targets.length ? `<ul class="rwf-hud__targets">${view.targets.map(o => `<li><button type="button" data-rwf-target="${e(o.tokenId)}"${o.current ? ' class="rwf-hud__on"' : ""}>
      ${o.img ? `<img src="${e(o.img)}" alt="">` : ""}<span class="rwf-hud__target-name">${e(o.name)}</span><span class="rwf-hud__distance">${o.distance === null ? words(t, "RWFTOOLS.Combat.UnknownDistance") : `${e(o.distance)} m`}</span></button></li>`).join("")}</ul>`
      : `<p class="rwf-hud__empty">${words(t, "RWFTOOLS.Combat.NoTargets")}</p>`;
    return `<div class="rwf-hud rwf-hud--combat">${head}<section class="rwf-hud__picker"><div class="rwf-hud__row"><button type="button" data-rwf-pick-done><i class="fa-solid fa-arrow-left"></i> ${words(t, "RWFTOOLS.Combat.BackToActions")}</button>
      <button type="button" data-rwf-untarget>${words(t, "RWFTOOLS.Combat.NoTarget")}</button></div><h3>${words(t, "RWFTOOLS.Combat.PickTarget")}</h3>${list}</section></div>`;
  }
  const target = `<section class="rwf-hud__target">${view.target
    ? `<div class="rwf-hud__row"><span><i class="fa-solid fa-crosshairs"></i> <strong>${e(view.target.name)}</strong>${view.target.distance === null ? "" : ` · ${e(view.target.distance)} m`}</span><button type="button" data-rwf-pick>${words(t, "RWFTOOLS.Combat.ChangeTarget")}</button></div>
      <div class="rwf-hud__row rwf-hud__cover"><span>${words(t, "RWFTOOLS.Combat.Cover")}</span><button type="button" data-rwf-cover="-1" aria-label="−">−</button><strong>${e(view.cover)}</strong><button type="button" data-rwf-cover="1" aria-label="+">+</button></div>`
    : `<div class="rwf-hud__row"><span><i class="fa-solid fa-crosshairs"></i> ${words(t, "RWFTOOLS.Combat.NoTarget")}</span><button type="button" data-rwf-pick>${words(t, "RWFTOOLS.Combat.Target")}</button></div>`}</section>`;
  const end = view.canEndTurn ? `<button type="button" class="rwf-hud__end" data-rwf-end-turn><i class="fa-solid fa-check"></i> ${e(fmt(t, view.endLabel, {pass: view.pass}))}</button>` : "";
  return `<div class="rwf-hud rwf-hud--combat">${head}${who}${modeSwitch(view.mode, t)}${target}${tableForm(view.pending, t, view.error)}${message(view.message, t)}
    <h3 class="rwf-hud__section">${words(t, "RWFTOOLS.Combat.Actions")}</h3><ul class="rwf-hud__cards">${c.cards.map(x => card(x, t)).join("")}</ul>${end}</div>`;
}

function gauge(row, bound, t) {
  const steps = [];
  for (let n = -bound; n <= bound; n++) steps.push(`<span class="rwf-hud__step${n === row.gauge ? " rwf-hud__step--here" : ""}${n === 0 ? " rwf-hud__step--zero" : ""}" title="${e(sign(n))}"></span>`);
  return `<div class="rwf-hud__gauge" role="meter" aria-valuemin="${-bound}" aria-valuemax="${bound}" aria-valuenow="${e(row.gauge)}">
    <div class="rwf-hud__gauge-ends"><span>${words(t, row.ends[0])}</span><span class="rwf-hud__gauge-status${row.status.done ? " rwf-hud__gauge-status--done" : ""}">${words(t, row.status.key)} (${e(sign(row.gauge))})</span><span>${words(t, row.ends[1])}</span></div>
    <div class="rwf-hud__track">${steps.join("")}</div></div>`;
}

function participant(row, view, t) {
  const gm = view.isGM;
  const meansName = row.vehicle ? row.vehicle.name : t("RWFTOOLS.Pursuit.OnFoot");
  const role = gm ? `<select data-rwf-role="${e(row.uuid)}" aria-label="${words(t, "RWFTOOLS.Pursuit.Role")}">${["poursuivant", "fuyard"].map(r => `<option value="${r}"${r === row.role ? " selected" : ""}>${words(t, `RWFTOOLS.Pursuit.Roles.${r}`)}</option>`).join("")}</select>`
    : `<span>${words(t, `RWFTOOLS.Pursuit.Roles.${row.role}`)}</span>`;
  const means = gm ? `<select data-rwf-means="${e(row.uuid)}" aria-label="${words(t, "RWFTOOLS.Pursuit.Means")}"><option value="pied"${row.means === "pied" ? " selected" : ""}>${words(t, "RWFTOOLS.Pursuit.OnFoot")}</option>${row.vehicles.map(v => `<option value="${e(v.key)}"${v.key === row.means ? " selected" : ""}>${e(t(v.name))}</option>`).join("")}</select>`
    : `<span>${e(t(meansName))}</span>`;
  const speed = `${words(t, "RWFTOOLS.Pursuit.Speed")} ${e(row.speed)}${row.reference ? ` · ${words(t, "RWFTOOLS.Pursuit.IsReference")}` : ` · ${e(fmt(t, "RWFTOOLS.Pursuit.Advantage", {n: sign(row.advantage)}))}`}`;
  const endurance = row.means === "pied" && row.endurance ? ` · ${words(t, "RWFTOOLS.Combat.Endurance")} ${e(row.endurance.value)}/${e(row.endurance.max)}` : "";
  const moves = row.moves.length ? `<div class="rwf-hud__actions">${row.moves.map(m => {
    const reason = m.reason ? t(m.reason) : "";
    return `<button type="button" class="rwf-hud__action" data-rwf-move="${e(m.move)}" data-rwf-who="${e(row.uuid)}"${m.allowed && !view.finished?.length ? "" : " disabled"}${reason ? ` title="${e(reason)}"` : ""}>${words(t, m.label)}</button>`;
  }).join("")}</div>` : "";
  return `<li class="rwf-hud__card rwf-hud__participant${row.reference ? " rwf-hud__participant--reference" : ""}">
    <div class="rwf-hud__card-head"><strong>${e(row.name)}</strong>
      ${gm ? `<button type="button" class="rwf-hud__icon${row.reference ? " rwf-hud__on" : ""}" data-rwf-reference="${e(row.uuid)}" title="${words(t, "RWFTOOLS.Pursuit.MakeReference")}" aria-pressed="${row.reference}"><i class="fa-solid fa-bullseye"></i></button>
      <button type="button" class="rwf-hud__icon" data-rwf-remove="${e(row.uuid)}" title="${words(t, "RWFTOOLS.Pursuit.Remove")}"><i class="fa-solid fa-xmark"></i></button>` : ""}</div>
    <div class="rwf-hud__row rwf-hud__setup">${role}${means}</div>
    <div class="rwf-hud__details"><span>${speed}${endurance}</span></div>
    ${gauge(row, view.bound, t)}${moves}</li>`;
}

/** The pursuit HUD. view: {reason} | {active, isGM, cap, rows, bound, mode, pending, error, message, finished} */
export function renderPursuitHTML(view, t) {
  if (view.reason) return `<div class="rwf-hud"><p class="rwf-hud__empty">${words(t, view.reason)}</p></div>`;
  if (!view.active) return `<div class="rwf-hud rwf-hud--pursuit"><p class="rwf-hud__empty">${words(t, view.isGM ? "RWFTOOLS.Pursuit.StartHint" : "RWFTOOLS.Pursuit.None")}</p>
    ${view.isGM ? `<button type="button" data-rwf-start><i class="fa-solid fa-gauge-high"></i> ${words(t, "RWFTOOLS.Pursuit.Start")}</button>` : ""}${message(view.message, t)}</div>`;
  const gm = view.isGM ? `<section class="rwf-hud__gm">
      <label class="rwf-hud__row">${words(t, "RWFTOOLS.Pursuit.Cap")}<input type="number" step="1" min="0" value="${e(view.cap)}" data-rwf-cap></label>
      <p class="rwf-hud__hint">${words(t, "RWFTOOLS.Pursuit.CapHint")}</p>
      <div class="rwf-hud__row"><button type="button" data-rwf-add>${words(t, "RWFTOOLS.Pursuit.Add")}</button><button type="button" data-rwf-end>${words(t, "RWFTOOLS.Pursuit.Finish")}</button></div></section>` : "";
  const finished = view.finished?.length ? `<p class="rwf-hud__outcome">${view.finished.map(r => `${e(r.name)} : ${words(t, r.status.key)}`).join(" · ")}</p>` : "";
  return `<div class="rwf-hud rwf-hud--pursuit"><header class="rwf-hud__head"><span>${e(fmt(t, "RWFTOOLS.Pursuit.Running", {n: view.rows.length}))}</span></header>
    ${gm}${modeSwitch(view.mode, t)}${tableForm(view.pending, t, view.error)}${message(view.message, t)}${finished}
    <ul class="rwf-hud__cards">${view.rows.map(row => participant(row, view, t)).join("")}</ul></div>`;
}
