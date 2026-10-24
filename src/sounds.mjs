/* The sounds of combats and pursuits, on each client for itself: the start of the encounter, "your turn" and "next up"
   for the player whose character acts, and a blow when a combatant falls out of the combat. They come from Foundry's
   combat themes (the world's "Combat Theme" when one is chosen, else Epic). With a Combat Theme chosen, Foundry plays
   the start and the turns itself, so only the fall is played here. The module's "Sounds" setting cuts all of them,
   Foundry's combat theme sounds included. */
import {MODULE_ID} from "./test-request-model.mjs";

export const SOUND_SETTING = "sounds";
const DEFAULT_THEME = "epic";

/** The cues for a change of the combat: before / after: {round, combatantId} (round 0: not started); mine / mineNext:
 * whether this user plays the combatant acting / the next one. themeOwnsTurns: Foundry's theme plays them already. */
export function combatCues({before = null, after, mine = false, mineNext = false, themeOwnsTurns = false}) {
  if (themeOwnsTurns || !after || !(after.round >= 1)) return [];
  if (!(before?.round >= 1)) return ["startEncounter", ...(mine ? ["yourTurn"] : [])];
  if (before.round === after.round && before.combatantId === after.combatantId) return [];
  return mine ? ["yourTurn"] : mineNext ? ["nextUp"] : [];
}

/** A file for a cue, from a theme of CONFIG.Combat.sounds ({startEncounter: [...], ...}), picked by pick (0..1). */
export function cueFile(theme, cue, pick = Math.random()) {
  const files = [theme?.[cue]].flat().filter(Boolean);
  return files.length ? files[Math.min(files.length - 1, Math.floor(pick * files.length))] : null;
}

export function registerSoundSetting() {
  globalThis.game.settings.register(MODULE_ID, SOUND_SETTING, {name: "RWFTOOLS.Settings.Sounds", hint: "RWFTOOLS.Settings.SoundsHint", scope: "client", config: true, type: Boolean, default: true});
}
export function soundsOn() { try { return globalThis.game.settings.get(MODULE_ID, SOUND_SETTING) !== false; } catch { return true; } }
const coreTheme = () => { try { return globalThis.game.settings.get("core", "combatTheme") ?? "none"; } catch { return "none"; } };

function play(src) {
  if (!src || !soundsOn()) return;
  const AudioHelper = globalThis.foundry?.audio?.AudioHelper ?? globalThis.AudioHelper;
  let volume = 0.8;
  try { volume = globalThis.game.settings.get("core", "globalInterfaceVolume") ?? volume; } catch { /* the default */ }
  try { AudioHelper?.play?.({src, volume, autoplay: true, loop: false}, false); } catch (error) { console.warn(`${MODULE_ID} | Sound not played`, src, error); }
}
const playCue = cue => {
  const sounds = globalThis.CONFIG?.Combat?.sounds ?? {}, theme = coreTheme();
  play(cueFile(sounds[theme !== "none" && sounds[theme] ? theme : DEFAULT_THEME], cue));
};

/** This user plays a combatant: a player who owns it; the GM never (it plays them all). */
const plays = combatant => Boolean(combatant) && !globalThis.game.user.isGM && Boolean(combatant.isOwner || combatant.actor?.isOwner);

export function installSounds({hooks = globalThis.Hooks, CombatClass = globalThis.CONFIG?.Combat?.documentClass, delay = 300} = {}) {
  // Foundry's own combat theme sounds go quiet with the setting too.
  const proto = CombatClass?.prototype, original = proto?._playCombatSound;
  if (original && !original.htmSounds) {
    const wrapped = function (...args) { return soundsOn() ? original.apply(this, args) : undefined; };
    wrapped.htmSounds = true;
    proto._playCombatSound = wrapped;
  }
  const seen = new Map(), state = combat => ({round: Number(combat.round ?? 0), combatantId: combat.combatant?.id ?? null});
  for (const combat of globalThis.game.combats ?? []) seen.set(combat.id, state(combat));
  hooks.on("createCombat", combat => seen.set(combat.id, state(combat)));
  hooks.on("deleteCombat", combat => seen.delete(combat.id));
  // A new round moves the turn more than once (initiative rerolled, first turn set again): the cues wait for it to settle.
  const timers = new Map();
  hooks.on("updateCombat", combat => {
    clearTimeout(timers.get(combat.id));
    timers.set(combat.id, setTimeout(() => {
      timers.delete(combat.id);
      const before = seen.get(combat.id) ?? null, after = state(combat);
      seen.set(combat.id, after);
      for (const cue of combatCues({before, after, mine: plays(combat.combatant), mineNext: plays(combat.nextCombatant), themeOwnsTurns: coreTheme() !== "none"})) playCue(cue);
    }, delay));
  });
  // A combatant falls: a blow on every client.
  hooks.on("updateCombatant", (combatant, changed) => {
    if (changed?.defeated === true && combatant.parent?.started) play(globalThis.CONFIG?.sounds?.combat ?? null);
  });
}
