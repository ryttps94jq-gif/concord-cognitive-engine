/**
 * Confidence Attacher — Computes and attaches confidence scores to AI responses
 *
 * Bridges the gap between existing confidence computation (chat-router.js,
 * chat-parallel-brains.js) and the actual response sent to users.
 *
 * Call attachConfidence() on any AI response before sending it.
 * The score combines:
 *   - Context quality (how relevant were the retrieved DTUs?)
 *   - Source coverage (how many sources supported the answer?)
 *   - Model confidence (repair brain consistency score if available)
 *   - Recency (how fresh are the sources?)
 *
 * Score: 0.0-1.0 with breakdown factors.
 */

import logger from "../logger.js";

// ── Confidence Computation ───────────────────────────────────────────────────

/**
 * Compute a confidence score for an AI response.
 *
 * @param {object} opts
 * @param {string} opts.response - The AI response text
 * @param {object[]} [opts.context] - Retrieved DTU context used
 * @param {string} [opts.method] - How the response was generated (rag, context_only, direct)
 * @param {number} [opts.consistencyScore] - From repair brain (0-1)
 * @param {object} [opts.routeInfo] - From chat-router (confidence, lensMatches)
 * @param {number} [opts.contextRelevance] - Average relevance score of context DTUs
 * @returns {{ score: number, level: string, factors: object }}
 */
export function computeResponseConfidence({
  response = "",
  context = [],
  method = "rag",
  consistencyScore = null,
  routeInfo = null,
  contextRelevance = null,
} = {}) {
  const factors = {};
  let totalWeight = 0;
  let weightedSum = 0;

  // Factor 1: Context coverage (0-1)
  // More relevant sources = higher confidence
  const contextCount = context?.length || 0;
  if (contextCount > 0) {
    const coverage = Math.min(contextCount / 5, 1); // 5+ sources = full coverage
    factors.contextCoverage = { score: coverage, weight: 0.25, detail: `${contextCount} sources` };
    weightedSum += coverage * 0.25;
    totalWeight += 0.25;
  }

  // Factor 2: Context relevance (0-1)
  // Average score of retrieved DTUs
  if (contextRelevance != null) {
    factors.contextRelevance = { score: contextRelevance, weight: 0.2, detail: `avg relevance ${Math.round(contextRelevance * 100)}%` };
    weightedSum += contextRelevance * 0.2;
    totalWeight += 0.2;
  } else if (context?.length > 0) {
    // Estimate from context — if DTUs have scores, use them
    const scores = context.map(c => c.score).filter(s => typeof s === "number" && s > 0);
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      factors.contextRelevance = { score: avg, weight: 0.2, detail: `avg relevance ${Math.round(avg * 100)}%` };
      weightedSum += avg * 0.2;
      totalWeight += 0.2;
    }
  }

  // Factor 3: Repair brain consistency (0-1)
  if (consistencyScore != null) {
    factors.consistency = { score: consistencyScore, weight: 0.3, detail: `repair brain: ${Math.round(consistencyScore * 100)}%` };
    weightedSum += consistencyScore * 0.3;
    totalWeight += 0.3;
  }

  // Factor 4: Route confidence from chat-router
  if (routeInfo?.confidence != null) {
    factors.routeConfidence = { score: routeInfo.confidence, weight: 0.15, detail: `route: ${Math.round(routeInfo.confidence * 100)}%` };
    weightedSum += routeInfo.confidence * 0.15;
    totalWeight += 0.15;
  }

  // Factor 5: Method quality
  const methodScores = { rag: 0.8, context_only: 0.4, direct: 0.6, fallback: 0.3 };
  const methodScore = methodScores[method] || 0.5;
  factors.method = { score: methodScore, weight: 0.1, detail: method };
  weightedSum += methodScore * 0.1;
  totalWeight += 0.1;

  // Factor 6: Response substance (heuristic — longer, structured responses = higher confidence)
  const responseLength = response?.length || 0;
  const substanceScore = Math.min(responseLength / 500, 1); // 500+ chars = full substance
  factors.substance = { score: substanceScore, weight: 0.1, detail: `${responseLength} chars` };
  weightedSum += substanceScore * 0.1;
  totalWeight += 0.1;

  // Normalize
  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0.5;
  const level = _getLevel(score);

  return { score, level, factors };
}

/**
 * Attach confidence to an existing response object.
 * Mutates and returns the response.
 *
 * @param {object} response - The response object (must have ok, response fields)
 * @param {object} [opts] - Same opts as computeResponseConfidence
 * @returns {object} The response with confidence attached
 */
export function attachConfidence(response, opts = {}) {
  if (!response || typeof response !== "object") return response;

  const confidence = computeResponseConfidence({
    response: response.response || response.text || "",
    context: response.context || opts.context,
    method: response.method || opts.method,
    consistencyScore: opts.consistencyScore,
    routeInfo: opts.routeInfo,
    contextRelevance: opts.contextRelevance,
  });

  response.confidence = confidence;
  return response;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _getLevel(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.50) return "moderate";
  if (score >= 0.25) return "low";
  return "speculative";
}

export default { computeResponseConfidence, attachConfidence };
