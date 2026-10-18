import {MODULE_ID} from "./src/test-request-model.mjs";
import {installTestRequests, ensureRequestMacro, openTestRequest} from "./src/test-request.mjs";

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({openTestRequest});
});

Hooks.once("ready", async () => {
  installTestRequests();
  try { await ensureRequestMacro(); } catch (error) { console.error("RWF tools | Macro", error); }
});
