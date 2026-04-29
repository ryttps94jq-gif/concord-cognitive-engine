# Phase 1: Mode System Core

## Files Created
- `concord-frontend/lib/concordia/modes.ts` — INPUT_MODES const, InputMode type, MODE_TO_HUD bridge
- `concord-frontend/lib/concordia/mode-manager.ts` — ModeManager singleton with subscribe/push/pop/manual-override
- `concord-frontend/lib/concordia/context-detection.ts` — GameContext, buildContext(), inferMode(), maybeUpdateMode() at 10 Hz
- `concord-frontend/lib/concordia/player-stats.ts` — Fallout SPECIAL stats, Sims needs system, mood/emotion, perks
- `concord-frontend/lib/concordia/karma.ts` — Karma tiers, faction reputation, KARMA_ACTIONS table
- `concord-frontend/hooks/useKeyboardInput.ts` — KeyMap hook, e.code-based, held-key support, input-element safe
- `concord-frontend/hooks/useMouseInput.ts` — movementX/Y delta, wheel, click with pointer-lock support
- `concord-frontend/hooks/useIsTouchDevice.ts` — matchMedia pointer:coarse detection

## Files Modified
- `concord-frontend/components/world-lens/AvatarSystem3D.tsx` — wired maybeUpdateMode() into the existing userData.update loop; imports buildContext/NearbyEntity/ZoneType

## Modes Defined
exploration, combat, driving, conversation, creation, lens_work, social, spectator

## New Systems (Fallout + Sims)
- **SPECIAL stats**: Strength, Perception, Endurance, Charisma, Intelligence, Agility, Luck with derived values (maxHealth, dodge%, critChance%, VATS AP pool, carry weight)
- **Sims Needs**: hunger, rest, social, fun, hygiene, comfort, safety — decay rates scale with Endurance
- **Mood system**: derives primary emotion from needs + active moodlets; mood modifiers affect XP, social, combat, crafting
- **Karma**: global -1000..1000 with saint/good/neutral/evil/demon tiers; per-faction reputation with hero..enemy standing
- **Manual override**: player switching mode suppresses auto-switch for 3 seconds

## Status: Complete
