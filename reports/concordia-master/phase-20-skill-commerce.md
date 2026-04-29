# Phase 20 — Cross-World Skill Commerce

## Summary
Players can list skill DTUs for sale and purchase them across worlds.
Purchases create student skill DTUs with lineage, triggering the existing royalty cascade.

## Files Created
- `server/lib/skill-marketplace.js` — listSkillForSale(), purchaseSkill(), getListings()
- `concord-frontend/components/concordia/skills/SkillMarketplace.tsx` — grid of listing cards with world filter, buy button, success/error feedback

## Routes added to worlds.js
- `GET  /api/worlds/marketplace` — paginated listings; filters: worldId, maxPrice
- `POST /api/worlds/marketplace/list` — body: `{ dtuId, priceCC, description }`
- `POST /api/worlds/marketplace/purchase` — body: `{ listingId }`

## DB
`skill_listings` created in migration 042 (Phase 12).

## Purchase flow
1. Validate listing active + buyer != seller
2. Debit buyer CC (best-effort), credit seller 80%
3. Call teachSkillToPlayer → new DTU with lineage → royalty cascade fires
4. Mark listing as sold
