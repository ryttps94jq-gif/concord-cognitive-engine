// server/lib/agentic/sub-cognition.js
// Spawns isolated sub-threads for exploratory or parallel tasks.
// Sub-cognitions never use the conscious brain — that is reserved for user-facing chat.
// Returns only distilled output to parent; intermediate reasoning is discarded.

import crypto from "node:crypto";
import { infer } from "../inference/index.js";

/**
 * Spawn an isolated sub-cognition thread.
 * The sub-cognition has its own context window, scoped tool access, and scoped DTU access.
 * It never inherits parent context — isolation is strict.
 *
 * @param {object} opts
 * @param {string} opts.task - the task description / intent
 * @param {string} opts.parentInferenceId - ID of the parent inference for tracing
 * @param {string[]} [opts.scopedTools] - tool names available to this sub-cognition
 * @param {string[]} [opts.scopedDTUs] - DTU IDs available to this sub-cognition
 * @param {'subconscious'|'utility'|'repair'} [opts.brainRole='subconscious'] - never 'conscious'
 * @param {number} [opts.maxSteps=10]
 * @param {number} [opts.timeoutMs=60000]
 * @param {object} [opts.lensContext]
 * @param {object} [opts.db]
 * @returns {Promise<{subId: string, parentInferenceId: string, distilledOutput: string, keyDTUsCreated: object[], metadata: object}>}
 */
export async function spawnSubCognition({
  task,
  parentInferenceId,
  scopedTools = [],
  scopedDTUs = [],
  brainRole = "subconscious",
  maxSteps = 10,
  timeoutMs = 60000,
  lensContext,
  db,
}) {
  // Enforce: sub-cognitions never use the conscious brain
  const role = brainRole === "conscious" ? "subconscious" : brainRole;

  const subId = `sub_${crypto.randomBytes(6).toString("hex")}`;

  const req = {
    role,
    intent: task,
    dtuRefs: scopedDTUs,
    toolScope: scopedTools,
    maxSteps,
    callerId: `sub-cognition:${parentInferenceId}:${subId}`,
    signal: AbortSignal.timeout(timeoutMs),
    lensContext,
  };

  const startedAt = Date.now();
  let result;

  try {
    result = await infer(req, db);
  } catch (err) {
    return {
      subId,
      parentInferenceId,
      distilledOutput: `[sub-cognition error: ${err?.message || "unknown"}]`,
      keyDTUsCreated: [],
      metadata: { error: err?.message, latencyMs: Date.now() - startedAt },
    };
  }

  // Return distilled output — intermediate steps are NOT forwarded to parent
  const keyDTUs = (result.dtuContributors || []).filter(c => (c.weight || 0) > 0.5);

  return {
    subId,
    parentInferenceId,
    distilledOutput: result.finalText || "",
    keyDTUsCreated: keyDTUs,
    metadata: {
      stepCount: result.steps?.length || 0,
      tokensUsed: (result.tokensIn || 0) + (result.tokensOut || 0),
      latencyMs: result.latencyMs || (Date.now() - startedAt),
      brainUsed: result.brainUsed,
      terminated: result.terminated,
    },
  };
}
