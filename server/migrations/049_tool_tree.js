// server/migrations/049_tool_tree.js
// Tool tier progression — prevents spec abuse. Players must craft lower-tier tools
// before they can build higher-tier items.
export function up(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tool_recipes (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL,
        description          TEXT NOT NULL DEFAULT '',
        tier                 INTEGER NOT NULL CHECK (tier BETWEEN 0 AND 4),
        required_tool_tier   INTEGER NOT NULL DEFAULT 0,
        required_skill_level REAL NOT NULL DEFAULT 0,
        materials_json       TEXT NOT NULL DEFAULT '[]',
        output_quality       INTEGER NOT NULL DEFAULT 50,
        created_at           INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_tools (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        recipe_id  TEXT NOT NULL,
        quality    INTEGER NOT NULL DEFAULT 50,
        acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES tool_recipes(id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_player_tools_user ON player_tools(user_id)`);
  } catch (e) {
    if (!e?.message?.includes("already exists")) throw e;
  }
}
