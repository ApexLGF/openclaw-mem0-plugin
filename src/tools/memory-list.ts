import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, MemoryItem, PluginState } from "../types.js";
import { NamespaceManager } from "../namespace.js";

export function registerMemoryList(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  api.registerTool(
    {
      name: "memory_list",
      label: "Memory List",
      description:
        "List all stored memories for a user. Use this when you want to see everything that's been remembered, rather than searching for something specific.",
      parameters: Type.Object({
        userId: Type.Optional(
          Type.String({
            description:
              "User ID to list memories for (default: configured userId)",
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
        const { userId, scope = "all" } = params as { userId?: string; scope?: "session" | "long-term" | "all" };

        try {
          let memories: MemoryItem[] = [];

          // Resolve effective user_ids based on agent isolation
          let userIds: string[];
          if (userId) {
            userIds = [userId];
          } else if (cfg.agentIsolation && state.currentAgentId) {
            const ns = new NamespaceManager(cfg.userId);
            userIds = ns.getSearchUserIds(state.currentAgentId);
          } else {
            userIds = [cfg.userId];
          }

          if (scope === "session") {
            if (state.currentSessionId) {
              for (const uid of userIds) {
                memories.push(...await provider.getAll({
                  user_id: uid,
                  run_id: state.currentSessionId,
                }));
              }
            }
          } else if (scope === "long-term") {
            for (const uid of userIds) {
              memories.push(...await provider.getAll({ user_id: uid }));
            }
          } else {
            for (const uid of userIds) {
              memories.push(...await provider.getAll({ user_id: uid }));
            }
            if (state.currentSessionId) {
              for (const uid of userIds) {
                memories.push(...await provider.getAll({
                  user_id: uid,
                  run_id: state.currentSessionId,
                }));
              }
            }
          }

          // Deduplicate by ID
          const seen = new Set<string>();
          memories = memories.filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });

          if (!memories || memories.length === 0) {
            return {
              content: [
                { type: "text", text: "No memories stored yet." },
              ],
              details: { count: 0 },
            };
          }

          const text = memories
            .map(
              (r, i) =>
                `${i + 1}. ${r.memory} (id: ${r.id})`,
            )
            .join("\n");

          const sanitized = memories.map((r) => ({
            id: r.id,
            memory: r.memory,
            categories: r.categories,
            created_at: r.created_at,
          }));

          return {
            content: [
              {
                type: "text",
                text: `${memories.length} memories:\n\n${text}`,
              },
            ],
            details: { count: memories.length, memories: sanitized },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Memory list failed: ${String(err)}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memory_list" },
  );
}
