// server/migrations/057_sandbox_workspaces.js
// Sandbox agent workspaces — isolated filesystem environments per agent session.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sandbox_workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT,
      thread_id TEXT,
      name TEXT NOT NULL DEFAULT 'workspace',
      status TEXT NOT NULL DEFAULT 'creating'
        CHECK(status IN ('creating','ready','running','paused','terminated')),
      sandbox_type TEXT NOT NULL DEFAULT 'browser'
        CHECK(sandbox_type IN ('browser','desktop','code','general')),
      config_json TEXT NOT NULL DEFAULT '{}',
      filesystem_snapshot TEXT,
      browser_session_id TEXT,
      entry_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
      terminated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sandbox_user
      ON sandbox_workspaces(user_id, status, last_active_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sandbox_thread
      ON sandbox_workspaces(thread_id);
    CREATE INDEX IF NOT EXISTS idx_sandbox_agent
      ON sandbox_workspaces(agent_id);

    CREATE TABLE IF NOT EXISTS sandbox_actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_args_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      error TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES sandbox_workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sandbox_actions_workspace
      ON sandbox_actions(workspace_id, created_at DESC);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS sandbox_actions;
    DROP TABLE IF EXISTS sandbox_workspaces;
  `);
}
