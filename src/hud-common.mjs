/* What both HUDs share in Foundry: the dice mode of this client, the pursuit kept in the world, running an RWF Action
   with its chat card, and re-rendering an open HUD when the game changes. */
import {MODULE_ID} from "./test-request-model.mjs";
import {DICE_MODES, actionContext, emptyPursuit} from "./hud-model.mjs";

export const t = key => globalThis.game?.i18n?.localize?.(key) ?? key;
export const rta = () => globalThis.game?.ruleThemAll;
export const notifyError = error => { console.error("RWF tools |", error); globalThis.ui?.notifications?.error?.(error?.message ?? String(error)); };
export const ApplicationV2 = () => globalThis.foundry.applications.api.ApplicationV2;

export function registerHudSettings() {
  const settings = globalThis.game.settings;
  settings.register(MODULE_ID, "diceMode", {scope: "client", config: false, type: String, default: "foundry"});
  settings.register(MODULE_ID, "pursuit", {scope: "world", config: false, type: Object, default: emptyPursuit()});
}

export function diceMode() {
  try { const mode = globalThis.game.settings.get(MODULE_ID, "diceMode"); return DICE_MODES.includes(mode) ? mode : "foundry"; } catch { return "foundry"; }
}
export const setDiceMode = mode => globalThis.game.settings.set(MODULE_ID, "diceMode", DICE_MODES.includes(mode) ? mode : "foundry");

/** An owned Content by the name of its Item, else its template's. */
export function contentNamer(ruleset, actorUuid) {
  const actor = globalThis.fromUuidSync?.(actorUuid);
  return row => actor?.items?.get?.(row.key)?.name ?? ruleset.contentTemplates?.find(tpl => tpl.id === row.templateId)?.nameKey ?? row.key;
}

/** Why an Action was refused, in words: the name of the Condition that stopped it. */
export function refusal(result, ruleset) {
  const condition = result?.conditionId ? ruleset?.conditions?.find(c => c.id === result.conditionId) : null;
  return condition ? t(condition.nameKey) : t("RWFTOOLS.Error.NotAllowed");
}

/** Run an RWF Action for a combatant and post its chat card; returns the result, throws when it is refused. */
export async function runAction({versionId, ruleset, actorUuid, actionId, targetUuid = null, contentKey = null, input = {}}) {
  const game = globalThis.game, runtime = rta().runtime;
  const result = await runtime.executeAction(versionId, actionId, actionContext({actorUuid, targetUuid, contentKey, input, userId: game.user?.id ?? null, isGM: game.user?.isGM}));
  if (!result?.allowed) throw new Error(refusal(result, ruleset));
  const actor = globalThis.fromUuidSync?.(actorUuid);
  await rta().chat.postActionCard(result, versionId, {speaker: globalThis.ChatMessage.getSpeaker({actor})});
  return result;
}

/** Re-render the open HUDs (ids) a little after the game changes, once for a burst of changes. */
export function refreshOnChanges(ids, hooks = globalThis.Hooks) {
  let timer = null;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { for (const id of ids) globalThis.foundry?.applications?.instances?.get?.(id)?.render(); }, 100);
  };
  for (const hook of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant", "targetToken",
    "updateActor", "createItem", "updateItem", "deleteItem", "updateToken", "createToken", "deleteToken", "canvasReady"]) hooks.on(hook, refresh);
  hooks.on("updateSetting", setting => { const key = String(setting?.key ?? ""); if (key.startsWith(`${MODULE_ID}.`) || key.startsWith("rule-them-all.")) refresh(); });
  return refresh;
}
