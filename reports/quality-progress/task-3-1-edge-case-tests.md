# Task 3.1: Edge Case Test Coverage — Critical Paths

**Date:** 2026-04-28  
**File:** `server/tests/edge-cases-critical-paths.test.js`

---

## Summary

Created 31 edge case tests across 11 `describe` groups covering the most critical server paths. Tests use the same Node native test runner pattern (`node:test`) as existing test files and integrate with CI via `API_BASE` environment variable.

---

## Test Groups

| Group | Tests | What It Covers |
|-------|-------|----------------|
| Auth — malformed/expired tokens | 5 | Invalid JWT, empty bearer, truncated token, missing auth header, logout |
| Auth — registration validation | 3 | Missing username, missing password, duplicate username → 409 |
| DTU lifecycle — nonexistent targets | 3 | Fork/like/get on non-existent DTU → no 5xx |
| DTU creation — input validation | 3 | Missing title, 10,000-char title, XSS in title |
| DTU deduplication | 2 | Double-like → alreadyLiked, double-vote → alreadyVoted |
| Marketplace — nonexistent listings | 1 | Purchase non-existent listing → 4xx not 5xx |
| Marketplace — wallet edge cases | 3 | Negative withdraw, zero withdraw, overdraft → all 4xx |
| Governance — nonexistent proposals | 2 | Vote on / GET non-existent proposal → no 5xx |
| Governance — proposal validation | 2 | Create without title → 4xx, double-vote → no 5xx |
| Health endpoints | 4 | /health, /ready, /api/health/db, /api/health/ws always respond |
| Input sanitization | 3 | SQL injection in search, NoSQL injection, deeply nested JSON |

**Total: 31 tests**

---

## Test Strategy

- **Pattern:** Same as `adversarial-critical-endpoints.test.js` — spawns test server locally or uses `API_BASE` in CI
- **Assertions:** All use graceful degradation principle — verify no 5xx, check error shape
- **Auth:** Tests register fresh users with unique names to avoid state collisions
- **Skipping:** Tests that depend on optional features (e.g., DTU creation) use early returns rather than hard failures — they pass vacuously if the feature isn't available

---

## CI Integration

Added as a step in the `integration-test` job (after the existing adversarial tests):

```yaml
- name: Run edge case tests (critical paths)
  working-directory: ./server
  env:
    API_BASE: http://localhost:5050
  run: node --test tests/edge-cases-critical-paths.test.js
```

---

## Key Edge Cases Covered

### Auth
- Truncated JWT (2-part instead of 3-part) → 401
- Empty string after `Bearer ` → 401  
- Duplicate registration → 409 (not 500)

### DTU
- Fork/like/vote on `does-not-exist-xyz` ID → no 5xx
- Create with 10,000-character title → no 5xx
- `<script>alert('xss')</script>` in title — verifies it doesn't reach the response unescaped
- Double-like / double-vote verified against `alreadyLiked`/`alreadyVoted` response fields

### Marketplace
- `amount: -100` → 4xx (not 5xx, not silently accepted)
- `amount: 999_999_999` → rejected (overdraft protection)

### Governance
- Vote/GET on `nonexistent-proposal-xyz` → no 5xx
- Double-vote on same proposal → no 5xx (idempotent or rejected gracefully)

### Health
- All 4 health endpoints verified to respond (200 or 503) with expected fields

### Injection
- `' OR '1'='1` URL-encoded in `?search=` → no 5xx
- Deeply nested 50-level JSON → no stack overflow
