// server/lib/inference/cost-model.js
// Cost attribution model for inference traces.
// Rates are approximate self-hosted GPU overhead costs.

/**
 * Cost rates in USD per 1,000 tokens (input / output).
 * Keyed by model string matching BRAIN_CONFIG model values.
 */
export const COST_RATES = Object.freeze({
  "concord-conscious:latest":     { in: 0.0006, out: 0.0008 },
  "qwen2.5:7b-instruct-q4_K_M":  { in: 0.0002, out: 0.0003 },
  "qwen2.5:3b":                   { in: 0.0001, out: 0.00015 },
  "qwen2.5:0.5b":                 { in: 0.00005, out: 0.0001 },
  "llava":                        { in: 0.0004, out: 0.0005 },
});

const DEFAULT_RATE = { in: 0.0002, out: 0.0003 };

/**
 * Compute cost for a single inference call.
 * @param {string} modelUsed - model string from brain-config
 * @param {number} tokensIn
 * @param {number} tokensOut
 * @returns {{ inputCost: number, outputCost: number, totalCost: number }}
 */
export function computeInferenceCost(modelUsed, tokensIn, tokensOut) {
  const rate = COST_RATES[modelUsed] || DEFAULT_RATE;
  const inputCost = ((tokensIn || 0) / 1000) * rate.in;
  const outputCost = ((tokensOut || 0) / 1000) * rate.out;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Aggregate cost breakdown from inference_spans rows.
 * @param {object[]} rows - rows from inference_spans table
 * @returns {{ totalUsd: number, byModel: Record<string,number>, byLens: Record<string,number>, byCaller: Record<string,number> }}
 */
export function aggregateCosts(rows) {
  let totalUsd = 0;
  const byModel = {};
  const byLens = {};
  const byCaller = {};

  for (const row of rows) {
    const { totalCost } = computeInferenceCost(row.model_used, row.tokens_in, row.tokens_out);
    totalUsd += totalCost;

    if (row.model_used) {
      byModel[row.model_used] = (byModel[row.model_used] || 0) + totalCost;
    }
    if (row.lens_id) {
      byLens[row.lens_id] = (byLens[row.lens_id] || 0) + totalCost;
    }
    if (row.caller_id) {
      byCaller[row.caller_id] = (byCaller[row.caller_id] || 0) + totalCost;
    }
  }

  // Sort by cost desc
  const sortObj = (obj) => Object.fromEntries(
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 20)
  );

  return {
    totalUsd,
    byModel: sortObj(byModel),
    byLens: sortObj(byLens),
    byCaller: sortObj(byCaller),
  };
}

/**
 * Format cost as human-readable string.
 * @param {number} usd
 */
export function formatCost(usd) {
  if (usd < 0.01) return `$${(usd * 100).toFixed(4)}¢`;
  return `$${usd.toFixed(4)}`;
}
