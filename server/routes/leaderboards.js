// server/routes/leaderboards.js
// Aggregate leaderboards from game tables.

import { Router } from "express";

export default function createLeaderboardsRouter({ db }) {
  const router = Router();

  // GET /api/leaderboards/:category  — top 20 for a category
  // Categories: sparks | skills | crafts | nemesis
  router.get("/:category", (req, res) => {
    const { category } = req.params;

    let rows = [];

    try {
      if (category === "sparks") {
        rows = db.prepare(`
          SELECT user_id, SUM(delta) AS score, u.username
          FROM sparks_ledger sl
          LEFT JOIN users u ON u.id = sl.user_id
          GROUP BY user_id
          ORDER BY score DESC
          LIMIT 20
        `).all();

      } else if (category === "skills") {
        rows = db.prepare(`
          SELECT creator_id AS user_id, MAX(skill_level) AS score, u.username
          FROM dtus
          LEFT JOIN users u ON u.id = dtus.creator_id
          WHERE type = 'skill'
          GROUP BY creator_id
          ORDER BY score DESC
          LIMIT 20
        `).all();

      } else if (category === "crafts") {
        rows = db.prepare(`
          SELECT user_id, COUNT(*) AS score, u.username
          FROM player_inventory
          LEFT JOIN users u ON u.id = player_inventory.user_id
          WHERE item_type = 'crafted'
          GROUP BY user_id
          ORDER BY score DESC
          LIMIT 20
        `).all();

      } else if (category === "nemesis") {
        rows = db.prepare(`
          SELECT player_id AS user_id, MAX(kill_count) AS score, u.username, npc_title
          FROM nemesis_records
          LEFT JOIN users u ON u.id = nemesis_records.player_id
          GROUP BY player_id
          ORDER BY score DESC
          LIMIT 20
        `).all();

      } else {
        return res.status(400).json({ ok: false, error: "unknown_category" });
      }
    } catch (_) {
      rows = [];
    }

    res.json({ ok: true, category, entries: rows });
  });

  return router;
}
