/**
 * User Feedback Loop
 *
 * Connects user experience to DTU quality signals.
 * Every DTU interaction can carry a feedback flag (helpful / not helpful).
 * Aggregated feedback adjusts DTU confidence and surfaces quality problems.
 *
 * This is the sensory input from humans that the lattice has been missing.
 *
 * Features:
 *   - Per-DTU feedback aggregation (helpful / not helpful / total)
 *   - Confidence adjustment: negative signals decay confidence
 *   - "Wrong" flag: user can mark a DTU as factually wrong → fast-track review
 *   - Feedback-driven quality scores for autogen/governance visibility
 *   - Time-weighted aggregation (recent feedback counts more)
 */

import { getEmergentState } from "./store.js";

// ── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_DECAY_PER_NEGATIVE = 0.02;   // Each "not helpful" reduces confidence by 2%
const CONFIDENCE_BOOST_PER_POSITIVE = 0.005;  // Each "helpful" boosts by 0.5% (slow positive)
const WRONG_FLAG_CONFIDENCE_HIT = 0.15;       // "Wrong" flag hits confidence by 15%
const MIN_FEEDBACK_FOR_ADJUSTMENT = 3;        // Need 3+ feedbacks before adjusting
const WRONG_FLAG_REVIEW_THRESHOLD = 2;        // 2+ "wrong" flags → flag for review
const MAX_FEEDBACK_PER_DTU = 500;             // Cap stored feedback records per DTU
const FEEDBACK_RECENCY_HALFLIFE_MS = 7 * 24 * 3600_000; // 7 days

// ── Store ────────────────────────────────────────────────────────────────────

function getFeedbackStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._userFeedback) {
    es._userFeedback = {
      // dtuId → FeedbackRecord
      byDtu: new Map(),

      // DTUs flagged for review (wrong flag threshold exceeded)
      reviewQueue: new Map(),

      metrics: {
        totalFeedbacks: 0,
        totalPositive: 0,
        totalNegative: 0,
        totalWrongFlags: 0,
        adjustmentsMade: 0,
        reviewsFlagged: 0,
      },
    };
  }
  return es._userFeedback;
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Record user feedback on a DTU interaction.
 *
 * @param {Object} STATE
 * @param {Object} feedback
 * @param {string} feedback.dtuId - The DTU being rated
 * @param {string} feedback.userId - Who gave the feedback
 * @param {boolean} feedback.helpful - Was the DTU-derived content helpful?
 * @param {boolean} [feedback.wrong=false] - Is the DTU factually wrong?
 * @param {string} [feedback.context] - Optional context (e.g., "chat", "lens", "search")
 * @param {string} [feedback.comment] - Optional user comment
 * @returns {{ ok, adjusted, reviewFlagged }}
 */
export function recordFeedback(STATE, feedback = {}) {
  const { dtuId, userId, helpful, wrong = false, context = "unknown", comment = null } = feedback;

  if (!dtuId || !userId || helpful === undefined) {
    return { ok: false, error: "dtuId_userId_helpful_required" };
  }

  const store = getFeedbackStore(STATE);
  const now = Date.now();

  // Get or create DTU feedback record
  let record = store.byDtu.get(dtuId);
  if (!record) {
    record = {
      dtuId,
      entries: [],
      totals: { helpful: 0, notHelpful: 0, wrongFlags: 0 },
      lastFeedbackAt: null,
      qualityScore: null,  // computed
    };
    store.byDtu.set(dtuId, record);
  }

  // Deduplicate: same user can update but not stack
  const existingIdx = record.entries.findIndex(e => e.userId === userId && e.context === context);
  if (existingIdx >= 0) {
    const prev = record.entries[existingIdx];
    // Undo previous totals
    if (prev.helpful) record.totals.helpful--;
    else record.totals.notHelpful--;
    if (prev.wrong) record.totals.wrongFlags--;
    record.entries.splice(existingIdx, 1);
  }

  // Add entry
  const entry = {
    userId,
    helpful: !!helpful,
    wrong: !!wrong,
    context,
    comment: comment ? String(comment).slice(0, 500) : null,
    timestamp: now,
  };
  record.entries.push(entry);

  // Cap entries
  if (record.entries.length > MAX_FEEDBACK_PER_DTU) {
    record.entries = record.entries.slice(-MAX_FEEDBACK_PER_DTU);
  }

  // Update totals
  if (helpful) record.totals.helpful++;
  else record.totals.notHelpful++;
  if (wrong) record.totals.wrongFlags++;
  record.lastFeedbackAt = now;

  // Update global metrics
  store.metrics.totalFeedbacks++;
  if (helpful) store.metrics.totalPositive++;
  else store.metrics.totalNegative++;
  if (wrong) store.metrics.totalWrongFlags++;

  // Compute quality score (time-weighted)
  record.qualityScore = computeQualityScore(record);

  // Apply confidence adjustment to the actual DTU
  let adjusted = false;
  let reviewFlagged = false;

  const total = record.totals.helpful + record.totals.notHelpful;
  if (total >= MIN_FEEDBACK_FOR_ADJUSTMENT) {
    adjusted = adjustDTUConfidence(STATE, dtuId, record);
  }

  // Check wrong flag threshold
  if (record.totals.wrongFlags >= WRONG_FLAG_REVIEW_THRESHOLD) {
    if (!store.reviewQueue.has(dtuId)) {
      store.reviewQueue.set(dtuId, {
        dtuId,
        wrongFlags: record.totals.wrongFlags,
        flaggedAt: new Date().toISOString(),
        qualityScore: record.qualityScore,
      });
      store.metrics.reviewsFlagged++;
      reviewFlagged = true;
    }
  }

  return { ok: true, adjusted, reviewFlagged, qualityScore: record.qualityScore };
}

/**
 * Compute time-weighted quality score for a DTU.
 * Recent feedback weighs more than old feedback.
 *
 * @param {Object} record
 * @returns {number} Score between 0 and 1
 */
function computeQualityScore(record) {
  const now = Date.now();
  let weightedPositive = 0;
  let weightedTotal = 0;

  for (const entry of record.entries) {
    const age = now - entry.timestamp;
    const weight = Math.pow(0.5, age / FEEDBACK_RECENCY_HALFLIFE_MS);
    weightedTotal += weight;
    if (entry.helpful) weightedPositive += weight;
    if (entry.wrong) weightedPositive -= weight * 0.5;  // wrong penalizes even "helpful"
  }

  return weightedTotal > 0 ? Math.max(0, Math.min(1, weightedPositive / weightedTotal)) : 0.5;
}

/**
 * Adjust a DTU's confidence based on aggregated feedback.
 * Modifies the DTU in STATE.dtus directly.
 *
 * @param {Object} STATE
 * @param {string} dtuId
 * @param {Object} record
 * @returns {boolean} Whether adjustment was applied
 */
function adjustDTUConfidence(STATE, dtuId, record) {
  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return false;

  const negativeRate = record.totals.notHelpful / (record.totals.helpful + record.totals.notHelpful);
  const wrongCount = record.totals.wrongFlags;

  let delta = 0;

  // Negative feedback decays confidence
  if (negativeRate > 0.5) {
    delta -= CONFIDENCE_DECAY_PER_NEGATIVE * record.totals.notHelpful;
  }

  // Positive feedback slowly boosts
  if (negativeRate < 0.3) {
    delta += CONFIDENCE_BOOST_PER_POSITIVE * record.totals.helpful;
  }

  // Wrong flags hit hard
  delta -= WRONG_FLAG_CONFIDENCE_HIT * wrongCount;

  if (Math.abs(delta) < 0.001) return false;

  // Apply to DTU (clamp 0-1)
  const currentConf = dtu.confidence ?? dtu.meta?.confidence ?? 0.5;
  const newConf = Math.max(0, Math.min(1, currentConf + delta));

  dtu.confidence = newConf;
  if (!dtu.meta) dtu.meta = {};
  dtu.meta.confidence = newConf;
  dtu.meta._feedbackAdjusted = true;
  dtu.meta._feedbackQuality = record.qualityScore;
  dtu.updatedAt = new Date().toISOString();

  const store = getFeedbackStore(STATE);
  store.metrics.adjustmentsMade++;

  return true;
}

// ── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get feedback summary for a specific DTU.
 */
export function getDTUFeedback(STATE, dtuId) {
  const store = getFeedbackStore(STATE);
  const record = store.byDtu.get(dtuId);
  if (!record) return { ok: true, dtuId, totals: { helpful: 0, notHelpful: 0, wrongFlags: 0 }, qualityScore: 0.5 };

  return {
    ok: true,
    dtuId,
    totals: record.totals,
    qualityScore: record.qualityScore,
    feedbackCount: record.entries.length,
    lastFeedbackAt: record.lastFeedbackAt ? new Date(record.lastFeedbackAt).toISOString() : null,
  };
}

/**
 * Get DTUs flagged for review (wrong flag threshold exceeded).
 */
export function getReviewQueue(STATE) {
  const store = getFeedbackStore(STATE);
  return {
    ok: true,
    queue: Array.from(store.reviewQueue.values()),
    count: store.reviewQueue.size,
  };
}

/**
 * Dismiss a review item (after manual review).
 */
export function dismissReview(STATE, dtuId) {
  const store = getFeedbackStore(STATE);
  const had = store.reviewQueue.delete(dtuId);
  return { ok: true, dismissed: had };
}

/**
 * Get the lowest-quality DTUs by user feedback.
 *
 * @param {Object} STATE
 * @param {number} [limit=20]
 * @returns {{ ok, dtus }}
 */
export function getLowestQualityDTUs(STATE, limit = 20) {
  const store = getFeedbackStore(STATE);

  const scored = Array.from(store.byDtu.values())
    .filter(r => r.entries.length >= MIN_FEEDBACK_FOR_ADJUSTMENT)
    .map(r => ({ dtuId: r.dtuId, qualityScore: r.qualityScore, totals: r.totals }))
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, limit);

  return { ok: true, dtus: scored, count: scored.length };
}

/**
 * Get feedback metrics.
 */
export function getFeedbackMetrics(STATE) {
  const store = getFeedbackStore(STATE);
  return {
    ok: true,
    dtusWithFeedback: store.byDtu.size,
    reviewQueueSize: store.reviewQueue.size,
    ...store.metrics,
  };
}
