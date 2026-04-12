/**
 * Concord City — Live Co-Presence System
 *
 * Tracks user positions in cities and broadcasts nearby positions
 * via WebSocket so avatars appear in real-time for all users.
 *
 * Spatial chunking (100x100m) keeps lookups efficient even with
 * thousands of concurrent users per city.
 */

import { randomUUID } from "crypto";
import logger from "../logger.js";

// ── State ───────────────────────────────────────────────────────────────────

/** userId -> { cityId, x, y, z, direction, action, lastUpdate, avatar, dirty } */
const _userPositions = new Map();

/** "${cityId}:${chunkX}:${chunkZ}" -> Set<userId> */
const _cityChunks = new Map();

/** Pluggable DB handle + fireTrigger hook set by server.js at startup. */
let _db = null;
let _fireTrigger = null;
let _flushTimer = null;

const CHUNK_SIZE = 100; // metres per chunk edge
const MAX_VISIBLE_AVATARS = 100;
const FLUSH_INTERVAL_MS = 30_000; // persist dirty positions every 30s

/**
 * Inject persistence and trigger hooks. Called once at server startup.
 * Passing `null` for either disables that side-effect (useful for tests).
 *
 * @param {object} opts
 * @param {object} [opts.db]          - better-sqlite3 handle with the
 *                                      035_player_world_state migration.
 * @param {Function} [opts.fireTrigger] - (cityId, triggerId, ctx) => void
 *                                      from world-mechanics.js.
 */
export function configurePresence({ db = null, fireTrigger = null } = {}) {
  _db = db;
  _fireTrigger = fireTrigger;
}

/**
 * Load a player's last-saved position from SQLite and seed the
 * in-memory map. Called on first authenticated socket connect /
 * first HTTP presence ping so users land back where they logged out.
 *
 * @param {string} userId
 * @returns {object|null} Restored position or null if nothing saved.
 */
export function loadPlayerState(userId) {
  if (!_db || !userId) return null;
  try {
    const row = _db.prepare(
      `SELECT user_id, city_id, district_id, x, y, z, rotation, direction,
              current_animation, action, health, max_health, stamina, max_stamina,
              client_state_json, last_seen_at
         FROM player_world_state WHERE user_id = ?`
    ).get(userId);
    if (!row) return null;
    const entry = {
      cityId: row.city_id,
      districtId: row.district_id || null,
      x: row.x,
      y: row.y,
      z: row.z,
      direction: row.direction || 0,
      rotation: row.rotation || 0,
      action: row.action || "idle",
      currentAnimation: row.current_animation || "idle",
      health: row.health,
      maxHealth: row.max_health,
      stamina: row.stamina,
      maxStamina: row.max_stamina,
      clientState: (() => { try { return JSON.parse(row.client_state_json || "{}"); } catch { return {}; } })(),
      lastUpdate: Date.now(),
      dirty: false,
    };
    _userPositions.set(userId, entry);
    addToChunk(userId, entry.cityId, toChunk(entry.x), toChunk(entry.z));
    return entry;
  } catch (err) {
    logger.warn?.("city-presence", `loadPlayerState failed for ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Flush all dirty (modified since last save) positions to SQLite.
 * Called periodically by the flush timer and on each disconnect.
 * Upsert-by-user-id so it's idempotent.
 */
export function flushDirtyPositions() {
  if (!_db || _userPositions.size === 0) return { flushed: 0 };
  let flushed = 0;
  try {
    const stmt = _db.prepare(`
      INSERT INTO player_world_state
        (user_id, city_id, district_id, x, y, z, rotation, direction,
         current_animation, action, health, max_health, stamina, max_stamina,
         chunk_x, chunk_z, client_state_json, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        city_id          = excluded.city_id,
        district_id      = excluded.district_id,
        x                = excluded.x,
        y                = excluded.y,
        z                = excluded.z,
        rotation         = excluded.rotation,
        direction        = excluded.direction,
        current_animation = excluded.current_animation,
        action           = excluded.action,
        health           = excluded.health,
        max_health       = excluded.max_health,
        stamina          = excluded.stamina,
        max_stamina      = excluded.max_stamina,
        chunk_x          = excluded.chunk_x,
        chunk_z          = excluded.chunk_z,
        client_state_json = excluded.client_state_json,
        last_seen_at     = excluded.last_seen_at
    `);
    const tx = _db.transaction(() => {
      for (const [userId, pos] of _userPositions) {
        if (!pos.dirty) continue;
        stmt.run(
          userId,
          pos.cityId || "concordia-central",
          pos.districtId || null,
          pos.x || 0,
          pos.y || 0,
          pos.z || 0,
          pos.rotation || 0,
          pos.direction || 0,
          pos.currentAnimation || "idle",
          pos.action || "idle",
          pos.health ?? 100,
          pos.maxHealth ?? 100,
          pos.stamina ?? 100,
          pos.maxStamina ?? 100,
          toChunk(pos.x || 0),
          toChunk(pos.z || 0),
          JSON.stringify(pos.clientState || {}),
        );
        pos.dirty = false;
        flushed++;
      }
    });
    tx();
  } catch (err) {
    logger.warn?.("city-presence", `flushDirtyPositions failed: ${err.message}`);
  }
  return { flushed };
}

/**
 * Persist a player immediately (e.g. on disconnect). Wraps
 * flushDirtyPositions for a single user.
 */
export function persistPlayer(userId) {
  const pos = _userPositions.get(userId);
  if (pos) pos.dirty = true;
  return flushDirtyPositions();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function chunkKey(cityId, chunkX, chunkZ) {
  return `${cityId}:${chunkX}:${chunkZ}`;
}

function toChunk(coord) {
  return Math.floor(coord / CHUNK_SIZE);
}

function removeFromChunk(userId, cityId, chunkX, chunkZ) {
  const key = chunkKey(cityId, chunkX, chunkZ);
  const set = _cityChunks.get(key);
  if (set) {
    set.delete(userId);
    if (set.size === 0) _cityChunks.delete(key);
  }
}

function addToChunk(userId, cityId, chunkX, chunkZ) {
  const key = chunkKey(cityId, chunkX, chunkZ);
  let set = _cityChunks.get(key);
  if (!set) {
    set = new Set();
    _cityChunks.set(key, set);
  }
  set.add(userId);
}

function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Update a user's position in the city. Handles chunk migration when the
 * user crosses a chunk boundary.
 *
 * @param {string} userId
 * @param {{ cityId: string, x: number, y: number, z: number, direction: number, action: string }} pos
 * @returns {{ nearby: object[] }} Nearby user positions after the update.
 */
export function updateUserPosition(userId, { cityId, x, y, z, direction, action, rotation, currentAnimation, districtId }) {
  const prev = _userPositions.get(userId);
  const newChunkX = toChunk(x);
  const newChunkZ = toChunk(z);
  let chunkCrossed = false;
  let cityChanged = false;

  // Remove from old chunk if city or chunk changed
  if (prev) {
    const oldChunkX = toChunk(prev.x);
    const oldChunkZ = toChunk(prev.z);
    if (prev.cityId !== cityId || oldChunkX !== newChunkX || oldChunkZ !== newChunkZ) {
      removeFromChunk(userId, prev.cityId, oldChunkX, oldChunkZ);
      addToChunk(userId, cityId, newChunkX, newChunkZ);
      chunkCrossed = true;
      cityChanged = prev.cityId !== cityId;
    }
  } else {
    addToChunk(userId, cityId, newChunkX, newChunkZ);
    chunkCrossed = true;
  }

  const entry = {
    cityId,
    districtId: districtId ?? prev?.districtId ?? null,
    x,
    y,
    z,
    direction: direction ?? prev?.direction ?? 0,
    rotation: rotation ?? prev?.rotation ?? 0,
    action: action ?? prev?.action ?? "idle",
    currentAnimation: currentAnimation ?? prev?.currentAnimation ?? "idle",
    health: prev?.health ?? 100,
    maxHealth: prev?.maxHealth ?? 100,
    stamina: prev?.stamina ?? 100,
    maxStamina: prev?.maxStamina ?? 100,
    clientState: prev?.clientState ?? {},
    lastUpdate: Date.now(),
    dirty: true, // mark for next flush
    avatar: prev?.avatar ?? null,
  };
  _userPositions.set(userId, entry);

  // Fire world-mechanics triggers when the player crosses a chunk
  // (or city) boundary. The hook is optional — tests and stand-alone
  // uses of this module just skip it. `_fireTrigger` is set at server
  // startup via configurePresence({ fireTrigger }).
  if (chunkCrossed && _fireTrigger) {
    try {
      if (cityChanged && prev) {
        _fireTrigger(prev.cityId, "player_leaves_zone", {
          userId,
          zoneId: `${prev.cityId}:${toChunk(prev.x)}:${toChunk(prev.z)}`,
        });
      }
      _fireTrigger(cityId, "player_enters_zone", {
        userId,
        zoneId: `${cityId}:${newChunkX}:${newChunkZ}`,
        districtId: entry.districtId,
      });
    } catch (err) {
      logger.debug?.("city-presence", `fireTrigger failed: ${err.message}`);
    }
  }

  const nearby = getNearbyUsers(userId);
  return { nearby, chunkCrossed };
}

/**
 * Get a user's current position record.
 * @param {string} userId
 * @returns {object|undefined}
 */
export function getUserPosition(userId) {
  return _userPositions.get(userId);
}

/**
 * Get all users within `radius` metres of the given user in the same city.
 *
 * @param {string} userId
 * @param {number} [radius=500]
 * @returns {object[]}
 */
export function getNearbyUsers(userId, radius = 500) {
  const pos = _userPositions.get(userId);
  if (!pos) return [];

  const radiusSq = radius * radius;
  const chunkRadius = Math.ceil(radius / CHUNK_SIZE);
  const cx = toChunk(pos.x);
  const cz = toChunk(pos.z);

  const results = [];

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const key = chunkKey(pos.cityId, cx + dx, cz + dz);
      const set = _cityChunks.get(key);
      if (!set) continue;
      for (const uid of set) {
        if (uid === userId) continue;
        const other = _userPositions.get(uid);
        if (!other || other.cityId !== pos.cityId) continue;
        if (distanceSq(pos, other) <= radiusSq) {
          results.push({
            userId: uid,
            x: other.x,
            y: other.y,
            z: other.z,
            direction: other.direction,
            action: other.action,
            avatar: other.avatar,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Count how many users are currently in a city.
 * @param {string} cityId
 * @returns {number}
 */
export function getCityUserCount(cityId) {
  let count = 0;
  for (const [, pos] of _userPositions) {
    if (pos.cityId === cityId) count++;
  }
  return count;
}

/**
 * Remove a user from the presence system (on disconnect / leave).
 * Persists their final position to SQLite before dropping them from
 * the in-memory map, so they land back in the same spot next login.
 * @param {string} userId
 */
export function removeUser(userId) {
  const pos = _userPositions.get(userId);
  if (pos) {
    // Final persist before dropping — mark dirty and flush just this user
    pos.dirty = true;
    flushDirtyPositions();
    removeFromChunk(userId, pos.cityId, toChunk(pos.x), toChunk(pos.z));
    _userPositions.delete(userId);
    logger.debug("city-presence", `User ${userId} removed from presence`);
  }
}

/**
 * Get the set of user IDs in a specific chunk.
 * @param {string} cityId
 * @param {number} chunkX
 * @param {number} chunkZ
 * @returns {Set<string>}
 */
export function getChunkUsers(cityId, chunkX, chunkZ) {
  return _cityChunks.get(chunkKey(cityId, chunkX, chunkZ)) ?? new Set();
}

/**
 * Broadcast position updates for every occupied chunk in a city.
 * Caps at MAX_VISIBLE_AVATARS per chunk — furthest users are dropped first.
 *
 * @param {string} cityId
 * @param {(event: string, data: object) => void} realtimeEmit
 */
export function broadcastPositions(cityId, realtimeEmit) {
  const visited = new Set();

  for (const [key, userSet] of _cityChunks) {
    if (visited.has(key)) continue;
    if (!key.startsWith(`${cityId}:`)) continue;
    visited.add(key);

    const parts = key.split(":");
    const chunkX = Number(parts[1]);
    const chunkZ = Number(parts[2]);

    let users = [];
    for (const uid of userSet) {
      const p = _userPositions.get(uid);
      if (!p) continue;
      users.push({
        userId: uid,
        x: p.x,
        y: p.y,
        z: p.z,
        direction: p.direction,
        action: p.action,
        avatar: p.avatar,
        displayName: uid, // caller may enrich later
      });
    }

    // Cap visible avatars — keep closest to chunk centre
    if (users.length > MAX_VISIBLE_AVATARS) {
      const centreX = (chunkX + 0.5) * CHUNK_SIZE;
      const centreZ = (chunkZ + 0.5) * CHUNK_SIZE;
      users.sort((a, b) => {
        const da = (a.x - centreX) ** 2 + (a.z - centreZ) ** 2;
        const db = (b.x - centreX) ** 2 + (b.z - centreZ) ** 2;
        return da - db;
      });
      users = users.slice(0, MAX_VISIBLE_AVATARS);
    }

    if (users.length === 0) continue;

    realtimeEmit("city:positions", {
      cityId,
      chunk: { x: chunkX, z: chunkZ },
      users,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Start periodic position broadcasts for all occupied cities.
 *
 * @param {(event: string, data: object) => void} realtimeEmit
 * @param {number} [intervalMs=100]
 * @returns {() => void} Cleanup function to stop broadcasting.
 */
export function startPresenceBroadcast(realtimeEmit, intervalMs = 100) {
  // Collect distinct cityIds on each tick
  const timer = setInterval(() => {
    const cities = new Set();
    for (const [, pos] of _userPositions) {
      cities.add(pos.cityId);
    }
    for (const cityId of cities) {
      broadcastPositions(cityId, realtimeEmit);
    }
  }, intervalMs);

  // Periodic flush of dirty positions to SQLite — survives restart.
  if (!_flushTimer && _db) {
    _flushTimer = setInterval(() => {
      try {
        flushDirtyPositions();
      } catch (err) {
        logger.warn?.("city-presence", `periodic flush failed: ${err.message}`);
      }
    }, FLUSH_INTERVAL_MS);
    _flushTimer.unref?.();
  }

  logger.info("city-presence", `Presence broadcast started (${intervalMs}ms interval, flush every ${FLUSH_INTERVAL_MS}ms)`);

  return () => {
    clearInterval(timer);
    if (_flushTimer) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
    // Final flush so any in-flight positions land on disk
    try { flushDirtyPositions(); } catch (_e) { /* shutdown, don't care */ }
    logger.info("city-presence", "Presence broadcast stopped");
  };
}

/**
 * Return aggregate presence statistics.
 * @returns {{ totalOnline: number, byCityCount: Map<string, number> }}
 */
export function getPresenceStats() {
  const byCityCount = new Map();
  for (const [, pos] of _userPositions) {
    byCityCount.set(pos.cityId, (byCityCount.get(pos.cityId) || 0) + 1);
  }
  return {
    totalOnline: _userPositions.size,
    byCityCount,
  };
}
