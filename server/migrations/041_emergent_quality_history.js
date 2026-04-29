// server/migrations/041_emergent_quality_history.js
export function up(db) {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS emergent_quality_history (
        id TEXT PRIMARY KEY,
        emergent_id TEXT NOT NULL,
        task_id TEXT,
        artifact_id TEXT,
        decision TEXT NOT NULL,
        quality_score REAL NOT NULL DEFAULT 0,
        stages_json TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_eqh_emergent_id ON emergent_quality_history(emergent_id)
    `).run();
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_eqh_created_at ON emergent_quality_history(created_at)
    `).run();
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
