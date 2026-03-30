import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, MemoryItem, PluginState } from "./types.js";
import { buildSearchOptions } from "./helpers.js";

export function registerCli(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  api.registerCli(
    ({ program }) => {
      const mem0 = program
        .command("mem0")
        .description("Mem0 memory plugin commands");

      mem0
        .command("search")
        .description("Search memories in Mem0")
        .argument("<query>", "Search query")
        .option("--limit <n>", "Max results", String(cfg.topK))
        .option("--scope <scope>", 'Memory scope: "session", "long-term", or "all"', "all")
        .action(async (query: string, opts: { limit: string; scope: string }) => {
          try {
            const limit = parseInt(opts.limit, 10);
            const scope = opts.scope as "session" | "long-term" | "all";

            let allResults: MemoryItem[] = [];
            const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;

            if (scope === "session" || scope === "all") {
              if (state.currentSessionId) {
                const optsList = buildSearchOptions(cfg, undefined, limit, state.currentSessionId, agentId);
                for (const opts of optsList) {
                  const sessionResults = await provider.search(query, opts);
                  if (sessionResults?.length) {
                    allResults.push(...sessionResults.map((r) => ({ ...r, _scope: "session" as const })));
                  }
                }
              } else if (scope === "session") {
                console.log("No active session ID available for session-scoped search.");
                return;
              }
            }

            if (scope === "long-term" || scope === "all") {
              const optsList = buildSearchOptions(cfg, undefined, limit, undefined, agentId);
              for (const opts of optsList) {
                const longTermResults = await provider.search(query, opts);
                if (longTermResults?.length) {
                  allResults.push(...longTermResults.map((r) => ({ ...r, _scope: "long-term" as const })));
                }
              }
            }

            // Deduplicate
            const seen = new Set<string>();
            allResults = allResults.filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });

            if (!allResults.length) {
              console.log("No memories found.");
              return;
            }

            const output = allResults.map((r) => ({
              id: r.id,
              memory: r.memory,
              score: r.score,
              scope: (r as any)._scope,
              categories: r.categories,
              created_at: r.created_at,
            }));
            console.log(JSON.stringify(output, null, 2));
          } catch (err) {
            console.error(`Search failed: ${String(err)}`);
          }
        });

      mem0
        .command("stats")
        .description("Show memory statistics from Mem0")
        .action(async () => {
          try {
            const memories = await provider.getAll({
              user_id: cfg.userId,
            });
            console.log(`Mode: ${cfg.mode}`);
            console.log(`User: ${cfg.userId}`);
            console.log(
              `Total memories: ${Array.isArray(memories) ? memories.length : "unknown"}`,
            );
            console.log(`Graph enabled: ${cfg.enableGraph}`);
            console.log(
              `Auto-recall: ${cfg.autoRecall}, Auto-capture: ${cfg.autoCapture}`,
            );
          } catch (err) {
            console.error(`Stats failed: ${String(err)}`);
          }
        });
    },
    { commands: ["mem0"] },
  );
}
