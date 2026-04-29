# Phase 9: Spectator Mode
Files: `components/concordia/spectator/SpectatorControls.tsx`

Free camera: WASD move, Space up, Shift down, mouse delta rotate, wheel zoom.
Follow player: dropdown of nearby players; F toggles between free and first-available player.
Time scrub: T opens range slider (0..timeRange seconds back); calls onTimeScrub() to rewind world snapshot.
Esc → modeManager.pop().
Status: Complete
