/**
 * Agent ID Resolver
 *
 * Extracts agentId from OpenClaw session keys.
 * Format: agent:{agentId}:{rest} (at least 3 segments, first must be "agent")
 *
 * See: OpenClaw SDK `plugin-sdk/session-key-*.js`
 */

export function resolveAgentId(sessionKey: string | undefined): string {
  if (!sessionKey) return "main";
  try {
    const parts = sessionKey.split(":");
    if (parts.length >= 3 && parts[0] === "agent") {
      return parts[1];
    }
  } catch {
    // fallback
  }
  return "main";
}
