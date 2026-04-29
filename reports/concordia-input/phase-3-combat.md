# Phase 3: Combat Mode

## Files Created
- `lib/concordia/combat/hotbar.ts` — CombatSkill, HotbarState, loadHotbarFromSubstrate(), createCombatSkill()
- `lib/concordia/combat/vats.ts` — VATS state machine, body-part targeting, hit-chance computation, AP regen
- `hooks/useCombatState.ts` — health/stamina/AP/hotbar/log/death records hook
- `components/concordia/hud/CombatHUD.tsx` — HP/Stamina/AP bars, hotbar slots with cooldown overlay, target indicator, VATS overlay, combat log

## Mechanics

### Hotbar (DTU-derived skills)
Skills are DTUs in personal locker with `meta.type === 'combat_skill'`. Load via `GET /api/personal-locker/dtus?lens=game`. Training flow: text/voice spec → `POST /api/chat` with subconscious brain → validates technique against physics/martial arts principles → `POST /api/dtus` with computed stats in metadata.

### VATS (Fallout-inspired)
- Entering VATS pauses action, shows body-part targeting UI with hit% and AP cost
- Hit chance = base accuracy − distance penalty + Perception bonus + Luck modifier
- Queued shots execute on exit, each consuming AP
- AP pool = 50 + Agility × 5; regens at 20/second outside VATS
- Body part crippling effects: head → blinded, torso → winded, legs → slowed, arms → weakened

### Stamina-managed combat (Elden Ring / UFC inspiration)
- Light attack: hotbar slot 1–9 (keyboard or click)
- Dodge (Q): costs 15 stamina; blocked if empty
- Block (Shift hold): reduces stamina regen to 2/s while held
- Stamina regens at 10/s normally; exhaustion = no dodge/block

### Death loop (Elden Ring / Hades 2 inspiration)
- On death: records killedBy, skills used, damage dealt/taken
- Respawns at full health (server determines spawn point)
- DeathRecord stored; next NPC encounter can reference it for combat tip via `POST /api/chat`
- Last 10 deaths kept; used in onboarding to surface "you died to X 3 times, consider skill Y"

### NPC Combat AI
- `POST /api/chat` with `brainOverride: 'subconscious'` throttled to 2 Hz per NPC
- Decision response parsed for action (attack/dodge/retreat/special)
- Subconscious brain for tactical decisions keeps conscious brain free for player dialogue

## Keybinds
Desktop: LClick=primary, RClick=secondary, Q=dodge, Shift=block, 1-9=hotbar, Tab=target lock, V=VATS, F=finisher
Mobile: large attack button, dodge button, hotbar bar, two-finger tap=target lock

## Status: Complete
