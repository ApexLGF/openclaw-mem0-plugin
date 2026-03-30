/**
 * OpenClaw Memory (Mem0) Plugin
 *
 * Long-term memory via Mem0 — supports both the Mem0 platform
 * and the open-source self-hosted SDK. Uses the official `mem0ai` package.
 *
 * Features:
 * - 5 tools: memory_search, memory_list, memory_store, memory_get, memory_forget
 *   (with session/long-term scope support via scope and longTerm parameters)
 * - Short-term (session-scoped) and long-term (user-scoped) memory
 * - Auto-recall: injects relevant memories (both scopes) before each agent turn
 * - Auto-capture: stores key facts scoped to the current session after each agent turn
 * - CLI: openclaw mem0 search, openclaw mem0 stats
 * - Dual mode: platform or open-source (self-hosted)
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { PluginState } from "./types.js";
import { mem0ConfigSchema } from "./config.js";
import { createProvider } from "./providers/index.js";
import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks.js";
import { registerCli } from "./cli.js";

const memoryPlugin = {
  id: "openclaw-mem0-plugin",
  name: "Memory (Mem0)",
  description:
    "Mem0 memory backend — Mem0 platform or self-hosted open-source",
  kind: "memory" as const,
  configSchema: mem0ConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = mem0ConfigSchema.parse(api.pluginConfig);
    const provider = createProvider(cfg, api);
    const state: PluginState = {};

    api.logger.info(
      `openclaw-mem0-plugin: registered (mode: ${cfg.mode}, user: ${cfg.userId}, graph: ${cfg.enableGraph}, autoRecall: ${cfg.autoRecall}, autoCapture: ${cfg.autoCapture}, agentIsolation: ${cfg.agentIsolation})`,
    );

    registerTools(api, cfg, provider, state);
    registerHooks(api, cfg, provider, state);
    registerCli(api, cfg, provider, state);

    api.registerService({
      id: "openclaw-mem0-plugin",
      start: () => {
        api.logger.info(
          `openclaw-mem0-plugin: initialized (mode: ${cfg.mode}, user: ${cfg.userId}, autoRecall: ${cfg.autoRecall}, autoCapture: ${cfg.autoCapture})`,
        );
      },
      stop: () => {
        api.logger.info("openclaw-mem0-plugin: stopped");
      },
    });
  },
};

export default memoryPlugin;
