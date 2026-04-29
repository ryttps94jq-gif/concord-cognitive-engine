// server/migrations/046_nemesis_crises.js
export function up(db) {
  const exec = (sql) => {
    try { db.exec(sql); } catch (e) {
      if (!e?.message?.includes('duplicate column') && !e?.message?.includes('already exists')) throw e;
    }
  };

  exec(`ALTER TABLE dtus ADD COLUMN last_used_at INTEGER`);

  exec(`CREATE TABLE IF NOT EXISTS nemesis_records (
    player_id   TEXT PRIMARY KEY,
    npc_id      TEXT NOT NULL,
    npc_name    TEXT,
    npc_title   TEXT,
    kill_count  INTEGER DEFAULT 1,
    last_encounter INTEGER,
    world_id    TEXT
  )`);

  exec(`CREATE TABLE IF NOT EXISTS world_crises (
    id               TEXT PRIMARY KEY,
    type             TEXT NOT NULL,
    description      TEXT,
    origin_world_id  TEXT,
    started_at       INTEGER,
    ends_at          INTEGER,
    status           TEXT DEFAULT 'active',
    resolved_by      TEXT,
    outcome          TEXT
  )`);

  exec(`CREATE TABLE IF NOT EXISTS loot_nodes (
    id          TEXT PRIMARY KEY,
    world_id    TEXT NOT NULL,
    x           REAL, y REAL, z REAL,
    contents    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    killer_id   TEXT,
    claimed_by  TEXT,
    claimed_at  INTEGER
  )`);
}
