import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, MemoryItem, PluginState } from "../types.js";
import { buildSearchOptions } from "../helpers.js";

export function registerMemoryForget(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  api.registerTool(
    {
      name: "memory_forget",
      label: "Memory Forget",
      description:
        "Delete memories from Mem0. Provide a specific memoryId to delete directly, or a query to search and delete matching memories. GDPR-compliant.",
      parameters: Type.Object({
        query: Type.Optional(
          Type.String({
            description: "Search query to find memory to delete",
          }),
        ),
        memoryId: Type.Optional(
          Type.String({ description: "Specific memory ID to delete" }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { query, memoryId } = params as {
          query?: string;
          memoryId?: string;
        };

        try {
          if (memoryId) {
            await provider.delete(memoryId);
            return {
              content: [
                { type: "text", text: `Memory ${memoryId} forgotten.` },
              ],
              details: { action: "deleted", id: memoryId },
            };
          }

          if (query) {
            const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;
            const optsList = buildSearchOptions(cfg, undefined, 5, undefined, agentId);
            let results: MemoryItem[] = [];
            for (const opts of optsList) {
              results.push(...await provider.search(query, opts));
            }
            // Deduplicate
            const seenIds = new Set<string>();
            results = results.filter((r) => {
              if (seenIds.has(r.id)) return false;
              seenIds.add(r.id);
              return true;
            });

            if (!results || results.length === 0) {
              return {
                content: [
                  { type: "text", text: "No matching memories found." },
                ],
                details: { found: 0 },
              };
            }

            if (
              results.length === 1 ||
              (results[0].score ?? 0) > 0.9
            ) {
              await provider.delete(results[0].id);
              return {
                content: [
                  {
                    type: "text",
                    text: `Forgotten: "${results[0].memory}"`,
                  },
                ],
                details: { action: "deleted", id: results[0].id },
              };
            }

            const list = results
              .map(
                (r) =>
                  `- [${r.id}] ${r.memory.slice(0, 80)}${r.memory.length > 80 ? "..." : ""} (score: ${((r.score ?? 0) * 100).toFixed(0)}%)`,
              )
              .join("\n");

            const candidates = results.map((r) => ({
              id: r.id,
              memory: r.memory,
              score: r.score,
            }));

            return {
              content: [
                {
                  type: "text",
                  text: `Found ${results.length} candidates. Specify memoryId to delete:\n${list}`,
                },
              ],
              details: { action: "candidates", candidates },
            };
          }

          return {
            content: [
              { type: "text", text: "Provide a query or memoryId." },
            ],
            details: { error: "missing_param" },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Memory forget failed: ${String(err)}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memory_forget" },
  );
}
