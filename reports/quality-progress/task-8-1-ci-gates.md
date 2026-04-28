# Task 8.1: CI Quality Gates

**Date:** 2026-04-28  
**File:** `.github/workflows/ci.yml`

---

## Pre-existing Gates (Verified Present)

| Gate | Job | Status |
|------|-----|--------|
| Lint server (`eslint`) | lint-and-test | ✅ |
| TypeScript server typecheck | lint-and-test | ✅ |
| Emergent module dependency check | lint-and-test | ✅ |
| Lint frontend | lint-and-test | ✅ |
| Lens quality validation | lint-and-test | ✅ |
| Frontend build (`next build`) | lint-and-test | ✅ |
| Frontend unit test coverage (35/60/38/35 thresholds) | lint-and-test | ✅ |
| Server test coverage (45/45/38/45 thresholds, c8) | lint-and-test | ✅ |
| Security audit server (--audit-level=critical) | security-scan | ✅ |
| Security audit frontend (--audit-level=critical) | security-scan | ✅ |
| Security audit mobile (--audit-level=critical) | security-scan | ✅ |
| Docker build (backend + frontend) | docker-build | ✅ |
| Smoke tests (real server) | smoke-test | ✅ |
| API integration tests (auth-security.test.js) | integration-test | ✅ |
| E2E tests (Playwright, chromium + firefox) | e2e-test | ✅ |
| Mobile lint + typecheck + coverage | mobile-test | ✅ |
| Mobile performance benchmarks | mobile-perf | ✅ |

## Gates Added in This Task

| Gate | Job | Notes |
|------|-----|-------|
| Frontend TypeScript typecheck (`npm run type-check`) | lint-and-test | Was missing — server had typecheck but not frontend |
| Auth bypass grep gate | lint-and-test | Scans for `req.body.userId \|\| req.user` patterns — fails build if found |
| Adversarial auth bypass tests | integration-test | Runs `tests/adversarial-critical-endpoints.test.js` against live server |

## Auth Bypass Grep Gate Logic

```bash
grep -rn \
  -e "req.body?.userId || req.user" \
  -e "req.body.userId || req.user" \
  -e "req.body?.user_id || req.user" \
  -e "req.body.user_id || req.user" \
  -e "req.body?.buyer_id || req.user" \
  -e "req.body.buyer_id || req.user" \
  server/ --include="*.js" | \
  grep -v "node_modules|// safe:|admin_only|test|spec|adversarial|audit|report"
# Must return 0 lines or build fails
```

Exclusions: `// safe:` annotation, admin_only routes, test/audit files.

## Gaps Left (Deferred)

| Gap | Why Deferred |
|-----|-------------|
| Lighthouse CI performance regression | Depends on Task 4.1 (Lighthouse CI setup) — added in that task |
| Coverage regression comparison (trend) | Requires baseline storage; artifacts uploaded for manual review |
| Frontend audit at --audit-level=high | Two known unfixable HIGHs (lodash-es, postcss via Next.js); documented in audit report |
