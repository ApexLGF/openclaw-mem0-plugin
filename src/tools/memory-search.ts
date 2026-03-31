import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, MemoryItem, PluginState } from "../types.js";
import { buildSearchOptions } from "../helpers.js";

export function registerMemorySearch(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  api.registerTool(
    {
      name: "memory_search",
      label: "Memory Search",
      description:
        "Search through long-term memories stored in Mem0. Use when you need context about user preferences, past decisions, or previously discussed topics. " +
        "When agent isolation is enabled, searches automatically include both your private memories AND shared memories accessible to all agents.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(
          Type.Number({
            description: `Max results (default: ${cfg.topK})`,
          }),
        ),
        userId: Type.Optional(
          Type.String({
            description:
              "User ID to scope search (default: configured userId)",
          }),
        ),
        scope: Type.Optional(
          Type.Union([
            Type.Literal("session"),
            Type.Literal("long-term"),
            Type.Literal("all"),
          ], {
            description:
              'Memory scope: "session" (current session only), "long-term" (user-scoped only), or "all" (both). Default: "all"',
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { query, limit, userId, scope = "all" } = params as {
          query: string;
          limit?: number;
          userId?: string;
          scope?: "session" | "long-term" | "all";
        };

        try {
          const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;
          let results: MemoryItem[] = [];

          if (scope === "session") {
            if (state.currentSessionId) {
              const optsList = buildSearchOptions(cfg, userId, limit, state.currentSessionId, agentId);
              for (const opts of optsList) {
                results.push(...await provider.search(query, opts));
              }
            }
          } else if (scope === "long-term") {
            const optsList = buildSearchOptions(cfg, userId, limit, undefined, agentId);
            for (const opts of optsList) {
              results.push(...await provider.search(query, opts));
            }
          } else {
            // "all" — search both scopes
            const longTermOptsList = buildSearchOptions(cfg, userId, limit, undefined, agentId);
            for (const opts of longTermOptsList) {
              results.push(...await provider.search(query, opts));
            }

            if (state.currentSessionId) {
              const sessionOptsList = buildSearchOptions(cfg, userId, limit, state.currentSessionId, agentId);
              for (const opts of sessionOptsList) {
                results.push(...await provider.search(query, opts));
              }
            }
          }

          // Deduplicate by ID
          const seen = new Set<string>();
          results = results.filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });

          if (!results || results.length === 0) {
            return {
              content: [
                { type: "text", text: "No relevant memories found." },
              ],
              details: { count: 0 },
            };
          }

          const text = results
            .map(
              (r, i) =>
                `${i + 1}. ${r.memory} (score: ${((r.score ?? 0) * 100).toFixed(0)}%, id: ${r.id})`,
            )
            .join("\n");

          const sanitized = results.map((r) => ({
            id: r.id,
            memory: r.memory,
            score: r.score,
            categories: r.categories,
            created_at: r.created_at,
          }));

          return {
            content: [
              {
                type: "text",
                text: `Found ${results.length} memories:\n\n${text}`,
              },
            ],
            details: { count: results.length, memories: sanitized },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Memory search failed: ${String(err)}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memory_search" },
  );
}
