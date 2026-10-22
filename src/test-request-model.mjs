/* What the GM's test request is made of, read from Rule Them'All and the active RWF Ruleset: the players who can be
   asked, the skills, the DDs, and the messages the clients exchange. Nothing here touches the screen. */

export const MODULE_ID = "hammer-them-all";
/** The module's id up to 0.6.4: its macros and the hotbar flag are taken over from it. */
export const OLD_MODULE_ID = "rwf-tools";
export const SOCKET = `module.${MODULE_ID}`;
/** The RWF Ruleset's Action for a test the GM asked for (2.1.0): the GM's client runs it with the announced d20. */
export const REQUESTED_TEST_ACTION = "test-demande";
export const SKILL_TYPE = "competence";
export const DD_TAG = "difficulte";
export const PLAYER_CHARACTER_STATE = "personnage-joueur";
export const D20_MIN = 1, D20_MAX = 20;

const enabled = entry => entry && entry.enabled !== false;
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/** The active Ruleset version when it can serve a requested test, else {reason}. */
export function requestRuleset(configurator) {
  const versionId = configurator?.getActiveVersionId?.();
  if (!versionId) return {reason: "RWFTOOLS.Error.NoRuleset"};
  let ruleset = null;
  try { ruleset = configurator.getRuntimeRuleset?.(versionId, "published"); } catch { ruleset = null; }
  if (!ruleset?.actions?.some(action => action.id === REQUESTED_TEST_ACTION && enabled(action))) return {reason: "RWFTOOLS.Error.NotRwf"};
  return {versionId, ruleset};
}

/** The skills, in the Ruleset's order: {id, label}. */
export function skillOptions(ruleset, label = key => key) {
  return (ruleset?.definitions ?? []).filter(d => enabled(d) && d.definitionTypeId === SKILL_TYPE).sort(byOrder).map(d => ({id: d.id, label: label(d.nameKey)}));
}

/** The DDs the Ruleset offers (parameters tagged "difficulte"), lowest first: {id, value, label}. */
export function ddOptions(ruleset, label = key => key) {
  return (ruleset?.parameters ?? []).filter(p => enabled(p) && (p.tags ?? []).includes(DD_TAG) && Number.isFinite(Number(p.value)))
    .map(p => ({id: p.id, value: Number(p.value), label: `${label(p.nameKey).replace(/^DD\s+/i, "")} (${Number(p.value)})`}))
    .sort((a, b) => a.value - b.value);
}
/** The DD selected first: the standard one when the Ruleset has it, else the middle one. */
export const defaultDD = options => options.find(option => option.id === "dd-standard") ?? options[Math.floor((options.length - 1) / 2)] ?? null;

/** Owner of an Actor by its own ownership (not the "all players" default): a character assigned to that player. */
const ownsCharacter = (actor, user, ownerLevel) => Number(actor?.ownership?.[user.id] ?? 0) >= ownerLevel;

/** The players who can be asked now: connected, not GM, owning an Actor of the RWF Ruleset that is a player character.
 * Returns [{userId, userName, actorUuid, actorName, img}], one row per character, players in name order.
 * isPlayerCharacter(actor): async, reads the character's Rule Them'All state. */
export async function requestCandidates({users = [], actors = [], ownerLevel = 3, isPlayerCharacter}) {
  const rows = [];
  for (const user of users) {
    if (!user?.active || user.isGM) continue;
    for (const actor of actors) {
      if (!ownsCharacter(actor, user, ownerLevel)) continue;
      if (!await isPlayerCharacter(actor)) continue;
      rows.push({userId: user.id, userName: user.name, actorUuid: actor.uuid, actorName: actor.name, img: actor.img ?? null});
    }
  }
  return rows.sort((a, b) => a.userName.localeCompare(b.userName) || a.actorName.localeCompare(b.actorName));
}

/** Whether a Rule Them'All container state is a player character of this Ruleset version. */
export const isRwfPlayerCharacter = (state, versionId) => state?.rulesetVersionId === versionId && Boolean(state?.definitionStates?.[PLAYER_CHARACTER_STATE]?.capabilityStates?.state?.active);

/** A d20 the player announces: a whole number from 1 to 20, else null. */
export function readD20(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= D20_MIN && n <= D20_MAX ? n : null;
}

/** The GM's choice is complete: at least one character, a skill and a DD of the lists. */
export function canSend({selected = [], skillId = null, ddId = null}, {skills = [], dds = []}) {
  return selected.length > 0 && skills.some(s => s.id === skillId) && dds.some(d => d.id === ddId);
}

/* Socket messages. request: GM -> one player; answer: that player -> the GM who asked; cancel: GM -> player. */
export const requestMessage = ({requestId, gmId, row, skill, dd}) => ({type: "request", requestId, gmId, userId: row.userId, actorUuid: row.actorUuid, actorName: row.actorName, skillId: skill.id, skillLabel: skill.label, ddId: dd.id, dd: dd.value, ddLabel: dd.label});
export const answerMessage = ({request, d20, manual}) => ({type: "answer", requestId: request.requestId, gmId: request.gmId, userId: request.userId, d20, manual: Boolean(manual)});
export const cancelMessage = request => ({type: "cancel", requestId: request.requestId, userId: request.userId});

/** The answer the GM's client accepts: to this GM, for a request it sent (pending: requestId -> {request}), from the
 * player it was asked of. */
export function acceptAnswer(message, pending, gmId, senderId = null) {
  if (message?.type !== "answer" || message.gmId !== gmId) return null;
  const request = pending.get(message.requestId)?.request;
  if (!request || request.userId !== message.userId || (senderId && senderId !== request.userId)) return null;
  const d20 = readD20(message.d20);
  return d20 === null ? null : {request, d20, manual: Boolean(message.manual)};
}

/** The Rule Them'All context of the requested test: the character tests the skill at the DD, with the announced d20. */
export const requestedTestContext = (request, d20) => ({
  roles: {self: {uuid: request.actorUuid}}, defaultRole: "self",
  variables: {definition: {objectKind: "definition", objectId: request.skillId}, input: {dd: request.dd, de: d20}}
});
