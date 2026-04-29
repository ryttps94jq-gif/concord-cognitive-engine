// server/migrations/040_emergent_communications.js
// Inter-emergent communication table.
export function up(db) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS emergent_communications (
      id TEXT PRIMARY KEY,
      from_emergent_id TEXT NOT NULL,
      to_emergent_id TEXT NOT NULL,
      intent TEXT NOT NULL,
      context TEXT,
      response TEXT,
      initiated_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
    )`,

    `CREATE INDEX IF NOT EXISTS idx_comm_from
     ON emergent_communications(from_emergent_id)`,

    `CREATE INDEX IF NOT EXISTS idx_comm_to
     ON emergent_communications(to_emergent_id)`,

    `CREATE INDEX IF NOT EXISTS idx_comm_status
     ON emergent_communications(status)`,
  ];

  for (const sql of stmts) {
    try { db.prepare(sql).run(); } catch (e) {
      if (!e?.message?.includes("already exists")) throw e;
    }
  }
}
