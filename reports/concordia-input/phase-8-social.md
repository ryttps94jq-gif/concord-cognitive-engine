# Phase 8: Social Mode
Files: `components/concordia/social/EmoteWheel.tsx`, `QuickMessageBar.tsx`, `ProximityVoiceChat.ts`

EmoteWheel: hold Z → radial wheel opens; hover to select; release to fire emote + broadcast via socket. 8 emotes.
QuickMessageBar: always-available preset messages (Hello, Need help, Watch out, etc.) rendered as pill buttons.
ProximityVoiceChat: typed stub with interface + socket signaling skeleton. WebRTC peer connections deferred (STOP CONDITION). Volume computed by distance / maxRange.

Status: Complete (WebRTC pending separate scoping)
