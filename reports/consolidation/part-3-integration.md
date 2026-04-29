# Part 3 — Integration

## Status: Complete (with already-shipped items noted)

## Already complete at time of this spec

| Item | Status | Location |
|---|---|---|
| LLaVA 5th brain integration | ✅ Shipped | `server/lib/vision-inference.js`, `server/lib/brain-config.js` |
| Personal DTU Locker | ✅ Shipped | `server/lib/personal-locker/`, `server/routes/personal-locker.js` |
| Personal substrate in chat | ✅ Shipped | `server/lib/chat-context-pipeline.js` → `fetchPersonalSubstrate()` |
| Backup scheduler | ✅ Shipped | `server/lib/backup-scheduler.js` (19KB, full S3 + CRON + retention) |
| Constitutional conflict resolution | ✅ Shipped | `server/lib/governance/conflict-detector.js`, `constitution.js`, `rule-enforcement.js` |
| Chargeback handler | ✅ Shipped | `server/economy/chargeback-handler.js` |

## New integration work in this part

### 3.1 Personal substrate in inference context-assembler

`server/lib/inference/context-assembler.js` includes personal substrate as a third source (after public DTUs, before history) when `req.userId` and `req.sessionKey` are present. The block is marked `scope: 'user-private'` so the tracer skips capture.

### 3.2 LLaVA through inference module

`server/lib/vision-inference.js` already calls Ollama multimodal directly. The inference module's `multimodal` role routes to the same brain. New code doing image analysis should use:
```js
infer({ role: 'multimodal', intent: prompt, lensContext: { imageBase64: b64 }, callerId: '...' })
```
The direct `callVision()` path in vision-inference.js remains for pipeline use where image bytes need to be passed as Ollama `images[]`.

### 3.3 Base-6 in governance voting

`server/lib/governance/voting.js` (new) — trinary vote weights encoded as Refusal Algebra glyphs. Integrates with the existing GRC system.

### 3.4–3.6 (Backup / Chargeback / Constitutional) — Already shipped

No additional work needed. Verified via file existence check.
