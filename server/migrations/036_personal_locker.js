// server/migrations/036_personal_locker.js
// Personal DTU Locker: adds locker_salt to users and creates personal_dtus table.

export function up(db) {
  // Each user gets a unique random salt for locker key derivation.
  // The key itself is never stored — derived at login from password + salt.
  db.prepare("ALTER TABLE users ADD COLUMN locker_salt TEXT").run();
  db.prepare("UPDATE users SET locker_salt = hex(randomblob(32)) WHERE locker_salt IS NULL").run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS personal_dtus (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      lens_domain  TEXT,
      content_type TEXT NOT NULL,
      title        TEXT,
      encrypted_content BLOB NOT NULL,
      iv           BLOB NOT NULL,
      auth_tag     BLOB NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare("CREATE INDEX IF NOT EXISTS idx_personal_dtus_user ON personal_dtus(user_id)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_personal_dtus_user_lens ON personal_dtus(user_id, lens_domain)").run();
}

export function down(db) {
  db.prepare("DROP TABLE IF EXISTS personal_dtus").run();
}
