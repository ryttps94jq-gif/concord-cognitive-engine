# Task 4.1: Lighthouse CI Integration

**Date:** 2026-04-28  
**Files created:**
- `concord-frontend/.lighthouserc.json`
- `.github/workflows/lighthouse.yml`

---

## Configuration

### `.lighthouserc.json` Thresholds

| Metric | Level | Threshold |
|--------|-------|-----------|
| Performance score | warn | ≥ 0.50 (50) |
| Accessibility score | **error** | ≥ 0.70 (70) |
| Best Practices score | warn | ≥ 0.70 (70) |
| SEO score | warn | ≥ 0.60 (60) |
| First Contentful Paint | warn | ≤ 4,000 ms |
| Largest Contentful Paint | warn | ≤ 6,000 ms |
| Time to Interactive | warn | ≤ 10,000 ms |
| Cumulative Layout Shift | warn | ≤ 0.25 |

**Rationale for thresholds:**
- Accessibility is `error` (blocks) because it represents a hard quality bar. Score of 70 is achievable and meaningful.
- Performance is `warn` (non-blocking) because the app is JavaScript-heavy with real-time features. The 50 floor catches catastrophic regressions without blocking valid code.
- HTTPS checks are disabled (`"off"`) — not applicable in CI localhost.
- PWA preset disabled (`lighthouse:no-pwa`) — no service worker currently.

### Workflow

The `lighthouse.yml` workflow:
1. Builds the frontend (`next build`)
2. Starts both the server (port 5050) and Next.js production server (port 3000)
3. Runs `@lhci/cli autorun` against `/` and `/lenses/news`
4. Uploads `.lighthouseci/` artifacts (retained 14 days)
5. Uses `continue-on-error: true` — never blocks deploys in the first sprint

---

## Pages Audited

| URL | Rationale |
|-----|-----------|
| `http://localhost:3000` | Home page — most-visited entry point |
| `http://localhost:3000/lenses/news` | Representative lens page with live feed panel |

---

## Phase 2 (Post-Launch Hardening)

Once baselines are established:
1. Switch `continue-on-error` to `false` for accessibility gate
2. Tighten Performance threshold to ≥ 0.60
3. Add more lens pages to audit list
4. Enable historical trend tracking with `--upload.target=lhci-server` pointed at a self-hosted LHCI server

---

## Gaps (Deferred)

| Gap | Reason |
|-----|--------|
| Historical trend tracking | Requires LHCI server or GitHub Actions storage setup |
| Real device emulation | Requires actual mobile test environment |
| Performance budget per route | Requires baseline data from first 2-4 weeks of running |
