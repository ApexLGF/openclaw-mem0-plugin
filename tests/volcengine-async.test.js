import { jest } from '@jest/globals';
import { MemoryClient } from '../src/lib/mem0.ts';

// Mock fetch
global.fetch = jest.fn();

describe('MemoryClient — Volcengine async mode', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('checkJobStatus', () => {
    it('should poll until SUCCEEDED', async () => {
      const client = new MemoryClient({
        apiKey: 'test-key',
        host: 'https://mem0.volces.com:8000',
      });

      // First poll: still processing
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ status: 'PROCESSING', event_id: 'evt-123' }),
      });
      // Second poll: succeeded
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          status: 'SUCCEEDED',
          event_id: 'evt-123',
          results: [{ id: 'mem-1', memory: 'test memory', event: 'ADD' }],
        }),
      });

      const result = await client.checkJobStatus('evt-123', { pollInterval: 10, timeout: 5000 });

      expect(result.status).toBe('SUCCEEDED');
      expect(result.results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        'https://mem0.volces.com:8000/v1/job/evt-123/',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Token test-key',
          }),
        }),
      );
    });

    it('should throw on FAILED status', async () => {
      const client = new MemoryClient({
        apiKey: 'test-key',
        host: 'https://mem0.volces.com:8000',
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ status: 'FAILED', error: 'Processing error' }),
      });

      await expect(
        client.checkJobStatus('evt-fail', { pollInterval: 10, timeout: 5000 }),
      ).rejects.toThrow('Job failed');
    });

    it('should throw on timeout', async () => {
      const client = new MemoryClient({
        apiKey: 'test-key',
        host: 'https://mem0.volces.com:8000',
      });

      // Always return PROCESSING
      fetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ status: 'PROCESSING' }),
      });

      await expect(
        client.checkJobStatus('evt-timeout', { pollInterval: 10, timeout: 50 }),
      ).rejects.toThrow('timed out');
    }, 10000);
  });

  describe('addAndWait', () => {
    it('should add and poll for completion when response is PENDING', async () => {
      const client = new MemoryClient({
        apiKey: 'test-key',
        host: 'https://mem0.volces.com:8000',
      });

      // add() returns PENDING
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          results: [{
            status: 'PENDING',
            event_id: 'evt-456',
            message: 'the request was successful',
          }],
        }),
      });
      // checkJobStatus poll: SUCCEEDED
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          status: 'SUCCEEDED',
          results: [{ id: 'mem-2', memory: 'user likes basketball', event: 'ADD' }],
        }),
      });

      const result = await client.addAndWait(
        [{ role: 'user', content: 'I like basketball' }],
        { user_id: 'test-user' },
        { pollInterval: 10, timeout: 5000 },
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].event).toBe('ADD');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return immediately if no PENDING status', async () => {
      const client = new MemoryClient({
        apiKey: 'test-key',
        host: 'https://api.mem0.ai',
      });

      // add() returns direct result (non-volcengine)
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          results: [{ id: 'mem-3', memory: 'user prefers dark mode', event: 'ADD' }],
        }),
      });

      const result = await client.addAndWait(
        [{ role: 'user', content: 'I prefer dark mode' }],
        { user_id: 'test-user' },
      );

      expect(result.results).toHaveLength(1);
      // Should NOT poll — only 1 fetch call (the add itself)
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('PlatformProvider — backward compatibility', () => {
  it('normalizeAddResult handles PENDING volcengine response', async () => {
    const { normalizeAddResult } = await import('../src/providers/normalizers.ts');

    const volcResponse = {
      results: [{
        message: 'the request was successful, and the memory will be completed asynchronously',
        status: 'PENDING',
        event_id: 'evt-789',
      }],
    };

    const result = normalizeAddResult(volcResponse);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].event).toBe('ADD');
    expect(result.results[0].id).toBe('');
  });

  it('normalizeAddResult handles standard platform response', async () => {
    const { normalizeAddResult } = await import('../src/providers/normalizers.ts');

    const standardResponse = {
      results: [{
        id: 'mem-1',
        memory: 'User likes TypeScript',
        event: 'ADD',
      }],
    };

    const result = normalizeAddResult(standardResponse);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].event).toBe('ADD');
    expect(result.results[0].id).toBe('mem-1');
  });
});
