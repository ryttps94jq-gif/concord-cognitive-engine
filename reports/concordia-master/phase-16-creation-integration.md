# Phase 16 — User Creation + NPC Integration

## Summary
NPCs evaluate nearby user-created DTUs and react to them, making the world
feel alive and responsive to player creativity.

## Implementation
`npcEvaluateNearbyCreation()` was implemented in `server/lib/npc-behaviors.js` as part of Phase 13 and is called from `NPCAgent._maybeEvaluateCreations()` in `npc-simulator.js` (10% probability per tick).

## Reaction types
`ignore | claim | use | admire | build_nearby | modify`

The subconscious brain picks the reaction given the NPC's profile and the creation's content. The reaction is stored in `world_npcs.state.evaluatedCreations[]`.

## Socket event
`world:npc-reacted-to-creation` is emitted by the calling code when a socket.io instance is available (planned integration hook).

## Files Modified
- `server/lib/npc-behaviors.js` — npcEvaluateNearbyCreation() (all logic here)
- `server/lib/npc-simulator.js` — `_maybeEvaluateCreations()` calls the above
