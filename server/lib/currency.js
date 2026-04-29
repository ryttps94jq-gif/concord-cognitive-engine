// server/lib/currency.js
// Dual-currency helpers. Sparks = gameplay-only, no real-world value.
// CC (concordia_credits) = real money equivalent, NEVER awarded by gameplay.

import crypto from "crypto";

/**
 * Award Sparks to a player for a gameplay action.
 * Returns the new Sparks balance.
 */
export function awardSparks(db, userId, amount, reason, worldId = null) {
  if (!userId || amount <= 0) return 0;
  const id = crypto.randomUUID();
  db.prepare(`UPDATE users SET sparks = sparks + ? WHERE id = ?`).run(amount, userId);
  db.prepare(`
    INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, amount, reason, worldId);
  const row = db.prepare(`SELECT sparks FROM users WHERE id = ?`).get(userId);
  return row?.sparks ?? 0;
}

/**
 * Spend Sparks. Throws if insufficient balance.
 * Returns new balance.
 */
export function spendSparks(db, userId, amount, reason, worldId = null) {
  if (!userId || amount <= 0) return 0;
  const row = db.prepare(`SELECT sparks FROM users WHERE id = ?`).get(userId);
  if (!row) throw new Error("user_not_found");
  if (row.sparks < amount) throw new Error("insufficient_sparks");

  const id = crypto.randomUUID();
  db.prepare(`UPDATE users SET sparks = sparks - ? WHERE id = ?`).run(amount, userId);
  db.prepare(`
    INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, -amount, reason, worldId);

  const updated = db.prepare(`SELECT sparks FROM users WHERE id = ?`).get(userId);
  return updated?.sparks ?? 0;
}

/**
 * Get both balances for a user.
 */
export function getBalances(db, userId) {
  const row = db.prepare(`SELECT sparks, concordia_credits FROM users WHERE id = ?`).get(userId);
  return { sparks: row?.sparks ?? 0, concordiaCredits: row?.concordia_credits ?? 0 };
}

/**
 * Transfer Sparks between two players (inventory trade, robbery, etc.).
 * Caller must validate consent rules before calling.
 */
export function transferSparks(db, fromUserId, toUserId, amount, reason) {
  spendSparks(db, fromUserId, amount, `transfer_out:${reason}`);
  awardSparks(db, toUserId, amount, `transfer_in:${reason}`);
}
