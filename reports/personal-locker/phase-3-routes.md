# Phase 3 — Upload Pipeline + Routes

## Delivered

- `server/lib/personal-locker/pipeline.js` — `analyzeContent()` routes by MIME to LLaVA (image), whisper.cpp (audio), text/pdf extraction + LLaVA (document), ffmpeg keyframe extraction + LLaVA (video).
- `server/routes/personal-locker.js` — full CRUD:
  - `POST /api/personal-locker/upload` — analyze → encrypt → store
  - `GET /api/personal-locker/dtus` — list metadata (no ciphertext)
  - `GET /api/personal-locker/dtus/:id` — assertSovereignty → decrypt → return
  - `DELETE /api/personal-locker/dtus/:id` — hard delete
  - `PUT /api/personal-locker/dtus/:id/publish` — decrypt → createDTU (public substrate)
- `server/package.json` — `fluent-ffmpeg` + `ffmpeg-static` for video frame extraction.
- `personal_dtus_never_leak` sovereignty invariant enforced on every read.
- Returns `{error:"locker_locked"}` when session locker key absent.
