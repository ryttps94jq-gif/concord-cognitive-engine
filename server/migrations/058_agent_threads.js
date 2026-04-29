// server/migrations/058_agent_threads.js
// Agent thread checkpointing for durable execution and resumption.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT,
      sandbox_id TEXT,
      brain_role TEXT NOT NULL DEFAULT 'conscious',
      intent TEXT,
      status TEXT NOT NULL DEFAULT 'running'
        CHECK(status IN ('running','paused','completed','failed','interrupted')),
      accumulated_state_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_checkpoint_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_threads_user
      ON agent_threads(user_id, status, last_checkpoint_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_threads_agent
      ON agent_threads(agent_id);

    CREATE TABLE IF NOT EXISTS agent_thread_checkpoints (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      node_id TEXT NOT NULL DEFAULT 'step',
      messages_json TEXT NOT NULL DEFAULT '[]',
      tool_calls_json TEXT NOT NULL DEFAULT '[]',
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES agent_threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
      ON agent_thread_checkpoints(thread_id, step_index DESC);

    CREATE TABLE IF NOT EXISTS inference_spans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inference_id TEXT NOT NULL,
      span_type TEXT NOT NULL,
      brain_used TEXT,
      model_used TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      step_count INTEGER DEFAULT 0,
      tool_name TEXT,
      lens_id TEXT,
      caller_id TEXT,
      error TEXT,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inference_spans_id
      ON inference_spans(inference_id);
    CREATE INDEX IF NOT EXISTS idx_inference_spans_brain
      ON inference_spans(brain_used, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inference_spans_type
      ON inference_spans(span_type, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inference_spans_recorded
      ON inference_spans(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inference_spans_caller
      ON inference_spans(caller_id, recorded_at DESC);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS inference_spans;
    DROP TABLE IF EXISTS agent_thread_checkpoints;
    DROP TABLE IF EXISTS agent_threads;
  `);
}
