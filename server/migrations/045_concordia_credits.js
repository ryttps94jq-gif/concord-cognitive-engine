// server/migrations/045_concordia_credits.js
export function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN concordia_credits REAL NOT NULL DEFAULT 100`);
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
}
