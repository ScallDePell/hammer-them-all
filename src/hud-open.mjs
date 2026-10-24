/* The HUD opens on its own for the players in it: when a combat or a pursuit starts, when one of their characters
   joins one that runs, and when they log in during one. Once per combat: a player who closes it opens it again with
   the macro. */
import {MODULE_ID} from "./test-request-model.mjs";

/** Which HUD a player opens for a combat: "pursuit", "combat", or null when it does not run or none of their
 * characters is in it. combatants: [{owned, playerOwned}]. */
export function hudToOpen({started, pursuit, combatants = [], isGM = false}) {
  if (isGM || !started) return null;
  if (!combatants.some(c => c.owned && c.playerOwned)) return null;
  return pursuit ? "pursuit" : "combat";
}

export function installHudOpening({openCombatHud, openPursuitHud, hooks = globalThis.Hooks}) {
  const opened = new Set();
  const look = combat => {
    const game = globalThis.game;
    if (!combat?.id || opened.has(combat.id)) return;
    const hud = hudToOpen({started: Boolean(combat.started), pursuit: Boolean(combat.getFlag?.(MODULE_ID, "pursuit")), isGM: Boolean(game.user.isGM),
      combatants: [...(combat.combatants ?? [])].map(c => ({owned: Boolean(c.isOwner || c.actor?.isOwner), playerOwned: Boolean(c.actor?.hasPlayerOwner)}))});
    if (!hud) return;
    opened.add(combat.id);
    try { if (hud === "pursuit") openPursuitHud(combat.id); else openCombatHud(); } catch (error) { console.error(`${MODULE_ID} | HUD not opened`, error); }
  };
  hooks.on("updateCombat", combat => look(combat));
  hooks.on("createCombatant", combatant => look(combatant.parent ?? combatant.combat));
  hooks.on("deleteCombat", combat => opened.delete(combat.id));
  for (const combat of globalThis.game.combats ?? []) look(combat);
  return look;
}
