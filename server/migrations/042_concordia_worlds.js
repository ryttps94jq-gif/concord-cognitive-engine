// server/migrations/042_concordia_worlds.js
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worlds (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL,
      universe_type        TEXT NOT NULL,
      description          TEXT,
      substrate_dtu_ids    TEXT DEFAULT '[]',
      physics_modulators   TEXT DEFAULT '{}',
      rule_modulators      TEXT DEFAULT '{}',
      created_by           TEXT,
      created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
      population           INTEGER NOT NULL DEFAULT 0,
      total_visits         INTEGER NOT NULL DEFAULT 0,
      npc_count            INTEGER NOT NULL DEFAULT 0,
      user_creation_count  INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS world_substrate_dtus (
      id             TEXT PRIMARY KEY,
      world_id       TEXT NOT NULL,
      dtu_id         TEXT NOT NULL,
      substrate_role TEXT NOT NULL DEFAULT 'element',
      added_at       INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_wsd_world ON world_substrate_dtus(world_id);

    CREATE TABLE IF NOT EXISTS world_npcs (
      id                TEXT PRIMARY KEY,
      world_id          TEXT NOT NULL,
      npc_emergent_id   TEXT,
      npc_type          TEXT NOT NULL DEFAULT 'generic',
      spawn_location    TEXT DEFAULT '{}',
      current_location  TEXT DEFAULT '{}',
      state             TEXT DEFAULT '{}',
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      last_tick_at      INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_world_npcs_world ON world_npcs(world_id);

    CREATE TABLE IF NOT EXISTS world_visits (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      world_id        TEXT NOT NULL,
      arrived_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      departed_at     INTEGER,
      total_time_minutes REAL
    );
    CREATE INDEX IF NOT EXISTS idx_world_visits_user  ON world_visits(user_id, arrived_at);
    CREATE INDEX IF NOT EXISTS idx_world_visits_world ON world_visits(world_id, arrived_at);

    CREATE TABLE IF NOT EXISTS world_quests (
      id             TEXT PRIMARY KEY,
      world_id       TEXT NOT NULL,
      giver_npc_id   TEXT,
      title          TEXT NOT NULL,
      description    TEXT,
      objectives_json TEXT DEFAULT '[]',
      reward_json    TEXT DEFAULT '{}',
      status         TEXT NOT NULL DEFAULT 'available',
      created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      accepted_by    TEXT,
      completed_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_world_quests_world  ON world_quests(world_id, status);
    CREATE INDEX IF NOT EXISTS idx_world_quests_player ON world_quests(accepted_by);

    CREATE TABLE IF NOT EXISTS world_emergent_affinity (
      emergent_id          TEXT NOT NULL,
      world_id             TEXT NOT NULL,
      affinity_level       REAL NOT NULL DEFAULT 0,
      specialization_tags  TEXT DEFAULT '[]',
      active_since         INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (emergent_id, world_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wea_world ON world_emergent_affinity(world_id);

    CREATE TABLE IF NOT EXISTS skill_listings (
      id                   TEXT PRIMARY KEY,
      seller_id            TEXT NOT NULL,
      skill_dtu_id         TEXT NOT NULL,
      origin_world_id      TEXT NOT NULL DEFAULT 'concordia-hub',
      price_cc             REAL NOT NULL DEFAULT 0,
      description          TEXT,
      effectiveness_ratings TEXT DEFAULT '{}',
      listed_at            INTEGER NOT NULL DEFAULT (unixepoch()),
      status               TEXT NOT NULL DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_skill_listings_seller ON skill_listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_skill_listings_status ON skill_listings(status, listed_at);
  `);

  // Extend player_world_state with world_id — safe if column already exists
  try {
    db.exec(`ALTER TABLE player_world_state ADD COLUMN world_id TEXT DEFAULT 'concordia-hub'`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_pws_world ON player_world_state(world_id)`);
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS skill_listings;
    DROP TABLE IF EXISTS world_emergent_affinity;
    DROP TABLE IF EXISTS world_quests;
    DROP TABLE IF EXISTS world_visits;
    DROP TABLE IF EXISTS world_npcs;
    DROP TABLE IF EXISTS world_substrate_dtus;
    DROP TABLE IF EXISTS worlds;
  `);
}
