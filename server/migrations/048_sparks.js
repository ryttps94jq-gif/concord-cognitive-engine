// server/migrations/048_sparks.js
// Adds the Sparks in-game currency to users. Sparks have zero real-world value,
// cannot be purchased, and are earned exclusively through gameplay.
export function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN sparks INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sparks_ledger (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        delta      INTEGER NOT NULL,
        reason     TEXT NOT NULL,
        world_id   TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
