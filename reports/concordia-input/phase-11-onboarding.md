# Phase 11: Onboarding
Files: `lib/concordia/onboarding/tutorial.ts`, `components/concordia/onboarding/TutorialHint.tsx`

TutorialManager: localStorage-persisted state machine. 10 steps from movement-basic → done.
Each step advances on a specific player action (moved-significant-distance, rotated-camera, sprinted, etc.).
tutorialManager.advance(action) is called by the game loop when the action fires.
Max 3 controls shown per hint (progressive disclosure).
Skip option: stores skipped=true in localStorage; skipped players never see tutorial again.
HelpMenu: renders all TUTORIAL_TOPICS as replay buttons + skip option.
Always-visible ? Help button bottom-left.
TutorialOverlay: mounts the hint toast (auto-dismisses after hint.duration ms) + help button.

## Progressive disclosure (modern game onboarding best practice)
Step 1-3: Only movement + camera + sprint. Nothing else.
Step 4-5: First NPC encounter. Only E and Enter shown.
Step 6: Creation terminal. Only E shown.
Step 7-8: Combat only after player encounters first enemy (organic, not forced).
Step 9-10: Lens portal + social — only after player has explored for ~10 minutes.
Complexity reveals as player demonstrates readiness.

Status: Complete
