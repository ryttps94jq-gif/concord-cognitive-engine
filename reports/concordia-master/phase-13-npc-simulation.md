# Phase 13 — NPC Simulation

## Summary
Per-world NPC agents that tick on population-scaled intervals, driven by need
urgency and subconscious brain decisions.

## Files Created
- `server/lib/population-scaling.js` — POPULATION_TIERS, getTierFor(), adjustSimulationDensity()
- `server/lib/npc-behaviors.js` — buildStructure(), practiceSkill(), findMastersInWorld(), npcEvaluateNearbyCreation(), npcObserveSkillUse()
- `server/lib/npc-simulator.js` — NPCAgent, NPCSimulator, `simulators` Map

## Files Modified
- `server/server.js` — import NPCSimulator + selectBrain, iterate seeded worlds, initialize and start one simulator each

## NPC Lifecycle
1. NPCSimulator.initialize() loads all world_npcs rows → NPCAgent instances
2. Each tick: updateNeeds → chooseAction (subconscious brain or urgent-need shortcut) → executeAction → maybeEvaluateCreations → persistState
3. Tick interval scales with population tier: 300s (empty) → 5s (dense)

## Population Tiers
| Tier     | Players  | Tick Rate | NPC Density |
|----------|----------|-----------|-------------|
| empty    | 0        | 5 min     | 10%         |
| sparse   | 1–10     | 1 min     | 30%         |
| active   | 11–50    | 30 s      | 60%         |
| bustling | 51–200   | 10 s      | 90%         |
| dense    | 201+     | 5 s       | 100%        |
