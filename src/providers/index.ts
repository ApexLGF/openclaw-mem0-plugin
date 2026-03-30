import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider } from "../types.js";
import { PlatformProvider } from "./platform.js";
import { OSSProvider } from "./oss.js";

export function createProvider(
  cfg: Mem0Config,
  api: OpenClawPluginApi,
): Mem0Provider {
  if (cfg.mode === "open-source") {
    return new OSSProvider(cfg.oss, cfg.customPrompt, (p) =>
      api.resolvePath(p),
    );
  }

  return new PlatformProvider(cfg.apiKey!, cfg.orgId, cfg.projectId, cfg.host);
}

export { PlatformProvider } from "./platform.js";
export { OSSProvider } from "./oss.js";
export { normalizeMemoryItem, normalizeSearchResults, normalizeAddResult } from "./normalizers.js";
