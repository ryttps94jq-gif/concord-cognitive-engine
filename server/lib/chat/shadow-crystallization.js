// server/lib/chat/shadow-crystallization.js
// Crystallizes important conversation exchanges into encrypted shadow DTUs
// stored in the user's personal locker. Replaces lossy linear-history scrolling
// with a semantically queryable substrate of prior conversation moments.

import crypto from "node:crypto";
import { encryptBlob } from "../personal-locker/crypto.js";

const IMPORTANCE_THRESHOLD = 0.35; // minimum score to crystallize
const SHADOW_CONTENT_TYPE = "shadow";

// Signals that raise importance score
const SIGNAL_WEIGHTS = {
  decision_made:      0.25,
  problem_solved:     0.25,
  preference_stated:  0.20,
  work_produced:      0.20,
  dtu_referenced:     0.15,
  novel_claim:        0.15,
  error_corrected:    0.20,
  identity_statement: 0.20,
  question_resolved:  0.15,
};

// Keyword patterns for each signal
const SIGNAL_PATTERNS = {
  decision_made:      /\b(decided|will go with|chosen|final answer|going with|committing to)\b/i,
  problem_solved:     /\b(solved|fixed|resolved|figured out|found the issue|works now)\b/i,
  preference_stated:  /\b(prefer|I like|I want|I need|I don't want|my preference|I always)\b/i,
  work_produced:      /```[\s\S]+?```|```\n[\s\S]+?\n```/,
  novel_claim:        /\b(discovered|noticed|realized|turns out|importantly|key insight)\b/i,
  error_corrected:    /\b(actually|correction|mistake|wrong|should be|not quite)\b/i,
  identity_statement: /\b(I am|I'm a|my name|I work|my role|about me)\b/i,
  question_resolved:  /\b(yes|no|correct|exactly|that's right|confirmed)\b/i,
};

/**
 * Score an exchange for importance using heuristic signal detection.
 * @param {{ userMessage: string, assistantResponse: string, dtuRefsUsed?: string[] }} exchange
 * @returns {{ score: number, detected: string[] }}
 */
function scoreImportance(exchange) {
  const combined = `${exchange.userMessage} ${exchange.assistantResponse}`;
  const detected = [];
  let score = 0;

  for (const [signal, pattern] of Object.entries(SIGNAL_PATTERNS)) {
    if (pattern.test(combined)) {
      detected.push(signal);
      score += SIGNAL_WEIGHTS[signal] || 0.1;
    }
  }

  // DTU references always boost importance
  if (exchange.dtuRefsUsed?.length) {
    detected.push("dtu_referenced");
    score += SIGNAL_WEIGHTS.dtu_referenced * Math.min(exchange.dtuRefsUsed.length, 3);
  }

  // Length of code blocks signals work was produced
  const codeBlocks = exchange.assistantResponse.match(/```[\s\S]+?```/g) || [];
  if (codeBlocks.length > 0 && !detected.includes("work_produced")) {
    detected.push("work_produced");
    score += SIGNAL_WEIGHTS.work_produced;
  }

  return { score: Math.min(1, score), detected };
}

/**
 * Extract a concise intent from a user message (first 200 chars, stripped).
 */
function extractIntent(msg) {
  return (msg || "").trim().slice(0, 200).replace(/\s+/g, " ");
}

/**
 * Extract a concise outcome from assistant response.
 * Prefers the first meaningful sentence; falls back to truncation.
 */
function extractOutcome(response) {
  const clean = (response || "").trim();
  const firstSentence = clean.match(/^[^.!?\n]+[.!?\n]/)?.[0] || clean;
  return firstSentence.slice(0, 300).replace(/\s+/g, " ");
}

/**
 * Evaluate and potentially crystallize a conversation exchange into a shadow DTU.
 * Stores encrypted in the user's personal_dtus table with content_type='shadow'.
 *
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.userId
 * @param {string} opts.userMessage
 * @param {string} opts.assistantResponse
 * @param {string[]} [opts.dtuRefsUsed]
 * @param {Buffer} opts.sessionKey - locker encryption key
 * @param {object} opts.db - better-sqlite3 instance
 * @returns {Promise<{crystallized: boolean, shadowId?: string, signals?: string[]}>}
 */
export async function maybeCrystallize({ sessionId, userId, userMessage, assistantResponse, dtuRefsUsed, sessionKey, db }) {
  if (!userId || !sessionKey || !db) return { crystallized: false };

  const { score, detected } = scoreImportance({ userMessage, assistantResponse, dtuRefsUsed });

  if (score < IMPORTANCE_THRESHOLD) return { crystallized: false };

  const payload = {
    type: "conversation_shadow",
    sessionId,
    userId,
    content: {
      intent: extractIntent(userMessage),
      outcome: extractOutcome(assistantResponse),
      signals: detected,
      importanceScore: Math.round(score * 100) / 100,
      timestamp: Date.now(),
    },
    lineage: dtuRefsUsed || [],
    tier: "shadow",
    createdAt: new Date().toISOString(),
  };

  try {
    const plaintext = Buffer.from(JSON.stringify(payload));
    const { iv, ciphertext, authTag } = encryptBlob(plaintext, sessionKey);
    const id = `shadow_${crypto.randomBytes(8).toString("hex")}`;

    db.prepare(`
      INSERT INTO personal_dtus (id, user_id, lens_domain, content_type, title, encrypted_content, iv, auth_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, "chat", SHADOW_CONTENT_TYPE, payload.content.intent.slice(0, 100), ciphertext, iv, authTag);

    return { crystallized: true, shadowId: id, signals: detected };
  } catch {
    return { crystallized: false };
  }
}

/**
 * Get count of shadow DTUs for a user (metadata only, no decryption needed).
 */
export function getShadowCount(userId, db) {
  if (!userId || !db) return 0;
  try {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM personal_dtus WHERE user_id = ? AND content_type = ?"
    ).get(userId, SHADOW_CONTENT_TYPE);
    return row?.cnt || 0;
  } catch { return 0; }
}
