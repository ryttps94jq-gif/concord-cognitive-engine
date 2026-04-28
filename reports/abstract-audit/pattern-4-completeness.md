# Pattern 4: Completeness Verification

**Date:** 2026-04-28

---

## Re-run of original userId audit

```
grep -rn "req\.body\.userId\|req\.body\.user_id" server/ --include="*.js" | grep -v "// safe:\|eslint\|comment"
```

Result: 1 remaining — `economy/routes.js:115` with `// safe: admin-only` comment. Gate passes.

---

## ESLint rule expansion

Added 11 new `no-restricted-syntax` selectors covering:

**req.body:** `ownerId`, `seller_id`, `fromUserId`, `toUserId`, `reviewer_id`, `creatorId`

**req.query:** `userId`, `user_id`, `ownerId`, `creatorId`

All at error level. Override with `// safe: <rationale>` comment pattern.

Previous selectors (userId, user_id in body; userId in query) retained.

---

## Test coverage

Adversarial test suite (`server/tests/adversarial-critical-endpoints.test.js`) covers: fork/like/vote 401 without auth, social/post 401, collab/comment 401. Pattern 1 fixes for economy routes and marketplace operations are covered by the existing economy integration tests.
