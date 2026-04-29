// server/migrations/037_base6_dtu_layer.js
// Adds base-6 Refusal Algebra representation columns to the dtus table.
// Columns are populated lazily on access or via the backfill script.

export function up(db) {
  // Add columns — idempotent via try-catch
  for (const col of ["base6_representation TEXT", "semantic_layer TEXT"]) {
    try {
      db.prepare(`ALTER TABLE dtus ADD COLUMN ${col}`).run();
    } catch (e) {
      if (!e?.message?.includes("duplicate column")) throw e;
    }
  }

  // Add columns to personal_dtus too (for numeric personal DTUs)
  for (const col of ["base6_representation TEXT", "semantic_layer TEXT"]) {
    try {
      db.prepare(`ALTER TABLE personal_dtus ADD COLUMN ${col}`).run();
    } catch (e) {
      if (!e?.message?.includes("duplicate column")) throw e;
    }
  }
}

export function down(db) {
  // SQLite does not support DROP COLUMN in older versions; migration is effectively irreversible.
  // Columns remain but are unused if this migration is rolled back.
}
