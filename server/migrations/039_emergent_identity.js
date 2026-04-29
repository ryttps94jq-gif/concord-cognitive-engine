// server/migrations/039_emergent_identity.js
// Persistent identity, observation, task, and activity-feed tables for emergent visibility.
export function up(db) {
  const stmts = [
    // Per-emergent identity (supplements in-memory STATE.__emergent.emergents)
    `CREATE TABLE IF NOT EXISTS emergent_identity (
      emergent_id TEXT PRIMARY KEY,
      given_name TEXT,
      naming_origin TEXT,
      naming_metadata TEXT,
      current_focus TEXT,
      last_active_at INTEGER,
      identity_locked INTEGER NOT NULL DEFAULT 0
    )`,

    `CREATE INDEX IF NOT EXISTS idx_emergent_identity_name
     ON emergent_identity(given_name)`,

    // Observation log
    `CREATE TABLE IF NOT EXISTS emergent_observations (
      id TEXT PRIMARY KEY,
      emergent_id TEXT NOT NULL,
      observation TEXT NOT NULL,
      context TEXT,
      related_dtu_ids TEXT,
      created_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_emergent_obs_emergent
     ON emergent_observations(emergent_id, created_at)`,

    // Per-emergent task queue
    `CREATE TABLE IF NOT EXISTS emergent_tasks (
      id TEXT PRIMARY KEY,
      emergent_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      task_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 50,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      result TEXT
    )`,

    `CREATE INDEX IF NOT EXISTS idx_emergent_tasks_status
     ON emergent_tasks(emergent_id, status, priority)`,

    // Global activity feed
    `CREATE TABLE IF NOT EXISTS emergent_activity_feed (
      id TEXT PRIMARY KEY,
      emergent_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_emergent_feed_time
     ON emergent_activity_feed(created_at DESC)`,
  ];

  for (const sql of stmts) {
    try { db.prepare(sql).run(); } catch (e) {
      if (!e?.message?.includes("already exists")) throw e;
    }
  }
}
