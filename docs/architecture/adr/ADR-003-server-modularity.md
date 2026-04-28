# ADR-003: Server Modularity — Incremental Extraction of server.js

| Field | Value |
|-------|-------|
| **Status** | Accepted (extraction in progress) |
| **Date** | 2026-04-28 |
| **Deciders** | Quality Sprint Team |

---

## Context

`server/server.js` has grown to **61,753 lines** containing **977 inline route handlers**. The file originated as a single-file prototype that was never decomposed as the system expanded to cover 176+ lens domains, social features, marketplace, collaboration, and feed management.

The consequences of this scale are concrete:

- **Onboarding is slow.** New contributors cannot grep for a route without wading through tens of thousands of unrelated lines.
- **Diffs are noisy.** Any PR that touches multiple unrelated routes produces a diff in a single file, making review difficult and increasing the risk of merge conflicts.
- **Duplicate route registrations.** At least three known duplicate registrations exist (near lines ~42901, ~43200, ~43450) — a direct consequence of a file too large to review holistically.
- **Testing in isolation is impossible.** Inline route handlers cannot be unit-tested without booting the entire server.

79 route namespaces have already been extracted to `server/routes/` prior to this ADR, validating the extraction pattern.

---

## Decision

Continue **incremental extraction** of route namespaces from `server.js` to dedicated router files under `server/routes/`.

### What is extracted

Each extraction targets one cohesive namespace (e.g., `/api/social/*`, `/api/marketplace/*`) and produces a single file:

```js
// server/routes/social.js
export default function createSocialRouter({ STATE, requireAuth, realtimeEmit, db }) {
  const router = express.Router();

  router.post('/follow', requireAuth(), async (req, res) => {
    const followerId = req.user.id;  // ADR-002: actor from token
    // ...
  });

  return router;
}
```

Mounted in `server.js`:

```js
import createSocialRouter from './routes/social.js';
app.use('/api/social', createSocialRouter({ STATE, requireAuth, realtimeEmit, db }));
```

### What stays in server.js

Macro/lifecycle code is **not** extracted to Express routers. This includes:

- Database initialisation and WAL mode setup
- `STATE` bootstrap (hydrating `STATE.dtus` from SQLite at startup)
- WebSocket / socket.io setup and per-user room management
- Feed Manager startup (`server/lib/feed-manager.js` orchestration)
- Heartbeat and process-level signal handlers

These are not route handlers. Moving them to Express routers would require a separate architectural refactoring with different trade-offs and is out of scope for this extraction effort.

### Extraction checklist per namespace

1. Read all routes in the target namespace from `server.js`.
2. Check for duplicate route registrations (known issue at lines ~42901, ~43200, ~43450 — deduplicate during extraction).
3. Create `server/routes/{namespace}.js` with `export default function create{Namespace}Router(deps)`.
4. Mount in `server.js`: `app.use('/api/{namespace}', create{Namespace}Router({ STATE, requireAuth, realtimeEmit, ... }))`.
5. Delete the inline routes from `server.js`.
6. Run `node --test server/tests/` and verify no regressions.

---

## Consequences

### Positive

- **Each extraction reduces `server.js` by ~500–2,000 lines.** After all 977 handlers are extracted, `server.js` will contain only lifecycle code (~5,000–10,000 lines).
- **Route files are independently testable.** A router factory that accepts injected deps can be instantiated in a test without starting the full server.
- **Diffs become scoped.** A PR touching `/api/social/*` produces a diff only in `server/routes/social.js`.
- **Duplicate registrations are eliminated** as a natural side-effect of the extraction review step.
- **ADR-002 compliance is enforced per file.** Each new route file is small enough to review for `req.body.userId` misuse during the extraction PR.

### Negative

- **Dependency injection boilerplate.** Every router factory must accept and thread through `STATE`, `requireAuth`, `realtimeEmit`, and any other server-level utilities it needs. This is mechanical but verbose.
- **Merge conflicts during parallel extraction.** Extracting two namespaces simultaneously risks conflicting edits to `server.js`. Extractions should be serialised or use non-overlapping line ranges.
- **Cannot batch multiple namespaces** in a single PR without elevated conflict risk. One namespace per PR is the safe cadence.

---

## Current Status

| Metric | Value |
|--------|-------|
| Total inline handlers in server.js | 977 |
| Namespaces extracted to `server/routes/` | 79 |
| Lines in server.js | 61,753 |

Extraction continues incrementally. Each route file added to `server/routes/` is tracked in the git log with a commit message of the form `extract: /api/{namespace} → server/routes/{namespace}.js`.

---

## Related

- [Server modularity task report](../../../reports/quality-progress/task-2-3-server-modularity.md)
- [ADR-002: Auth Pattern](ADR-002-auth-pattern.md) — new route files must follow the actor-identity rule
- [System overview — Data Layer](../overview.md#data-layer)
