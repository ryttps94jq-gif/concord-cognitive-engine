# Concurrency ceiling — measured audit + ranked fix plan

**2026-09-08.** Companion to `docs/CONCURRENCY_STATE_AUDIT.md` (which maps the
STATE-coordination work a multi-process cluster needs). This doc answers the
prior question: **what is actually causing the ceiling, and what's the cheapest
thing that moves it?**

Everything below is measured from `macro_call_log` (198,618 real macro
invocations on the live DB) plus targeted code reads. No estimates.

---

## 1. The measurement that reframes the problem

`macro_call_log` happens to contain a natural experiment: this session's chaos
storms (~200-250 concurrent) ran on 2026-09-08, and every prior day is the
unloaded baseline. Same macros, same box, load as the only variable.

| macro | unloaded avg | **under load** | max under load | ×    |
|---|--:|--:|--:|--:|
| `dtu.list` | ~5 ms | **655 ms** | 11,729 ms | **130×** |
| `emergent.scope.globalTick` | 7.5 ms | 367 ms | 27,100 ms | 49× |
| `lens.list` | 1.5 ms | 52.7 ms | 5,449 ms | 35× |
| `dtu.create` (WRITE) | 4.0 ms | 80.6 ms | 18,652 ms | 20× |
| `emergent.repair.agent.tick` | 59.4 ms | 549.6 ms | 40,227 ms | 9× |
| `emergent.register` | 66.3 ms | 460 ms | 27,088 ms | 7× |
| `ingest.processQueueOnce` | 6.1 ms | 18.3 ms | 25,777 ms | 3× |
| **`accounting.trialBalance`** | — | **0.0 ms** | **1 ms** | **1×** |
| `goals.list` | — | 2.9 ms | **5,618 ms** | avg fine, tail dead |
| `dtu.stats` | — | 3.1 ms | **6,122 ms** | avg fine, tail dead |

**`accounting.trialBalance` ran 5,138 times under full load at avg 0.0 ms / max
1 ms.** A pure-compute macro was completely unaffected while everything around it
degraded 20–130×. `goals.list` and `dtu.stats` show avg 3 ms with 5–6 second
maxima — bimodal.

**The loop is not saturated with evenly-distributed work. It is being parked by a
few expensive operations, and everything else eats the stall.** That is
head-of-line blocking, not throughput exhaustion — and it changes the fix order
completely, because the cheap fixes target the parkers, not the process count.

---

## 2. The parkers, named

### 2a. `dtu.list` — an O(corpus) scan with a fresh array allocation, per call
```js
function dtusArray() { return Array.from(STATE.dtus.values()); }   // server.js:17614
function userVisibleDTUs(viewerId) { … return dtusArray().filter(d => { …12 predicates… }); }
```
`userVisibleDTUs()` is called from **15 sites**. There is **no cache and no
index**. With ~12k in-memory DTUs and 18,016 `dtu.list` calls today, that is
~216 million filter iterations plus 18,016 full-array copies of 12k elements —
all synchronous, all on the request loop. This single function is the dominant
parker.

(A versioned-cache idiom already exists in the same file —
`_cognitiveDtuEntriesCache` / `_cognitiveDtuEntriesCacheVersion` — so the
pattern to copy is in-tree.)

### 2b. Synchronous `better-sqlite3` writes on the request path
`dtu.create` 4 ms → 80.6 ms (max 18.6 s). Every `db.prepare().run()` blocks the
loop for its full duration. There is no async escape hatch — better-sqlite3 is
synchronous by design.

### 2c. Background work sharing the HTTP loop
`governorTick` dispatches **143 heartbeat modules sequentially** every 15 s on
the *same* event loop that serves HTTP. Plus the high-volume tick macros:
`ingest.processQueueOnce` (75,499 calls), `emergent.bridge.heartbeatTick`
(12,517), `emergent.repair.agent.tick`, `emergent.scope.globalTick`. None of
this is user-facing; all of it competes with user requests.

`CONCORD_DISABLE_HEARTBEAT` already exists (server.js:37118) but is partial —
the file's own comment records that `buildCognitiveSnapshot` "was NOT gated by
CONCORD_DISABLE_HEARTBEAT (that switch only short-circuits the unrelated
governor/registry heartbeat)" and therefore ran in *both* arms of a memory
bisect.

### 2d. NOT a parker: the LLM macros
`system.analogize` avg 17.8 s, `chat.respond` avg 175 s, `emergent.pipeline.run`
avg 8 s. These are `await fetch(ollama)` — they consume `_llmQueue` slots, **not
loop time.** They dominate the "total ms" column and are irrelevant to the
concurrency ceiling. Their fix is A40 capacity, not architecture. **Do not
conflate the two**; the totals table invites exactly that mistake.

---

## 3. The research constraint that bounds clustering

WAL mode solves **reader/writer** blocking. It does not solve **writer/writer**:
SQLite permits exactly one writer at a time, and adding processes adds
contention without adding write parallelism ([SkyPilot](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/),
[OneUptime](https://oneuptime.com/blog/post/2026-09-08-fix-sqlite-database-is-locked-concurrent-writes/view),
[DOCSAID](https://docsaid.org/en/blog/sqlite-wal-busy-timeout-for-workers/)).
Recommended practice when multiple workers write regularly: admit writes through
a **single bounded queue**, or move to a client/server DB.

Practical consequence for Concord: **an N-process cluster scales reads ~N× and
writes 0×.** Concord's request mix is read-dominant today (`dtu.list`/`goals.list`/
`dtu.stats`/`lens.list` vs `dtu.create`), so clustering is still worth doing —
but it is a ceiling-raiser, not a ceiling-remover, and it will convert write
pressure into `SQLITE_BUSY` retries rather than throughput.

---

## 4. Ranked plan

### Tier 0 — hours, no architecture change, best ratio by far
| # | Fix | Effort | Expected |
|---|---|---|---|
| **A** | **Cache/index `userVisibleDTUs`.** Memoize per `(viewerId, scope, tier)` against a `STATE.dtus` version counter bumped on every DTU write (copy the `_cognitiveDtuEntriesCache` idiom). Better still: maintain a pre-filtered public/regional index so the common anon case is O(page), not O(corpus). | ~4-6 h | `dtu.list` 655 ms → target <20 ms at the same concurrency. Removes the dominant parker. |
| **B** | Re-evaluate the DTU-sidecar lag-bypass (`cde86295b`). It currently sends `dtu.list` **inline** when loop lag > 250 ms — correct while (A) is unfixed (inline beat a UDS hop on a starved loop), likely wrong after (A) lands. Re-measure and flip if so. | ~1 h | avoids a self-inflicted slow path |
| **C** | Audit the other 14 `userVisibleDTUs()` call sites for the same O(corpus) pattern. | ~2 h | removes secondary parkers |

**Do Tier 0 before anything else.** Spending multi-day cluster work to divide a
problem that a few hours of caching largely removes is the wrong order.

### Tier 1 — 1-2 days, process separation, no STATE-coordination needed
| # | Fix | Effort | Expected |
|---|---|---|---|
| **D** | **Run the heartbeat in its own process.** `CONCORD_HEARTBEAT_ONLY=1` (governorTick + emergent, binds no HTTP port) alongside the HTTP process with a *complete* `CONCORD_DISABLE_HEARTBEAT=1`. The `CONCORD_READ_REPLICA` work already proves the "boot server.js in a role" pattern, and `world-shard-protocol.js` already documents the per-world vs user-global write split this needs. Fix the partial gating noted in 2c. | 1-2 d | 143 modules of bulk work leave the request loop entirely. Structurally the biggest win that is **not** clustering. |
| **E** | **Activate the read-replica + read-router** (already built, commit `56c6e4ec7`, `engines/concord-read-router/RUNBOOK.md`). Takes the allowlisted GET catalog off the writer. | ~1 h + monitoring | free read parallelism; gated on RAM headroom → needs the A40, not the 16 GB Mac |

### Tier 2 — multi-day, the actual cluster
Execute `docs/CONCURRENCY_STATE_AUDIT.md`'s 7 steps in order: resolve
`/api/credits/*` (a live in-memory free-mint wallet — correctness fix, do it
regardless), `IS_HEARTBEAT_NODE` singleton guard (largely subsumed by D), nginx
routing tiers, Redis for `_macroRateLimits`/`_apiRateWindows`/user-cache bust,
Tier-U write-through (`game_profiles`, `xpStore`, `mentorships`), then
`instances: 2` and watch for a week.

Expected: reads scale ~N. Writes do not (§3).

### Tier 3 — only if measurement says writes are the ceiling
- **F.** Single bounded write queue (the research's recommendation) — makes
  contention predictable instead of `SQLITE_BUSY` storms.
- **G.** Postgres for the hot write tables. Large project; only on measured need.

---

## 5. What not to do

- **Don't buy a bigger pod expecting this to fix it.** A 9-vCPU A40 still runs
  *one* event loop for `POST /api/lens/run`. More cores give Ollama, the
  frontend, and workers room — they do not parallelize the macro chokepoint.
  (The A40 *does* fix the LLM degradation in 2d, which is real and worth doing —
  just a different problem.)
- **Don't cluster before Tier 0.**
- **Don't read the `total_ms` column as a priority list** — it is dominated by
  LLM await time that never touched the loop.
- **Don't let clustering land without the `/api/credits` fix** — per-process
  in-memory balances plus a client-supplied `earn` amount is a mint bug that
  gets strictly worse under N processes.

---

## 6. Reproduce

```sh
sqlite3 server/data/concord.db "SELECT domain||'.'||macro_name, count(*), ROUND(AVG(duration_ms),1), MAX(duration_ms) \
  FROM macro_call_log WHERE ts > unixepoch('2026-09-08') GROUP BY 1 HAVING count(*)>50 ORDER BY 2 DESC;"
# …and the same with `ts <` for the unloaded baseline.

AUTH=1 node load-tests/chaos-storm.mjs          # regenerate load
node scripts/detect-lens-stacking.mjs           # unrelated, frontend
```

**Sources:** [SkyPilot — Abusing SQLite to Handle Concurrency](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/) ·
[OneUptime — Fix SQLite "Database Is Locked" Under Concurrent Writes](https://oneuptime.com/blog/post/2026-09-08-fix-sqlite-database-is-locked-concurrent-writes/view) ·
[DOCSAID — SQLite WAL busy_timeout for workers](https://docsaid.org/en/blog/sqlite-wal-busy-timeout-for-workers/) ·
[OneUptime — Node.js clustering with PM2](https://oneuptime.com/blog/post/2026-02-20-nodejs-clustering-pm2/view) ·
[Site24x7 — Scaling Node.js Applications](https://www.site24x7.com/learn/scaling-node-js-application.html)
