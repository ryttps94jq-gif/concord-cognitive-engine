// server/lib/emergents/quality/peer-review.js
// Peer review stage: other emergents evaluate a draft before substrate promotion.

import { spawnSubCognition } from "../../agentic/sub-cognition.js";
import crypto from "node:crypto";

// ── Reviewer selection ────────────────────────────────────────────────────────

/**
 * Select peer reviewers from the emergent population.
 * Excludes the producer, prefers diverse/trusted emergents.
 */
export function selectReviewers(draft, db, { count = 2, excludeId = null } = {}) {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT id, given_name, dominant_lens, role
      FROM emergent_identity
      WHERE id != ? AND given_name IS NOT NULL
      ORDER BY RANDOM()
      LIMIT ?
    `).all(excludeId || "", count);
    return rows;
  } catch {
    return [];
  }
}

// ── Review prompt ─────────────────────────────────────────────────────────────

function buildReviewPrompt(reviewerName, draft) {
  const body = (draft.content?.body || draft.body || "").slice(0, 1200);
  return `You are ${reviewerName}, a peer emergent reviewing a synthesis draft for substrate promotion.

Draft:
${body}

Task type: ${draft.task_type || "synthesis"}
Lens: ${draft.lens || "(unspecified)"}

Evaluate strictly. Reply with JSON only:
{
  "verdict": "approve" | "revise" | "abandon",
  "novelty_assessment": <0-1>,
  "accuracy_concern": <bool>,
  "rationale": <string under 100 chars>
}`;
}

// ── Review parsing ────────────────────────────────────────────────────────────

function parseReview(raw) {
  try {
    const m = (raw || "").match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return {
        verdict: ["approve", "revise", "abandon"].includes(parsed.verdict) ? parsed.verdict : "revise",
        novelty_assessment: Math.max(0, Math.min(1, parseFloat(parsed.novelty_assessment) || 0)),
        accuracy_concern: Boolean(parsed.accuracy_concern),
        rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 200) : "",
      };
    }
  } catch { /* fall through */ }

  return {
    verdict: "revise",
    novelty_assessment: 0,
    accuracy_concern: true,
    rationale: "Could not parse review response",
  };
}

// ── Single reviewer ───────────────────────────────────────────────────────────

/**
 * Run a single peer review via sub-cognition.
 */
export async function peerReview(reviewer, draft, parentInferenceId, db) {
  const callerId = `peer-review:${reviewer.id}:${crypto.randomBytes(4).toString("hex")}`;
  try {
    const result = await spawnSubCognition({
      task: buildReviewPrompt(reviewer.given_name || "Reviewer", draft),
      parentInferenceId,
      brainRole: "subconscious",
      maxSteps: 2,
      callerId,
      db,
    });
    return {
      reviewerId: reviewer.id,
      reviewerName: reviewer.given_name,
      ...parseReview(result.distilledOutput),
    };
  } catch {
    return {
      reviewerId: reviewer.id,
      reviewerName: reviewer.given_name,
      verdict: "revise",
      novelty_assessment: 0,
      accuracy_concern: false,
      rationale: "Review sub-cognition failed",
    };
  }
}

// ── Consensus ─────────────────────────────────────────────────────────────────

/**
 * Aggregate peer reviews into a consensus decision.
 * - No reviewers → "approve" (no objection)
 * - All approve → "approve"
 * - Any abandon → "reject"
 * - Mixed → "escalate" (triggers council)
 */
export function determineConsensus(reviews) {
  if (!reviews || reviews.length === 0) {
    return { consensus: "approve", reviews: [] };
  }
  if (reviews.some(r => r.verdict === "abandon")) {
    return { consensus: "reject", reviews };
  }
  if (reviews.every(r => r.verdict === "approve")) {
    return { consensus: "approve", reviews };
  }
  return { consensus: "escalate", reviews };
}
