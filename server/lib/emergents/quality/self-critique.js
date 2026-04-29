// server/lib/emergents/quality/self-critique.js
// Self-critique stage: emergent's own critic sub-cognition evaluates a draft DTU
// before it enters the formal gating system. Most drafts get refined or abandoned here.

import { spawnSubCognition } from "../../agentic/sub-cognition.js";

const MAX_REVISION_CYCLES = 3;

/**
 * Build the critique prompt for a draft + sources.
 */
function buildCritiquePrompt(draft, sources) {
  const sourceText = (sources || [])
    .map(s => `- ${s.id || "?"}: ${s.title || "untitled"} — ${(s.summary || s.content || "").slice(0, 200)}`)
    .join("\n");

  return `As a critic evaluating a draft DTU, assess quality strictly.

Sources cited:
${sourceText || "(none cited)"}

Draft:
${(draft.content?.body || draft.body || "").slice(0, 1500)}

Evaluate and reply with JSON only (no commentary):
{
  "novelty_score": <0-1>,
  "supported": <bool>,
  "coherence_score": <0-1>,
  "citations_accurate": <bool>,
  "substrate_fit_score": <0-1>,
  "weaknesses": [<string>],
  "improvements": [<string>],
  "verdict": "approve" | "revise" | "abandon"
}`;
}

/**
 * Parse structured critique from LLM response.
 * Falls back to a conservative result on parse failure.
 */
function parseCritique(raw) {
  try {
    const jsonMatch = (raw || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        novelty_score: Math.max(0, Math.min(1, parseFloat(parsed.novelty_score) || 0)),
        supported: Boolean(parsed.supported),
        coherence_score: Math.max(0, Math.min(1, parseFloat(parsed.coherence_score) || 0)),
        citations_accurate: Boolean(parsed.citations_accurate),
        substrate_fit_score: Math.max(0, Math.min(1, parseFloat(parsed.substrate_fit_score) || 0)),
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 10) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 10) : [],
        verdict: ["approve", "revise", "abandon"].includes(parsed.verdict) ? parsed.verdict : "revise",
      };
    }
  } catch { /* fall through */ }

  // Conservative fallback — send back for revision
  return {
    novelty_score: 0,
    supported: false,
    coherence_score: 0,
    citations_accurate: false,
    substrate_fit_score: 0,
    weaknesses: ["Could not parse critique — structural quality unknown"],
    improvements: ["Ensure draft makes clear, supported, novel claims"],
    verdict: "revise",
  };
}

/**
 * Apply critique-driven improvements to a draft.
 * Returns null if verdict is 'abandon'.
 */
async function reviseFromCritique(emergentId, draft, critique, parentInferenceId, db) {
  if (critique.verdict === "abandon") return null;
  if (critique.verdict === "approve") return draft;

  const body = draft.content?.body || draft.body || "";
  const result = await spawnSubCognition({
    task: `Revise the following draft to address these weaknesses: ${critique.weaknesses.join("; ")}.

Apply these improvements: ${critique.improvements.join("; ")}.

Original draft:
${body.slice(0, 1000)}

Return only the revised draft body. Be specific, reduce hedging, strengthen novel claims.`,
    parentInferenceId,
    brainRole: "subconscious",
    maxSteps: 2,
    db,
  });

  const revisedBody = result.distilledOutput || body;
  return {
    ...draft,
    content: { ...(draft.content || {}), body: revisedBody },
    body: revisedBody,
  };
}

/**
 * Run self-critique cycle on a draft. Up to MAX_REVISION_CYCLES revisions.
 *
 * @param {string} emergentId
 * @param {object} draft - { id, content: { body }, lineage }
 * @param {object[]} sources - source DTU summaries
 * @param {string} parentInferenceId
 * @param {object} db
 * @returns {Promise<{passed: boolean, finalDraft: object|null, cycles: number, lastCritique: object}>}
 */
export async function runSelfCritique(emergentId, draft, sources, parentInferenceId, db) {
  let current = draft;
  let cycles = 0;
  let lastCritique = null;

  while (cycles < MAX_REVISION_CYCLES) {
    const result = await spawnSubCognition({
      task: buildCritiquePrompt(current, sources),
      parentInferenceId,
      brainRole: "subconscious",
      maxSteps: 2,
      callerId: `emergent:${emergentId}:self-critique:cycle-${cycles}`,
      db,
    });

    lastCritique = parseCritique(result.distilledOutput);
    cycles++;

    if (lastCritique.verdict === "abandon") {
      return { passed: false, finalDraft: null, cycles, lastCritique };
    }

    if (lastCritique.verdict === "approve") {
      return { passed: true, finalDraft: current, cycles, lastCritique };
    }

    // Revise and try again
    const revised = await reviseFromCritique(emergentId, current, lastCritique, parentInferenceId, db);
    if (!revised) return { passed: false, finalDraft: null, cycles, lastCritique };
    current = revised;
  }

  // Exceeded revision limit — approve if novelty score is decent
  const acceptable = (lastCritique?.novelty_score || 0) >= 0.4 && (lastCritique?.coherence_score || 0) >= 0.5;
  return { passed: acceptable, finalDraft: acceptable ? current : null, cycles, lastCritique };
}
