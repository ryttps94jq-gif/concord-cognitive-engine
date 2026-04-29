# Phase 7: Lens Work Mode
Files: `components/concordia/lens/LensWorkspaceInWorld.tsx`
Floating panel (designed for @react-three/drei Html in canvas, also renders as fixed overlay).
Chat → POST /api/chat with brainOverride: 'conscious' + lensContext.
DTU browser sidebar loads personal locker DTUs for the active lens.
@dtuId citations can be injected into input by clicking DTU chips.
Close → modeManager.pop() returns to prior mode.
Status: Complete
