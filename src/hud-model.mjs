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

/** Outside its turn a combatant waits: no button of its cards can be used, for the one reason said once. */
export function waitForTurn(combatant) {
  return {...combatant, waiting: true, cards: combatant.cards.map(card => ({...card, buttons: card.buttons.map(b => ({...b, allowed: false, reason: "RWFTOOLS.Combat.WaitTurn", range: null, waiting: true}))}))};
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

/* Targets are kept per combatant in the combat (rwf-tools flag "targets": {combatantId: target combatantId}): a new
   combat starts with none, a target stays until its combatant picks another one or it is out of the combat. */

/** The combatant a combatant aims at, or null when it has none or that one is gone or out of combat (defeated).
 * combatants: [{id, defeated}]. */
export function keptTarget({targets = {}, combatantId, combatants = []}) {
  const id = targets?.[combatantId];
  const target = id && id !== combatantId ? combatants.find(c => c.id === id) : null;
  return target && !target.defeated ? target.id : null;
}

/** The entries of the targets to remove: those of a combatant gone, and those aiming at a combatant gone or defeated. */
export function staleTargets({targets = {}, combatants = []}) {
  const alive = new Map(combatants.map(c => [c.id, c]));
  return Object.entries(targets ?? {}).filter(([from, to]) => !alive.has(from) || !alive.get(to) || alive.get(to).defeated).map(([from]) => from);
}

/** The combatant whose target a user's own Foundry targeting sets: the one acting when this user plays it (the GM: a
 * combatant no player owns), else, for a player, their own character, else a combatant they own. */
export function aimingCombatant({combatants = [], activeId = null, isGM = false, characterUuid = null}) {
  const active = combatants.find(c => c.id === activeId);
  if (isGM) return active && !active.playerOwned ? active : null;
  if (active?.owned) return active;
  const own = combatants.filter(c => c.owned && !c.defeated);
  return own.find(c => c.actorUuid === characterUuid) ?? own[0] ?? null;
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

/* A pursuit is prepared by the GM (a draft kept in the world: who flees, who pursues, on foot or in which vehicle),
   then run as a Foundry combat flagged as a pursuit: initiative sets the order of play, the fleeing side gets a bonus
   in the first round, and each participant moves its own gauge on its turn. */

export const ROLES = ["fuyard", "poursuivant"];
export const FOOT = "pied";
export const FLEE_BONUS = 2;
export const FLEEING = ["pnj", "pj"];
export const emptyPursuit = () => ({phase: "none", fleeing: "pnj", cap: 0, participants: []});

const roleOf = (playerOwned, fleeing) => (fleeing === "pj") === Boolean(playerOwned) ? "fuyard" : "poursuivant";
const readParticipant = p => ({uuid: p.uuid, name: String(p.name ?? ""), role: ROLES.includes(p.role) ? p.role : "poursuivant",
  means: typeof p.means === "string" && p.means ? p.means : FOOT, playerOwned: Boolean(p.playerOwned),
  ...(typeof p.tokenId === "string" ? {tokenId: p.tokenId} : {}), ...(typeof p.combatantId === "string" ? {combatantId: p.combatantId} : {})});
const readParticipants = list => {
  const out = (Array.isArray(list) ? list : []).filter(p => p && typeof p.uuid === "string").map(readParticipant);
  return out.filter((p, i) => out.findIndex(q => q.uuid === p.uuid) === i);
};

/** The pursuit the GM prepares, kept in the world: {phase: "none" | "setup", fleeing: which side flees by default
 * ("pnj" | "pj"), cap: the terrain's speed cap (0: none), participants: [{uuid, tokenId, name, role, means, playerOwned}]}. */
export function readPursuit(stored) {
  const value = stored && typeof stored === "object" ? stored : {};
  const participants = readParticipants(value.participants);
  return {phase: value.phase === "setup" ? "setup" : "none", fleeing: FLEEING.includes(value.fleeing) ? value.fleeing : "pnj", cap: Math.max(0, number(value.cap) ?? 0), participants};
}

/** The pursuit a combat runs (its rwf-tools flag "pursuit"): {cap, participants: [{uuid, combatantId, name, role, means}],
 * outcomes: {uuid: the status key it ended with}}. */
export function readRunningPursuit(flag) {
  const value = flag && typeof flag === "object" ? flag : {};
  const outcomes = Object.fromEntries(Object.entries(value.outcomes && typeof value.outcomes === "object" ? value.outcomes : {}).filter(([, key]) => typeof key === "string"));
  return {cap: Math.max(0, number(value.cap) ?? 0), participants: readParticipants(value.participants), outcomes};
}

/** New participants join the side the draft says: the fleeing side ("pnj" or "pj"), the others pursue. */
export function addParticipants(pursuit, candidates) {
  const next = {...pursuit, participants: [...pursuit.participants]};
  for (const c of candidates) if (!next.participants.some(p => p.uuid === c.uuid)) next.participants.push(readParticipant({...c, role: roleOf(c.playerOwned, next.fleeing), means: FOOT}));
  return next;
}
/** Who flees: the non-player characters or the player characters; every participant takes its side again. */
export const setFleeing = (pursuit, fleeing) => FLEEING.includes(fleeing) ? {...pursuit, fleeing, participants: pursuit.participants.map(p => ({...p, role: roleOf(p.playerOwned, fleeing)}))} : pursuit;
/** Whether a prepared pursuit can start: someone on each side. */
export const canLaunch = pursuit => ROLES.every(role => pursuit.participants.some(p => p.role === role));

/** Sign of a speed difference: +1 faster than the other side, −1 slower, 0 as fast (or no one to compare with). */
export const speedAdvantage = (speed, reference) => speed === null || reference === null || reference === undefined ? 0 : Math.sign(speed - reference);

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

/** Whether the pursuit is over: no one left running on one of the sides. rows: [{role, status: {done}}]. */
export const pursuitOver = rows => ROLES.some(role => !rows.some(r => r.role === role && !r.status.done));

/** A participant's means and speed: on foot, or one of its vehicles, capped by the terrain. */
async function meansOf(runtime, versionId, ruleset, p, {cap, contentName}) {
  let state = null, contents = [];
  try { state = await runtime.getContainerState(p.uuid); contents = await runtime.listOwnedContents(versionId, p.uuid, actionContext({actorUuid: p.uuid})); } catch { state = null; }
  const footSpeed = number(ruleset.parameters?.find(x => x.id === RWF.footSpeed)?.value) ?? -1;
  const vehicles = contents.filter(r => r.contentTypeId === RWF.vehicleType).map(r => ({key: r.key, name: contentName(r, p.uuid), speed: number(r.fields?.vitesse) ?? 0, handling: number(r.fields?.maniabilite) ?? 0}));
  const vehicle = vehicles.find(v => v.key === p.means) ?? null, raw = vehicle ? vehicle.speed : footSpeed;
  return {state, vehicles, vehicle, means: vehicle ? vehicle.key : FOOT, speed: cap > 0 ? Math.min(raw, cap) : raw};
}

/** The pursuit being prepared: each participant with the vehicles it could use. */
export async function setupView(runtime, {versionId, ruleset, pursuit, contentName = row => row.name ?? row.templateId}) {
  const rows = [];
  for (const p of pursuit.participants) {
    const {vehicles, vehicle, means, speed} = await meansOf(runtime, versionId, ruleset, p, {cap: pursuit.cap, contentName});
    rows.push({...p, vehicles, vehicle, means, speed});
  }
  return {phase: "setup", fleeing: pursuit.fleeing, cap: pursuit.cap, rows, canLaunch: canLaunch(pursuit)};
}

/** The pursuit running: every participant in turn order with its gauge, its speed and its advantage over the fastest
 * of the other side still running; the moves of the one whose turn it is, when this user plays it.
 * order: the participants' uuids in turn order; activeUuid: whose turn it is; canAct(uuid): whether this user plays it. */
export async function pursuitView(runtime, {versionId, ruleset, pursuit, order = [], activeUuid = null, canAct = () => true, isGM = false, userId = null, contentName = row => row.name ?? row.templateId}) {
  const bound = number(ruleset.parameters?.find(x => x.id === RWF.gaugeBound)?.value) ?? 3;
  const rank = uuid => { const i = order.indexOf(uuid); return i < 0 ? Infinity : i; };
  const participants = [...pursuit.participants].sort((a, b) => rank(a.uuid) - rank(b.uuid));
  const rows = [];
  for (const p of participants) {
    const {state, vehicles, vehicle, means, speed} = await meansOf(runtime, versionId, ruleset, p, {cap: pursuit.cap, contentName});
    const gauge = counter(state, RWF.gauge), outcome = pursuit.outcomes?.[p.uuid];
    const status = outcome ? {key: outcome, done: true} : pursuitStatus(p.role, gauge, bound);
    rows.push({...p, means, vehicles, vehicle, speed, gauge, status, ends: gaugeEnds(p.role), active: p.uuid === activeUuid, playable: Boolean(state) && canAct(p.uuid),
      endurance: means === FOOT ? await runtime.tokenBarValue(versionId, p.uuid, "rta.endurance.points").catch(() => null) : null});
  }
  for (const row of rows) {
    const others = rows.filter(r => r.role !== row.role && !r.status.done);
    row.advantage = speedAdvantage(row.speed, others.length ? Math.max(...others.map(r => r.speed)) : null);
  }
  const current = rows.find(r => r.active) ?? null;
  if (current) {
    current.moves = [];
    if (current.playable && !current.status.done) {
      const context = actionContext({actorUuid: current.uuid, contentKey: current.vehicle?.key ?? null, input: {vitesse: current.advantage}, userId, isGM});
      for (const move of RWF.moves) current.moves.push({move, actionId: moveAction(move, current.means), contentKey: current.vehicle?.key ?? null, label: `RWFTOOLS.Pursuit.Move.${move}`, ...(await usable(runtime, versionId, ruleset, moveAction(move, current.means), context))});
      current.moves.push({move: "stop", actionId: RWF.stop, contentKey: null, label: "RWFTOOLS.Pursuit.Move.stop", ...(await usable(runtime, versionId, ruleset, RWF.stop, context))});
    }
  }
  const sides = Object.fromEntries(ROLES.map(role => [role, rows.filter(r => r.role === role)]));
  return {phase: "running", bound, cap: pursuit.cap, rows, sides, current, over: pursuitOver(rows)};
}
