# Phase 18 — Population-Driven Richness

## Summary
World simulation density (NPC tick rate, NPC count target) scales automatically
with real player population. Metrics are exposed via a dedicated endpoint.

## Implementation
All core logic was built in Phase 13 (`population-scaling.js`, `NPCSimulator.updatePopulation()`).

## Endpoint
`GET /api/worlds/:id/metrics` — added in Phase 12 worlds route; returns:
- population, npcCount, totalVisits, userCreations, completedQuests, skillDtusCreated

## Live scaling
`NPCSimulator.updatePopulation(count)` recalculates tick rate via
`adjustSimulationDensity()` and restarts the interval if it changed.

Callers should invoke it whenever the world population changes (e.g. after
a successful `POST /api/worlds/travel`).

## Population tiers (recap)
empty → sparse → active → bustling → dense
300s  → 60s   → 30s    → 10s      → 5s tick rates
