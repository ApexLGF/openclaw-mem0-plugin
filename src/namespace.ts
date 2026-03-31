/**
 * NamespaceManager — Three-layer namespace isolation for multi-agent memory
 *
 * Layers:
 * - system_knowledge: Global shared knowledge (all agents can read)
 * - pool_shared: Agent team shared memory (all agents can read/write)
 * - agent_{id}_private: Agent-specific private memory (only that agent)
 *
 * Maps namespaces to Mem0 `user_id` values for isolation via the existing API.
 */

export enum Namespace {
  SYSTEM = "system_knowledge",
  SHARED = "pool_shared",
  PRIVATE = "private",
}

export class NamespaceManager {
  constructor(private readonly baseUserId: string) {}

  /**
   * Get the effective user_id for a given namespace and optional agentId.
   */
  getUserId(namespace: Namespace, agentId?: string): string {
    switch (namespace) {
      case Namespace.SYSTEM:
        return "system_knowledge";
      case Namespace.SHARED:
        return "pool_shared";
      case Namespace.PRIVATE:
        if (agentId) return `agent_${agentId}_private`;
        return this.baseUserId;
    }
  }

  /**
   * Get the user_ids to search for an agent (private + shared + system).
   * When no agentId, falls back to base userId + system.
   */
  getSearchUserIds(agentId?: string, includeSystem = false): string[] {
    const ids: string[] = [];
    if (agentId) {
      ids.push(this.getUserId(Namespace.PRIVATE, agentId));
      ids.push(this.getUserId(Namespace.SHARED));
    } else {
      ids.push(this.baseUserId);
    }
    if (includeSystem) {
      ids.push(this.getUserId(Namespace.SYSTEM));
    }
    return ids;
  }

  /**
   * Get the user_id to write memories for an agent (private namespace).
   * When no agentId, falls back to base userId.
   */
  getWriteUserId(agentId?: string): string {
    if (!agentId) return this.baseUserId;
    return this.getUserId(Namespace.PRIVATE, agentId);
  }
}
