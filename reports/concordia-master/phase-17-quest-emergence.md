# Phase 17 — Quest Emergence from NPC Goals

## Summary
NPCs with urgent needs that can only be met by players automatically generate
quests via the subconscious brain, surfacing them on the world quest board.

## Files Created
- `server/lib/quest-emergence.js` — detectQuestOpportunities(), createQuestFromNeed(), getWorldQuests(), updateQuestProgress()

## Files Modified
- `server/lib/npc-simulator.js` — NPCAgent._maybeGenerateQuests() (5% chance per tick); called from NPCSimulator.tick()

## DB
`world_quests` table created in migration 042 (Phase 12).

## Routes (in worlds.js, Phase 12)
- `GET  /api/worlds/:worldId/quests?status=` — uses getWorldQuests()
- `POST /api/worlds/:worldId/quests/:id/accept`
- `POST /api/worlds/:worldId/quests/:id/event` — calls updateQuestProgress()

## Quest generation
If `npc.needs.purpose < 0.5` or `npc.needs.social < 0.5`, the subconscious
brain drafts title/description/objectives/reward. Falls back to a minimal
template if the brain is unavailable.
