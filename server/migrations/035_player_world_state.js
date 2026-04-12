/**
 * Migration 035: Player World State
 *
 * Persists the MMO's per-player position, inventory, and session state
 * so `city-presence.js` has something to rehydrate on login and flush
 * on disconnect. Before this migration, every sim* Map in
 * routes/world.js was in-memory only — server restart wiped
 * everything. After this migration, players land back where they
 * logged off with their inventory intact.
 *
 * Tables
 * ------
 * player_world_state  — one row per user; their current position,
 *                       chunk, HP, stamina, facing direction, and a
 *                       JSON blob of whatever transient state the
 *                       client wants to round-trip (action, outfit).
 *
 * player_inventory    — one row per (user, item); quantity + slot.
 *                       Uses a composite primary key so upserts
 *                       just `ON CONFLICT UPDATE` naturally.
 *
 * world_events_log    — append-only log of world events (mechanic
 *                       firings, zone entries, combat outcomes) for
 *                       replay / audit. Matches the shape of what
 *                       world-mechanics.fireTrigger() returns so the
 *                       existing code can insert directly.
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Player position + avatar state
    -- One row per user. Upsert on every save flush.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS player_world_state (
      user_id          TEXT PRIMARY KEY,
      city_id          TEXT NOT NULL DEFAULT 'concordia-central',
      district_id      TEXT,
      x                REAL DEFAULT 0,
      y                REAL DEFAULT 0,
      z                REAL DEFAULT 0,
      rotation         REAL DEFAULT 0,
      direction        REAL DEFAULT 0,
      chunk_x          INTEGER,
      chunk_z          INTEGER,
      current_animation TEXT DEFAULT 'idle',
      action           TEXT,
      health           INTEGER DEFAULT 100,
      max_health       INTEGER DEFAULT 100,
      stamina          INTEGER DEFAULT 100,
      max_stamina      INTEGER DEFAULT 100,
      -- Opaque JSON bag for client-side state (outfit, equipped weapon, ...)
      client_state_json TEXT DEFAULT '{}',
      last_seen_at     TEXT NOT NULL DEFAULT (datetime('now')),
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_player_world_state_city
      ON player_world_state(city_id);
    CREATE INDEX IF NOT EXISTS idx_player_world_state_chunk
      ON player_world_state(city_id, chunk_x, chunk_z);
    CREATE INDEX IF NOT EXISTS idx_player_world_state_last_seen
      ON player_world_state(last_seen_at);

    -- ═══════════════════════════════════════════════════
    -- Player inventory
    -- Composite key so upsert logic is clean.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS player_inventory (
      user_id     TEXT NOT NULL,
      item_id     TEXT NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 0,
      slot        TEXT,          -- 'head', 'chest', 'weapon', 'bag-1', ...
      metadata    TEXT DEFAULT '{}',
      acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_player_inventory_user
      ON player_inventory(user_id);

    -- ═══════════════════════════════════════════════════
    -- World event log (append-only, bounded via caller)
    -- Shape matches world-mechanics.fireTrigger() output so
    -- fired events can be logged directly without a translator.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS world_events_log (
      id          TEXT PRIMARY KEY,
      city_id     TEXT NOT NULL,
      user_id     TEXT,              -- nullable for world events
      trigger_id  TEXT NOT NULL,
      mechanic_id TEXT,
      action      TEXT,
      reward      TEXT,
      context_json TEXT DEFAULT '{}',
      fired_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_world_events_city
      ON world_events_log(city_id, fired_at);
    CREATE INDEX IF NOT EXISTS idx_world_events_user
      ON world_events_log(user_id, fired_at);
    CREATE INDEX IF NOT EXISTS idx_world_events_trigger
      ON world_events_log(trigger_id, fired_at);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_world_events_trigger;
    DROP INDEX IF EXISTS idx_world_events_user;
    DROP INDEX IF EXISTS idx_world_events_city;
    DROP TABLE IF EXISTS world_events_log;

    DROP INDEX IF EXISTS idx_player_inventory_user;
    DROP TABLE IF EXISTS player_inventory;

    DROP INDEX IF EXISTS idx_player_world_state_last_seen;
    DROP INDEX IF EXISTS idx_player_world_state_chunk;
    DROP INDEX IF EXISTS idx_player_world_state_city;
    DROP TABLE IF EXISTS player_world_state;
  `);
}
