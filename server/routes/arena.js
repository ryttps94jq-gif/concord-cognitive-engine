// server/routes/arena.js
// Structured PvP arena: matchmaking queue + match resolution.
// Uses the wagers table for automatic Sparks escrow on queue opt-in.

import { Router } from "express";
import crypto from "crypto";
import { awardSparks, spendSparks } from "../lib/currency.js";

const ARENA_SPARKS_WAGER = 25;
const ARENA_PLATFORM_FEE_PCT = 0.02;

// In-memory queue (resets on server restart — acceptable for alpha)
const _queue = new Map(); // userId → { userId, queuedAt, socketId }

export default function createArenaRouter({ requireAuth, db, realtimeEmit }) {
  const router = Router();

  // GET /api/arena/queue  — queue status
  router.get("/queue", requireAuth, (req, res) => {
    const userId = req.user.id;
    const inQueue = _queue.has(userId);
    const position = inQueue
      ? [..._queue.keys()].indexOf(userId) + 1
      : null;

    res.json({ ok: true, queueSize: _queue.size, inQueue, position });
  });

  // POST /api/arena/queue  — join queue
  router.post("/queue", requireAuth, async (req, res) => {
    const userId = req.user.id;

    if (_queue.has(userId)) {
      return res.json({ ok: true, status: "already_queued", position: [..._queue.keys()].indexOf(userId) + 1 });
    }

    // Try to match immediately if someone else is waiting
    const waitingId = [..._queue.keys()].find(id => id !== userId);

    if (waitingId) {
      _queue.delete(waitingId);

      // Create arena wager
      const wagerId = crypto.randomUUID();
      const now = Date.now();

      try {
        spendSparks(db, userId,   ARENA_SPARKS_WAGER, "arena_escrow");
        spendSparks(db, waitingId, ARENA_SPARKS_WAGER, "arena_escrow");
      } catch (err) {
        // If either player can't afford it, abort gracefully
        try { awardSparks(db, userId,    ARENA_SPARKS_WAGER, "arena_escrow_refund"); } catch (_) {}
        try { awardSparks(db, waitingId, ARENA_SPARKS_WAGER, "arena_escrow_refund"); } catch (_) {}
        return res.status(402).json({ ok: false, error: "insufficient_sparks" });
      }

      db.prepare(`
        INSERT INTO wagers
          (id, proposer_id, opponent_id, amount, currency, duel_type, status,
           escrow_locked, world_id, proposed_at, accepted_at, expires_at)
        VALUES (?, ?, ?, ?, 'sparks', 'arena', 'active', 1, 'concordia-hub', ?, ?, ?)
      `).run(wagerId, waitingId, userId, ARENA_SPARKS_WAGER * 2, now, now, now + 30 * 60 * 1000);

      const matchData = { matchId: wagerId, opponentId: userId };
      const matchDataB = { matchId: wagerId, opponentId: waitingId };

      realtimeEmit?.("arena:match:found", { userId: waitingId, ...matchData });
      realtimeEmit?.("arena:match:found", { userId,           ...matchDataB });

      return res.json({ ok: true, status: "matched", matchId: wagerId, opponentId: waitingId });
    }

    // No match — join queue
    _queue.set(userId, { userId, queuedAt: Date.now() });
    res.json({ ok: true, status: "queued", position: _queue.size });
  });

  // POST /api/arena/queue/leave  — leave queue
  router.post("/queue/leave", requireAuth, (req, res) => {
    _queue.delete(req.user.id);
    res.json({ ok: true });
  });

  // GET /api/arena/matches  — player match history
  router.get("/matches", requireAuth, (req, res) => {
    const userId = req.user.id;
    const matches = db.prepare(`
      SELECT w.*, u1.username AS proposer_name, u2.username AS opponent_name
      FROM wagers w
      LEFT JOIN users u1 ON u1.id = w.proposer_id
      LEFT JOIN users u2 ON u2.id = w.opponent_id
      WHERE (w.proposer_id = ? OR w.opponent_id = ?)
        AND w.duel_type = 'arena'
      ORDER BY w.proposed_at DESC
      LIMIT 20
    `).all(userId, userId);

    res.json({ ok: true, matches });
  });

  // POST /api/arena/matches/:id/resolve  — resolve match, pay out winner
  router.post("/matches/:id/resolve", requireAuth, (req, res) => {
    const { winnerId } = req.body;
    if (!winnerId) return res.status(400).json({ ok: false, error: "winnerId_required" });

    const wager = db.prepare("SELECT * FROM wagers WHERE id = ? AND duel_type = 'arena' AND status = 'active'").get(req.params.id);
    if (!wager) return res.status(404).json({ ok: false, error: "match_not_found" });

    const loserId = wager.proposer_id === winnerId ? wager.opponent_id : wager.proposer_id;
    const pot     = wager.amount;
    const fee     = Math.floor(pot * ARENA_PLATFORM_FEE_PCT);
    const payout  = pot - fee;

    awardSparks(db, winnerId, payout, "arena_win", "concordia-hub");

    db.prepare(`UPDATE wagers SET status = 'resolved', winner_id = ?, resolved_at = ? WHERE id = ?`)
      .run(winnerId, Date.now(), wager.id);

    realtimeEmit?.("world:notification", {
      userId: winnerId,
      message: `Arena victory! +${payout} Sparks`,
      type: "milestone",
    });
    realtimeEmit?.("world:notification", {
      userId: loserId,
      message: `Arena defeat. Better luck next time.`,
      type: "info",
    });

    res.json({ ok: true, winnerId, payout, fee });
  });

  return router;
}
