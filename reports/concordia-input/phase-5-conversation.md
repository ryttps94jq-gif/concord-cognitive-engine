# Phase 5: Conversation Mode

## Files Created
- `hooks/useDialogue.ts` — DialogueState, NPCRelationship, SkillCheckOption, startDialogue(), send(), endDialogue()
- `components/concordia/dialogue/DialoguePanel.tsx` — full dialogue UI with NPC info, message history, skill check buttons, quick options, text + voice input

## Mechanics

### NPC Memory (Shadow of Mordor inspiration)
Each NPC carries `memories[]` and `opinion` in its relationship record. On conversation open, these are passed as context to the conscious brain so the NPC responds to prior history. "You helped me last week" or "You attacked my friend" — NPCs remember.

### Sims-style Relationship Building
- Relationship score: −100 to 100, displayed as a bar with standing label (hostile → ally)
- Familiarity: 0–100, increases +2 per exchange
- Opinion changes per exchange: +10 for passed skill check, +3 for normal positive exchange, −5 for failed check
- Standing determines NPC dialogue tone and available quest hooks

### Fallout Skill Checks
- Dialogue options gated by SPECIAL stats (e.g., "[CHARISMA 7] Convince them to stand down")
- Stat requirement shown; locked options dim and show required vs. current
- Passed check = favorable NPC response + opinion bonus; failed = neutral or negative response
- LLM generates skill check options as part of NPC response JSON block

### Voice Input
- MediaRecorder → audio/webm blob → POST /api/personal-locker/upload
- Whisper pipeline returns extractedText → pre-fills textarea
- Record button toggles; stop → auto-submit transcript

### Conversation Persistence
Shadow crystallization fires automatically server-side in /api/chat when exchange passes importance threshold. Important conversations become personal DTUs without any explicit frontend call.

### API Routing
- NPC dialogue: POST /api/chat with brainOverride: 'conscious' and lensContext.npc
- Conscious brain chosen because this is user-facing chat that needs depth and persona consistency

## Status: Complete
