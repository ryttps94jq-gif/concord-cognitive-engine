# Phase 14 — Cross-World Transit

## Summary
Players can travel between the 6 canonical worlds. Population counters and visit
logs update atomically. Socket.io emits `world:player-arrived` on arrival.

## Files Created
- `server/lib/transit.js` — travelToWorld(), applyWorldRulesToPlayer()
- `concord-frontend/components/concordia/transit/TransitHub.tsx` — world grid with population badges, confirm modal, POST /api/worlds/travel

## Routes (in worlds.js)
- `POST /api/worlds/travel` — body: `{ worldId }` — closes open visit on previous world, opens new visit, updates population, updates player_world_state.world_id
- `GET  /api/worlds/current` — returns active world for authenticated player

## Socket events
- `world:player-arrived` emitted to `world:<id>` room on successful travel
