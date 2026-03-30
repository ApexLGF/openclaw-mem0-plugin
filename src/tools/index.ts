import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, PluginState } from "../types.js";
import { registerMemorySearch } from "./memory-search.js";
import { registerMemoryStore } from "./memory-store.js";
import { registerMemoryGet } from "./memory-get.js";
import { registerMemoryList } from "./memory-list.js";
import { registerMemoryForget } from "./memory-forget.js";

export function registerTools(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  registerMemorySearch(api, cfg, provider, state);
  registerMemoryStore(api, cfg, provider, state);
  registerMemoryGet(api, provider);
  registerMemoryList(api, cfg, provider, state);
  registerMemoryForget(api, cfg, provider, state);
}
