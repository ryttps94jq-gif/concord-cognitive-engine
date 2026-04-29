// server/migrations/050_player_inventory.js
// Physical item inventory for players. Items here CAN be lost to PvP/death.
// DTUs and designs are NEVER here — they're in the personal locker.
export function up(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_inventory (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        item_type   TEXT NOT NULL DEFAULT 'material',
        item_id     TEXT NOT NULL,
        item_name   TEXT NOT NULL DEFAULT '',
        quantity    INTEGER NOT NULL DEFAULT 1,
        quality     INTEGER NOT NULL DEFAULT 50,
        acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_player_inv_user ON player_inventory(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_player_inv_item ON player_inventory(user_id, item_id)`);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
