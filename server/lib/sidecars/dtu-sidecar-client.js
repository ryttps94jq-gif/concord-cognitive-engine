// dtu-sidecar-client — thin Node client for engines/concord-dtu-sidecar.
//
// Concurrency Refactor Phase 3. READ-ONLY DTU reads over a Unix socket so they
// stop blocking the Node event loop.
//
// STATUS: CARVED, NOT LIVE. This client + the sidecar are built and correct, but
// nothing routes through them yet — on this deploy DTUs live in the in-memory
// STATE.dtus Map and concord.db.dtus is empty, and a synthetic benchmark showed
// inline better-sqlite3 is fine for fast indexed reads. See
// engines/concord-dtu-sidecar/README.md + ~/.zuko/remaining-work/concord-dtu-sidecar-proof.json.
//
// Guarded by CONCORD_DTU_SIDECAR=1 (default off). FAIL SOFT like the others.

import http from "node:http";
import os from "node:os";
import path from "node:path";

const SOCK =
  process.env.CONCORD_DTU_SIDECAR_SOCK ||
  path.join(process.env.CONCORD_RUN_DIR || path.join(os.homedir(), "concord", "run"), "concord-dtu-sidecar.sock");

export const ENABLED = process.env.CONCORD_DTU_SIDECAR === "1";

function get(pathname, { timeoutMs = 5_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCK, path: pathname, method: "GET", timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
          } catch {
            reject(new Error(`dtu-sidecar: bad JSON (${res.statusCode})`));
          }
        });
      },
    );
    req.on("error", (e) => reject(new Error(`dtu-sidecar unreachable: ${e.code || e.message}`)));
    req.on("timeout", () => req.destroy(new Error("dtu-sidecar: request timeout")));
    req.end();
  });
}

let _availAt = 0;
let _availVal = null;
export async function isAvailable() {
  if (!ENABLED) return false;
  const now = Date.now();
  if (now - _availAt < 3_000 && _availVal !== null) return _availVal;
  try {
    const r = await get("/v1/health", { timeoutMs: 1_500 });
    _availVal = r.status === 200 && r.body?.ok === true;
  } catch {
    _availVal = false;
  }
  _availAt = now;
  return _availVal;
}

export async function health() {
  return (await get("/v1/health", { timeoutMs: 1_500 })).body;
}

export async function getDTU(id) {
  const r = await get(`/v1/dtu?id=${encodeURIComponent(id)}`);
  return r.body;
}

export async function recent({ limit = 50, owner, visibility, tier } = {}) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (owner) q.set("owner", owner);
  if (visibility) q.set("visibility", visibility);
  if (tier) q.set("tier", tier);
  return (await get(`/v1/dtus/recent?${q}`)).body;
}

export async function search(term, { limit = 50 } = {}) {
  const q = new URLSearchParams({ q: term, limit: String(limit) });
  return (await get(`/v1/dtus/search?${q}`)).body;
}

export const socketPath = SOCK;
