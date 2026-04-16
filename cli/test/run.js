import http from 'node:http';
import { createMockServer } from './mock-server.js';
import { startServer } from '../server.js';

const PROXY_PORT = 18079;
const MOCK_PORT = 18078;

// ── Test harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write(`  \x1B[32m✓\x1B[0m ${name}\n`);
  } else {
    failed++;
    failures.push({ name, detail });
    process.stdout.write(`  \x1B[31m✗\x1B[0m ${name}${detail ? ` — ${detail}` : ''}\n`);
  }
}

function request(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PROXY_PORT,
      path,
      method,
      headers: headers || {},
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let json;
        try { json = JSON.parse(raw); } catch { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Tests ───────────────────────────────────────────────────────────
async function runTests() {
  process.stdout.write('\n  proxy tests\n  ───────────\n\n');

  // ── Basic proxying ──
  {
    const r = await request('GET', '/health');
    assert('GET /health → 200', r.status === 200);
    assert('GET /health → body', r.json?.status === 'ok');
  }

  {
    const r = await request('GET', '/json');
    assert('GET /json → 200', r.status === 200);
    assert('GET /json → correct body', r.json?.hello === 'world');
  }

  // ── POST with body echo ──
  {
    const payload = JSON.stringify({ foo: 'bar' });
    const r = await request('POST', '/echo', {
      body: payload,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    });
    assert('POST /echo → 200', r.status === 200);
    assert('POST /echo → body echoed', r.json?.foo === 'bar');
  }

  // ── Status codes ──
  {
    const r = await request('GET', '/status/201');
    assert('GET /status/201 → 201', r.status === 201);
  }
  {
    const r = await request('GET', '/status/404');
    assert('GET /status/404 → 404', r.status === 404);
  }
  {
    const r = await request('GET', '/status/500');
    assert('GET /status/500 → 500', r.status === 500);
  }

  // ── Redirect following ──
  {
    const r = await request('GET', '/redirect');
    assert('GET /redirect → follows to /json', r.status === 200 && r.json?.hello === 'world');
  }
  {
    const r = await request('GET', '/redirect-chain');
    assert('GET /redirect-chain → follows chain', r.status === 200 && r.json?.hello === 'world');
  }

  // ── 404 passthrough ──
  {
    const r = await request('GET', '/nonexistent');
    assert('GET /nonexistent → 404', r.status === 404);
  }

  // ── changeOrigin: Host header rewrite ──
  {
    const r = await request('GET', '/headers');
    assert('Host header rewritten (changeOrigin)', r.json?.host === `127.0.0.1:${MOCK_PORT}`);
  }

  // ── Custom request headers from config ──
  {
    const r = await request('GET', '/headers');
    assert('Config header x-custom injected', r.json?.['x-custom'] === 'test-value');
  }

  // ── Target down → 502 ──
  // We test this by making a request to a port nothing listens on.
  // We can't easily do this via the running proxy without reconfiguring,
  // so we test the proxy module directly.
  {
    const { proxyRequest, ProxyError } = await import('../proxy.js');
    try {
      // Create a minimal fake req stream
      const { Readable } = await import('node:stream');
      const fakeReq = new Readable({ read() { this.push(null); } });
      fakeReq.method = 'GET';

      await proxyRequest({
        req: fakeReq,
        targetUrl: 'http://127.0.0.1:19999/nope',
        headers: {},
        changeOrigin: false,
        followRedirects: false,
      });
      assert('Target down → ProxyError', false, 'Expected rejection');
    } catch (err) {
      assert('Target down → ProxyError 502', err instanceof ProxyError && err.statusCode === 502);
    }
  }
}

// ── Orchestration ───────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  process.stdout.write('\n  Tests started...\n');

  // 1. Start mock target
  process.stdout.write('  [setup] Starting mock target on port ' + MOCK_PORT + '...\n');
  const mockServer = await createMockServer(MOCK_PORT);

  // 2. Start proxy pointed at mock
  const config = {
    logLevel: 0, // silent during tests
    maxRequestSize: -1,
  };
  const env = {
    id: 'test',
    name: 'Test',
    port: PROXY_PORT,
    targetUrl: `http://127.0.0.1:${MOCK_PORT}`,
    requestHeaders: { 'X-Custom': 'test-value' },
    changeOrigin: true,
    followRedirects: true,
  };
  process.stdout.write('  [setup] Starting proxy on port ' + PROXY_PORT + '...\n');
  const proxyServer = await startServer(config, env);

  // 3. Run tests
  process.stdout.write('  [run]   Executing test cases...\n');
  try {
    await runTests();
  } catch (err) {
    process.stderr.write(`\nUnexpected error: ${err.stack || err}\n`);
    failed++;
  }

  // 4. Report
  const elapsed = Date.now() - t0;
  process.stdout.write(`\n  ───────────\n`);
  process.stdout.write(`  ${passed} passed, ${failed} failed (${elapsed}ms)\n\n`);
  if (failures.length) {
    for (const f of failures) {
      process.stderr.write(`  FAIL: ${f.name}${f.detail ? ` — ${f.detail}` : ''}\n`);
    }
    process.stdout.write('\n');
  }

  // 5. Cleanup
  process.stdout.write('  [cleanup] Shutting down servers...\n');
  proxyServer.close();
  mockServer.close();
  process.stdout.write('  Tests finished.\n\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
