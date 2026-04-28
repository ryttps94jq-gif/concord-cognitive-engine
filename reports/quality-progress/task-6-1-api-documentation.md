# Task 6.1: API Documentation

**Date:** 2026-04-28  
**File modified:** `server/routes/api-docs.js`

---

## Summary

Extended the auto-generated OpenAPI 3.1 spec served at `GET /api/docs/openapi.json` with three new tag groups and 10 new endpoint definitions covering social interactions, governance, and the marketplace.

---

## New Endpoint Coverage

### Social (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/social/post` | Create a social post |
| GET | `/api/social/feed` | Get social feed (authenticated) |
| POST | `/api/social/follow` | Follow a user |
| POST | `/api/dtus/{id}/like` | Like a DTU |
| POST | `/api/dtus/{id}/vote` | Vote on a DTU (up/down) |

### Governance (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET/POST | `/api/governance/proposals` | List or create proposals |
| POST | `/api/governance/proposals/{id}/vote` | Vote on a proposal |

### Marketplace (3 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/economy/marketplace` | List marketplace listings |
| POST | `/api/dtus/{id}/publish` | Publish a DTU to the marketplace |
| POST | `/api/economy/marketplace/{id}/purchase` | Purchase a listing |

### DTU extensions (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/api/dtus/{id}/fork` | Fork a DTU (moved to DTUs tag) |

---

## Tags Added

| Tag | Description |
|-----|-------------|
| `Social` | Social interactions: posts, follows, likes, votes |
| `Governance` | Community governance proposals and voting |
| `Marketplace` | DTU marketplace: publish, browse, and purchase listings |

Previously existing tags: Auth, API Keys, DTUs, Chat, Billing, Docs, + all Lens domain tags.

---

## Explorer HTML

The interactive API explorer at `GET /api/docs` already includes a search bar and tag filter, so the new tags are immediately browsable without any UI changes.

---

## Gaps (Deferred)

| Gap | Reason |
|-----|--------|
| Request/response schemas for all endpoints | Time-bounded sprint; structural coverage prioritized |
| Feed-manager tick endpoint | Internal admin endpoint, not part of public API contract |
| WebSocket events (`feed:new-dtu`, `marketplace:purchase`, etc.) | OpenAPI 3.1 AsyncAPI extension out of scope for this sprint |
| Full parameter validation examples | Can be added incrementally from integration test data |
