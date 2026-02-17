/**
 * Concord Cognitive Engine — Centralized ID Generation
 *
 * Single source of truth for all entity ID creation across the system.
 * Eliminates duplicated ID generation scattered across modules.
 *
 * Format: `{prefix}_{timestamp_base36}_{random_hex}`
 * - Timestamp ensures rough sortability
 * - Random suffix prevents collisions
 * - Prefix identifies entity type at a glance
 */

import crypto from "crypto";

/**
 * Generate a prefixed, collision-resistant ID.
 *
 * @param {string} prefix - Entity type prefix (e.g. "atlas", "gt", "sess")
 * @param {number} [randomBytes=6] - Number of random bytes (default 6 = 12 hex chars)
 * @returns {string} Formatted ID
 */
export function generateId(prefix, randomBytes = 6) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(randomBytes).toString("hex")}`;
}

// ── Typed convenience functions ──────────────────────────────────────────────

/** Atlas DTU ID */
export function atlasId() {
  return generateId("atlas");
}

/** Atlas claim ID */
export function claimId() {
  return generateId("c", 4);
}

/** Atlas source ID */
export function sourceId() {
  return generateId("src", 4);
}

/** Gate trace ID (includes monotonic sequence for ordering within a session) */
let _traceSeq = 0;
export function traceId() {
  return `gt_${Date.now().toString(36)}_${(++_traceSeq).toString(36)}`;
}

/** Dialogue session ID */
let _sessionSeq = 0;
export function sessionId() {
  return `ds_${Date.now().toString(36)}_${(++_sessionSeq).toString(36)}`;
}

/** Event ID (for affect/event logs) */
export function eventId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generic unique ID with custom prefix */
export function uid(prefix = "id") {
  return generateId(prefix, 4);
}
