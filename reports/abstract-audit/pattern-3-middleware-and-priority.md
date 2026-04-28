# Pattern 3: Middleware Ordering and Identifier Priority

**Date:** 2026-04-28

## Summary

Audited all routes where req.body/query identifier accesses are used, checking priority ordering and middleware presence.

---

## Priority Issues Found and Fixed

All priority issues (client-supplied before req.user) were found in Pattern 1 audit and fixed simultaneously. See pattern-1-identifiers.md for full list.

---

## Middleware Ordering Findings

No ordering bugs found. The server uses a flat route registration model — each route registers its own middleware inline as arguments. Express processes middleware in registration order within a route, so:

```js
app.post("/route", requireAuth(), validate("schema"), handler)
```

...is always in the correct order (auth → validate → handle).

Pattern checked: routes that call `req.user?.id` without `requireAuth()` middleware were caught in Pattern 1 and fixed by adding `authRequired` middleware.

---

## Accepted Non-Fixes

Routes using `req.user?.id || req.query.userId` where auth has priority are accepted as valid — they allow public viewing of another user's content (e.g., viewing a public profile, filtering content by author) while preferring the authenticated user's own context.
