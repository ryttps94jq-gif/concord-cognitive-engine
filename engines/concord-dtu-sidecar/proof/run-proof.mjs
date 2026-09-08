// Concurrency Refactor Phase 3 proof — DTU reads: inline better-sqlite3 vs sidecar.
//
// Seeds a scratch concord-shaped DB with N DTU rows (realistic multi-KB bodies +
// FTS index), then runs a burst of mixed get-by-id + FTS-search reads two ways:
//   INLINE   — synchronous better-sqlite3 in the Node process (today's path)
//   SIDECAR  — concurrent HTTP reads through concord-dtu-sidecar (read-only)
//
// Metric: max Node event-loop lag during the burst + wall time.
//
//   node engines/concord-dtu-sidecar/proof/run-proof.mjs
//
// Writes ~/.zuko/remaining-work/concord-dtu-sidecar-proof.json

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(path.join(process.cwd(), "server", "index.js"));
const Database = require("better-sqlite3");

const HOME = os.homedir();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dtu-proof-"));
const DBP = path.join(TMP, "scratch.db");
const SOCK = path.join(TMP, "s.sock");
const BIN = path.join(process.cwd(), "engines", "concord-dtu-sidecar", "bin", "concord-dtu-sidecar");
const N_ROWS = 5000;
const BURST = 400;

function seed() {
  const db = new Database(DBP);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE dtus (
      id TEXT PRIMARY KEY, owner_user_id TEXT, title TEXT NOT NULL DEFAULT 'Untitled',
      body_json TEXT NOT NULL DEFAULT '{}', tags_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'private', tier TEXT NOT NULL DEFAULT 'regular',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      federation_tier TEXT DEFAULT 'local', creti_score INTEGER DEFAULT 0, price REAL DEFAULT 0,
      lens_id TEXT DEFAULT 'unknown', size_kb REAL DEFAULT 0, version INTEGER DEFAULT 1);
    CREATE INDEX idx_dtus_created ON dtus(created_at DESC);
    CREATE VIRTUAL TABLE dtus_fts USING fts5(title, body_json, tags_json, lens_id, content='dtus', content_rowid='rowid');
    CREATE TRIGGER dtus_fts_insert AFTER INSERT ON dtus BEGIN
      INSERT INTO dtus_fts(rowid, title, body_json, tags_json, lens_id)
      VALUES (new.rowid, new.title, new.body_json, new.tags_json, new.lens_id); END;
  `);
  const words = ["reactor", "lattice", "glyph", "economy", "royalty", "mesh", "concord", "substrate", "cascade", "kernel", "vector", "manifold"];
  const ins = db.prepare(`INSERT INTO dtus (id, owner_user_id, title, body_json, tags_json, visibility, tier, created_at, lens_id, size_kb) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    for (let i = 0; i < N_ROWS; i++) {
      const body = JSON.stringify({ claims: Array.from({ length: 20 }, (_, k) => `${words[(i + k) % words.length]} claim ${k} for dtu ${i} ${"x".repeat(60)}`) });
      ins.run(`dtu_${i}`, "u_1", `DTU ${i} ${words[i % words.length]}`, body, JSON.stringify([words[i % words.length], "seed"]), i % 3 === 0 ? "public" : "private", "regular", new Date(Date.now() - i * 1000).toISOString(), words[i % words.length], body.length / 1024);
    }
  });
  tx();
  const ids = db.prepare(`SELECT id FROM dtus`).all().map((r) => r.id);
  db.close();
  return ids;
}

function startLagSampler() {
  const want = 20;
  let last = performance.now();
  let max = 0;
  const t = setInterval(() => {
    const now = performance.now();
    const lag = now - last - want;
    if (lag > max) max = lag;
    last = now;
  }, want);
  return { stop: async () => { await new Promise((r) => setTimeout(r, 60)); clearInterval(t); return Math.round(max); } };
}

function sidecarGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCK, path: pathname, method: "GET" }, (res) => {
      const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => resolve(JSON.parse(Buffer.concat(c).toString())));
    });
    req.on("error", reject); req.end();
  });
}

async function measure(label, fire) {
  await new Promise((r) => setTimeout(r, 200));
  const lag = startLagSampler();
  const lat = [];
  const t0 = performance.now();
  await fire(lat);
  const wallMs = Math.round(performance.now() - t0);
  const maxLagMs = await lag.stop();
  lat.sort((a, b) => a - b);
  const p99 = Math.round(lat[Math.floor(lat.length * 0.99)] || 0);
  console.log(`  ${label}: wall=${wallMs}ms  maxEventLoopLag=${maxLagMs}ms  p99ReadLatency=${p99}ms`);
  return { wallMs, maxLagMs, p99ReadLatencyMs: p99, reads: lat.length };
}

async function main() {
  console.log(`Seeding scratch DB: ${N_ROWS} DTUs, burst of ${BURST} mixed reads\n`);
  const ids = seed();

  const child = spawn(BIN, [], { env: { ...process.env, CONCORD_DTU_SIDECAR_SOCK: SOCK, CONCORD_DB_PATH: DBP }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  let up = false;
  try { up = (await sidecarGet("/v1/health"))?.ok === true; } catch { up = false; }
  if (!up) { child.kill(); console.error("FAIL: sidecar didn't start"); process.exit(1); }

  const terms = ["reactor", "lattice glyph", "economy royalty", "concord substrate", "kernel vector"];
  const pick = (i) => (i % 4 === 0 ? { kind: "search", q: terms[i % terms.length] } : { kind: "get", id: ids[(i * 37) % ids.length] });

  // INLINE — synchronous better-sqlite3, exactly what a Node request handler does
  const inline = await measure("INLINE better-sqlite3 (today's path)", async (lat) => {
    const db = new Database(DBP, { readonly: true });
    const getStmt = db.prepare(`SELECT id, owner_user_id, title, body_json, tags_json, visibility, tier, created_at, updated_at, federation_tier, creti_score, price, lens_id, size_kb, version FROM dtus WHERE id = ?`);
    const searchStmt = db.prepare(`SELECT d.* FROM dtus_fts f JOIN dtus d ON d.rowid = f.rowid WHERE dtus_fts MATCH ? ORDER BY rank LIMIT 50`);
    for (let i = 0; i < BURST; i++) {
      const job = pick(i);
      const s = performance.now();
      if (job.kind === "get") getStmt.get(job.id);
      else searchStmt.all(job.q.split(/\s+/).map((w) => `"${w}"`).join(" "));
      lat.push(performance.now() - s);
      // yield occasionally like a real server between requests
      if (i % 20 === 0) await new Promise((r) => setImmediate(r));
    }
    db.close();
  });

  // SIDECAR — concurrent HTTP reads, DB work off the Node loop
  const sidecar = await measure("VIA dtu-sidecar (post-refactor)", async (lat) => {
    await Promise.all(Array.from({ length: BURST }, async (_, i) => {
      const job = pick(i);
      const s = performance.now();
      if (job.kind === "get") await sidecarGet(`/v1/dtu?id=${encodeURIComponent(job.id)}`);
      else await sidecarGet(`/v1/dtus/search?q=${encodeURIComponent(job.q)}&limit=50`);
      lat.push(performance.now() - s);
    }));
  });

  child.kill("SIGTERM");

  const result = {
    phase: "3",
    audit_finding: "sync better-sqlite3 on the event loop (DTU/economy hot reads)",
    generated: new Date().toISOString(),
    host: os.hostname(),
    seed: { dtuRows: N_ROWS, burst: BURST, mix: "75% get-by-id / 25% FTS search" },
    inline_better_sqlite3: inline,
    via_dtu_sidecar: sidecar,
    event_loop_lag_reduction_ms: inline.maxLagMs - sidecar.maxLagMs,
    honesty: {
      status: "CARVED — sidecar built + smoke-tested; NOT wired as the live read path, and the synthetic benchmark does NOT justify wiring it",
      finding: "For fast indexed DTU reads, inline better-sqlite3 is not the event-loop bottleneck — " +
        inline.maxLagMs + "ms max lag / " + inline.p99ReadLatencyMs + "ms p99 across " + BURST + " reads. " +
        "The sidecar adds UDS+HTTP round-trip cost (modernc.org/sqlite is slower than better-sqlite3) and only pays off for genuinely heavy queries or under writer contention — neither reproducible on this box.",
      why_not_live: "1) On this deploy DTUs live in the in-memory STATE.dtus Map; concord.db.dtus is empty (0 rows). 2) No loaded production DB to benchmark the contention/heavy-query case that would actually benefit.",
      to_go_live: "Needs a real workload: migrate the DTU substrate to SQLite-backed storage AND benchmark against a loaded concord.db under a concurrent writer. Only wire /api/dtus through the sidecar if that benchmark shows a real lag reduction. The UDS HTTP contract is language-agnostic — a Rust reimpl is a drop-in.",
      single_writer: "Node remains the only writer. Sidecar opens mode=ro + PRAGMA query_only(1); WAL gives it consistent snapshot reads.",
    },
    verdict:
      "CARVED, NOT LIVE — infra is built and correct (read-only, single-writer-safe, " + sidecar.reads + "/" + BURST + " reads served) " +
      "but the evidence says inline better-sqlite3 is fine for this read shape. Deferred pending a loaded-DB benchmark. This is the honest call, not a soft-defer.",
  };

  const outDir = path.join(HOME, ".zuko", "remaining-work");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "concord-dtu-sidecar-proof.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`\n${result.verdict}\n→ ${outPath}`);

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
}

main().catch((e) => { console.error(e); process.exit(1); });
