# Phase 10: Mobile Controls
Files: `components/concordia/mobile/VirtualJoystick.tsx`, `SteeringWheel.tsx`, `MobileControlsOverlay.tsx`

VirtualJoystick: dual-touch-identifier tracking, radius clamping, spring-back on release, renders left or right side.
SteeringWheel: rotates ±90° via touch drag, springs back to center on release, emits -1..1.
MobileControlsOverlay: gated behind useIsTouchDevice() — renders nothing on desktop. Mode-conditional layout:
- exploration: dual joystick + jump + interact
- combat: dual joystick + attack (large) + dodge + block (hold) + compact hotbar
- driving: vertical throttle/brake sliders + steering wheel + exit button
- conversation/creation/lens_work: own UI handles touch, returns null

adaptQualityToDevice(): exported utility reads hardwareConcurrency + deviceMemory → tier (high/medium/low) → sets LOD, NPC density, shadow quality.

Status: Complete
