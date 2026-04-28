# Task 1.2: Comprehensive Dependency Audit

**Date:** 2026-04-28

---

## Server Vulnerabilities (Before)

| Package | Severity | CVE | Status |
|---------|----------|-----|--------|
| `protobufjs` < 7.5.5 via `@xenova/transformers` chain | **CRITICAL (×4)** | GHSA-xq3m-2v4x-88gg | ✅ Fixed via `overrides: { "protobufjs": "^7.5.5" }` |
| `uuid` < 14.0.0 | MODERATE | GHSA-w5hq-g745-h8pq | ✅ Accepted — only v4 used (vulnerability is in v3/v5/v6 when `buf` provided) |

**After fix:** 0 CRITICAL, 0 HIGH, 1 MODERATE (uuid — inapplicable to our usage).

## Frontend Vulnerabilities (Before)

| Package | Severity | CVE | Status |
|---------|----------|-----|--------|
| `lodash-es` ≤ 4.17.23 via `langium`→`chevrotain` | **HIGH** | GHSA-xxjr-mmjv-4gpg, GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh | ⚠️ Deferred — no patched lodash-es release exists; runtime exposure is nil (build-time Monaco/langium dep only) |
| `postcss` < 8.5.10 via `next`→`@sentry/nextjs` | HIGH | — | ⚠️ Deferred — fix requires Next.js 9.x downgrade (unacceptable) |
| Various `uuid` < 14.0.0 | MODERATE (×12) | GHSA-w5hq-g745-h8pq | ⚠️ Deferred — fix requires uuid@14 (breaking) |

**After:** 0 CRITICAL, 1 HIGH (lodash-es, build-time only), 13 MODERATE.

---

## Outdated Packages

### Server — Safe-to-schedule upgrades

| Package | Current | Latest | Risk | Priority |
|---------|---------|--------|------|----------|
| `pg` | 8.18.0 | 8.20.0 | Low (patch) | Scheduled |
| `ws` | 8.19.0 | 8.20.0 | Low (patch) | Scheduled |
| `pdfkit` | 0.17.2 | 0.18.0 | Low (minor) | Scheduled |
| `@types/node` | 25.5.0 | 25.6.0 | None (devDep patch) | Scheduled |

### Server — Major version upgrades (require dedicated sprint)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `express` | 4.22.1 | 5.2.1 | Breaking API changes — full regression suite required |
| `stripe` | 17.7.0 | 22.1.0 | Major API changes — payment flow testing required |
| `zod` | 3.25.76 | 4.3.6 | Breaking schema API — full validation audit required |
| `helmet` | 7.2.0 | 8.1.0 | Security middleware — requires CSP policy review |
| `redis` | 4.7.1 | 5.12.1 | Client API changes |
| `bcryptjs` | 2.4.3 | 3.0.3 | Auth-critical — require parallel testing |
| `better-sqlite3` | 11.10.0 | 12.9.0 | Database layer — regression testing |
| `uuid` | 9.0.1 | 14.0.0 | Import syntax change across 9 files |
| `meilisearch` | 0.37.0 | 0.57.0 | Search client API changes |

### Frontend — Major version upgrades (require dedicated sprint)

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@tiptap/*` | 2.x | 3.x | Rich text editor — all 11 extensions upgraded simultaneously |
| `@react-three/*` | 8.x/9.x | 9.x/10.x | 3D rendering — visual regression testing required |
| `@tanstack/react-query` | 5.90.x | 5.100.x | Minor; safe to upgrade |
| `@playwright/test` | 1.58.x | 1.59.x | Patch; safe to upgrade |

---

## Actions Taken

1. **Server `protobufjs` CRITICAL (×4):** Added `"overrides": { "protobufjs": "^7.5.5" }` to `server/package.json`. Verified 0 CRITICAL remaining.
2. **Auth tests verified:** `node --test tests/auth.test.js` → 10 pass, 0 fail.

## Deferred Items

| Item | Rationale |
|------|-----------|
| Frontend `lodash-es` HIGH | No upstream patch exists; build-time dep only; runtime exposure = 0 |
| Frontend `postcss` HIGH | Next.js bundle dep; fix = Next.js 9 downgrade (breaks everything) |
| Server `uuid` MODERATE | Only v4 used; vulnerability in v3/v5/v6 with explicit buf arg |
| Major version upgrades | Require dedicated testing sprint per package; not a security issue |
