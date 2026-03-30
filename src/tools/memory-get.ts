import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Mem0Provider } from "../types.js";

export function registerMemoryGet(
  api: OpenClawPluginApi,
  provider: Mem0Provider,
) {
  api.registerTool(
    {
      name: "memory_get",
      label: "Memory Get",
      description: "Retrieve a specific memory by its ID from Mem0.",
      parameters: Type.Object({
        memoryId: Type.String({ description: "The memory ID to retrieve" }),
      }),
      async execute(_toolCallId, params) {
        const { memoryId } = params as { memoryId: string };

        try {
          const memory = await provider.get(memoryId);

          return {
            content: [
              {
                type: "text",
                text: `Memory ${memory.id}:\n${memory.memory}\n\nCreated: ${memory.created_at ?? "unknown"}\nUpdated: ${memory.updated_at ?? "unknown"}`,
              },
            ],
            details: { memory },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Memory get failed: ${String(err)}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memory_get" },
  );
}
