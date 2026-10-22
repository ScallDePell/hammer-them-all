import {MODULE_ID, SOCKET} from "./src/test-request-model.mjs";
import {installTestRequests, ensureMacros, openTestRequest} from "./src/test-request.mjs";
import {registerHudSettings, refreshOnChanges} from "./src/hud-common.mjs";
import {COMBAT_HUD_ID, openCombatHud, serveEndTurn, serveTarget, installCombatTargets} from "./src/combat-hud.mjs";
import {PURSUIT_HUD_ID, openPursuitHud, installPursuitKeeper, servePursuitTarget, servePursuitOpen} from "./src/pursuit-hud.mjs";
import {installTurnGuard} from "./src/turn-guard.mjs";

Hooks.once("init", () => {
  registerHudSettings();
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({openTestRequest, openCombatHud, openPursuitHud});
});

Hooks.once("ready", async () => {
  installTestRequests();
  game.socket.on(SOCKET, (message, senderId) => {
    const sender = typeof senderId === "string" ? senderId : null;
    if (message?.type === "hud.endTurn") serveEndTurn(message, sender);
    if (message?.type === "hud.target") serveTarget(message, sender);
    if (message?.type === "pursuit.target") servePursuitTarget(message, sender);
    if (message?.type === "pursuit.open") servePursuitOpen(message);
  });
  refreshOnChanges([COMBAT_HUD_ID, PURSUIT_HUD_ID]);
  installTurnGuard();
  installCombatTargets();
  installPursuitKeeper();
  // One at a time: the GM's own macro creations fire createMacro while it is still making the others.
  let queue = Promise.resolve();
  const macros = () => (queue = queue.then(ensureMacros).catch(error => console.error("Hammer Them'All | Macro", error)));
  await macros();
  // A player who logged in before the GM made the macros gets them as soon as they exist.
  Hooks.on("createMacro", macro => { if (macro.flags?.[MODULE_ID]) macros(); });
});
