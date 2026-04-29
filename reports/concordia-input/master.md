# Concordia Input Mode System — Master Report

**Branch:** `claude/review-game-progress-RRbSa`  
**Status:** All 12 phases complete. 48/48 tests pass.

---

## What Shipped

### Core Infrastructure
| File | Purpose |
|------|---------|
| `lib/concordia/modes.ts` | 8 INPUT_MODES const + InputMode type |
| `lib/concordia/mode-manager.ts` | Singleton with push/pop stack, manual override (3s), subscribe |
| `lib/concordia/context-detection.ts` | GameContext, buildContext(), inferMode(), 10Hz maybeUpdateMode() |
| `lib/concordia/player-stats.ts` | Fallout SPECIAL + Sims needs/mood + perks |
| `lib/concordia/karma.ts` | Karma tiers, per-faction reputation, KARMA_ACTIONS table |
| `lib/concordia/input-mapping.ts` | CACS: per-mode/per-controller profiles, gyro support, community export/import |
| `hooks/useKeyboardInput.ts` | e.code-based, held-key support, input-element safe |
| `hooks/useMouseInput.ts` | movementX/Y delta, wheel, click |
| `hooks/useIsTouchDevice.ts` | matchMedia pointer:coarse |

### Mode Components
| Phase | Files |
|-------|-------|
| Exploration | `components/concordia/controls/ExplorationControls.tsx` |
| Combat | `lib/concordia/combat/hotbar.ts`, `combat/vats.ts`, `hooks/useCombatState.ts`, `components/concordia/hud/CombatHUD.tsx` |
| Driving | `hooks/useVehicleState.ts`, `components/concordia/hud/VehicleHUD.tsx` |
| Conversation | `hooks/useDialogue.ts`, `components/concordia/dialogue/DialoguePanel.tsx` |
| Creation | `components/concordia/creation/CreationWorkshop.tsx` |
| Lens Work | `components/concordia/lens/LensWorkspaceInWorld.tsx` |
| Social | `components/concordia/social/EmoteWheel.tsx`, `QuickMessageBar.tsx`, `ProximityVoiceChat.ts` |
| Spectator | `components/concordia/spectator/SpectatorControls.tsx` |
| Mobile | `components/concordia/mobile/MobileControlsOverlay.tsx`, `VirtualJoystick.tsx`, `SteeringWheel.tsx` |
| Onboarding | `lib/concordia/onboarding/tutorial.ts`, `components/concordia/onboarding/TutorialHint.tsx` |

### Modified Existing Files
- `components/world-lens/AvatarSystem3D.tsx` — wired `maybeUpdateMode()` into update loop

### Test Files
- `tests/concordia/mode-system.test.ts` — 13 tests (all pass)
- `tests/concordia/combat.test.ts` — 12 tests (all pass)
- `tests/concordia/player-stats.test.ts` — 14 tests (all pass)
- `tests/concordia/onboarding.test.ts` — 9 tests (all pass)

**Total: 48 tests, 48 passing**

---

## Game Mechanics Incorporated

### Fallout DNA
- **SPECIAL stats**: Strength, Perception, Endurance, Charisma, Intelligence, Agility, Luck — derive maxHealth, maxStamina, carryWeight, dodge%, critChance%, XP multiplier, speech chance, VATS AP pool
- **VATS**: Slow-motion body-part targeting UI, hit% per part (Perception-scaled), AP cost queue, body-part crippling effects
- **Karma**: −1000 to 1000 global score, saint/good/neutral/evil/demon tiers, per-faction reputation
- **Dialogue skill checks**: SPECIAL-gated options in dialogue panel (Charisma 7 to unlock speech option)
- **Perks**: Defined type system — unlock at level thresholds with PerkEffect modifiers
- **Survival needs**: Hunger, rest, social, fun, hygiene, comfort, safety — decay scales with Endurance

### Sims DNA
- **Needs system**: 7 needs with decay rates, visual display hooks
- **Mood/emotion**: deriveMood() derives primary emotion from needs + moodlets; 10 emotions including inspired, confident, tired
- **Mood modifiers**: XP bonus when inspired, social bonus when flirty, combat penalty when tired
- **Relationship building**: NPCRelationship with opinion (−100..100), familiarity, standing — shifts on every exchange
- **Moodlets**: Time-limited mood boosts that expire naturally

### Elden Ring / Hades 2 DNA
- **Stamina-managed combat**: Dodge = 15 stamina, block suppresses regen; no stamina = no defensive options
- **Death loop**: DeathRecord captures skills used, damage dealt/taken, killedBy — surfaces lesson text on next attempt
- **Hotbar from DTU-derived skills**: skills earned through training, validated by subconscious brain

### Shadow of Mordor DNA
- **NPC memory**: memories[], opinion, familiarity passed to conscious brain on conversation open
- **Emergent NPC tone**: NPCs respond to prior history ("you helped me last week" / "you betrayed my faction")

### Zelda (BotW) DNA
- **Single interact key**: E does the right thing based on what player is looking at — dispatches to NPC dialogue, vehicle entry, creation terminal, lens portal

### Minecraft DNA
- **Satisfying validation feedback**: Score ring + 4 category meters + suggestions — not just pass/fail, shows incremental progress

### CACS (Concord Adaptive Control System)
- Per-mode bindings for keyboard + Xbox/PS5/Switch gamepads
- Elden Ring combat layout: RB=light attack, RT=heavy, B=dodge, LB=block
- Hades 2 exploration: clean low-fatigue face button layout
- Gyro support defined (pitch/roll/yaw per action)
- Community profile export/import (JSON)
- localStorage custom binding persistence

### Death Stranding / STALKER World Reactivity
- Specced as: player actions leave karma traces, NPC memory propagates through gossip network on heartbeat tick — karma.ts + NPC memory system provide the substrate

### Helldivers 2 / MMO Social
- Emote wheel (hold Z, radial UI, hover to select, release to fire)
- Quick message bar (always-available presets)
- Proximity voice chat: typed stub + socket signaling skeleton; WebRTC deferred (STOP CONDITION)

### Progressive Onboarding
- 10 steps, max 3 controls shown per hint
- Advances on player actions — no forced interruptions
- Skip persists to localStorage; always-visible ? Help button with tutorial replay

---

## STOP CONDITIONS Status

| Condition | Status |
|-----------|--------|
| Mobile 30 FPS | Adaptive quality system implemented (`adaptQualityToDevice`); hardware tier detection via `hardwareConcurrency` + `deviceMemory` |
| NPC AI 2 Hz | Throttle implemented in combat tick; POST /api/chat latency not yet measured under load |
| Combat skill DTU quality | Subconscious brain validates before creating DTU; quality gate is at inference level |
| WebRTC proximity voice | **DEFERRED** — ProximityVoiceChat is a typed stub with interface; full implementation needs separate scoping |

---

## What Remains Before Merge
1. Wire all overlay components into `app/lenses/world/page.tsx` (mode-aware rendering)
2. Extend `HUDOverlay.tsx` HUDMode type to include driving/spectator/lens_work modes
3. WebRTC proximity voice (separate scoping conversation)
4. Playtest scenarios (spec §12.2) — requires running world with players

---

## Files Changed Summary
- **New files**: 34
- **Modified files**: 1 (AvatarSystem3D.tsx)
- **Test files**: 4 (48 tests, all passing)
- **Report files**: 12 (one per phase + this master)
