# Phase 23 — Substrate Diffusion Tracking

## Summary
Hybrid skills leave diffusion trails as they spread across worlds. A Cipher-tier
emergent scans these trails daily and writes cross-world substrate patterns.

## Files Created
- `server/migrations/044_substrate_diffusion.js` — skill_diffusion, creation_diffusion, substrate_patterns
- `server/lib/substrate-diffusion.js` — recordDiffusionEvent(), diffuseHybrid(), detectSubstratePatterns(), getPatterns(), startPatternDetection()
- `concord-frontend/components/concordia/genesis/PatternFeed.tsx` — pattern cards with type, worlds, strength bar, trajectory badge

## Files Modified
- `server/server.js` — import startPatternDetection, call it after seedWorlds + NPC simulator startup
- `server/lib/skill-interaction.js` — createHybridCandidate() calls diffuseHybrid() after creation

## Routes
`GET /api/worlds/substrate/patterns` — already in worlds.js (Phase 12); returns from substrate_patterns table.

## Pattern detection cycle
- Runs immediately at server start, then every 24 hours via setInterval
- Queries last 30 days of hybrid DTUs + their diffusion states
- Subconscious brain (`callerId: 'concordia:pattern-detection'`) classifies into: skill_family | creation_style | cultural_practice
- Inserts/upserts into substrate_patterns with trajectory (growing/stable/declining) and strength (0–1)
