/**
 * Migration 033: Account Lifecycle — Deletion, Disputes, Seller Verification
 *
 * Supports:
 * - ToS Section 3.3 (account deletion with balance forfeit)
 * - ToS Section 8 (marketplace disputes and refunds)
 * - Privacy Policy Section 6.4 (right to erasure)
 * - Seller verification gates
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Account deletion requests
    -- Tracks scheduled deletions (90-day balance forfeit)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
      balance_at_request REAL DEFAULT 0,
      forfeit_date TEXT,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_deletion_status
      ON account_deletion_requests(status);
    CREATE INDEX IF NOT EXISTS idx_deletion_forfeit
      ON account_deletion_requests(forfeit_date);

    -- ═══════════════════════════════════════════════════
    -- Marketplace disputes
    -- Per ToS Section 8.2
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS marketplace_disputes (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'under_review', 'resolved', 'escalated')),
      resolution_type TEXT
        CHECK (resolution_type IS NULL OR resolution_type IN (
          'refund_buyer', 'side_with_seller', 'partial_refund'
        )),
      resolved_by TEXT,
      refund_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dispute_buyer
      ON marketplace_disputes(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_dispute_seller
      ON marketplace_disputes(seller_id);
    CREATE INDEX IF NOT EXISTS idx_dispute_status
      ON marketplace_disputes(status);
  `);

  // Add ToS acceptance and email verification columns to users table
  // These are needed for seller verification gates
  try {
    db.exec("ALTER TABLE users ADD COLUMN tos_accepted_at TEXT DEFAULT NULL");
  } catch { /* column may already exist */ }

  try {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
  } catch { /* column may already exist */ }
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS marketplace_disputes;
    DROP TABLE IF EXISTS account_deletion_requests;
  `);
}
