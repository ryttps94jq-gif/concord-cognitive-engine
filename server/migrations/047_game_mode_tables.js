export function up(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS expedition_progress (
        player_id TEXT NOT NULL,
        world_id  TEXT NOT NULL,
        visited_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player_id, world_id)
      )
    `);
  } catch (e) {
    if (!e?.message?.includes('already exists')) throw e;
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_achievements (
        player_id      TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        earned_at      INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player_id, achievement_id)
      )
    `);
  } catch (e) {
    if (!e?.message?.includes('already exists')) throw e;
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_npcs (
        id         TEXT PRIMARY KEY,
        world_id   TEXT NOT NULL,
        state_json TEXT NOT NULL DEFAULT '{}'
      )
    `);
  } catch (e) {
    if (!e?.message?.includes('already exists')) throw e;
  }
}
