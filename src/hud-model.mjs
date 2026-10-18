/* What the combat and pursuit HUDs show, read from the RWF Ruleset through Rule Them'All's runtime API, and the
   context they run its Actions in. Nothing here touches the screen or Foundry: the combat, the tokens and the
   names come in as plain data. */

/** The RWF Ruleset (2.2.0 or later) as the HUDs use it. */
export const RWF = Object.freeze({
  weaponType: "arme", powerType: "pouvoir", vehicleType: "vehicule",
  unarmed: "attaquer-mains-nues", sprint: "sprinter", rest: "reprendre-son-souffle",
  weaponActions: ["attaquer", "tirer-rafale", "tirer-full-auto", "recharger"],
  powerActions: ["utiliser-pouvoir", "pouvoir-degats", "pouvoir-soins"],
  burstActions: ["tirer-rafale", "tirer-full-auto"],
  pools: ["vitalite", "endurance", "energie"],
  moves: ["continuer", "risque", "raccourci"],
  stop: "poursuite-arret", reset: "poursuite-nouvelle",
  gauge: "progression-poursuite", gaugeBound: "poursuite-borne", footSpeed: "vitesse-a-pied", burstBonus: "bonus-rafale",
  // What the HUD needs the Ruleset to have: the 2.2.0 combat rules.
  required: ["reprendre-son-souffle", "recharger", "poursuite-a-pied-continuer"]
});
export const D20_MIN = 1, D20_MAX = 20;
export const DICE_MODES = ["foundry", "table"];

const enabled = entry => entry && entry.enabled !== false;
const number = value => { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; };

/** The active Ruleset version when the HUDs can play it, else {reason}. */
export function hudRuleset(configurator) {
  const versionId = configurator?.getActiveVersionId?.();
  if (!versionId) return {reason: "RWFTOOLS.Error.NoRuleset"};
  let ruleset = null;
  try { ruleset = configurator.getRuntimeRuleset?.(versionId, "published"); } catch { ruleset = null; }
  if (!RWF.required.every(id => ruleset?.actions?.some(action => action.id === id && enabled(action)))) return {reason: "RWFTOOLS.Error.NotRwfHud"};
  return {versionId, ruleset};
}

/** An announced roll: a whole number from min to max, else null. */
export function readWhole(value, min = D20_MIN, max = D20_MAX) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/* ---------- Combat ---------- */

/** The combatant a user's HUD follows: the one acting when it is theirs (any one for the GM), else their own
 * character, else a combatant they own. combatants: [{id, actorUuid, owned, defeated}], activeId: the turn's. */
export function followedCombatant({combatants = [], activeId = null, isGM = false, characterUuid = null}) {
  const active = combatants.find(c => c.id === activeId);
  if (active && (isGM || active.owned)) return active;
  const own = combatants.filter(c => c.owned && !c.defeated);
  return own.find(c => c.actorUuid === characterUuid) ?? own[0] ?? (isGM ? active ?? combatants[0] ?? null : null);
}

/** Whether the turn is this user's to play: a player's when they own the combatant acting, the GM's when no player does. */
export const yourTurn = ({isGM, owned, playerOwned}) => isGM ? !playerOwned : Boolean(owned);

/** Whose targets the HUD reads for a combatant: a player's own; on the GM's HUD, a player character's targets are its
 * player's (the one connected whose character it is, else one connected who owns it), the GM's own otherwise.
 * users: [{id, isGM, active, characterUuid, owner}] (owner: owns this combatant's Actor). Returns a user id. */
export function targetingUser({viewerId, isGM, playerOwned, actorUuid, users = []}) {
  if (!isGM || !playerOwned) return viewerId;
  const players = users.filter(u => !u.isGM && u.active && u.owner);
  return (players.find(u => u.characterUuid === actorUuid) ?? players[0])?.id ?? viewerId;
}

/** The combatants one may pick as a target: those of the other side (a player character aims at the others, anyone
 * else at the player characters). rows: [{playerOwned, ...}]. */
export const opposingSide = (rows, playerOwned) => rows.filter(row => Boolean(row.playerOwned) !== Boolean(playerOwned));

/** Whether an announced d20 hits: it reaches the d20 the test needs (a 1 never does, a 20 always does). */
export const hits = (d20, required) => d20 === D20_MAX || (d20 > 1 && required !== null && required !== undefined && d20 >= required);

/** Gap between two tokens, edge to edge, in scene units (two tokens that touch are 0 apart).
 * a, b: {x, y, width, height} (x, y in pixels; width, height in grid squares); grid: {size, distance}. */
export function edgeDistance(a, b, {size, distance}) {
  if (!a || !b || !(size > 0)) return null;
  const box = t => ({left: t.x, top: t.y, right: t.x + t.width * size, bottom: t.y + t.height * size});
  const p = box(a), q = box(b);
  const gapX = Math.max(0, Math.max(p.left, q.left) - Math.min(p.right, q.right));
  const gapY = Math.max(0, Math.max(p.top, q.top) - Math.min(p.bottom, q.bottom));
  return Math.round(Math.hypot(gapX, gapY) / size * distance * 10) / 10;
}

/** Why a weapon cannot reach the target, or null: melee needs contact, a ranged weapon its range (0: no limit). */
export function outOfRange({range, distance, melee}) {
  if (distance === null || distance === undefined) return null;
  if (melee) return distance > 0 ? {key: "RWFTOOLS.Combat.Contact", distance} : null;
  return range > 0 && distance > range ? {key: "RWFTOOLS.Combat.OutOfRange", distance, range} : null;
}

/** The d20 a test needs: its difficulty minus its bonus, never below 2 (a 1 always fails) nor above 20 (a 20 always succeeds). */
export function requiredD20(difficulty, bonus) {
  const dd = number(difficulty), b = number(bonus);
  if (dd === null || b === null) return null;
  return Math.min(D20_MAX, Math.max(2, dd - b));
}

/** The context an HUD runs an Action in: the combatant acts (self), on its target, with the Content it uses. */
export function actionContext({actorUuid, targetUuid = null, contentKey = null, input = {}, userId = null, isGM = false}) {
  return {roles: {self: actorUuid, source: actorUuid, owner: actorUuid, target: targetUuid ?? actorUuid}, defaultRole: "self",
    ...(contentKey ? {content: {key: contentKey, role: "self"}} : {}),
    variables: {input: {...input}}, userContext: {userId, isGM: Boolean(isGM)}};
}

/** The same context, as the HUD reads a difficulty: the cover is the attack Test's input too. */
const readContext = (options, cover) => {
  const context = actionContext({...options, input: {couverture: cover}});
  context.variables.test = {inputs: {couverture: cover}};
  return context;
};

/** The Actions a Content grants (its template's grant relations), in the order of `ids`. */
export function grantedActions(ruleset, templateId, ids) {
  const template = ruleset?.contentTemplates?.find(t => t.id === templateId);
  const granted = new Set((template?.relations ?? []).filter(r => r?.operation === "grant" && r.targetRef?.objectKind === "action").map(r => r.targetRef.objectId));
  return ids.filter(id => granted.has(id));
}

const counter = (state, id) => number(state?.definitionStates?.[id]?.capabilityStates?.value?.base) ?? 0;

/** Whether an Action can be used now, and the first Condition that stops it ({allowed, reason}). */
async function usable(runtime, versionId, ruleset, actionId, context) {
  const action = ruleset.actions?.find(a => a.id === actionId && enabled(a));
  if (!action) return {allowed: false, reason: null};
  for (const conditionId of action.conditionRefs ?? []) {
    let ok = false;
    try { ok = Boolean(await runtime.evaluateCondition(versionId, conditionId, context)); } catch { ok = false; }
    if (!ok) return {allowed: false, reason: ruleset.conditions?.find(c => c.id === conditionId)?.nameKey ?? conditionId};
  }
  return {allowed: true, reason: null};
}

const hasInput = (ruleset, actionId, inputId) => Boolean(ruleset.actions?.find(a => a.id === actionId)?.inputs?.some(i => i.id === inputId));
const formula = async (runtime, versionId, id, context) => { try { return await runtime.evaluateFormula(versionId, id, context); } catch { return null; } };

/** The combat HUD of one combatant: its resources, its attacks this round, and an action card per way it can act.
 * target: {uuid, name, distance} or null; cover: the cover the HUD adds to the target's defence. */
export async function combatantView(runtime, {versionId, ruleset, actorUuid, target = null, cover = 0, isGM = false, userId = null, contentName = row => row.name ?? row.templateId}) {
  const state = await runtime.getContainerState(actorUuid);
  const base = {actorUuid, target: target?.uuid ?? null, isGM, userId};
  const self = readContext(base, cover);
  const pools = {};
  for (const id of RWF.pools) pools[id] = await runtime.tokenBarValue(versionId, actorUuid, `rta.${id}.points`);
  const bestAttacks = number(await formula(runtime, versionId, "attaques-meilleure", self)) ?? 1;
  const view = {
    pools, defense: await formula(runtime, versionId, "defense-calcul", self),
    attacks: {used: counter(state, "attaques-utilisees"), best: bestAttacks},
    efforts: counter(state, "efforts-physiques"), pass: counter(state, "passe-en-cours"), lastPass: counter(state, "derniere-passe-attaque"),
    inCombat: Boolean(state?.stateInstances?.some(instance => instance.definitionId === "en-combat" && instance.active !== false) || state?.definitionStates?.["en-combat"]?.capabilityStates?.state?.active),
    cards: []
  };
  const burstBonus = number(ruleset.parameters?.find(p => p.id === RWF.burstBonus)?.value) ?? 0;
  const button = async (actionId, context, extra = {}) => ({actionId, ...(await usable(runtime, versionId, ruleset, actionId, context)), damage: hasInput(ruleset, actionId, "degats"), d20: hasInput(ruleset, actionId, "de"), ...extra});
  const blockRange = (b, range) => range && b.allowed ? {...b, allowed: false, reason: range.key, range} : b;

  // Unarmed: always there, as a melee attack.
  if (ruleset.actions?.some(a => a.id === RWF.unarmed)) {
    const required = target ? requiredD20(await formula(runtime, versionId, "difficulte-attaque", self), await formula(runtime, versionId, "bonus-mains-nues", self)) : null;
    const range = target ? outOfRange({range: 0, distance: target.distance, melee: true}) : null;
    view.cards.push({kind: "unarmed", key: "unarmed", name: "RWFTOOLS.Combat.Unarmed", details: [{label: "RWFTOOLS.Combat.Damage", value: "1d4 + Force"}], required,
      buttons: [blockRange(await button(RWF.unarmed, self, {label: "RWFTOOLS.Combat.Attack", needsTarget: true}), range)]});
  }
  const contents = await runtime.listOwnedContents(versionId, actorUuid, self);
  for (const row of contents.filter(r => r.contentTypeId === RWF.weaponType)) {
    const context = readContext({...base, contentKey: row.key}, cover), f = row.fields ?? {};
    const actions = grantedActions(ruleset, row.templateId, RWF.weaponActions);
    if (!actions.length) continue;
    const range = number(f.portee) ?? 0, melee = range === 0;
    const required = target ? requiredD20(await formula(runtime, versionId, "difficulte-attaque", context), await formula(runtime, versionId, "bonus-attaque-arme", context)) : null;
    const reach = target ? outOfRange({range, distance: target.distance, melee}) : null;
    const buttons = [];
    for (const actionId of actions) {
      const attack = actionId !== "recharger";
      const label = actionId === "attaquer" ? (melee ? "RWFTOOLS.Combat.Attack" : "RWFTOOLS.Combat.Shoot") : `RWFTOOLS.Combat.Action.${actionId}`;
      const b = await button(actionId, context, {label, needsTarget: attack, ...(attack && required !== null ? {required: RWF.burstActions.includes(actionId) ? Math.max(2, required - burstBonus) : required} : {})});
      buttons.push(attack ? blockRange(b, reach) : b);
    }
    const magazine = number(f.chargeur) ?? 0;
    view.cards.push({kind: "weapon", key: row.key, name: contentName(row), required,
      details: [{label: "RWFTOOLS.Combat.Damage", value: `${f.degats ?? "?"}${f.ajouteForce ? " + Force" : ""}`}, {label: "RWFTOOLS.Combat.Range", value: melee ? "RWFTOOLS.Combat.Melee" : `${range} m`},
        ...(number(f.perforation) ? [{label: "RWFTOOLS.Combat.Piercing", value: String(f.perforation)}] : [])],
      ...(magazine > 0 ? {ammo: {loaded: number(f.munitions) ?? 0, magazine, reserve: number(f.reserve) ?? 0}} : {}),
      perRound: number(await formula(runtime, versionId, "attaques-arme", context)), buttons});
  }
  for (const row of contents.filter(r => r.contentTypeId === RWF.powerType && (r.available || isGM))) {
    const context = readContext({...base, contentKey: row.key}, cover), f = row.fields ?? {};
    const actions = grantedActions(ruleset, row.templateId, RWF.powerActions);
    if (!actions.length) continue;
    const required = requiredD20(await formula(runtime, versionId, "dd-pouvoir", context), await formula(runtime, versionId, "bonus-pouvoir", context));
    const buttons = [];
    for (const actionId of actions) buttons.push(await button(actionId, context, {label: `RWFTOOLS.Combat.Action.${actionId}`, required, needsTarget: actionId !== "utiliser-pouvoir"}));
    view.cards.push({kind: "power", key: row.key, name: contentName(row), latent: !row.available, required,
      details: [{label: "RWFTOOLS.Combat.Cost", value: `${f.cout ?? 0}`}, {label: "RWFTOOLS.Combat.DD", value: `${f.difficulte ?? "?"}`},
        ...(f.degats ? [{label: "RWFTOOLS.Combat.Dice", value: String(f.degats)}] : []), ...(number(f.portee) ? [{label: "RWFTOOLS.Combat.Range", value: `${f.portee} m`}] : [])], buttons});
  }
  const physical = [];
  for (const actionId of [RWF.sprint, RWF.rest]) if (ruleset.actions?.some(a => a.id === actionId)) physical.push(await button(actionId, self, {label: `RWFTOOLS.Combat.Action.${actionId}`}));
  if (physical.length) view.cards.push({kind: "physical", key: "physical", name: "RWFTOOLS.Combat.Physical", details: [], buttons: physical});
  return view;
}

/** The bottom button: the combatant ends this pass when it acts in a later one, else its round. */
export const endTurnLabel = ({pass, passes}) => pass < passes ? "RWFTOOLS.Combat.EndPass" : "RWFTOOLS.Combat.EndRound";

/* ---------- Pursuit ---------- */

export const ROLES = ["poursuivant", "fuyard"];
export const FOOT = "pied";
export const emptyPursuit = () => ({active: false, referenceUuid: null, cap: 0, participants: []});

/** A pursuit kept in the world (GM writes): its participants [{uuid, name, role, means}], the reference of speed, the
 * environment's speed cap (0: none). Anything malformed is dropped. */
export function readPursuit(stored) {
  const value = stored && typeof stored === "object" ? stored : {};
  const participants = (Array.isArray(value.participants) ? value.participants : []).filter(p => p && typeof p.uuid === "string")
    .map(p => ({uuid: p.uuid, name: String(p.name ?? ""), role: ROLES.includes(p.role) ? p.role : "poursuivant", means: typeof p.means === "string" && p.means ? p.means : FOOT}));
  const unique = participants.filter((p, i) => participants.findIndex(q => q.uuid === p.uuid) === i);
  const referenceUuid = unique.some(p => p.uuid === value.referenceUuid) ? value.referenceUuid : null;
  return {active: Boolean(value.active) && unique.length > 0, referenceUuid, cap: Math.max(0, number(value.cap) ?? 0), participants: unique};
}

/** New participants, by default: a player's character pursues, anyone else flees; the reference is the first who flees. */
export function addParticipants(pursuit, candidates) {
  const next = readPursuit(pursuit);
  for (const c of candidates) if (!next.participants.some(p => p.uuid === c.uuid)) next.participants.push({uuid: c.uuid, name: c.name, role: c.playerOwned ? "poursuivant" : "fuyard", means: FOOT});
  next.referenceUuid ??= next.participants.find(p => p.role === "fuyard")?.uuid ?? next.participants[0]?.uuid ?? null;
  return next;
}

/** Sign of a speed difference: +1 faster than the reference, −1 slower, 0 as fast (and for the reference itself). */
export const speedAdvantage = (speed, reference) => speed === null || reference === null ? 0 : Math.sign(speed - reference);

/** How far a participant got, read from its gauge: the outcome once a bound is reached ({key, done}). */
export function pursuitStatus(role, gauge, bound = 3) {
  if (gauge >= bound) return {key: role === "fuyard" ? "RWFTOOLS.Pursuit.Status.Escaped" : "RWFTOOLS.Pursuit.Status.Caught", done: true};
  if (gauge <= -bound) return {key: role === "fuyard" ? "RWFTOOLS.Pursuit.Status.CaughtUp" : "RWFTOOLS.Pursuit.Status.Lost", done: true};
  return {key: "RWFTOOLS.Pursuit.Status.Running", done: false};
}
/** The words at the two ends of a participant's gauge (−bound, +bound). */
export const gaugeEnds = role => role === "fuyard" ? ["RWFTOOLS.Pursuit.Ends.CaughtUp", "RWFTOOLS.Pursuit.Ends.Escaped"] : ["RWFTOOLS.Pursuit.Ends.Lost", "RWFTOOLS.Pursuit.Ends.Caught"];

/** The Action a pursuit move runs: on foot it is the character's own, in a vehicle the vehicle's. */
export const moveAction = (move, means) => means === FOOT ? `poursuite-a-pied-${move}` : `poursuite-vehicule-${move}`;

/** The pursuit HUD: one card per participant, with its gauge, its means and speed, and its moves.
 * canAct(uuid): whether this user plays that participant; contentName(row, uuid): an owned Content's name. */
export async function pursuitView(runtime, {versionId, ruleset, pursuit, canAct = () => true, isGM = false, userId = null, contentName = row => row.name ?? row.templateId}) {
  const param = id => number(ruleset.parameters?.find(p => p.id === id)?.value);
  const bound = param(RWF.gaugeBound) ?? 3, footSpeed = param(RWF.footSpeed) ?? -1, cap = pursuit.cap > 0 ? pursuit.cap : null;
  const rows = [];
  for (const p of pursuit.participants) {
    let state = null, contents = [];
    try { state = await runtime.getContainerState(p.uuid); contents = await runtime.listOwnedContents(versionId, p.uuid, actionContext({actorUuid: p.uuid})); } catch { state = null; }
    const vehicles = contents.filter(r => r.contentTypeId === RWF.vehicleType).map(r => ({key: r.key, name: contentName(r, p.uuid), speed: number(r.fields?.vitesse) ?? 0, handling: number(r.fields?.maniabilite) ?? 0}));
    const vehicle = vehicles.find(v => v.key === p.means) ?? null, means = vehicle ? vehicle.key : FOOT;
    const raw = vehicle ? vehicle.speed : footSpeed, speed = cap !== null ? Math.min(raw, cap) : raw;
    rows.push({...p, means, vehicles, vehicle, speed, gauge: counter(state, RWF.gauge), endurance: await runtime.tokenBarValue(versionId, p.uuid, "rta.endurance.points").catch(() => null), playable: Boolean(state) && canAct(p.uuid)});
  }
  const reference = rows.find(r => r.uuid === pursuit.referenceUuid) ?? null;
  for (const row of rows) {
    row.reference = row === reference;
    row.advantage = row.reference ? 0 : speedAdvantage(row.speed, reference?.speed ?? null);
    row.status = pursuitStatus(row.role, row.gauge, bound);
    row.ends = gaugeEnds(row.role);
    row.moves = [];
    if (!row.playable || row.reference) continue;
    const context = actionContext({actorUuid: row.uuid, contentKey: row.vehicle?.key ?? null, input: {vitesse: row.advantage}, userId, isGM});
    for (const move of RWF.moves) row.moves.push({move, actionId: moveAction(move, row.means), contentKey: row.vehicle?.key ?? null, label: `RWFTOOLS.Pursuit.Move.${move}`, ...(await usable(runtime, versionId, ruleset, moveAction(move, row.means), context))});
    row.moves.push({move: "stop", actionId: RWF.stop, contentKey: null, label: "RWFTOOLS.Pursuit.Move.stop", ...(await usable(runtime, versionId, ruleset, RWF.stop, context))});
  }
  return {bound, cap: pursuit.cap, rows, reference: reference?.uuid ?? null, finished: rows.filter(r => r.status.done)};
}
