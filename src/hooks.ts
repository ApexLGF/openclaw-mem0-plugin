import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Config, Mem0Provider, MemoryItem, PluginState } from "./types.js";
import { buildAddOptions, buildSearchOptions } from "./helpers.js";
import { resolveAgentId } from "./agent-resolver.js";

export function registerHooks(
  api: OpenClawPluginApi,
  cfg: Mem0Config,
  provider: Mem0Provider,
  state: PluginState,
) {
  // Auto-recall: inject relevant memories before agent starts
  if (cfg.autoRecall) {
    api.on("before_agent_start", async (event, ctx) => {
      if (!event.prompt || event.prompt.length < 5) return;

      const sessionId = (ctx as any)?.sessionKey ?? undefined;
      if (sessionId) {
        state.currentSessionId = sessionId;
        if (cfg.agentIsolation) {
          state.currentAgentId = resolveAgentId(sessionId);
        }
      }

      try {
        const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;

        // Search across all relevant namespaces (private + shared when isolated)
        const searchOptionsList = buildSearchOptions(cfg, undefined, undefined, undefined, agentId);
        let longTermResults: MemoryItem[] = [];
        for (const searchOpts of searchOptionsList) {
          const results = await provider.search(event.prompt, searchOpts);
          longTermResults.push(...results);
        }

        // Deduplicate by id
        const seenIds = new Set<string>();
        longTermResults = longTermResults.filter((r) => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        });

        // Search session memories if we have a session ID
        let sessionResults: MemoryItem[] = [];
        if (state.currentSessionId) {
          const sessionSearchList = buildSearchOptions(cfg, undefined, undefined, state.currentSessionId, agentId);
          for (const searchOpts of sessionSearchList) {
            const results = await provider.search(event.prompt, searchOpts);
            sessionResults.push(...results);
          }
        }

        // Deduplicate session results against long-term
        const longTermIds = new Set(longTermResults.map((r) => r.id));
        const uniqueSessionResults = sessionResults.filter(
          (r) => !longTermIds.has(r.id),
        );

        if (longTermResults.length === 0 && uniqueSessionResults.length === 0) return;

        // Build context with clear labels
        let memoryContext = "";
        if (longTermResults.length > 0) {
          memoryContext += longTermResults
            .map(
              (r) =>
                `- ${r.memory}${r.categories?.length ? ` [${r.categories.join(", ")}]` : ""}`,
            )
            .join("\n");
        }
        if (uniqueSessionResults.length > 0) {
          if (memoryContext) memoryContext += "\n";
          memoryContext += "\nSession memories:\n";
          memoryContext += uniqueSessionResults
            .map((r) => `- ${r.memory}`)
            .join("\n");
        }

        const totalCount = longTermResults.length + uniqueSessionResults.length;
        api.logger.info(
          `openclaw-mem0-plugin: injecting ${totalCount} memories into context (${longTermResults.length} long-term, ${uniqueSessionResults.length} session)${cfg.agentIsolation ? ` [agent: ${state.currentAgentId ?? "main"}]` : ""}`,
        );

        return {
          systemPrompt: `<relevant-memories>\nThe following memories may be relevant to this conversation:\n${memoryContext}\n</relevant-memories>`,
        };
      } catch (err) {
        api.logger.warn(`openclaw-mem0-plugin: recall failed: ${String(err)}`);
      }
    });
  }

  // Auto-capture: store conversation context after agent ends
  if (cfg.autoCapture) {
    api.on("agent_end", async (event, ctx) => {
      if (!event.success || !event.messages || event.messages.length === 0) {
        return;
      }

      const sessionId = (ctx as any)?.sessionKey ?? undefined;
      if (sessionId) {
        state.currentSessionId = sessionId;
        if (cfg.agentIsolation) {
          state.currentAgentId = resolveAgentId(sessionId);
        }
      }

      try {
        const recentMessages = event.messages.slice(-10);
        const formattedMessages: Array<{
          role: string;
          content: string;
        }> = [];

        for (const msg of recentMessages) {
          if (!msg || typeof msg !== "object") continue;
          const msgObj = msg as Record<string, unknown>;

          const role = msgObj.role;
          if (role !== "user" && role !== "assistant") continue;

          let textContent = "";
          const content = msgObj.content;

          if (typeof content === "string") {
            textContent = content;
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (
                block &&
                typeof block === "object" &&
                "type" in block &&
                (block as Record<string, unknown>).type === "text" &&
                "text" in block &&
                typeof (block as Record<string, unknown>).text === "string"
              ) {
                textContent +=
                  (textContent ? "\n" : "") +
                  ((block as Record<string, unknown>).text as string);
              }
            }
          }

          if (!textContent) continue;
          if (textContent.includes("<relevant-memories>")) continue;

          formattedMessages.push({
            role: role as string,
            content: textContent,
          });
        }

        if (formattedMessages.length === 0) return;

        // When agentIsolation is enabled, write to agent's private namespace
        const agentId = cfg.agentIsolation ? state.currentAgentId : undefined;
        const addOpts = buildAddOptions(cfg, undefined, state.currentSessionId, agentId);
        api.logger.info(
          `openclaw-mem0-plugin: auto-capturing: userId=${addOpts.user_id}, runId=${addOpts.run_id}${cfg.agentIsolation ? `, agent=${state.currentAgentId ?? "main"}` : ""}`,
        );
        const result = await provider.add(
          formattedMessages,
          addOpts,
        );

        const capturedCount = result.results?.length ?? 0;
        if (capturedCount > 0) {
          api.logger.info(
            `openclaw-mem0-plugin: auto-captured ${capturedCount} memories`,
          );
        }
      } catch (err) {
        api.logger.warn(`openclaw-mem0-plugin: capture failed: ${String(err)}`);
      }
    });
  }
}
