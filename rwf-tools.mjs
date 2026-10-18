import {MODULE_ID, SOCKET} from "./src/test-request-model.mjs";
import {installTestRequests, ensureMacros, openTestRequest} from "./src/test-request.mjs";
import {registerHudSettings, refreshOnChanges} from "./src/hud-common.mjs";
import {COMBAT_HUD_ID, openCombatHud, serveEndTurn} from "./src/combat-hud.mjs";
import {PURSUIT_HUD_ID, openPursuitHud} from "./src/pursuit-hud.mjs";

Hooks.once("init", () => {
  registerHudSettings();
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({openTestRequest, openCombatHud, openPursuitHud});
});

Hooks.once("ready", async () => {
  installTestRequests();
  game.socket.on(SOCKET, (message, senderId) => { if (message?.type === "hud.endTurn") serveEndTurn(message, typeof senderId === "string" ? senderId : null); });
  refreshOnChanges([COMBAT_HUD_ID, PURSUIT_HUD_ID]);
  // One at a time: the GM's own macro creations fire createMacro while it is still making the others.
  let queue = Promise.resolve();
  const macros = () => (queue = queue.then(ensureMacros).catch(error => console.error("RWF tools | Macro", error)));
  await macros();
  // A player who logged in before the GM made the macros gets them as soon as they exist.
  Hooks.on("createMacro", macro => { if (macro.flags?.[MODULE_ID]) macros(); });
});
