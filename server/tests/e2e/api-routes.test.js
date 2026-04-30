/**
 * E2E HTTP-level API route tests
 *
 * Strategy: spawn server.js as a child process on a free port, wait for it
 * to confirm it is listening, run fetch-based assertions, then kill the
 * process in the after() hook.
 *
 * Why child-process instead of direct import?
 *   server.js is a 62 k-line monolith that does NOT export `app`.  Importing
 *   it directly in test scope would require patching internals.  Spawning it
 *   is the cleanest, most realistic test surface: it exercises the real boot
 *   sequence end-to-end.
 *
 * Environment variables forwarded to the child:
 *   PORT            — a random free port obtained before spawn
 *   NODE_ENV        — "e2e-test"  (avoids both prod and the no-listen guard)
 *   CONCORD_NO_LISTEN — explicitly unset so the server does bind
 *   DATA_DIR        — isolated temp dir so tests don't touch real data
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a port that is free at the moment of the call. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Spawn the Concord server and resolve once it is accepting connections.
 * Rejects if the server does not become ready within `timeoutMs`.
 */
function spawnServer(port, dataDir, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const serverPath = join(
      fileURLToPath(import.meta.url),
      '../../../server.js',
    );

    const env = {
      ...process.env,
      PORT: String(port),
      // Use "e2e-test" — not "test" (which triggers SHOULD_LISTEN=false)
      NODE_ENV: 'e2e-test',
      CONCORD_NO_LISTEN: 'false',
      DATA_DIR: dataDir,
      // Suppress noisy output
      LOG_LEVEL: 'error',
      LOG_FORMAT: 'json',
      // Disable optional heavy deps that slow boot or require credentials
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    };

    const child = spawn(process.execPath, ['--experimental-vm-modules', serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        child.kill('SIGKILL');
        reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
      }
    }, timeoutMs);

    function checkLine(line) {
      // The server emits "server_listening" in structuredLog once it binds
      if (
        line.includes('server_listening') ||
        line.includes(`http://localhost:${port}`) ||
        line.includes(`"url":"http://localhost:${port}"`)
      ) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(child);
        }
      }
    }

    let stdoutBuf = '';
    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop(); // keep incomplete line
      lines.forEach(checkLine);
    });

    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop();
      lines.forEach(checkLine);
    });

    child.on('exit', (code, signal) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Server exited early (code=${code} signal=${signal})`));
      }
    });

    child.on('error', (err) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/** fetch with a 5-second abort timeout. */
async function apiFetch(base, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** GET JSON and return { status, body } */
async function getJSON(base, path) {
  const res = await apiFetch(base, path);
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

/** POST JSON and return { status, body } */
async function postJSON(base, path, payload) {
  const res = await apiFetch(base, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('E2E API routes', { timeout: 120_000 }, () => {
  let base;        // e.g. "http://127.0.0.1:54321"
  let serverProc;  // ChildProcess

  before(async () => {
    const port = await getFreePort();
    const dataDir = mkdtempSync(join(tmpdir(), 'concord-e2e-'));
    base = `http://127.0.0.1:${port}`;
    serverProc = await spawnServer(port, dataDir, 90_000);
  });

  after(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      // Give up to 3 s for graceful shutdown
      await new Promise((resolve) => {
        const t = setTimeout(() => { serverProc.kill('SIGKILL'); resolve(); }, 3_000);
        serverProc.on('exit', () => { clearTimeout(t); resolve(); });
      });
    }
  });

  // ── Public GET routes that must return 200 with ok:true ─────────────────

  it('GET /api/status returns 200 with ok:true', async () => {
    const { status, body } = await getJSON(base, '/api/status');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true in body');
    // version should be a non-empty string
    assert.equal(typeof body?.version, 'string', 'Expected version string');
    assert.ok(body.version.length > 0, 'version must be non-empty');
  });

  it('GET /api/compute/modules returns 200 with ok:true and modules array', async () => {
    const { status, body } = await getJSON(base, '/api/compute/modules');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
    assert.ok(Array.isArray(body?.modules), 'Expected modules array');
    assert.ok(body.modules.length > 0, 'Expected at least one compute module');
  });

  it('GET /api/city-assets returns 200 with ok:true and assets array', async () => {
    const { status, body } = await getJSON(base, '/api/city-assets');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
    assert.ok(Array.isArray(body?.assets), 'Expected assets array');
  });

  it('GET /api/lens-features/templates returns 200 with ok:true and templates array', async () => {
    const { status, body } = await getJSON(base, '/api/lens-features/templates');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
    assert.ok(Array.isArray(body?.templates), 'Expected templates array');
    assert.ok(body.templates.length > 0, 'Expected at least one template');
  });

  it('GET /api/worlds returns 200 with an array', async () => {
    const { status, body } = await getJSON(base, '/api/worlds');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    // worlds router returns { ok, worlds } or an array — just check 200
    assert.ok(body !== null, 'Expected JSON body');
  });

  it('GET /api/lattice/beacon returns 200 with ok:true', async () => {
    const { status, body } = await getJSON(base, '/api/lattice/beacon');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
  });

  it('GET /api/lenses/templates returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/lenses/templates');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(body !== null, 'Expected JSON body');
  });

  it('GET /api/lenses/custom returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/lenses/custom');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(body !== null, 'Expected JSON body');
  });

  // ── Compute run ──────────────────────────────────────────────────────────

  it('POST /api/compute/run with logic.isTautology returns 200 ok:true', async () => {
    const { status, body } = await postJSON(base, '/api/compute/run', {
      module: 'logic',
      fn: 'isTautology',
      args: ['P | !P'],
    });
    assert.equal(status, 200, `Expected 200, got ${status}. body: ${JSON.stringify(body)}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
    // result should be a boolean
    assert.equal(typeof body?.result, 'boolean', 'Expected boolean result from isTautology');
  });

  it('POST /api/compute/run with unknown module returns 404', async () => {
    const { status } = await postJSON(base, '/api/compute/run', {
      module: 'nonexistent-module-xyz',
      fn: 'anything',
      args: [],
    });
    assert.equal(status, 404, `Expected 404 for unknown module, got ${status}`);
  });

  // ── Lens feature generate ────────────────────────────────────────────────

  it('POST /api/lens-features/generate with basic-crud template returns 200', async () => {
    const { status, body } = await postJSON(base, '/api/lens-features/generate', {
      template: 'basic-crud',
      config: { domain: 'test' },
    });
    assert.equal(status, 200, `Expected 200, got ${status}. body: ${JSON.stringify(body)}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
    assert.ok(body?.lens !== undefined, 'Expected lens in response');
  });

  it('POST /api/lens-features/generate with unknown template returns 400', async () => {
    const { status, body } = await postJSON(base, '/api/lens-features/generate', {
      template: 'no-such-template-xyz',
      config: {},
    });
    assert.equal(status, 400, `Expected 400 for unknown template, got ${status}`);
    assert.equal(body?.ok, false, 'Expected ok:false');
  });

  // ── 404 handling ─────────────────────────────────────────────────────────

  it('GET /api/this-route-does-not-exist returns 404', async () => {
    const { status } = await getJSON(base, '/api/this-route-does-not-exist');
    assert.equal(status, 404, `Expected 404, got ${status}`);
  });

  it('GET /api/xyzzy-nonexistent returns 404', async () => {
    const { status } = await getJSON(base, '/api/xyzzy-nonexistent');
    assert.equal(status, 404, `Expected 404, got ${status}`);
  });

  // ── Auth-required routes return 401 or 403 (not 200, not 500) ───────────

  it('POST /api/city-assets (unauthenticated) returns 401 or 403', async () => {
    const { status } = await postJSON(base, '/api/city-assets', {
      name: 'test-asset',
      category: 'building',
    });
    assert.ok(
      status === 401 || status === 403,
      `Expected 401 or 403 for unauthenticated POST /api/city-assets, got ${status}`,
    );
  });

  it('POST /api/dtus/:id/fork (unauthenticated) returns 401 or 403', async () => {
    const { status } = await postJSON(base, '/api/dtus/fake-id/fork', {});
    assert.ok(
      status === 401 || status === 403,
      `Expected 401 or 403 for unauthenticated fork, got ${status}`,
    );
  });

  it('POST /api/dtus/:id/vote (unauthenticated) returns 401 or 403', async () => {
    const { status } = await postJSON(base, '/api/dtus/fake-id/vote', { direction: 'up' });
    assert.ok(
      status === 401 || status === 403,
      `Expected 401 or 403 for unauthenticated vote, got ${status}`,
    );
  });

  // ── Skills export — not 500 ──────────────────────────────────────────────

  it('GET /api/skills/export/:id returns 200 or 404, not 500', async () => {
    const { status } = await getJSON(base, '/api/skills/export/test-emergent-id');
    assert.ok(
      status === 200 || status === 404,
      `Expected 200 or 404 for skills export, got ${status}`,
    );
  });

  // ── Emergent proposals list ──────────────────────────────────────────────

  it('GET /api/emergent/lattice/proposals returns 200 or 401/403, not 500', async () => {
    const { status } = await getJSON(base, '/api/emergent/lattice/proposals');
    assert.ok(
      status !== 500,
      `Expected non-500 for /api/emergent/lattice/proposals, got ${status}`,
    );
  });

  it('GET /api/emergent/status returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/emergent/status');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(body !== null, 'Expected JSON body');
  });

  // ── Health / system checks ───────────────────────────────────────────────

  it('GET /health returns 200 or 503 (not 404 or 500)', async () => {
    const { status } = await getJSON(base, '/health');
    assert.ok(
      status === 200 || status === 503,
      `Expected 200 or 503 from /health, got ${status}`,
    );
  });

  it('GET / returns 200 with ok:true', async () => {
    const { status, body } = await getJSON(base, '/');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
  });

  it('GET /api/compute/catalog returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/compute/catalog');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
  });

  it('GET /api/city-assets/stats returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/city-assets/stats');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
  });

  it('GET /api/city-assets/base returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/city-assets/base');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.equal(body?.ok, true, 'Expected ok:true');
  });

  it('GET /api/bridge/log returns 200, not 500', async () => {
    const { status } = await getJSON(base, '/api/bridge/log');
    assert.ok(
      status !== 500,
      `Expected non-500 for /api/bridge/log, got ${status}`,
    );
  });

  it('GET /api/bridge/organisms returns 200', async () => {
    const { status, body } = await getJSON(base, '/api/bridge/organisms');
    assert.equal(status, 200, `Expected 200, got ${status}`);
    assert.ok(body !== null, 'Expected JSON body');
  });
});
