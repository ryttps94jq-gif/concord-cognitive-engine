# Phase 0 — Codebase Integration Audit
**Date:** 2026-04-29  
**Branch:** claude/competitive-parity-master-spec-XAYJ9

## Summary

This audit identifies systems that exist in the codebase but are not properly wired end-to-end.

---

## 1. Unwired Emergent Modules

28 emergent modules in `server/emergent/` have no import or reference in `server/server.js`:

| Module | File | Gap |
|--------|------|-----|
| action-slots | action-slots.js | Not imported or ticked |
| autogen-pipeline | autogen-pipeline.js | Not imported or ticked |
| capability-bridge | capability-bridge.js | Not imported or ticked |
| cnet-federation | cnet-federation.js | Not imported or ticked |
| cognitive-fingerprint | cognitive-fingerprint.js | Not imported or ticked |
| cross-lens-pipeline | cross-lens-pipeline.js | Not imported or ticked |
| developer-sdk | developer-sdk.js | Not imported or ticked |
| dream-cycle | dream-cycle.js | Not imported or ticked |
| emergent-comms | emergent-comms.js | Not imported or ticked |
| empirical-gates | empirical-gates.js | Not imported or ticked |
| entity-emergence | entity-emergence.js | Not imported or ticked |
| event-scoping | event-scoping.js | Not imported or ticked |
| federation-peering | federation-peering.js | Not imported or ticked |
| ghost-threads | ghost-threads.js | Not imported or ticked |
| idle-behavior | idle-behavior.js | Not imported or ticked |
| lattice-interface | lattice-interface.js | Not imported or ticked |
| lattice-ops | lattice-ops.js | Not imported or ticked |
| microbond-governance | microbond-governance.js | Not imported or ticked |
| module-registry | module-registry.js | Not imported or ticked |
| name-validation | name-validation.js | Not imported or ticked |
| scenario-engine | scenario-engine.js | Not imported or ticked |
| schema-guard | schema-guard.js | Not imported or ticked |
| sectors | sectors.js | Not imported or ticked |
| spam-prevention | spam-prevention.js | Not imported or ticked |
| state-migration | state-migration.js | Not imported or ticked |
| user-constitution | user-constitution.js | Not imported or ticked |
| user-feedback | user-feedback.js | Not imported or ticked |
| verification-pipeline | verification-pipeline.js | Not imported or ticked |

**Fix:** Wire into heartbeat (governorTick) per WIRING_SPEC.md pattern — wrapped in try/catch.

---

## 2. Route Files Not Imported in server.js

| File | Gap |
|------|-----|
| server/routes/api-docs.js | Not imported |
| server/routes/api-keys.js | Not imported |

**Fix:** Add `import` + `app.use()` in server.js.

---

## 3. Competitive Parity Gaps (New Modules Required)

The following surface capabilities are absent from the codebase and are implemented by this spec:

| Gap | Status | Phase |
|-----|--------|-------|
| OpenTelemetry export | Missing | Phase 1 |
| Anthropic Skills format compatibility | Missing | Phase 2 |
| External messaging adapters (WhatsApp/Telegram/Discord/Signal/iMessage/Slack) | Missing | Phases 3–8 |
| Voice agent real-time pipeline (WebRTC + VAD + barge-in) | Partial (STT/TTS exist in server.js) | Phase 9 |
| Computer Use brokered tool | Missing | Phase 10 |
| Sandbox agent workspaces | Missing | Phase 11 |
| Thread-based agent resumption | Missing | Phase 12 |
| Agent debugging UI with transcript + signals | Missing | Phase 13 |
| SQL over traces | Missing | Phase 14 |
| Cost attribution per trace | Missing | Phase 15 |

---

## 4. Voice Pipeline Gap

`/api/voice/transcribe` and `/api/voice/tts` macros **exist** in server.js (lines 8782–8882) with whisper.cpp + Piper local stacks. However:
- No **real-time** WebRTC pipeline for voice conversation
- No **VAD** (voice activity detection) on server side
- No **barge-in** interrupt handling
- No **voice session** state management
- Frontend `VoiceRecorder` component calls these APIs but there is no `VoiceChat` component with full duplex conversation

**Fix:** Phase 9 adds `server/lib/voice/voice-pipeline.js` and WebRTC signaling.

---

## 5. OTel Infrastructure Gap

`server/lib/inference/tracer.js` has an `addListener(fn)` API suitable for OTel hooking, but:
- No `@opentelemetry/*` packages installed
- No OTLP exporter configured
- Traces are in-memory circular buffer only (2000 spans max)

**Fix:** Phase 1 adds `server/lib/inference/otel-exporter.js` hooked via `addListener`.  
**Note:** OTel packages will be installed via npm if `CONCORD_OTEL_ENABLED=true`. Default disabled — no performance impact.

---

## 6. Skills Format Gap

`server/lib/agentic/skills.js` loads `EMERGENT.md` files. Anthropic Agent Skills use `SKILL.md`. No adapter exists to translate between formats.

**Fix:** Phase 2 adds bidirectional adapter.

---

## Verification

All competitive parity gaps will be addressed in Phases 1–17. Unwired emergent modules and missing route imports are documented for a follow-up wiring pass (outside this spec's scope — see WIRING_SPEC.md for pattern).
