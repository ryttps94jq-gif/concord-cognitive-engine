# concord-dtu-sidecar  (Rust)

Read-only reader for the Concord DTU substrate. Opens `concord.db` with
`SQLITE_OPEN_READ_ONLY` + `PRAGMA query_only(1)` and answers get-by-id / list
(visibility-filtered) / recent over a Unix socket, so those reads don't run on
the Node event loop.

Concurrency Refactor **Phase 3**.

## ⚠️ STATUS: BUILT + INVESTIGATED — BLOCKED ON A SCHEMA MIGRATION. NOT WIRED.

This is the honest outcome, backed by a differential test, not a soft-defer.

`dtu.get` / `dtu.list` (server.js, reached via `GET /api/dtus`) were the target.
`dtu.list` runs `userVisibleDTUs()` + a scope/visibility filter over the **entire
in-memory `STATE.dtus` set** on every locker page load — a real O(n) event-loop
cost at scale. The plan: do that filter in Rust against SQLite.

**Three findings from actually building it (`proof/run-proof.mjs` — boots the real
server, seeds a scenario matrix, diffs Rust output vs the live macro):**

1. **`dtu_store` can't feed a faithful visibility filter.**
   - `dtu_store.data` is frequently just `JSON.stringify(dtu.body)` (the
     `sniffPayload` fallback in `dtu-store.js`) — `id` / `owner` / `visibility` /
     `privacy` / `federation_tier` are **lost** for any DTU with a `body` field.
   - `dtu_store.scope` / `.tier` / `.source` are **persist-time defaulted**
     (`dtu.scope ?? "global"`), so they diverge from the in-memory object the JS
     filter sees.
   - `owner_user_id` / `visibility` / `privacy` / `federation_tier` /
     `machine.kind` — the fields `userVisibleDTUs` needs — are **not columns and
     not reliably in `data`.**
   The differential test's residual diffs are tiny (one special seed DTU + one
   private-DTU scope edge) *because most fields happen to survive* — but "happens
   to survive" is not something you ship on a privacy-sensitive path.

2. **DTU reads are not event-loop-bound today.** The JS `dtu.list` macro filters
   ~2000 already-parsed in-memory objects in **~2 ms** (14 ms max loop lag across
   a 60-call burst). There is nothing to rescue here yet.

3. **A per-request `dtu_store` reader is ~38× slower** — it re-reads and
   JSON-parses every row on every call. A read sidecar only helps if it *also*
   caches parsed rows in memory, i.e. rebuilds `STATE.dtus` in Rust.

### The real fix (spec'd, ~1 day, its own reviewed change)

1. **Migration:** add `owner_user_id`, `visibility`, `privacy`,
   `federation_tier`, `location_regional`, `location_national`, `kind` columns to
   `dtu_store`; indexes on `(owner_user_id)` and `(scope, tier, created_at DESC)`.
2. **Write path:** `dtu-store.js#persistToSQLite` populates them from the DTU
   object (not defaulted); stop the body-only `data` fallback (or always also
   write the columns).
3. **Backfill:** re-persist existing rows from the in-memory cache on next boot
   (`rehydrateFromSQLite` already runs).
4. Then the Rust `list` becomes an indexed
   `SELECT … WHERE owner_user_id=? OR visibility IN('public','published') OR scope='global' ORDER BY created_at DESC LIMIT ?`
   — no full parse — and the differential proof passes.

Until then: the locker filter stays in Node. If it ever gets slow at scale, the
first move is an **in-Node index** (Map by owner + a createdAt-sorted array), not
a sidecar.

## What's here

- `src/main.rs` — Rust, `rusqlite` (bundled SQLite), hand-rolled HTTP over
  `UnixListener`, N worker threads each with their own RO connection.
- `GET /v1/health`, `/v1/dtu?id=`, `/v1/dtus/list?viewer=&scope=&tier=&q=&mine=&limit=&offset=`,
  `/v1/dtus/recent`.
- `dtu.get` semantics **do** match the macro (reliable `id` PK + shadow-hide).
- No launchd plist — nothing runs it until the schema lands.

## Build

```sh
cd engines/concord-dtu-sidecar
~/.cargo/bin/cargo build --release   # → target/release/concord-dtu-sidecar
```

Rust 1.98 (rustup, minimal profile) is installed on this box.
