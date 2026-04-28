# Pattern 1: Client-Supplied Identifier as Authenticator

**Date:** 2026-04-28

## Summary

Broad grep across all server files for req.body/req.query identifier accesses. Found 114 identifier accesses total. Classified each:

---

## Category A — Fixed (17 instances)

| File | Line | Pattern | Fix Applied |
|------|------|---------|-------------|
| economy/routes.js | 316 | `/api/economy/withdrawals` — `req.query.user_id` priority | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 661 | `/api/stripe/connect/status` — `req.query.user_id` priority | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 743 | `/api/economy/purchases` — `req.query.user_id` priority | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 1568 | `/api/economy/marketplace/listings/:id/delist` — `req.body.seller_id` | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 1585 | `/api/economy/marketplace/listings/:id/price` — `req.body.seller_id` | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 1611 | `/api/marketplace/pack` — `req.body.seller_id` | Added `authRequired`, use `req.user.id` |
| economy/routes.js | 353,377 | Admin withdrawal approve/reject — `req.body.reviewer_id` in audit log | Use `req.user?.id` — audit log integrity |
| server.js | 41380 | `/api/economy/balance` — `req.query.user_id` priority | Swapped to `req.user?.id` first |
| server.js | 42717 | `/api/social/bookmarks` — `req.query.userId` priority | Swapped priority, dropped `req.actor` |
| server.js | 42725 | `/api/social/feed/foryou` — `req.query.userId` priority | Same |
| server.js | 42732 | `/api/social/feed/following` — `req.query.userId` priority | Same |
| server.js | 42780 | `/api/social/stories` — `req.query.userId` priority | Same |
| server.js | 42891 | `/api/collab/workspaces` — `req.query.userId` priority | Swapped priority |
| server.js | 47718,47740 | `/api/twin`, `/api/twin/circadian` — `req.query.userId` only | Use `req.user?.id` first |
| server.js | 49002,49010 | `/api/rate-limits`, `/api/costs` — `req.query.userId` only | Use `req.user?.id` first |
| server.js | 49563 | `/api/adaptive/layout` — `req.query.userId` only | Use `req.user?.id` first |
| film-studio.js | 293,299,305 | Gift routes — `req.body.fromUserId`/`toUserId` fallback | Dropped body fallback (authForWrites covers POST) |
| guidance.js | 403 | UNDO event audit log — `req.body.user_id` as actor | Use `req.user?.id` |
| durable.js | 414 | Marketplace entitlement — `req.query.user_id` | Use `req.user?.id` |
| durable.js | 435 | Download audit log — `req.query.user_id` | Use `req.user?.id` |
| routes/studio.js | 193 | `/projects` — `req.query.userId` priority | Swapped priority |
| routes/media.js | 308 | Media viewer ID — `viewerId \|\| req.query.userId` | Use `viewerId` only |

---

## Category B — Target Identifier (Accepted)

| Instance | Rationale |
|----------|-----------|
| `server.js:38697` — `addWorkspaceMember(id, req.body.userId, role, {inviterId})` | `req.body.userId` is the INVITED MEMBER, not the actor. Actor is `inviterId` from `req.user.id`. |
| `server.js:37717` — `/api/shard/route?userId=` | Routing lookup only — read-only, no action taken on behalf of user |
| `server.js:37720` — `/api/governor/check?userId=` | Governance status check — read-only |
| `server.js:38964` — `/api/onboarding?userId=` | `req.user?.id` takes priority; `userId` for anonymous tracking |
| `film-studio.js:143,313` — `req.user?.id \|\| req.query.creatorId` | Auth takes priority; creatorId is public filter for analytics |

---

## Category C — Admin-Only (Accepted)

| Instance | Rationale |
|----------|-----------|
| `economy/routes.js:115` | `adminOnly` middleware. `req.body.user_id` is the target account to credit. Added `// safe: admin-only` comment. |
| `economy/routes.js:817-827` | `adminOnly` middleware. `req.body.user_id` is the account to adjust. Admin operation by design. |

---

## Category D — Public by Design (Documented)

| Instance | Rationale |
|----------|-----------|
| `server.js:38921` — `/api/activity?userId=` | Activity log filter; public-facing activity data |
| `server.js:47570` — `getSubscription(req.query.userId)` | Subscription tier is public information (used for feature gates) |
