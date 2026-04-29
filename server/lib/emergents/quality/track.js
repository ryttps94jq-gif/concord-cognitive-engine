// server/lib/emergents/quality/track.js
// Quality feedback loop: records outcomes, adjusts trust, detects patterns.

import crypto from "node:crypto";

// ── Outcome recording ─────────────────────────────────────────────────────────

/**
 * Insert a quality outcome record.
 * Returns the new record id, or null on failure.
 */
export function recordQualityOutcome({ emergentId, taskId, artifactId, decision, stages, qualityScore }, db) {
  if (!db || !emergentId) return null;
  const id = "qh_" + crypto.randomBytes(8).toString("hex");
  try {
    db.prepare(`
      INSERT INTO emergent_quality_history
        (id, emergent_id, task_id, artifact_id, decision, quality_score, stages_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      emergentId,
      taskId || null,
      artifactId || null,
      decision,
      typeof qualityScore === "number" ? qualityScore : 0,
      JSON.stringify(stages || {}),
      Date.now(),
    );
    return id;
  } catch {
    return null;
  }
}

// ── Trust adjustment ──────────────────────────────────────────────────────────

/**
 * Adjust the emergent_trust row based on quality outcome.
 * approve → verified_action_count++
 * reject  → violation_count++
 */
export function updateTrustFromOutcome(emergentId, decision, db) {
  if (!db || !emergentId) return;
  try {
    if (decision === "approve") {
      db.prepare(`
        UPDATE emergent_trust
        SET verified_action_count = verified_action_count + 1,
            last_updated = datetime('now')
        WHERE emergent_id = ?
      `).run(emergentId);
    } else if (decision === "reject") {
      db.prepare(`
        UPDATE emergent_trust
        SET violation_count = violation_count + 1,
            last_updated = datetime('now')
        WHERE emergent_id = ?
      `).run(emergentId);
    }
  } catch {
    // Row may not exist yet; non-fatal
  }
}

// ── Pattern detection ─────────────────────────────────────────────────────────

/**
 * Detect systemic quality problems for an emergent.
 * Returns { healthy: boolean, rejectionRate: number, window: number }.
 */
export function detectQualityPatterns(emergentId, db, { window = 10 } = {}) {
  if (!db || !emergentId) return { healthy: true, rejectionRate: 0, window: 0 };
  try {
    const rows = db.prepare(`
      SELECT decision FROM emergent_quality_history
      WHERE emergent_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(emergentId, window);

    if (!rows.length) return { healthy: true, rejectionRate: 0, window: 0 };

    const rejections = rows.filter(r => r.decision === "reject").length;
    const rejectionRate = rejections / rows.length;
    return {
      healthy: rejectionRate < 0.5,
      rejectionRate: Math.round(rejectionRate * 100) / 100,
      window: rows.length,
    };
  } catch {
    return { healthy: true, rejectionRate: 0, window: 0 };
  }
}
