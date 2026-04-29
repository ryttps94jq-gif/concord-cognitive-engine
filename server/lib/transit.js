// server/lib/transit.js
// Cross-world transit logic — wrapped by worlds.js POST /travel route.

import crypto from "crypto";
import { loadWorld, getActiveWorldForPlayer } from "./world-loader.js";

/**
 * Move a player from their current world to a destination world.
 * Updates world_visits, worlds population counters, and player_world_state.
 *
 * @param {string} userId
 * @param {string} destinationWorldId
 * @param {import('better-sqlite3').Database} db
 * @param {import('socket.io').Server|null} io  optional — emits socket events
 * @returns {{ previousWorldId: string, worldId: string, world: object }}
 */
export async function travelToWorld(userId, destinationWorldId, db, io = null) {
  const dest = loadWorld(db, destinationWorldId);
  if (!dest) throw Object.assign(new Error("Destination world not found"), { status: 404 });

  const currentWorldId = getActiveWorldForPlayer(db, userId);

  // Close open visit on current world
  const openVisit = db.prepare(`
    SELECT id FROM world_visits
    WHERE user_id = ? AND world_id = ? AND departed_at IS NULL
    ORDER BY arrived_at DESC LIMIT 1
  `).get(userId, currentWorldId);

  if (openVisit) {
    db.prepare(`
      UPDATE world_visits
      SET departed_at = unixepoch(),
          total_time_minutes = (unixepoch() - arrived_at) / 60.0
      WHERE id = ?
    `).run(openVisit.id);
    db.prepare(
      "UPDATE worlds SET population = MAX(0, population - 1) WHERE id = ?"
    ).run(currentWorldId);
  }

  // Open new visit
  db.prepare(
    "INSERT INTO world_visits (id, user_id, world_id) VALUES (?, ?, ?)"
  ).run(crypto.randomUUID(), userId, destinationWorldId);

  db.prepare(
    "UPDATE worlds SET population = population + 1, total_visits = total_visits + 1 WHERE id = ?"
  ).run(destinationWorldId);

  // Persist player world state
  db.prepare(`
    INSERT INTO player_world_state (user_id, world_id)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET world_id = excluded.world_id
  `).run(userId, destinationWorldId);

  // Emit socket event to destination world room
  if (io) {
    io.to(`world:${destinationWorldId}`).emit("world:player-arrived", {
      userId,
      worldId: destinationWorldId,
      at: Date.now(),
    });
  }

  return { previousWorldId: currentWorldId, worldId: destinationWorldId, world: dest };
}

/**
 * Apply a world's rule set to the player's session state.
 * Stores the active rule set as JSON in player_world_state.
 * @param {string} userId
 * @param {object} world
 * @param {import('better-sqlite3').Database} db
 */
export function applyWorldRulesToPlayer(userId, world, db) {
  const ruleSet = JSON.stringify({
    worldId:     world.id,
    rules:       world._rules      || world.rule_modulators    || {},
    physics:     world._physics    || world.physics_modulators || {},
    appliedAt:   Date.now(),
  });

  db.prepare(`
    UPDATE player_world_state
    SET client_state_json = json_patch(client_state_json, json_object('activeWorldRules', json(?)))
    WHERE user_id = ?
  `).run(ruleSet, userId);
}
