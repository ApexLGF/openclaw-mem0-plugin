import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, PluginState } from "../types.js";
import { buildAddOptions } from "../helpers.js";
import { Namespace } from "../namespace.js";

export function registerMemoryStore(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  api.registerTool(
    {
      name: "memory_store",
      label: "Memory Store",
      description:
        "Save important information in long-term memory via Mem0. Use for preferences, facts, decisions, and anything worth remembering. " +
        "When agent isolation is enabled, memories are private to the current agent by default. " +
        'Use scope "shared" for knowledge that ALL agents should access — e.g. user profile, company facts, cross-team decisions, or shared context. ' +
        'Use scope "private" (default) for agent-specific notes, working context, or domain-specific preferences.',
      parameters: Type.Object({
        text: Type.String({ description: "Information to remember" }),
        userId: Type.Optional(
          Type.String({
            description: "User ID to scope this memory",
          }),
        ),
        metadata: Type.Optional(
          Type.Record(Type.String(), Type.Unknown(), {
            description: "Optional metadata to attach to this memory",
          }),
        ),
        longTerm: Type.Optional(
          Type.Boolean({
            description:
              "Store as long-term (user-scoped) memory. Default: true. Set to false for session-scoped memory.",
          }),
        ),
        scope: Type.Optional(
          Type.Union([
            Type.Literal("private"),
            Type.Literal("shared"),
          ], {
            description:
              'Memory visibility scope (only effective when agent isolation is enabled). ' +
              '"private" (default): only this agent can see it. ' +
              '"shared": all agents can see it — use for user preferences, company knowledge, cross-agent decisions.',
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { text, userId, longTerm = true, scope = "private" } = params as {
          text: string;
          userId?: string;
          metadata?: Record<string, unknown>;
          longTerm?: boolean;
          scope?: "private" | "shared";
        };

        try {
          const runId = !longTerm && state.currentSessionId ? state.currentSessionId : undefined;
          const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;

          // When scope is "shared" and agent isolation is enabled, write to pool_shared
          const isSharedWrite = cfg.agentIsolation && scope === "shared";
          const effectiveUserId = isSharedWrite ? Namespace.SHARED : (userId || undefined);
          const addOpts = buildAddOptions(cfg, effectiveUserId, runId, isSharedWrite ? undefined : agentId);

          api.logger.info(
            `openclaw-mem0-plugin: memory_store: userId=${addOpts.user_id}, runId=${runId}, content=${text}`,
          );
          const result = await provider.add(
            [{ role: "user", content: text }],
            addOpts,
          );

          const added =
            result.results?.filter((r) => r.event === "ADD") ?? [];
          const updated =
            result.results?.filter((r) => r.event === "UPDATE") ?? [];

          const summary = [];
          if (added.length > 0)
            summary.push(
              `${added.length} new memor${added.length === 1 ? "y" : "ies"} added`,
            );
          if (updated.length > 0)
            summary.push(
              `${updated.length} memor${updated.length === 1 ? "y" : "ies"} updated`,
            );
          if (summary.length === 0)
            summary.push("No new memories extracted");

          return {
            content: [
              {
                type: "text",
                text: `Stored: ${summary.join(", ")}. ${result.results?.map((r) => `[${r.event}] ${r.memory}`).join("; ") ?? ""}`,
              },
            ],
            details: {
              action: "stored",
              results: result.results,
            },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Memory store failed: ${String(err)}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memory_store" },
  );
}
