// lib/brain-config.js
// Two-Model Cognitive Architecture — Configuration
//
// Two standing Ollama models on a 20GB GPU:
//   - 14b (qwen2.5:14b-instruct-q4_K_M) — Conscious brain. Chat. ~13GB.
//   - 7b (qwen2.5:7b-instruct-q4_K_M) — Subconscious + Utility + Repair. ~6.3GB.
//   - LLaVA 7b — Vision. Loads on demand, auto-unloads after 30s.
//
// Subconscious, utility, and repair share the SAME 7b Ollama instance
// with different system prompts and temperature profiles per role.
// Total concurrency across all three roles is capped by the shared instance.

// The shared 7b URL (subconscious/utility/repair all point here)
const SHARED_7B_URL = process.env.BRAIN_SUBCONSCIOUS_URL || process.env.BRAIN_UTILITY_URL || process.env.BRAIN_REPAIR_URL || "http://ollama-subconscious:11434";
const SHARED_7B_MODEL = process.env.BRAIN_SUBCONSCIOUS_MODEL || "qwen2.5:7b-instruct-q4_K_M";

export const BRAIN_CONFIG = Object.freeze({
  conscious: {
    url: process.env.BRAIN_CONSCIOUS_URL || process.env.OLLAMA_HOST || "http://ollama-conscious:11434",
    model: process.env.BRAIN_CONSCIOUS_MODEL || "qwen2.5:14b-instruct-q4_K_M",
    role: "chat, deep reasoning, council deliberation",
    temperature: 0.7,
    timeout: 45000,
    priority: 1,       // CRITICAL — user-facing
    maxConcurrent: 2,  // 14b model is memory-heavy; 2 parallel max
    contextWindow: 32768,
    maxTokens: 4096,
  },
  subconscious: {
    url: SHARED_7B_URL,
    model: SHARED_7B_MODEL,
    role: "autogen, dream, evolution, synthesis, birth",
    temperature: 0.85,
    timeout: 30000,
    priority: 2,       // NORMAL — autonomous background
    maxConcurrent: 2,  // Shared 7b: total across sub+util+repair = ~4 parallel
    contextWindow: 8192,
    maxTokens: 1200,
  },
  utility: {
    url: SHARED_7B_URL,
    model: SHARED_7B_MODEL,
    role: "lens interactions, entity actions, quick domain tasks",
    temperature: 0.3,
    timeout: 20000,
    priority: 3,       // LOW — support tasks
    maxConcurrent: 2,  // Shared 7b: keep low to avoid starving subconscious
    contextWindow: 16384,
    maxTokens: 800,
  },
  repair: {
    url: SHARED_7B_URL,
    model: SHARED_7B_MODEL,
    role: "error detection, auto-fix, runtime repair",
    temperature: 0.1,
    timeout: 10000,
    priority: 0,       // HIGHEST — system health
    maxConcurrent: 1,  // Shared 7b: repair is low-frequency, 1 slot is enough
    contextWindow: 4096,
    maxTokens: 500,
  },
});

/**
 * Map from system/subsystem names to brain assignments.
 * Used by the brain router to determine which brain handles each call.
 */
export const SYSTEM_TO_BRAIN = Object.freeze({
  // Conscious brain — user-facing and sovereign
  chat: "conscious",
  sovereign_decree: "conscious",
  entity_dialogue: "conscious",

  // Subconscious brain — autonomous generation + unsaid analysis
  autogen: "subconscious",
  autogen_pipeline: "subconscious",
  meta_derivation: "subconscious",
  dream_synthesis: "subconscious",
  chat_unsaid: "subconscious",

  // Utility brain — analytical and support tasks + conversation compression
  hlr_engine: "utility",
  agent_system: "utility",
  hypothesis_engine: "utility",
  council_voices: "utility",
  research_jobs: "utility",
  chat_summary: "utility",

  // Repair brain — self-healing + entity consistency
  repair_cortex: "repair",
  repair_diagnosis: "repair",
  chat_consistency: "repair",
});

/**
 * Map brain names to LLM queue priority levels.
 */
export const BRAIN_PRIORITY = Object.freeze({
  repair: 0,       // CRITICAL
  conscious: 1,    // HIGH
  subconscious: 2, // NORMAL
  utility: 3,      // LOW
});

/**
 * Get the brain config for a system name.
 * @param {string} systemName - e.g., "chat", "autogen", "repair_cortex"
 * @returns {{ brainName: string, config: object }}
 */
export function getBrainForSystem(systemName) {
  const brainName = SYSTEM_TO_BRAIN[systemName] || "conscious";
  return { brainName, config: BRAIN_CONFIG[brainName] };
}
