// server/lib/inference/royalty-hook.js
// Post-call DTU contributor crediting — queues royalty events to the
// existing royalty-cascade engine without blocking the inference response.

/**
 * Queue a royalty event for DTU contributors used in an inference call.
 * Non-blocking and non-fatal — inference continues even if royalty fails.
 *
 * @param {string} inferenceId
 * @param {Array<{dtuId: string, weight: number}>} contributors
 * @param {object} [db] - better-sqlite3 for direct royalty writes
 */
export async function emitRoyaltyEvent(inferenceId, contributors, db) {
  if (!contributors?.length) return;

  setImmediate(async () => {
    try {
      const { queueRoyaltyEvent } = await import("../../economy/royalty-cascade.js");
      await queueRoyaltyEvent({
        sourceId: inferenceId,
        sourceType: "inference_use",
        contributors: contributors.map(c => ({ dtuId: c.dtuId, weight: c.weight ?? 1 })),
      }, db);
    } catch {
      // Non-fatal — royalty failure does not degrade inference
    }
  });
}

/**
 * Compute DTU contributor weights based on step usage.
 * Simple heuristic: all referenced DTUs get equal weight.
 *
 * @param {string[]} dtuRefs - DTU IDs referenced in the request
 * @param {import('./types.js').InferStep[]} steps
 * @returns {Array<{dtuId: string, weight: number}>}
 */
export function computeContributors(dtuRefs, steps) {
  if (!dtuRefs?.length) return [];
  const weight = 1 / dtuRefs.length;
  return dtuRefs.map(dtuId => ({ dtuId, weight: Math.round(weight * 100) / 100 }));
}
