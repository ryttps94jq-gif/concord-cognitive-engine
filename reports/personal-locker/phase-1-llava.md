# Phase 1 — LLaVA Inference Layer

## Delivered

- `server/lib/vision-inference.js` — unified `callVision()` / `callVisionUrl()` / `visionPromptForDomain()`. Calls LLaVA via BRAIN_CONFIG.multimodal without session opt-in requirement.
- `server/lib/brain-config.js` — added `multimodal` brain entry (5th brain). URL from `BRAIN_MULTIMODAL_URL || OLLAMA_URL || OLLAMA_HOST`, model from `OLLAMA_VISION_MODEL || "llava"`.
- `SYSTEM_TO_BRAIN` — added multimodal system mappings.
- Vision lens actions added to 9 domains: art, photography, filmstudios, whiteboard, science, research, healthcare, food, fashion.
- `POST /api/brain/conscious/chat` — image pre-processing: if `imageB64` or `imageUrl` in body, LLaVA describes it and prepends description to message so conscious brain reasons with full visual context.

## Verification

```bash
npm run lint       # 0 errors
npm run typecheck  # 0 errors
curl /api/brain/health | jq '.multimodal'
POST /api/lens/run { domain: "art", action: "vision", imageB64: "..." }
POST /api/brain/conscious/chat { message: "what is this?", imageB64: "..." }
```
