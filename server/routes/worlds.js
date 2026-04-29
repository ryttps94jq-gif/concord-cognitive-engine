// server/routes/worlds.js
// Multi-world API routes: list, get, create, travel, skill teach/effectiveness.

import express from "express";
import crypto from "crypto";
import { loadWorld, listWorlds, getActiveWorldForPlayer } from "../lib/world-loader.js";

export default function createWorldsRouter({ requireAuth, db }) {
  const router = express.Router();

  // GET /api/worlds — list all active worlds
  router.get("/", (req, res) => {
    try {
      const worlds = listWorlds(db);
      res.json({ worlds });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/current — current world for the authenticated player
  router.get("/current", requireAuth, (req, res) => {
    try {
      const worldId = getActiveWorldForPlayer(db, req.user.id);
      const world   = loadWorld(db, worldId);
      res.json({ worldId, world });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/:id — single world detail
  router.get("/:id", (req, res) => {
    try {
      const world = loadWorld(db, req.params.id);
      if (!world) return res.status(404).json({ error: "World not found" });
      res.json({ world });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/:id/metrics — population metrics
  router.get("/:id/metrics", (req, res) => {
    try {
      const world = loadWorld(db, req.params.id);
      if (!world) return res.status(404).json({ error: "World not found" });

      const completedQuests = db.prepare(
        "SELECT COUNT(*) as c FROM world_quests WHERE world_id = ? AND status = 'completed'"
      ).get(req.params.id)?.c || 0;

      const skillDtusCreated = db.prepare(
        "SELECT COUNT(*) as c FROM world_visits WHERE world_id = ? AND departed_at IS NOT NULL"
      ).get(req.params.id)?.c || 0;

      res.json({
        worldId: req.params.id,
        population:       world.population,
        npcCount:         world.npc_count,
        totalVisits:      world.total_visits,
        userCreations:    world.user_creation_count,
        completedQuests,
        skillDtusCreated,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/worlds — create a new world (auth required)
  router.post("/", requireAuth, (req, res) => {
    try {
      const { name, universe_type, description, physics_modulators, rule_modulators } = req.body;
      if (!name || !universe_type) return res.status(400).json({ error: "name and universe_type required" });

      const id = `world-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO worlds (id, name, universe_type, description, physics_modulators, rule_modulators, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, name, universe_type, description || "",
        JSON.stringify(physics_modulators || {}),
        JSON.stringify(rule_modulators    || {}),
        req.user.id,
      );

      const world = loadWorld(db, id);
      res.status(201).json({ world });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/worlds/:id/health — update district health score
  router.patch("/:id/health", requireAuth, (req, res) => {
    try {
      const { field, value } = req.body;
      const allowed = ["population", "npc_count", "user_creation_count"];
      if (!allowed.includes(field)) return res.status(400).json({ error: "Invalid field" });

      db.prepare(`UPDATE worlds SET ${field} = ? WHERE id = ?`).run(value, req.params.id);
      res.json({ ok: true, field, value });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/worlds/travel — move authenticated player to a new world
  router.post("/travel", requireAuth, (req, res) => {
    try {
      const { worldId: destinationWorldId } = req.body;
      if (!destinationWorldId) return res.status(400).json({ error: "worldId required" });

      const dest = loadWorld(db, destinationWorldId);
      if (!dest) return res.status(404).json({ error: "Destination world not found" });

      const userId = req.user.id;
      const currentWorldId = getActiveWorldForPlayer(db, userId);

      // Close open visit on current world
      const openVisit = db.prepare(
        "SELECT id FROM world_visits WHERE user_id = ? AND world_id = ? AND departed_at IS NULL ORDER BY arrived_at DESC LIMIT 1"
      ).get(userId, currentWorldId);

      if (openVisit) {
        db.prepare(
          "UPDATE world_visits SET departed_at = unixepoch(), total_time_minutes = (unixepoch() - arrived_at) / 60.0 WHERE id = ?"
        ).run(openVisit.id);
        db.prepare("UPDATE worlds SET population = MAX(0, population - 1) WHERE id = ?").run(currentWorldId);
      }

      // Open new visit
      db.prepare(
        "INSERT INTO world_visits (id, user_id, world_id) VALUES (?, ?, ?)"
      ).run(crypto.randomUUID(), userId, destinationWorldId);
      db.prepare(
        "UPDATE worlds SET population = population + 1, total_visits = total_visits + 1 WHERE id = ?"
      ).run(destinationWorldId);

      // Update player world state
      db.prepare(
        "INSERT INTO player_world_state (user_id, world_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET world_id = excluded.world_id"
      ).run(userId, destinationWorldId);

      res.json({ ok: true, previousWorldId: currentWorldId, worldId: destinationWorldId, world: dest });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/:worldId/quests — list quests in a world
  router.get("/:worldId/quests", (req, res) => {
    try {
      const { status = "available" } = req.query;
      const quests = db.prepare(
        "SELECT * FROM world_quests WHERE world_id = ? AND (status = ? OR ? = 'all') ORDER BY created_at DESC"
      ).all(req.params.worldId, status, status);

      res.json({ quests: quests.map(_parseQuest) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/worlds/:worldId/quests/:questId/accept
  router.post("/:worldId/quests/:questId/accept", requireAuth, (req, res) => {
    try {
      const { questId } = req.params;
      const quest = db.prepare("SELECT * FROM world_quests WHERE id = ? AND status = 'available'").get(questId);
      if (!quest) return res.status(404).json({ error: "Quest not available" });

      db.prepare(
        "UPDATE world_quests SET status = 'active', accepted_by = ? WHERE id = ?"
      ).run(req.user.id, questId);

      res.json({ ok: true, quest: _parseQuest({ ...quest, status: "active", accepted_by: req.user.id }) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/worlds/:worldId/quests/:questId/event — dispatch progress event
  router.post("/:worldId/quests/:questId/event", requireAuth, (req, res) => {
    try {
      const quest = db.prepare("SELECT * FROM world_quests WHERE id = ?").get(req.params.questId);
      if (!quest) return res.status(404).json({ error: "Quest not found" });
      // Progress update is handled by quest-emergence.js; acknowledge receipt here
      res.json({ ok: true, questId: req.params.questId, event: req.body });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/skills/teach — teach a skill from one player to another
  router.post("/skills/teach", requireAuth, async (req, res) => {
    try {
      const { teacherDtuId, studentId } = req.body;
      if (!teacherDtuId || !studentId) return res.status(400).json({ error: "teacherDtuId and studentId required" });

      const { teachSkillToPlayer } = await import("../lib/skill-effectiveness.js");
      const { selectBrain } = await import("../lib/inference/router.js");
      const worldId = req.query.worldId || "concordia-hub";
      const world   = loadWorld(db, worldId);

      const newSkill = await teachSkillToPlayer(
        req.user.id,
        studentId,
        teacherDtuId,
        { worldId, worldName: world?.name },
        db,
        selectBrain,
      );

      res.status(201).json({ skill: newSkill });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // GET /api/skills/:dtuId/effectiveness — skill effectiveness in a world
  router.get("/skills/:dtuId/effectiveness", async (req, res) => {
    try {
      const { worldId = "concordia-hub" } = req.query;
      const skill = db.prepare("SELECT * FROM dtus WHERE id = ?").get(req.params.dtuId);
      if (!skill) return res.status(404).json({ error: "Skill not found" });

      const world = loadWorld(db, worldId);
      if (!world) return res.status(404).json({ error: "World not found" });

      const { evaluateSkillInWorld } = await import("../lib/skill-effectiveness.js");
      res.json({ skillId: req.params.dtuId, worldId, ...evaluateSkillInWorld(skill, world) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/marketplace — list skill listings
  router.get("/marketplace", async (req, res) => {
    try {
      const { getListings } = await import("../lib/skill-marketplace.js");
      const { worldId, maxPrice, page, limit } = req.query;
      const result = getListings({
        worldId,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        page:     page     ? Number(page)     : 1,
        limit:    limit    ? Number(limit)    : 20,
      }, db);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/worlds/marketplace/list — list a skill for sale
  router.post("/marketplace/list", requireAuth, async (req, res) => {
    try {
      const { dtuId, priceCC, description } = req.body;
      if (!dtuId || priceCC == null) return res.status(400).json({ error: "dtuId and priceCC required" });

      const { listSkillForSale } = await import("../lib/skill-marketplace.js");
      const listing = listSkillForSale(req.user.id, dtuId, Number(priceCC), description, db);
      res.status(201).json({ listing });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // POST /api/worlds/marketplace/purchase — buy a skill listing
  router.post("/marketplace/purchase", requireAuth, async (req, res) => {
    try {
      const { listingId } = req.body;
      if (!listingId) return res.status(400).json({ error: "listingId required" });

      const { purchaseSkill } = await import("../lib/skill-marketplace.js");
      const { selectBrain } = await import("../lib/inference/router.js");
      const worldId = getActiveWorldForPlayer(db, req.user.id);
      const world   = loadWorld(db, worldId);

      const result = await purchaseSkill(
        req.user.id, listingId,
        { worldId, worldName: world?.name },
        db, selectBrain,
      );
      res.json(result);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  // GET /api/worlds/skills/mine — player's own skills with progression data
  router.get("/skills/mine", requireAuth, async (req, res) => {
    try {
      const worldId = getActiveWorldForPlayer(db, req.user.id) || "concordia-hub";
      const skills = db.prepare(
        "SELECT * FROM dtus WHERE creator_id = ? AND type = 'skill' ORDER BY skill_level DESC"
      ).all(req.user.id);

      const { getMasteryMarkers } = await import("../lib/skill-progression.js");
      const { evaluateSkillInWorld } = await import("../lib/skill-effectiveness.js");
      const world = loadWorld(db, worldId);

      const shaped = skills.map(s => ({
        ...s,
        mastery: getMasteryMarkers(s),
        effectivenessInCurrentWorld: world ? evaluateSkillInWorld(s, world).effectiveness : null,
      }));
      res.json({ skills: shaped, worldId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/:worldId/leaderboard — top skills in a world by level
  router.get("/:worldId/leaderboard", async (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT d.id, d.title, d.skill_level, d.creator_id, u.username
        FROM dtus d
        LEFT JOIN users u ON u.id = d.creator_id
        WHERE d.world_id = ? AND d.type = 'skill' AND d.skill_level > 1
        ORDER BY d.skill_level DESC
        LIMIT 20
      `).all(req.params.worldId);
      res.json({ leaderboard: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/worlds/skills/legendary — Legendary+ skill holders across all worlds
  router.get("/skills/legendary", async (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT d.id, d.title, d.skill_level, d.creator_id, u.username, d.world_id
        FROM dtus d LEFT JOIN users u ON u.id = d.creator_id
        WHERE d.type = 'skill' AND d.skill_level >= 500
        ORDER BY d.skill_level DESC LIMIT 20
      `).all();
      res.json({ legends: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/worlds/crises — active civilization crises
  router.get("/crises", async (req, res) => {
    try {
      const { getActiveCrises } = await import("../lib/world-crisis.js");
      res.json({ crises: getActiveCrises(db) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/worlds/crises/:id/respond — player contributes to crisis resolution
  router.post("/crises/:id/respond", requireAuth, async (req, res) => {
    try {
      const { resolveCrisis } = await import("../lib/world-crisis.js");
      // For now: any response contributes to resolution
      const result = await resolveCrisis(db, req.params.id, {
        resolvedBy: req.user.id,
        outcome: req.body.outcome || "Resolved by player intervention.",
      }, () => {});
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/worlds/loot/:nodeId — claim a loot node
  router.post("/loot/:nodeId/claim", requireAuth, (req, res) => {
    try {
      const node = db.prepare("SELECT * FROM loot_nodes WHERE id = ?").get(req.params.nodeId);
      if (!node) return res.status(404).json({ error: "Loot node not found or expired" });
      if (node.claimed_by) return res.status(409).json({ error: "Already claimed" });
      if (node.expires_at < Date.now()) return res.status(410).json({ error: "Loot node expired" });

      const now = Date.now();
      // Killer priority window: first 2 minutes
      if (node.killer_id && node.killer_id !== req.user.id && now < node.created_at + 120_000) {
        return res.status(403).json({ error: "Killer priority window active" });
      }

      db.prepare("UPDATE loot_nodes SET claimed_by = ?, claimed_at = ? WHERE id = ?")
        .run(req.user.id, now, node.id);

      const contents = JSON.parse(node.contents || "[]");
      res.json({ ok: true, contents });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/worlds/:worldId/nemesis — get the caller's nemesis in a world
  router.get("/:worldId/nemesis", requireAuth, (req, res) => {
    try {
      const record = db.prepare("SELECT * FROM nemesis_records WHERE player_id = ?").get(req.user.id);
      res.json({ nemesis: record || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/worlds/:worldId/difficulty — player's effective resistance curve
  router.get("/:worldId/difficulty", requireAuth, async (req, res) => {
    try {
      const { evaluateSkillInWorld } = await import("../lib/skill-effectiveness.js");
      const { loadWorld } = await import("../lib/world-loader.js");
      const world = loadWorld(db, req.params.worldId);
      if (!world) return res.status(404).json({ error: "World not found" });

      const playerSkills = db.prepare(
        "SELECT skill_level FROM dtus WHERE creator_id = ? AND type = 'skill'"
      ).all(req.user.id);
      const avgLevel = playerSkills.length
        ? playerSkills.reduce((s, r) => s + (r.skill_level || 1), 0) / playerSkills.length
        : 1;

      const populationAvg = db.prepare(`
        SELECT AVG(d.skill_level) as avg FROM dtus d
        INNER JOIN users u ON u.id = d.creator_id
        WHERE d.type = 'skill' AND d.world_id = ?
      `).get(req.params.worldId)?.avg || 1;

      const scalingFactor = Math.min(2.0, avgLevel / Math.max(1, populationAvg));
      res.json({ worldId: req.params.worldId, playerAvgLevel: avgLevel, populationAvg, scalingFactor });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/worlds/:worldId/prestige — reset skills for prestige badge
  router.post("/:worldId/prestige", requireAuth, async (req, res) => {
    try {
      const PRESTIGE_THRESHOLD = 200;
      const playerSkills = db.prepare(
        "SELECT id, skill_level, title FROM dtus WHERE creator_id = ? AND type = 'skill' AND world_id = ?"
      ).all(req.user.id, req.params.worldId);

      if (playerSkills.length === 0) return res.status(400).json({ error: "No skills in this world" });
      const avgLevel = playerSkills.reduce((s, r) => s + (r.skill_level || 1), 0) / playerSkills.length;
      if (avgLevel < PRESTIGE_THRESHOLD) {
        return res.status(400).json({ error: `Need average skill level ${PRESTIGE_THRESHOLD}. Current: ${avgLevel.toFixed(1)}` });
      }

      // Reset skill levels, preserve lineage for royalty cascade
      for (const skill of playerSkills) {
        const prestigenMeta = JSON.stringify({ prestige_from_level: skill.skill_level, world: req.params.worldId });
        db.prepare("UPDATE dtus SET skill_level = 1, total_experience = 0, practice_count = 0 WHERE id = ?").run(skill.id);
        db.prepare("UPDATE dtus SET meta = json_patch(COALESCE(meta, '{}'), ?) WHERE id = ?")
          .run(prestigenMeta, skill.id);
      }

      // Chronicle entry
      try {
        const { recordEvent } = await import("../emergent/history-engine.js");
        const username = db.prepare("SELECT username FROM users WHERE id = ?").get(req.user.id)?.username || "Unknown";
        recordEvent("breakthrough", {
          actorId: req.user.id,
          description: `${username} has prestiged in ${req.params.worldId} after reaching avg level ${avgLevel.toFixed(1)}.`,
          significance: "prestige",
        });
      } catch (_) {}

      res.json({ ok: true, prestigedSkills: playerSkills.length, fromAvgLevel: avgLevel.toFixed(1) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/substrate/patterns — substrate pattern feed
  router.get("/substrate/patterns", (req, res) => {
    try {
      const patterns = db.prepare(
        "SELECT * FROM substrate_patterns ORDER BY current_strength DESC LIMIT 50"
      ).all().map(p => ({
        ...p,
        member_dtu_ids: _tryParseJSON(p.member_dtu_ids, []),
        worlds_present: _tryParseJSON(p.worlds_present, []),
      }));
      res.json({ patterns });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

function _parseQuest(q) {
  return {
    ...q,
    objectives: _tryParseJSON(q.objectives_json, []),
    reward:     _tryParseJSON(q.reward_json,     {}),
  };
}

function _tryParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
