// server/lib/vision-inference.js
// Unified vision inference — calls LLaVA via Ollama /api/chat with image data.
// Used by: personal locker pipeline, lens visual actions, chat pre-processing.
// Does NOT require session multimodalOptIn — this is a server-side pipeline helper.

import { BRAIN_CONFIG } from "./brain-config.js";

const DEFAULT_PROMPT = "Describe this image in detail. Extract key entities, topics, any visible text, and overall context.";

/**
 * Analyze an image using the multimodal brain (LLaVA).
 * @param {string} imageB64 - Base64-encoded image (no data URL prefix)
 * @param {string} [prompt]
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ok: boolean, content?: string, source?: string, error?: string}>}
 */
export async function callVision(imageB64, prompt = DEFAULT_PROMPT, opts = {}) {
  const brain = BRAIN_CONFIG.multimodal;
  const url = `${brain.url}/api/chat`;
  const timeoutMs = opts.timeoutMs || brain.timeout;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: brain.model,
        stream: false,
        messages: [{ role: "user", content: prompt, images: [imageB64] }],
        options: { temperature: brain.temperature, num_predict: brain.maxTokens },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { ok: false, error: `LLaVA HTTP ${res.status}`, source: "ollama_llava" };
    }

    const j = await res.json();
    const content = j?.message?.content || j?.response || "";
    return { ok: true, content, source: "ollama_llava", model: brain.model };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), source: "ollama_llava" };
  }
}

/**
 * Fetch an image from a URL and analyze it.
 * @param {string} imageUrl
 * @param {string} [prompt]
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function callVisionUrl(imageUrl, prompt = DEFAULT_PROMPT, opts = {}) {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, error: `Failed to fetch image: HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const imageB64 = Buffer.from(buf).toString("base64");
    return callVision(imageB64, prompt, opts);
  } catch (err) {
    return { ok: false, error: err?.message || String(err), source: "ollama_llava" };
  }
}

/**
 * Domain-specific prompt for a given lens domain.
 * @param {string} domain
 * @returns {string}
 */
export function visionPromptForDomain(domain) {
  const prompts = {
    art:          "Analyze this artwork. Describe the style, technique, color palette, composition, subject matter, and emotional tone.",
    photography:  "Analyze this photograph. Describe composition, lighting, subject, technique, and any notable photographic elements.",
    filmstudios:  "Analyze this film image or still. Describe scene composition, lighting, cinematographic technique, mood, and narrative elements.",
    whiteboard:   "Extract all text, diagrams, equations, and structural content from this whiteboard. Preserve the logical organization.",
    research:     "Analyze this research image, chart, or figure. Describe what data or findings it presents, axes, trends, and key takeaways.",
    science:      "Describe this scientific image, diagram, or figure. Explain what it depicts, including any labels, measurements, or processes shown.",
    healthcare:   "Describe this medical or health-related image. Identify anatomical structures, any visible conditions, or clinical context. Do not diagnose.",
    food:         "Describe this food or dish. Identify ingredients, preparation style, presentation, and overall appearance.",
    fashion:      "Analyze this fashion image. Describe garments, materials, style, color palette, silhouette, and overall aesthetic.",
  };
  return prompts[domain] || DEFAULT_PROMPT;
}
