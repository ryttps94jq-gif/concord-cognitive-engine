# Phase 12 — Multi-World Substrate

## Summary
Establishes the database schema and server-side infrastructure for the
multi-world architecture. Six canonical worlds are seeded on server start.

## Files Created
- `server/migrations/042_concordia_worlds.js` — tables: worlds, world_substrate_dtus, world_npcs, world_visits, world_quests, world_emergent_affinity, skill_listings; extends player_world_state with world_id
- `server/lib/world-loader.js` — loadWorld(), listWorlds(), getActiveWorldForPlayer(), applyPhysicsModulators(), applyRuleModulators()
- `server/lib/world-seed.js` — seedWorlds() — idempotent INSERT OR IGNORE of 6 canonical worlds
- `server/routes/worlds.js` — GET /api/worlds, GET /api/worlds/:id, GET /api/worlds/current, POST /api/worlds, PATCH /api/worlds/:id/health, POST /api/worlds/travel, GET /api/worlds/:worldId/quests, POST /api/worlds/:worldId/quests/:id/accept, POST /api/worlds/:worldId/quests/:id/event, GET /api/worlds/substrate/patterns

## Files Modified
- `server/server.js` — import createWorldsRouter, import seedWorlds, register /api/worlds, call seedWorlds(db) on startup

## Six Canonical Worlds
| ID | Type | Key Modulator |
|----|------|---------------|
| concordia-hub | standard | no combat, neutral skill effectiveness |
| fable-world | fantasy | magic ×1.5, technology ×0.0 |
| superhero-world | superpowered | power ×2.0, power threshold 10 |
| wasteland-world | post_apocalyptic | survival ×1.5, magic ×0.0 |
| crime-city | urban_crime | hacking ×1.3, stealth ×1.2 |
| war-zone | military | combat ×1.5, tactics ×1.4, magic ×0.0 |

## Design Notes
- `rule_modulators.skill_resistance` carries per-skill-type `{threshold, scaling}` used by the Phase 15 continuous effectiveness curve
- `world_quests` is included here so Phase 17 quest emergence has its table from the start
- `skill_listings` included here so Phase 20 skill commerce has its table
- `world_emergent_affinity` included for Phase 19 cross-world emergent specialization
