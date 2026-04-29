# Phase 22 — Skill Evolution and Mixing

## Summary
When an actor uses 2+ skills simultaneously in the same context, the system
checks whether a novel hybrid skill can be created. Hybrids carry lineage
pointing at both parents, triggering the royalty cascade automatically.

## Files Created
- `server/lib/skill-interaction.js` — detectSkillInteraction(), hasCombined(), evaluateHybridPotential(), createHybridCandidate(), npcObserveSkillUse()

## NPC observation
`npcObserveSkillUse` delegates to `npc-behaviors.js` — already wired into the
NPC simulator for nearby skill use events.

## Hybrid creation flow
1. `detectSkillInteraction(actor, skills, context)` — checks 2+ skills + not already combined
2. `evaluateHybridPotential` — subconscious brain returns `{ viable, noveltyScore, rationale }`
3. If viable → `createHybridCandidate` — generates spec via brain, creates DTU with lineage, awards `hybrid_contribution` XP to parents
4. Calls `diffuseHybrid(hybrid, worldId)` into substrate diffusion (Phase 23)

## Anti-repetition
`hasCombined()` queries dtus WHERE `json_extract(content, '$.hybridKey') = combinationKey` — same actor cannot create the same hybrid twice.
