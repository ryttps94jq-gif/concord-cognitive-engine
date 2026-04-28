# Task 1.1: GET Endpoint userId Classification

**Date:** 2026-04-28  
**Total instances found:** 27 (1 in eslint config comment, 26 in route code)

---

## Category A — Authenticator Misuse (Fixed)

| File | Line | Route | Issue | Fix |
|------|------|-------|-------|-----|
| server.js | 42823 | `GET /api/social/notifications` | `req.query.userId` first — any user could read another's private notifications | `requireAuth()` + `req.user?.id` |
| server.js | 42844 | `GET /api/social/notifications/count` | Same — exposes unread count for any userId | `requireAuth()` + `req.user?.id` |
| routes/shield.js | 46 | `GET /api/shield/status` | `req.query.userId` first — could expose another user's security posture | Removed query fallback, uses `req.user?.id \|\| "anonymous"` |

All 3 fixed in this commit.

---

## Category B — Target Identifier (Acceptable — Read-Only Lookups)

| File | Line | Route | Rationale |
|------|------|-------|-----------|
| server.js | 37721 | `GET /api/shard/route` | Routing lookup for whom to shard — not actor identity |
| server.js | 37724 | `GET /api/governor/check` | Permission check on a target user — not actor |
| server.js | 38925 | `GET /api/activity` | Activity log filter by target user — read-only |
| server.js | 42548 | `GET /api/social/feed` | Viewing another user's public feed |
| server.js | 42558 | `GET /api/social/analytics/creator` | Public creator stats (DTU count, engagement) |
| server.js | 42682 | `GET /api/social/reactions/:postId` | Current user's reaction status — context lookup |
| server.js | 42728 | `GET /api/social/bookmarks` | Viewing another user's bookmarks (public in this platform) |
| server.js | 42736 | `GET /api/social/feed/foryou` | For-you feed for a specific user — public-facing personalization |
| server.js | 42743 | `GET /api/social/feed/following` | Following feed — social graph is public |
| server.js | 42791 | `GET /api/social/stories` | Active stories — public content |
| server.js | 42907 | `GET /api/collab/workspaces` | Workspaces owned by a user — public workspace list |
| routes/studio.js | 193 | `GET /studio/projects` | Projects by creator — optional filter, falls back to all |
| routes/media.js | 308 | `GET /api/media/:id` | Viewer identity for access check — viewerId takes priority |

---

## Category D — Public by Design (Accepted)

| File | Line | Route | Rationale |
|------|------|-------|-----------|
| server.js | 38968 | `GET /api/onboarding` | `req.user?.id \|\| req.query.userId \|\| "anonymous"` — session first, supports anonymous onboarding by design |
| server.js | 47608 | `GET /api/subscription` | Subscription tier is non-sensitive (just "free"/"pro") — public product information |
| server.js | 47756 | `GET /api/twin` | Digital twin is a public behavioral profile; twin updates require auth (POST /api/twin/update) |
| server.js | 47778 | `GET /api/twin/circadian` | Circadian profile — public-facing productivity data |
| server.js | 49040 | `GET /api/rate-limits` | Rate limit usage — non-sensitive, useful for debugging |
| server.js | 49048 | `GET /api/costs` | Cost accounting — development/monitoring tool |
| server.js | 49601 | `GET /api/adaptive/layout` | UI layout preferences — non-sensitive personalization |
| routes/world.js | 425 | `_userId(req) \|\| req.user?.id \|\| req.query.userId` | Query is last fallback, unreachable when auth middleware is applied |
| routes/media.js | 475 | `GET /media/feed` | `req.user?.id \|\| req.query.userId \|\| "anonymous"` — session first |

---

## Summary

- **Category A fixed:** 3 routes
- **Category B accepted:** 13 routes (read-only, public content lookups)
- **Category D accepted:** 9 routes (public by design or session-first ordering)
- **No Category C (admin-only GET patterns found)**
