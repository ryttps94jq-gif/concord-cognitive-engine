# CONCORD COMPETITIVE PARITY MASTER SPEC v1.0 — Implementation Report

**Branch:** `claude/competitive-parity-master-spec-XAYJ9`
**Date:** 2026-04-29
**Status:** COMPLETE — 26/26 integration tests passing

---

## Executive Summary

This report covers the full implementation of the Concord Competitive Parity Master Spec v1.0, closing capability gaps versus LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK, OpenClaw, LangSmith, and Laminar. All 17 phases have been implemented and wired end-to-end into the production codebase.

---

## Phase-by-Phase Status

### Phase 0 — Codebase Integration Audit
**Status:** COMPLETE  
**File:** `reports/competitive-parity/phase-0-audit.md`

Identified 28 unwired emergent modules, 2 unimported route files, the `skillRegistry.scan()` bug, and all competitive parity gaps against the competitor matrix.

---

### Phase 1 — OpenTelemetry Exporter
**Status:** COMPLETE  
**File:** `server/lib/inference/otel-exporter.js`

- Hooks into tracer via `addListener(fn)` from `server/lib/inference/tracer.js`
- Accumulates spans per inferenceId in `_inflight` Map
- Exports OTLP JSON to `CONCORD_OTEL_ENDPOINT` on `finish`/`failure` span
- Uses GenAI semantic conventions (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.*`) plus `concord.*` extensions
- Disabled by default; enabled via `CONCORD_OTEL_ENABLED=true`
- No OTel SDK packages required — uses native `fetch` to POST OTLP JSON

**Comparable to:** LangSmith tracing, Laminar span export

---

### Phase 2 — Anthropic Skills Compatibility
**Status:** COMPLETE  
**File:** `server/lib/skills/anthropic-skills-adapter.js`

- `importAnthropicSkill(skillMdPath)` — SKILL.md → EMERGENT.md format conversion
- `exportToAnthropicFormat(emergentMdPath)` — reverse direction
- `importAnthropicSkillTree(rootDir)` — recursive bulk import
- Fixed `skillRegistry.scan()` bug in `server/lib/agentic/skills.js` (was silently failing at startup)

**Comparable to:** Claude Agent SDK skill format

---

### Phase 3 — WhatsApp Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/whatsapp.js`

Meta Graph API v19+; X-Hub-Signature-256 HMAC verification; `handleVerificationChallenge` for GET webhook.

---

### Phase 4 — Telegram Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/telegram.js`

Bot API; X-Telegram-Bot-Api-Secret-Token verification; `registerWebhook(url)` helper.

---

### Phase 4b — Discord Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/discord.js`

Ed25519 signature verification via `crypto.verify`; handles interaction type 2 and MESSAGE_CREATE gateway events.

---

### Phase 5 — Signal Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/signal.js`

signal-cli HTTP API bridge; `pollMessages()` for polling mode. Env: `SIGNAL_CLI_URL`, `SIGNAL_PHONE_NUMBER`.

---

### Phase 5b — iMessage Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/imessage.js`

BlueBubbles bridge; parses `new-message` webhook events; X-BlueBubbles-Password auth.

---

### Phase 5c — Slack Adapter
**Status:** COMPLETE  
**File:** `server/lib/messaging/adapters/slack.js`

Events API; HMAC-SHA256 with 5-minute replay attack window; URL verification challenge handling.

---

### Phase 6 — Permission Tiers
**Status:** COMPLETE  
**File:** `server/lib/messaging/permission-tiers.js`

Three tiers: `restricted` (read-only Set), `standard` (create, no transact), `elevated` (all tools, `canTransact: true`). Registers idempotent `before_tool` hook at priority 10.

---

### Phase 7 — Cross-Reality Bridge
**Status:** COMPLETE  
**File:** `server/lib/messaging/cross-reality-bridge.js`

5 world action regex patterns (build, move, use, interact, query); `parseWorldIntent(text)`; `routeToWorldOrChat`; `notifyUserOfWorldEvent`.

---

### Phase 8 — Messaging Routes + DB
**Status:** COMPLETE  
**Files:** `server/routes/messaging.js`, `server/migrations/056_messaging_adapters.js`

Tables: `messaging_bindings`, `messaging_messages`, `messaging_verification_codes`. All webhook endpoints + binding management routes. Three-gate compliance documented.

**Frontend:** `concord-frontend/components/messaging/MessagingChannelsPanel.tsx`

**Comparable to:** OpenAI Agents SDK multi-channel support

---

### Phase 9 — Voice Agent Pipeline
**Status:** COMPLETE  
**Files:** `server/lib/voice/voice-pipeline.js`, `server/routes/voice-agent.js`

- Session state machine: `idle → listening → processing → speaking → interrupted`
- VAD silence detection (1200ms client-side)
- Barge-in: AbortController kills in-flight inference + stops audio
- Conversation history circular buffer (20 items)
- Stale session pruning (30-min timeout)
- Audio accepted as raw octet-stream or base64 JSON (no multer dependency)

**Frontend:** `concord-frontend/components/voice/VoiceChat.tsx` — full VAD + barge-in UI

**Comparable to:** OpenAI Realtime API, ElevenLabs voice agents

---

### Phase 10 — Computer Use Tool
**Status:** COMPLETE  
**File:** `server/lib/tools/computer-use-tool.js`

- `COMPUTER_USE_TOOL_SCHEMA` with 7 actions: screenshot, click, type, scroll, navigate, key, wait
- Constitutional gate at priority 5: blocks when `computerUseEnabled` flag absent; blocks surveillance terms (keylog, stalk, monitor, spy, track, surveil)
- Playwright-backed implementation
- Auto-registers gate on module load

**Comparable to:** Anthropic Computer Use API

---

### Phase 11 — Sandbox Workspaces
**Status:** COMPLETE  
**Files:** `server/lib/tools/sandbox-manager.js`, `server/migrations/057_sandbox_workspaces.js`

Tables: `sandbox_workspaces`, `sandbox_actions`. Sandbox types: browser/desktop/code/general. Full CRUD + audit trail.

**Comparable to:** E2B sandboxes, Modal sandboxes

---

### Phase 12 — Thread-Based Agent Resumption
**Status:** COMPLETE  
**Files:** `server/lib/inference/thread-manager.js`, `server/migrations/058_agent_threads.js`

Tables: `agent_threads`, `agent_thread_checkpoints`, `inference_spans`. `wireSpanPersistence(db)` persists all OTel spans to SQLite for durable querying.

**Comparable to:** LangGraph state persistence, OpenAI thread continuity

---

### Phase 13 — Agent Debugging UI
**Status:** COMPLETE  
**File:** `concord-frontend/components/debug/InferenceTranscriptViewer.tsx`

- Collapsible trace cards with span drill-down
- Filter by inferenceId and min latency
- Auto-refresh every 10s
- Status indicators: brain used, latency, tokens, failure state

**Comparable to:** LangSmith trace viewer, Laminar debug UI

---

### Phase 14 — SQL Over Traces
**Status:** COMPLETE  
**File:** `server/routes/inference-debug.js` (`POST /api/inference/spans/query`)

- Accepts arbitrary SELECT queries against `inference_spans`
- Security: blocks non-SELECT; regex blocks user/session/DTU tables and destructive statements
- Pre-built `GET /api/inference/spans/stats` for common aggregations (by brain, recent failures)

**Comparable to:** LangSmith custom queries, Laminar SQL analytics

---

### Phase 15 — Cost Attribution
**Status:** COMPLETE  
**File:** `server/lib/inference/cost-model.js`

- `COST_RATES` for all 5 brain models (GPU overhead cost in USD/1k tokens)
- `computeInferenceCost(model, tokensIn, tokensOut)` — per-call cost
- `aggregateCosts(rows)` — grouped by model / lens / caller, top 20 each
- `GET /api/inference/costs?days=30&userId=...` route in inference-debug router

**Comparable to:** LangSmith cost tracking, OpenAI usage dashboard

---

### Phase 16 — Integration Tests
**Status:** COMPLETE  
**File:** `server/tests/integration/competitive-parity.test.js`

26 tests across all phases. **All 26 pass.**

Constitutional protection tests confirm:
- Computer use gate blocks surveillance terms
- Messaging permission tier filter registers correctly

---

### Phase 17 — Master Report
**Status:** COMPLETE (this document)

---

## Files Created

| File | Phase |
|------|-------|
| `reports/competitive-parity/phase-0-audit.md` | 0 |
| `server/lib/inference/otel-exporter.js` | 1 |
| `server/lib/skills/anthropic-skills-adapter.js` | 2 |
| `server/lib/messaging/adapter-interface.js` | 3 |
| `server/lib/messaging/adapters/whatsapp.js` | 3 |
| `server/lib/messaging/adapters/telegram.js` | 4 |
| `server/lib/messaging/adapters/discord.js` | 4 |
| `server/lib/messaging/adapters/signal.js` | 5 |
| `server/lib/messaging/adapters/imessage.js` | 5 |
| `server/lib/messaging/adapters/slack.js` | 5 |
| `server/lib/messaging/inbound-pipeline.js` | 6 |
| `server/lib/messaging/permission-tiers.js` | 6 |
| `server/lib/messaging/cross-reality-bridge.js` | 7 |
| `server/routes/messaging.js` | 8 |
| `server/migrations/056_messaging_adapters.js` | 8 |
| `server/lib/voice/voice-pipeline.js` | 9 |
| `server/routes/voice-agent.js` | 9 |
| `server/lib/tools/computer-use-tool.js` | 10 |
| `server/lib/tools/sandbox-manager.js` | 11 |
| `server/migrations/057_sandbox_workspaces.js` | 11 |
| `server/lib/inference/thread-manager.js` | 12 |
| `server/migrations/058_agent_threads.js` | 12 |
| `server/lib/inference/cost-model.js` | 15 |
| `server/routes/inference-debug.js` | 13-15 |
| `server/tests/integration/competitive-parity.test.js` | 16 |
| `concord-frontend/components/debug/InferenceTranscriptViewer.tsx` | 13 |
| `concord-frontend/components/messaging/MessagingChannelsPanel.tsx` | 8 |
| `concord-frontend/components/voice/VoiceChat.tsx` | 9 |

## Files Modified

| File | Change |
|------|--------|
| `server/lib/agentic/skills.js` | Added `scan()` alias for `initialize()` |
| `server/server.js` | Three-gate additions + 5 route mounts + OTel/span wiring |

---

## Constitutional Safeguards

All new capabilities respect Concord's sovereignty invariants:

1. **Computer Use**: Hard gate — `computerUseEnabled` flag required; surveillance terms blocked
2. **Messaging**: Permission tier hook in `before_tool` chain — restricted/standard/elevated
3. **SQL Traces**: SELECT-only on `inference_spans`; user/session/DTU tables blocked
4. **Voice**: All endpoints require authenticated session; barge-in scoped to session owner
5. **Sandbox**: All operations scoped to `user_id`; terminated sandboxes preserved for audit

---

## Competitor Gap Closure

| Capability | LangGraph | CrewAI | OpenAI SDK | Claude SDK | Concord (after) |
|-----------|-----------|--------|------------|------------|-----------------|
| OTel Tracing | ✓ | — | ✓ | ✓ | ✓ |
| Skill Import | — | ✓ | ✓ | ✓ | ✓ |
| Multi-channel Messaging | — | — | ✓ | — | ✓ |
| Voice Pipeline | — | — | ✓ | — | ✓ |
| Computer Use | — | — | ✓ | ✓ | ✓ |
| Sandbox Execution | ✓ | — | ✓ | — | ✓ |
| Thread Resumption | ✓ | — | ✓ | — | ✓ |
| Debug UI | ✓ | — | — | — | ✓ |
| SQL Trace Queries | ✓ | — | — | ✓ | ✓ |
| Cost Attribution | ✓ | — | ✓ | — | ✓ |
