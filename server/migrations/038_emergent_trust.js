// server/migrations/038_emergent_trust.js
export function up(db) {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS emergent_trust (
        emergent_id TEXT PRIMARY KEY,
        session_count INTEGER NOT NULL DEFAULT 0,
        verified_action_count INTEGER NOT NULL DEFAULT 0,
        violation_count INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
