// server/routes/player-inventory.js
// Player physical inventory (items in player_inventory table).
// Distinct from /api/inventory (codebase inventory scanner).

import { Router } from "express";

export default function createPlayerInventoryRouter({ requireAuth, db }) {
  const router = Router();

  // GET /api/player-inventory  — list current player's items
  router.get("/", requireAuth, (req, res) => {
    const userId = req.user.id;
    const items = db.prepare(`
      SELECT * FROM player_inventory
      WHERE user_id = ?
      ORDER BY acquired_at DESC
    `).all(userId);
    res.json({ ok: true, items });
  });

  // GET /api/player-inventory/:userId  — admin/debug: get another player's items
  router.get("/:userId", requireAuth, (req, res) => {
    const items = db.prepare(`
      SELECT * FROM player_inventory
      WHERE user_id = ?
      ORDER BY acquired_at DESC
    `).all(req.params.userId);
    res.json({ ok: true, items });
  });

  return router;
}
