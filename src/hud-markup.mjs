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
  const stopped = !blocked && !c.buttons.some(b => b.waiting) && c.kind !== "physical" && c.buttons.length && c.buttons.every(b => !b.allowed) ? c.buttons.find(b => b.reason) : null;
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
    const list = view.targets.length ? `<ul class="rwf-hud__targets">${view.targets.map(o => `<li><button type="button" data-rwf-target="${e(o.id)}"${o.current ? ' class="rwf-hud__on"' : ""}>
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
    <h3 class="rwf-hud__section">${words(t, "RWFTOOLS.Combat.Actions")}</h3>${c.waiting ? `<p class="rwf-hud__hint">${words(t, "RWFTOOLS.Combat.WaitTurn")}</p>` : ""}<ul class="rwf-hud__cards">${c.cards.map(x => card(x, t)).join("")}</ul>${end}</div>`;
}

/* ---------- Pursuit ---------- */

/** A fugitive's gap gauge from −bound to +bound: the steps from 0 to where it stands are filled, green toward +bound
 * (getting away), red toward −bound (caught). */
function gauge(row, bound, t) {
  const steps = [], tone = row.gauge > 0 ? "good" : "bad";
  for (let n = -bound; n <= bound; n++) {
    const filled = n !== 0 && (row.gauge > 0 ? n > 0 && n <= row.gauge : n < 0 && n >= row.gauge);
    steps.push(`<span class="rwf-hud__step${n === 0 ? " rwf-hud__step--zero" : ""}${filled ? ` rwf-hud__step--${tone}` : ""}${n === row.gauge ? " rwf-hud__step--here" : ""}" title="${e(sign(n))}"></span>`);
  }
  return `<div class="rwf-hud__gauge" role="meter" aria-valuemin="${-bound}" aria-valuemax="${bound}" aria-valuenow="${e(row.gauge)}" aria-label="${e(`${t(row.ends[0])} / ${t(row.ends[1])}`)}">
    <span class="rwf-hud__gauge-end">${words(t, row.ends[0])}</span><div class="rwf-hud__track">${steps.join("")}</div><strong class="rwf-hud__gauge-value rwf-hud__gauge-value--${row.gauge === 0 ? "zero" : tone}">${e(sign(row.gauge))}</strong><span class="rwf-hud__gauge-end">${words(t, row.ends[1])}</span></div>`;
}
const meansName = (row, t) => row.vehicle ? t(row.vehicle.name) : t("RWFTOOLS.Pursuit.OnFoot");

/** A participant in its side's list: name and means; a fugitive's gap gauge below, with who chases it; a pursuer's
 * target. The one whose turn it is stands out. */
function runner(row, view, t) {
  const tag = row.status.done ? `<span class="rwf-pursuit__outcome">${words(t, row.status.key)}</span>`
    : row.active ? `<span class="rwf-pursuit__now">${words(t, "RWFTOOLS.Pursuit.ItsTurn")}</span>` : "";
  const below = row.role === "fuyard"
    ? `${gauge(row, view.bound, t)}${row.status.done ? "" : `<p class="rwf-pursuit__chase">${row.chasers?.length ? e(fmt(t, "RWFTOOLS.Pursuit.ChasedBy", {names: row.chasers.map(c => c.name).join(", ")})) : words(t, "RWFTOOLS.Pursuit.NotChased")}</p>`}`
    : row.status.done ? "" : `<p class="rwf-pursuit__chase">${row.target ? `<i class="fa-solid fa-arrow-right"></i> ${e(fmt(t, "RWFTOOLS.Pursuit.Chases", {name: row.target.name}))}` : words(t, "RWFTOOLS.Pursuit.NoTarget")}</p>`;
  return `<li class="rwf-pursuit__runner${row.active ? " rwf-pursuit__runner--active" : ""}${row.status.done ? " rwf-pursuit__runner--done" : ""}"${row.active ? ' aria-current="true"' : ""}>
    <div class="rwf-pursuit__line"><span class="rwf-pursuit__rank">${e(row.rank)}.</span><strong>${e(row.name)}</strong><span class="rwf-pursuit__means">${e(meansName(row, t))}</span>${tag}</div>
    ${below}</li>`;
}

function zone(role, rows, view, t) {
  const count = view.phase === "setup" ? "" : `<small>${e(fmt(t, "RWFTOOLS.Pursuit.StillRunning", {n: rows.filter(r => !r.status.done).length}))}</small>`;
  return `<section class="rwf-pursuit__zone rwf-pursuit__zone--${role}"><h3 class="rwf-pursuit__zone-title">${words(t, `RWFTOOLS.Pursuit.Side.${role}`)}${count}</h3>
    ${rows.length ? `<ul class="rwf-pursuit__list">${rows.map(row => view.phase === "setup" ? setupLine(row, view, t) : runner(row, view, t)).join("")}</ul>` : `<p class="rwf-hud__empty">${words(t, "RWFTOOLS.Pursuit.NoOne")}</p>`}</section>`;
}

function meansSelect(row, t) {
  return `<select data-rwf-means="${e(row.uuid)}" aria-label="${words(t, "RWFTOOLS.Pursuit.Means")}"><option value="pied"${row.means === "pied" ? " selected" : ""}>${words(t, "RWFTOOLS.Pursuit.OnFoot")}</option>${row.vehicles.map(v => `<option value="${e(v.key)}"${v.key === row.means ? " selected" : ""}>${e(t(v.name))}</option>`).join("")}</select>`;
}
/** The fugitive a pursuer chases, to pick among those still running. */
function chaseSelect(row, fugitives, attr, t) {
  if (!fugitives.length) return "";
  return `<select ${attr}="${e(row.uuid)}" aria-label="${words(t, "RWFTOOLS.Pursuit.Chase")}" title="${words(t, "RWFTOOLS.Pursuit.Chase")}">${fugitives.map(f => `<option value="${e(f.uuid)}"${f.uuid === (row.targetUuid ?? row.target?.uuid) ? " selected" : ""}>${e(f.name)}</option>`).join("")}</select>`;
}
/** The GM's line for a participant: its means, whom it chases (a pursuer), the other side, out of the pursuit. */
function setupLine(row, view, t) {
  const other = row.role === "fuyard" ? "poursuivant" : "fuyard";
  const fugitives = view.fugitives ?? view.rows.filter(r => r.role === "fuyard" && !r.status?.done).map(r => ({uuid: r.uuid, name: r.name}));
  return `<li class="rwf-pursuit__setup"><strong>${e(row.name)}</strong>${row.role === "poursuivant" ? chaseSelect(row, fugitives, "data-rwf-target", t) : ""}${meansSelect(row, t)}
    <button type="button" class="rwf-hud__icon" data-rwf-role="${e(row.uuid)}" data-rwf-to="${other}" title="${e(fmt(t, "RWFTOOLS.Pursuit.MoveTo", {side: t(`RWFTOOLS.Pursuit.Side.${other}`)}))}"><i class="fa-solid fa-right-left"></i></button>
    <button type="button" class="rwf-hud__icon" data-rwf-remove="${e(row.uuid)}" title="${words(t, "RWFTOOLS.Pursuit.Remove")}"><i class="fa-solid fa-xmark"></i></button></li>`;
}
/** The scene's other tokens, to bring into the pursuit on one side or the other. */
function available(view, t) {
  if (!view.available?.length) return "";
  return `<section class="rwf-pursuit__available"><h3 class="rwf-pursuit__zone-title">${words(t, "RWFTOOLS.Pursuit.Available")}</h3><ul class="rwf-pursuit__list">${view.available.map(a =>
    `<li class="rwf-pursuit__setup"><strong>${e(a.name)}</strong>${["fuyard", "poursuivant"].map(role => `<button type="button" class="rwf-pursuit__join" data-rwf-join="${e(a.uuid)}" data-rwf-side="${role}"><i class="fa-solid fa-plus"></i> ${words(t, `RWFTOOLS.Pursuit.Roles.${role}`)}</button>`).join("")}</li>`).join("")}</ul></section>`;
}
const capField = (cap, t) => `<label class="rwf-pursuit__cap"><span>${words(t, "RWFTOOLS.Pursuit.Cap")}</span><input type="number" step="1" min="0" value="${e(cap)}" data-rwf-cap></label>
  <p class="rwf-hud__hint">${words(t, "RWFTOOLS.Pursuit.CapHint")}</p>`;

/** The GM prepares the pursuit: who flees, then each participant's side and means. */
function renderSetup(view, t) {
  if (!view.isGM) return `<div class="rwf-hud rwf-hud--pursuit"><p class="rwf-hud__empty">${words(t, "RWFTOOLS.Pursuit.Preparing")}</p></div>`;
  const fleeing = `<div class="rwf-hud__mode" role="radiogroup" aria-label="${words(t, "RWFTOOLS.Pursuit.WhoFlees")}"><span class="rwf-hud__mode-label">${words(t, "RWFTOOLS.Pursuit.WhoFlees")}</span>${["pnj", "pj"].map(f =>
    `<button type="button" role="radio" data-rwf-fleeing="${f}" aria-checked="${f === view.fleeing}" class="rwf-hud__mode-option${f === view.fleeing ? " rwf-hud__mode-option--on" : ""}">${words(t, `RWFTOOLS.Pursuit.Fleeing.${f}`)}${f === view.fleeing ? ' <i class="fa-solid fa-check"></i>' : ""}</button>`).join("")}</div>`;
  const side = role => view.rows.filter(r => r.role === role);
  return `<div class="rwf-hud rwf-hud--pursuit"><header class="rwf-hud__head"><span>${words(t, "RWFTOOLS.Pursuit.Prepare")}</span></header>
    <p class="rwf-hud__hint">${words(t, "RWFTOOLS.Pursuit.SetupHint")}</p>
    ${fleeing}${message(view.message, t)}
    <div class="rwf-pursuit__zones">${zone("fuyard", side("fuyard"), view, t)}${zone("poursuivant", side("poursuivant"), view, t)}</div>
    ${available(view, t)}
    ${capField(view.cap, t)}
    <p class="rwf-hud__hint">${e(fmt(t, "RWFTOOLS.Pursuit.FleeBonus", {n: view.fleeBonus}))}</p>
    <div class="rwf-hud__row"><button type="button" data-rwf-launch${view.canLaunch ? "" : ` disabled title="${words(t, "RWFTOOLS.Pursuit.BothSides")}"`}><i class="fa-solid fa-flag-checkered"></i> ${words(t, "RWFTOOLS.Pursuit.Launch")}</button><button type="button" data-rwf-cancel>${words(t, "RWFTOOLS.Hud.Cancel")}</button></div></div>`;
}

/** The turn being played: the participant, its means and speed, and its moves when this user plays it. */
function turnPanel(view, t) {
  const c = view.current;
  if (!c) return "";
  const facts = [`${e(meansName(c, t))}`, `${e(fmt(t, "RWFTOOLS.Pursuit.Advantage", {n: sign(c.advantage)}))}`, ...(c.endurance ? [`${words(t, "RWFTOOLS.Combat.Endurance")} ${e(c.endurance.value)}/${e(c.endurance.max)}`] : [])];
  // A pursuer's target: its player (or the GM) picks among the fugitives still running.
  const chase = c.role !== "poursuivant" || c.status.done ? ""
    : c.playable && c.targets?.length > 1 ? `<label class="rwf-pursuit__cap"><span>${words(t, "RWFTOOLS.Pursuit.Chase")}</span>${chaseSelect(c, c.targets, "data-rwf-chase", t)}</label>`
    : `<p class="rwf-pursuit__chase">${c.target ? `<i class="fa-solid fa-arrow-right"></i> ${e(fmt(t, "RWFTOOLS.Pursuit.Chases", {name: c.target.name}))}` : words(t, "RWFTOOLS.Pursuit.NoTarget")}</p>`;
  const hint = c.role === "fuyard" ? fmt(t, "RWFTOOLS.Pursuit.MovesHintFlee", {dd: view.dd ?? "?", n: sign(c.advantage)}) : fmt(t, "RWFTOOLS.Pursuit.MovesHintChase", {dd: view.dd ?? "?", n: sign(c.advantage), name: c.target?.name ?? "?"});
  const moves = c.moves?.length ? `<p class="rwf-hud__hint">${e(hint)}</p><div class="rwf-hud__actions">${c.moves.map(m => {
    const reason = m.reason ? t(m.reason) : t(`RWFTOOLS.Pursuit.MoveHelp.${m.move}`);
    const extra = [m.modifier ? sign(m.modifier) : "", m.required ? `${m.required}+` : ""].filter(Boolean).join(" · ");
    return `<button type="button" class="rwf-hud__action" data-rwf-move="${e(m.move)}"${m.allowed ? "" : " disabled"} title="${e(reason)}">${words(t, m.label)}${extra ? ` <small>${e(extra)}</small>` : ""}</button>`;
  }).join("")}</div>
    <button type="button" class="rwf-hud__end" data-rwf-end-turn><i class="fa-solid fa-forward"></i> ${words(t, "RWFTOOLS.Pursuit.SkipTurn")}</button>` : "";
  return `<section class="rwf-pursuit__turn"><div class="rwf-pursuit__line"><strong>${e(c.name)}</strong><span class="rwf-pursuit__role">${words(t, `RWFTOOLS.Pursuit.Roles.${c.role}`)}</span></div>
    <div class="rwf-hud__details">${facts.map(f => `<span>${f}</span>`).join("")}</div>${chase}
    ${moves ? "" : `<p class="rwf-hud__hint">${e(c.status.done ? `${c.name} : ${t(c.status.key)}` : fmt(t, "RWFTOOLS.Pursuit.Waiting", {name: c.name}))}</p>`}${tableForm(view.pending, t, view.error)}${moves}</section>`;
}

/** The GM's settings of a running pursuit, folded away: terrain, sides and means, add, remove, finish. */
function settings(view, t) {
  if (!view.isGM) return "";
  return `<details class="rwf-pursuit__settings"${view.settingsOpen ? " open" : ""} data-rwf-settings><summary>${words(t, "RWFTOOLS.Pursuit.Settings")}</summary><div class="rwf-pursuit__settings-body">
    ${capField(view.cap, t)}
    <ul class="rwf-pursuit__list">${view.rows.map(row => setupLine(row, view, t)).join("")}</ul>
    ${available(view, t)}
    <button type="button" data-rwf-end><i class="fa-solid fa-flag-checkered"></i> ${words(t, "RWFTOOLS.Pursuit.Finish")}</button></div></details>`;
}

/** The pursuit HUD. view: {reason} | {phase: "none", isGM} | setupView + {isGM, fleeBonus} | pursuitView + {round, isGM, myTurn,
 * mode, pending, error, message, settingsOpen} */
export function renderPursuitHTML(view, t) {
  if (view.reason) return `<div class="rwf-hud"><p class="rwf-hud__empty">${words(t, view.reason)}</p></div>`;
  if (view.phase === "setup") return renderSetup(view, t);
  if (view.phase !== "running") return `<div class="rwf-hud rwf-hud--pursuit"><p class="rwf-hud__empty">${words(t, view.isGM ? "RWFTOOLS.Pursuit.StartHint" : "RWFTOOLS.Pursuit.None")}</p>
    ${view.isGM ? `<button type="button" data-rwf-start><i class="fa-solid fa-gauge-high"></i> ${words(t, "RWFTOOLS.Pursuit.Start")}</button>` : ""}${message(view.message, t)}</div>`;
  const turn = view.current ? (view.myTurn ? `<span class="rwf-hud__turn rwf-hud__turn--mine">${words(t, "RWFTOOLS.Combat.YourTurn")}</span>` : `<span class="rwf-hud__turn">${e(fmt(t, "RWFTOOLS.Combat.TurnOf", {name: view.current.name}))}</span>`) : "";
  return `<div class="rwf-hud rwf-hud--pursuit"><header class="rwf-hud__head"><span>${e(fmt(t, "RWFTOOLS.Pursuit.Round", {round: view.round}))}</span>${turn}</header>
    ${modeSwitch(view.mode, t)}${message(view.message, t)}${turnPanel(view, t)}
    <div class="rwf-pursuit__zones">${zone("fuyard", view.sides.fuyard, view, t)}${zone("poursuivant", view.sides.poursuivant, view, t)}</div>
    ${settings(view, t)}</div>`;
}
