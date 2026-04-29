# Part 1 — @concord/inference Module

## Status: Complete

## What was built

New module at `server/lib/inference/` — single entry point for all brain calls.

### Files created

| File | Purpose |
|---|---|
| `index.js` | Public `infer()` and `inferStream()` API |
| `types.js` | JSDoc type definitions for InferRequest, InferResponse, etc. |
| `router.js` | Brain selection with role chain, availability check, and fallback |
| `ollama-client.js` | OpenAI-compatible Ollama wrapper using BRAIN_CONFIG |
| `semaphore.js` | VRAM choreography — tracks warm brains, evicts on budget overflow |
| `context-assembler.js` | Builds messages from DTU refs + lens context + personal substrate + history |
| `tool-picker.js` | Selects top-N tools via embedding rerank (keyword fallback when embeddings disabled) |
| `agent-loop.js` | Multi-step tool calling with dispatch, reinject, stop conditions, abort |
| `tracer.js` | OTEL-style in-memory spans; strips user content per privacy principle |
| `royalty-hook.js` | Non-blocking DTU contributor crediting via royalty-cascade.js |

### Tests created

`server/tests/inference/`:
- `router.test.js` — 10 tests
- `tracer.test.js` — 9 tests
- `agent-loop.test.js` — 8 tests
- `royalty.test.js` — 5 tests

All 32 inference tests pass.

## Design decisions

- **Wraps existing infrastructure**: Uses BRAIN_CONFIG, llm-queue patterns. Does not replace them.
- **Embeddings-safe**: tool-picker gracefully degrades to keyword scoring when `EMBEDDINGS_ENABLED=false`.
- **Privacy preserved**: tracer.sanitize() only captures structural metadata — no user content, no history, no personal substrate data ever appears in spans.
- **Non-blocking royalties**: royalty-hook uses setImmediate so it never delays inference responses.
- **VRAM semaphore**: static budget from config (no GPU probing); repair+utility always stay warm.

## Direct Ollama call audit

Remaining direct `/api/generate` calls outside the inference module:

| File | Status |
|---|---|
| `lib/chat-parallel-brains.js` | Core chat infrastructure — migrate in dedicated PR |
| `lib/conversation-summarizer.js` | Core chat infrastructure — migrate in dedicated PR |
| `lib/conversation-memory.js` | Core chat infrastructure — migrate in dedicated PR |
| `lib/brain-router.js` | Preload/warm only — correct location |
| `lib/vision-inference.js` | Vision-specific — will route through inference.multimodal |

New code calling inference module should use `import { infer, inferStream } from './lib/inference/index.js'`.
