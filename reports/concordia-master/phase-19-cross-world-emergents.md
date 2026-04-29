# Phase 19 — Cross-World Emergent Specialization

## Summary
World-native emergent entities are seeded with identities derived from the
world's substrate. Emergents that operate across 3+ worlds reach Cipher tier.

## Files Created
- `server/lib/world-emergents.js` — spawnWorldNativeEmergent(), getCrossWorldEmergents(), getWorldEmergents(), growAffinity()

## DB
`world_emergent_affinity` (emergent_id, world_id, affinity_level, specialization_tags, active_since) — created in migration 042.

## Cipher-tier detection
`getCrossWorldEmergents()` queries world_emergent_affinity for emergents
with HAVING COUNT(DISTINCT world_id) >= 3 — these are the cross-world
observers capable of detecting substrate patterns (Phase 23).

## Integration notes
- `spawnWorldNativeEmergent` is callable at server startup or on demand
- `growAffinity()` should be called whenever an emergent acts in a world
