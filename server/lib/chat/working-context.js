// server/lib/chat/working-context.js
// Builds the bounded working context for each chat turn.
// Holds the last RAW_HISTORY_LIMIT messages verbatim; older context is retrieved
// semantically from the shadow DTU substrate rather than loaded linearly.

import { fetchRelevantShadowDTUs, formatShadowContext } from "./substrate-retrieval.js";

const RAW_HISTORY_LIMIT = 6;       // last N messages always held raw
export const SHADOW_THRESHOLD = 7; // message count above which shadows become relevant

/**
 * Build the working context for a conscious brain turn.
 *
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.userId
 * @param {string} opts.currentQuery - current user message (for substrate retrieval)
 * @param {Buffer|null} opts.sessionKey - locker key; null = skip personal substrate
 * @param {object|null} opts.db
 * @param {object} opts.STATE - server STATE object holding session map
 * @returns {Promise<{rawHistory: object[], shadowContext: string, metadata: object}>}
 */
export async function buildWorkingContext({ sessionId, userId, currentQuery, sessionKey, db, STATE }) {
  const session = STATE?.sessions?.get(sessionId);
  const allMessages = session?.messages || [];

  // Raw history: last RAW_HISTORY_LIMIT messages, always verbatim
  const rawHistory = allMessages.slice(-RAW_HISTORY_LIMIT).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Shadow substrate: only query when conversation is long enough to have crystallized material
  let shadowContext = "";
  let shadowCount = 0;

  if (userId && sessionKey && db && allMessages.length >= SHADOW_THRESHOLD) {
    const shadows = await fetchRelevantShadowDTUs({
      userId,
      sessionKey,
      query: currentQuery,
      db,
      limit: 5,
      sessionId, // exclude same-session shadows (already in raw history)
    });
    shadowContext = formatShadowContext(shadows);
    shadowCount = shadows.length;
  }

  return {
    rawHistory,
    shadowContext,
    metadata: {
      totalMessages: allMessages.length,
      rawCount: rawHistory.length,
      shadowCount,
      hasPersonalSubstrate: shadowCount > 0,
    },
  };
}

/**
 * Estimate token count for the working context (rough: 4 chars ≈ 1 token).
 * Used to verify context stays bounded.
 * @param {{ rawHistory: object[], shadowContext: string }} ctx
 * @returns {number}
 */
export function estimateContextTokens(ctx) {
  const historyChars = (ctx.rawHistory || []).reduce((s, m) => s + (m.content || "").length, 0);
  const shadowChars = (ctx.shadowContext || "").length;
  return Math.ceil((historyChars + shadowChars) / 4);
}
