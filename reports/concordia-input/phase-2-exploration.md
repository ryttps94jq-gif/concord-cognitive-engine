# Phase 2: Exploration Mode

## Files Created
- `concord-frontend/components/concordia/controls/ExplorationControls.tsx`

## What It Does
- WASD movement, Space jump, Shift sprint (held-key onDown/onUp), Ctrl crouch, E interact, Escape menu
- Mouse delta → camera.rotate(), wheel → camera.zoom()
- Single E key dispatches to the right mode via modeManager.switchTo({ push: true }) + callback:
  - NPC → conversation mode + onStartDialogue
  - Vehicle → driving mode + onEnterVehicle
  - Creation terminal → creation mode + onOpenCreation
  - Lens portal → lens_work mode + onOpenLens
  - Item → player.pickUp
  - Door/switch → server-side activate (fire-and-forget)
- Input silenced when focus is in INPUT/TEXTAREA/SELECT

## Zelda-style Contextual Interaction (BotW inspiration)
One button (E) does the correct thing based on what the player is looking at. No mode-specific menus to open first. The interact dispatcher is the entry point into every other mode.

## Status: Complete
