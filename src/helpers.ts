import type { Mem0Config, AddOptions, SearchOptions } from "./types.js";
import { Namespace, NamespaceManager } from "./namespace.js";

/** Convert Record<string, string> categories to the array format mem0ai expects */
export function categoriesToArray(
  cats: Record<string, string>,
): Array<Record<string, string>> {
  return Object.entries(cats).map(([key, value]) => ({ [key]: value }));
}

/**
 * Build add options for storing memories.
 *
 * When agentIsolation is enabled and agentId is provided,
 * writes go to the agent's private namespace.
 */
export function buildAddOptions(
  cfg: Mem0Config,
  userIdOverride?: string,
  runId?: string,
  agentId?: string,
): AddOptions {
  let userId: string;
  if (userIdOverride) {
    userId = userIdOverride;
  } else if (cfg.agentIsolation && agentId) {
    const ns = new NamespaceManager(cfg.userId);
    userId = ns.getWriteUserId(agentId);
  } else {
    userId = cfg.userId;
  }

  const opts: AddOptions = { user_id: userId };
  if (runId) opts.run_id = runId;
  if (cfg.mode === "platform") {
    opts.custom_instructions = cfg.customInstructions;
    opts.custom_categories = categoriesToArray(cfg.customCategories);
    opts.enable_graph = cfg.enableGraph;
    opts.output_format = "v1.1";
  }
  return opts;
}

/**
 * Build search options. Returns an array of SearchOptions — one per namespace to query.
 *
 * When agentIsolation is enabled and agentId is provided,
 * returns options for both private and shared namespaces.
 * Otherwise returns a single-element array with the default userId.
 */
export function buildSearchOptions(
  cfg: Mem0Config,
  userIdOverride?: string,
  limit?: number,
  runId?: string,
  agentId?: string,
): SearchOptions[] {
  function makeOpts(userId: string): SearchOptions {
    const opts: SearchOptions = {
      user_id: userId,
      top_k: limit ?? cfg.topK,
      limit: limit ?? cfg.topK,
      threshold: cfg.searchThreshold,
      keyword_search: true,
      reranking: true,
    };
    if (runId) opts.run_id = runId;
    return opts;
  }

  if (userIdOverride) {
    return [makeOpts(userIdOverride)];
  }

  if (cfg.agentIsolation && agentId) {
    const ns = new NamespaceManager(cfg.userId);
    return ns.getSearchUserIds(agentId, !!cfg.systemMemoryFile).map(makeOpts);
  }

  // No isolation — still include system_knowledge if systemMemoryFile is configured
  const ids = [cfg.userId];
  if (cfg.systemMemoryFile) {
    ids.push(Namespace.SYSTEM);
  }
  return ids.map(makeOpts);
}
