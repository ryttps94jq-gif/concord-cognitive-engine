# concord-dtu-sidecar

Read-only SQLite follower for the DTU substrate. Opens `concord.db` with
`mode=ro` + `PRAGMA query_only(1)` and answers get-by-id / recent / FTS-search
over a Unix socket, so those reads don't block the Node event loop.

Concurrency Refactor **Phase 3** — audit finding "sync better-sqlite3 on the
event loop".

## ⚠️ STATUS: CARVED, NOT LIVE — this is the honest call, not a soft-defer

The sidecar, the Node client (`server/lib/sidecars/dtu-sidecar-client.js`), and
the fail-soft contract are **built and correct**. Nothing routes through them yet,
for two evidence-backed reasons:

1. **DTUs aren't in SQLite on this deploy.** They live in the in-memory
   `STATE.dtus` Map; `concord.db.dtus` has **0 rows**. A sidecar reading that
   table returns nothing.
2. **The benchmark doesn't justify wiring it.** `proof/run-proof.mjs` seeds a
   5000-row scratch DB and fires a 400-read burst (75% get-by-id, 25% FTS):
   inline `better-sqlite3` handles it with **~18ms** max event-loop lag /
   **~6ms** p99. The sidecar adds UDS+HTTP round-trip cost (`modernc.org/sqlite`
   is slower than `better-sqlite3`) and only pays off for genuinely heavy queries
   or under writer contention — neither reproducible on this box.

### To go live

Needs a real workload: a SQLite-backed DTU substrate **and** a loaded
`concord.db` to benchmark the contention / heavy-query case. Wire `/api/dtus`
through the sidecar only if that benchmark shows a real lag reduction. The
Unix-socket HTTP contract is language-agnostic — a Rust reimplementation (the
handoff's original language pick) is a drop-in replacement.

## Why Go, not Rust

The handoff cheat-sheet picks Rust for this. Rust's toolchain isn't installed
and F0 rule 5 (stay lean, ~20GB disk) discourages a ~1GB install. Go was already
vendored for Phase 1, the event-loop-offload goal is language-independent, and
`modernc.org/sqlite` is pure-Go (no cgo, static binary). Swap to Rust later
behind the same socket contract if the loaded-DB benchmark ever justifies it.

## API (read-only)

| Method | Path | Returns |
|---|---|---|
| GET | `/v1/health` | `{ok, dtuRows, queryOnly, served}` |
| GET | `/v1/dtu?id=` | `{ok, dtu}` / 404 |
| GET | `/v1/dtus/recent?limit=&owner=&visibility=&tier=` | `{ok, count, dtus[]}` |
| GET | `/v1/dtus/search?q=&limit=` | `{ok, count, dtus[]}` (FTS5, input sanitised) |

## Build

```sh
cd engines/concord-dtu-sidecar
GOFLAGS=-trimpath go build -ldflags="-s -w" -o bin/concord-dtu-sidecar .
```

No launchd plist is installed — the sidecar isn't part of the running stack
until it's wired. `CONCORD_DTU_SIDECAR=1` + `CONCORD_DB_PATH` to run it manually.
