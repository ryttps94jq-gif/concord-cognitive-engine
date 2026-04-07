// economy/micro-cc.js
// Integer Cents Storage — Micro-CC Conversion Layer
//
// ALL money values stored as integers in MICRO-CC
// 1 CC = 1,000,000 micro-CC
// This gives 6 decimal places of precision with zero floating point error.
//
// x²-x=0 — a value is either exact (integer) or wrong (float).

const MICRO = 1_000_000; // 1 CC = 1,000,000 micro

// ── Conversion Functions ───────────────────────────────────────────────────

/** Convert micro-CC (integer) to CC (float) for display only. */
export function microToCC(micro) {
  return micro / MICRO;
}

/** Convert CC (float) to micro-CC (integer). Always rounds. */
export function ccToMicro(cc) {
  return Math.round(cc * MICRO);
}

/** Convert micro-CC to display string with 2 decimal places. */
export function microToDisplay(micro) {
  return (micro / MICRO).toFixed(2);
}

/** Convert micro-CC to USD cents for Stripe (1 CC = $1). */
export function microToStripeCents(micro, tokensPerUsd = 1) {
  // micro / MICRO = CC amount, then * 100 for cents, then / tokensPerUsd
  return Math.round((micro / MICRO / tokensPerUsd) * 100);
}

/** Convert Stripe cents to micro-CC. */
export function stripeCentsToMicro(cents, tokensPerUsd = 1) {
  // cents / 100 = USD, * tokensPerUsd = CC, * MICRO = micro
  return Math.round((cents / 100) * tokensPerUsd * MICRO);
}

// ── Integer Fee Calculation ────────────────────────────────────────────────

/**
 * Calculate fee using integer arithmetic only.
 * Rate is expressed as basis points divided by 100.
 * e.g., 1.46% = 146 bps → fee = amount * 146 / 10000
 *
 * @param {number} amountMicro — amount in micro-CC (integer)
 * @param {number} rateBps — rate in basis points (e.g., 146 for 1.46%)
 * @returns {{ fee: number, net: number }}
 */
export function calculateFeeMicro(amountMicro, rateBps) {
  const fee = Math.floor(amountMicro * rateBps / 10000);
  const net = amountMicro - fee;
  return { fee, net };
}

// Fee rates in basis points
export const FEE_RATES_BPS = {
  TOKEN_PURCHASE: 146,        // 1.46%
  TRANSFER: 146,              // 1.46%
  WITHDRAWAL: 146,            // 1.46%
  MARKETPLACE_PURCHASE: 546,  // 4% + 1.46% = 5.46%
  EMERGENT_TRANSFER: 146,     // 1.46%
  ROYALTY_PAYOUT: 0,          // 0%
  musicDistribution: 400,     // 4%
  artDistribution: 400,       // 4%
};

/**
 * Calculate fee for a transaction type in micro-CC.
 * @param {string} type — transaction type
 * @param {number} amountMicro — gross amount in micro-CC
 * @returns {{ fee: number, net: number, rateBps: number }}
 */
export function calculateFeeForType(type, amountMicro) {
  const rateBps = FEE_RATES_BPS[type] ?? 0;
  const { fee, net } = calculateFeeMicro(amountMicro, rateBps);
  return { fee, net, rateBps };
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate that a value is a safe integer (suitable for micro-CC).
 */
export function isValidMicro(value) {
  return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

/**
 * Safely add two micro-CC values (checks for overflow).
 */
export function addMicro(a, b) {
  const result = a + b;
  if (result > Number.MAX_SAFE_INTEGER) {
    throw new Error("micro_cc_overflow");
  }
  return result;
}

/**
 * Safely subtract micro-CC values (checks for negative).
 */
export function subtractMicro(a, b) {
  const result = a - b;
  if (result < 0) {
    throw new Error("micro_cc_underflow");
  }
  return result;
}

// ── API boundary helpers ───────────────────────────────────────────────────

/**
 * Convert an API input amount (float CC) to micro-CC for internal use.
 * Use at API boundaries when receiving amounts from clients.
 */
export function apiInputToMicro(ccAmount) {
  if (typeof ccAmount !== "number" || !Number.isFinite(ccAmount) || ccAmount < 0) {
    return { ok: false, error: "invalid_amount" };
  }
  return { ok: true, micro: ccToMicro(ccAmount) };
}

/**
 * Convert internal micro-CC to API output (float CC).
 * Use at API boundaries when sending amounts to clients.
 */
export function microToApiOutput(micro) {
  return Math.round(micro / MICRO * 100) / 100; // 2 decimal places
}

// ── Example Usage ──────────────────────────────────────────────────────────
//
// const saleAmount = ccToMicro(100);                    // 100_000_000 micro
// const { fee, net } = calculateFeeForType("MARKETPLACE_PURCHASE", saleAmount);
// // fee = 5_460_000 (5.46%)
// // net = 94_540_000
// // Exact. No floating point. No drift. Ever.

export { MICRO };
