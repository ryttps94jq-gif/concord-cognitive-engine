// server/migrations/051_wagers.js
// Consensual duels and wagers. CC wagers require both-party acceptance before any money moves.
export function up(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS wagers (
        id               TEXT PRIMARY KEY,
        proposer_id      TEXT NOT NULL,
        opponent_id      TEXT NOT NULL,
        amount           INTEGER NOT NULL,
        currency         TEXT NOT NULL CHECK (currency IN ('sparks', 'cc')),
        duel_type        TEXT NOT NULL DEFAULT 'combat',
        status           TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'resolved', 'cancelled')),
        escrow_locked    INTEGER NOT NULL DEFAULT 0,
        winner_id        TEXT,
        world_id         TEXT,
        proposed_at      INTEGER NOT NULL DEFAULT (unixepoch()),
        accepted_at      INTEGER,
        resolved_at      INTEGER,
        expires_at       INTEGER NOT NULL,
        FOREIGN KEY (proposer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_wagers_proposer ON wagers(proposer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_wagers_opponent ON wagers(opponent_id)`);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS death_loot_bags (
        id          TEXT PRIMARY KEY,
        world_id    TEXT NOT NULL,
        x           REAL NOT NULL DEFAULT 0,
        y           REAL NOT NULL DEFAULT 0,
        z           REAL NOT NULL DEFAULT 0,
        owner_id    TEXT NOT NULL,
        killer_id   TEXT,
        sparks      INTEGER NOT NULL DEFAULT 0,
        items_json  TEXT NOT NULL DEFAULT '[]',
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        expires_at  INTEGER NOT NULL,
        claimed_by  TEXT,
        claimed_at  INTEGER,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_loot_bags_world ON death_loot_bags(world_id)`);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
