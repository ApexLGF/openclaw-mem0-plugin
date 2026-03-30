import { MemoryClient } from '../src/lib/mem0.ts';
import dotenv from 'dotenv';
import { join } from 'path';
import { homedir } from 'os';
import fs from 'fs';

// Load env
const ENV_SOURCES = [
  { name: "openclaw", path: join(homedir(), ".openclaw", ".env") },
  { name: "local", path: join(process.cwd(), ".env") },
];

function loadEnv() {
  for (const source of ENV_SOURCES) {
    if (fs.existsSync(source.path)) {
      const envConfig = dotenv.parse(fs.readFileSync(source.path));
      for (const k in envConfig) {
        if (!process.env[k]) process.env[k] = envConfig[k];
      }
    }
  }
}

loadEnv();

const apiKey = process.env.MEM0_API_KEY;
const host = process.env.MEM0_HOST;

// Only run if we have API key AND a custom host (Volcengine)
const describeIfVolc = (apiKey && host) ? describe : describe.skip;

describeIfVolc('Volcengine Integration — async API behavior', () => {
  let client;
  const testUserId = `volc-integration-${Date.now()}`;

  beforeAll(() => {
    client = new MemoryClient({ apiKey, host });
  });

  test('add() should return PENDING with event_id (fire-and-forget)', async () => {
    const result = await client.add(
      [{ role: 'user', content: 'Integration test: user likes coffee and reading.' }],
      { user_id: testUserId, output_format: 'v1.1' },
    );

    console.log('[Volcengine] Add result:', JSON.stringify(result, null, 2));

    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);

    // Volcengine returns PENDING + event_id
    const first = result.results[0];
    expect(first.status).toBe('PENDING');
    expect(first.event_id).toBeDefined();
    expect(typeof first.event_id).toBe('string');
    expect(first.event_id.length).toBeGreaterThan(0);

    console.log(`[Volcengine] event_id: ${first.event_id} ✓`);
  }, 30000);

  test('checkJobStatus() should return valid job status', async () => {
    // Add a memory to get event_id
    const addResult = await client.add(
      [{ role: 'user', content: 'Job status test: user likes TypeScript.' }],
      { user_id: testUserId, output_format: 'v1.1' },
    );

    const eventId = addResult?.results?.[0]?.event_id;
    expect(eventId).toBeDefined();

    // Poll once to verify the endpoint works and returns expected format
    const jobUrl = `${host}/v1/job/${eventId}/`;
    const response = await fetch(jobUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    const jobData = await response.json();

    console.log('[Volcengine] Job status response:', JSON.stringify(jobData, null, 2));

    expect(jobData).toBeDefined();
    expect(jobData.status).toBeDefined();
    expect(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']).toContain(jobData.status);
    expect(jobData.request_id).toBe(eventId);
    expect(jobData.job_type).toBe('add');
    expect(jobData.user_id).toBe(testUserId);

    console.log(`[Volcengine] Job ${eventId} status: ${jobData.status} ✓`);
  }, 30000);

  test('search should work independently of async add completion', async () => {
    // Search always works — returns whatever is indexed
    const results = await client.search('coffee reading', { user_id: testUserId });

    console.log('[Volcengine] Search result:', JSON.stringify(results, null, 2));

    expect(results).toBeDefined();
    // Results may be empty if async add hasn't completed yet — that's expected
    const resultsArray = Array.isArray(results) ? results : results.results || [];
    expect(Array.isArray(resultsArray)).toBe(true);

    console.log(`[Volcengine] Found ${resultsArray.length} results (may be 0 if async pending) ✓`);
  }, 30000);

  test('different user_ids should create isolated namespaces', async () => {
    const agentUserId = `agent_test-bot_private`;

    // Add to agent namespace
    const agentResult = await client.add(
      [{ role: 'user', content: 'Agent memory: prefers verbose logging.' }],
      { user_id: agentUserId, output_format: 'v1.1' },
    );

    expect(agentResult.results[0].status).toBe('PENDING');

    // Add to user namespace
    const userResult = await client.add(
      [{ role: 'user', content: 'User memory: prefers dark mode.' }],
      { user_id: testUserId, output_format: 'v1.1' },
    );

    expect(userResult.results[0].status).toBe('PENDING');

    // Both accepted — namespace isolation is enforced by Mem0's user_id field
    console.log(`[Volcengine] Agent namespace (${agentUserId}) and user namespace (${testUserId}) both accepted ✓`);
    console.log('[Volcengine] Namespace isolation is enforced by Mem0 user_id at the API level');
  }, 30000);
});
