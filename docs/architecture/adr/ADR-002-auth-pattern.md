# ADR-002: Auth Pattern — req.user.id as Actor Identity

| Field | Value |
|-------|-------|
| **Status** | Accepted (remediated) |
| **Date** | 2026-04-28 |
| **Deciders** | Quality Sprint Team |

---

## Context

A recurring vulnerability was discovered in mutation routes across the server: AI-generated code frequently used `req.body?.userId` as the actor identity — the ID of the user performing an action — instead of the authenticated identity resolved from the JWT or API key.

Example of the vulnerable pattern:

```js
// VULNERABLE — auth bypass
router.post('/api/social/follow', requireAuth(), async (req, res) => {
  const followerId = req.body.userId;  // ← attacker-controlled
  await db.createFollow({ followerId, followeeId: req.body.followeeId });
  res.json({ ok: true });
});
```

Any authenticated user can set `req.body.userId` to a different user's ID and perform actions on their behalf. This affects social graphs, collaboration invites, DTU ownership assignments, and any other user-scoped write operation.

The root cause is that AI code-generation tools pattern-match on "I need the userId, and userId is in the body", without recognising that the authenticated identity must come from the verified token, not the request payload.

---

## Decision

**Rule:** All mutation routes (POST, PUT, PATCH, DELETE) that write user-scoped data MUST:

1. Apply `requireAuth()` middleware.
2. Use `req.user.id` as the actor identity.

```js
// CORRECT
router.post('/api/social/follow', requireAuth(), async (req, res) => {
  const followerId = req.user.id;  // ← server-resolved, unforgeable
  await db.createFollow({ followerId, followeeId: req.body.followeeId });
  res.json({ ok: true });
});
```

**Exception — target identifier:** `req.body.userId` is permitted when it identifies the *target* of an action (e.g., the user being invited to a workspace, the user whose profile is being viewed). When used as a target identifier it MUST be annotated inline:

```js
// safe: target-identifier
const inviteeId = req.body.userId;
```

This annotation is machine-readable: the CI grep gate passes over it.

---

## Consequences

### Positive

- **Closes the auth bypass class.** No mutation route can be exploited by supplying a forged userId in the request body.
- **CI gate prevents reintroduction.** The following command is run in CI and must return zero results:

  ```bash
  grep -rn "req\.body\.userId" server/ --include="*.js" | grep -v "// safe:"
  ```

- **Correct by default.** `req.user.id` is always the right value for actor identity; this decision has no known downside compared to the old pattern.

### Negative

- None. `req.user.id` is always more correct than `req.body.userId` for actor identity. The annotation requirement for target-identifier uses adds minor verbosity but improves auditability.

---

## Detection and Remediation

### Finding violations

```bash
grep -rn "req\.body\.userId" server/ --include="*.js" | grep -v "// safe:"
```

Each result is a potential auth bypass. For each:

1. Determine whether `req.body.userId` is used as actor identity or target identity.
2. If actor identity: replace with `req.user.id` and ensure `requireAuth()` is on the route.
3. If target identity: add `// safe: target-identifier` comment on the same line.

### CI gate

The grep command above is registered as a CI check (see `reports/quality-progress/task-8-1-ci-gates.md`). A non-zero exit code (i.e., any unannotated `req.body.userId`) fails the build.

---

## Related

- [Auth audit report](../../../reports/quality-progress/task-1-1-get-userid-classification.md)
- [Security overview](../../AUTH.md)
- [ADR-003: Server Modularity](ADR-003-server-modularity.md) — extraction process that ensures new route files follow this pattern from the start
