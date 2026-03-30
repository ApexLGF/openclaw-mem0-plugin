import { jest } from '@jest/globals';
import { mem0ConfigSchema } from '../src/config.ts';
import { buildAddOptions, buildSearchOptions } from '../src/helpers.ts';

/**
 * Backward compatibility tests — ensure that when agentIsolation is false (default),
 * ALL behavior is identical to pre-Phase-2 code.
 */
describe('Backward compatibility (agentIsolation: false)', () => {
  describe('config parsing', () => {
    it('should default agentIsolation to false when not specified', () => {
      const cfg = mem0ConfigSchema.parse({
        mode: 'platform',
        apiKey: 'test-key',
        userId: 'my-user',
      });
      expect(cfg.agentIsolation).toBe(false);
    });

    it('should accept agentIsolation: true', () => {
      const cfg = mem0ConfigSchema.parse({
        mode: 'platform',
        apiKey: 'test-key',
        agentIsolation: true,
      });
      expect(cfg.agentIsolation).toBe(true);
    });

    it('should treat non-boolean agentIsolation as false', () => {
      const cfg = mem0ConfigSchema.parse({
        mode: 'platform',
        apiKey: 'test-key',
        agentIsolation: 'yes',
      });
      expect(cfg.agentIsolation).toBe(false);
    });
  });

  describe('buildAddOptions — no isolation', () => {
    const cfg = mem0ConfigSchema.parse({
      mode: 'platform',
      apiKey: 'test-key',
      userId: 'my-user',
    });

    it('should use cfg.userId when no override', () => {
      const opts = buildAddOptions(cfg);
      expect(opts.user_id).toBe('my-user');
    });

    it('should use userIdOverride when provided', () => {
      const opts = buildAddOptions(cfg, 'other-user');
      expect(opts.user_id).toBe('other-user');
    });

    it('should include platform-specific options', () => {
      const opts = buildAddOptions(cfg);
      expect(opts.custom_instructions).toBeDefined();
      expect(opts.custom_categories).toBeDefined();
      expect(opts.output_format).toBe('v1.1');
    });

    it('should ignore agentId parameter when agentIsolation is false', () => {
      const opts = buildAddOptions(cfg, undefined, undefined, 'some-agent');
      expect(opts.user_id).toBe('my-user'); // NOT agent_some-agent_private
    });
  });

  describe('buildSearchOptions — no isolation', () => {
    const cfg = mem0ConfigSchema.parse({
      mode: 'platform',
      apiKey: 'test-key',
      userId: 'my-user',
      topK: 10,
      searchThreshold: 0.6,
    });

    it('should return single-element array with cfg.userId', () => {
      const result = buildSearchOptions(cfg);
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('my-user');
      expect(result[0].top_k).toBe(10);
      expect(result[0].threshold).toBe(0.6);
    });

    it('should ignore agentId when agentIsolation is false', () => {
      const result = buildSearchOptions(cfg, undefined, undefined, undefined, 'some-agent');
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('my-user');
    });

    it('should respect userIdOverride', () => {
      const result = buildSearchOptions(cfg, 'override-user');
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('override-user');
    });

    it('should pass runId through', () => {
      const result = buildSearchOptions(cfg, undefined, undefined, 'session-123');
      expect(result).toHaveLength(1);
      expect(result[0].run_id).toBe('session-123');
    });
  });

  describe('config — open-source mode', () => {
    it('should work without apiKey in open-source mode', () => {
      const cfg = mem0ConfigSchema.parse({
        mode: 'open-source',
      });
      expect(cfg.mode).toBe('open-source');
      expect(cfg.agentIsolation).toBe(false);
      expect(cfg.userId).toBe('default');
    });

    it('should support legacy "oss" mode string', () => {
      const cfg = mem0ConfigSchema.parse({
        mode: 'oss',
      });
      expect(cfg.mode).toBe('open-source');
    });
  });
});
