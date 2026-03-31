import { jest } from '@jest/globals';
import { resolveAgentId } from '../src/agent-resolver.ts';
import { NamespaceManager, Namespace } from '../src/namespace.ts';
import { buildAddOptions, buildSearchOptions } from '../src/helpers.ts';

// =============================================================================
// AgentResolver Tests
// =============================================================================

describe('resolveAgentId', () => {
  test('should extract agentId from standard session key', () => {
    expect(resolveAgentId('agent:myka:main')).toBe('myka');
  });

  test('should extract agentId from DM session key', () => {
    expect(resolveAgentId('agent:research-bot:direct:user123')).toBe('research-bot');
  });

  test('should extract agentId from channel session key', () => {
    expect(resolveAgentId('agent:code-reviewer:discord:group:channel456')).toBe('code-reviewer');
  });

  test('should return "main" for non-agent session keys', () => {
    expect(resolveAgentId('user:123:main')).toBe('main');
  });

  test('should return "main" for empty or undefined', () => {
    expect(resolveAgentId('')).toBe('main');
    expect(resolveAgentId(undefined)).toBe('main');
  });

  test('should return "main" for single-segment key', () => {
    expect(resolveAgentId('something')).toBe('main');
  });

  test('should handle two-segment key starting with "agent"', () => {
    // "agent:foo" has only 2 parts, less than 3 required
    expect(resolveAgentId('agent:foo')).toBe('main');
  });
});

// =============================================================================
// NamespaceManager Tests
// =============================================================================

describe('NamespaceManager', () => {
  const baseUserId = 'user-liuguifeng';

  test('should return base userId for system_knowledge namespace', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getUserId(Namespace.SYSTEM)).toBe('system_knowledge');
  });

  test('should return shared userId for pool_shared namespace', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getUserId(Namespace.SHARED)).toBe('pool_shared');
  });

  test('should return agent-specific userId for private namespace', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getUserId(Namespace.PRIVATE, 'myka')).toBe('agent_myka_private');
  });

  test('should fall back to base userId when no agentId for private namespace', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getUserId(Namespace.PRIVATE)).toBe(baseUserId);
  });

  test('should return search namespaces for agent (private + shared) by default', () => {
    const ns = new NamespaceManager(baseUserId);
    const userIds = ns.getSearchUserIds('myka', false);
    expect(userIds).toEqual(['agent_myka_private', 'pool_shared']);
  });

  test('should include system_knowledge when includeSystem is true', () => {
    const ns = new NamespaceManager(baseUserId);
    const userIds = ns.getSearchUserIds('myka', true);
    expect(userIds).toEqual(['agent_myka_private', 'pool_shared', 'system_knowledge']);
  });

  test('should return write namespace for agent (private only)', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getWriteUserId('myka')).toBe('agent_myka_private');
  });

  test('should return base userId for search when no agentId (no system by default)', () => {
    const ns = new NamespaceManager(baseUserId);
    const userIds = ns.getSearchUserIds(undefined, false);
    expect(userIds).toEqual([baseUserId]);
  });

  test('should return base userId + system when includeSystem is true and no agentId', () => {
    const ns = new NamespaceManager(baseUserId);
    const userIds = ns.getSearchUserIds(undefined, true);
    expect(userIds).toEqual([baseUserId, 'system_knowledge']);
  });

  test('should return base userId for write when no agentId', () => {
    const ns = new NamespaceManager(baseUserId);
    expect(ns.getWriteUserId(undefined)).toBe(baseUserId);
  });
});

// =============================================================================
// Helpers with agentIsolation Tests
// =============================================================================

describe('buildAddOptions with agentIsolation', () => {
  const baseCfg = {
    mode: 'platform',
    apiKey: 'test-key',
    userId: 'default-user',
    autoCapture: true,
    autoRecall: true,
    customInstructions: 'test instructions',
    customCategories: { test: 'test category' },
    enableGraph: false,
    searchThreshold: 0.5,
    topK: 5,
    agentIsolation: false,
  };

  test('without agentIsolation, should use cfg.userId as before', () => {
    const opts = buildAddOptions(baseCfg);
    expect(opts.user_id).toBe('default-user');
  });

  test('with agentIsolation + agentId, should use private namespace', () => {
    const cfg = { ...baseCfg, agentIsolation: true };
    const opts = buildAddOptions(cfg, undefined, undefined, 'myka');
    expect(opts.user_id).toBe('agent_myka_private');
  });

  test('with agentIsolation but no agentId, should fall back to cfg.userId', () => {
    const cfg = { ...baseCfg, agentIsolation: true };
    const opts = buildAddOptions(cfg);
    expect(opts.user_id).toBe('default-user');
  });

  test('userIdOverride should take precedence over agentIsolation', () => {
    const cfg = { ...baseCfg, agentIsolation: true };
    const opts = buildAddOptions(cfg, 'override-user', undefined, 'myka');
    expect(opts.user_id).toBe('override-user');
  });
});

describe('buildSearchOptions with agentIsolation', () => {
  const baseCfg = {
    mode: 'platform',
    apiKey: 'test-key',
    userId: 'default-user',
    autoCapture: true,
    autoRecall: true,
    customInstructions: 'test',
    customCategories: {},
    enableGraph: false,
    searchThreshold: 0.5,
    topK: 5,
    agentIsolation: false,
  };

  test('without agentIsolation, should return single search options', () => {
    const result = buildSearchOptions(baseCfg);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('default-user');
  });

  test('with agentIsolation + agentId, should return private + shared options (no systemMemoryFile)', () => {
    const cfg = { ...baseCfg, agentIsolation: true };
    const result = buildSearchOptions(cfg, undefined, undefined, undefined, 'myka');
    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBe('agent_myka_private');
    expect(result[1].user_id).toBe('pool_shared');
  });

  test('with agentIsolation + agentId + systemMemoryFile, should include system_knowledge', () => {
    const cfg = { ...baseCfg, agentIsolation: true, systemMemoryFile: './System_Memory.md' };
    const result = buildSearchOptions(cfg, undefined, undefined, undefined, 'myka');
    expect(result).toHaveLength(3);
    expect(result[0].user_id).toBe('agent_myka_private');
    expect(result[1].user_id).toBe('pool_shared');
    expect(result[2].user_id).toBe('system_knowledge');
  });

  test('with agentIsolation but no agentId, should fall back to single default', () => {
    const cfg = { ...baseCfg, agentIsolation: true };
    const result = buildSearchOptions(cfg);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('default-user');
  });
});
