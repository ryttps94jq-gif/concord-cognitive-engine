// Migration 034: Consolidate orphan tables + add missing tables and indexes
// These tables were created at runtime outside the migration system, or referenced
// but never created. Moving them here ensures clean migration-based deployments work.

export function up(db) {
  db.exec(`
    -- Commission system (was in economy/commission-service.js)
    CREATE TABLE IF NOT EXISTS commission_types (
      id            TEXT PRIMARY KEY,
      creator_id    TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      min_price     REAL NOT NULL,
      max_price     REAL NOT NULL,
      turnaround    TEXT,
      category      TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commission_requests (
      id                  TEXT PRIMARY KEY,
      client_id           TEXT NOT NULL,
      creator_id          TEXT NOT NULL,
      commission_type_id  TEXT,
      brief               TEXT NOT NULL,
      agreed_price        REAL NOT NULL,
      status              TEXT NOT NULL DEFAULT 'REQUESTED',
      escrow_tx_id        TEXT,
      delivered_dtu_id    TEXT,
      license_tier        TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commission_messages (
      id          TEXT PRIMARY KEY,
      request_id  TEXT NOT NULL,
      sender_id   TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    -- Global scope gates (was in economy/global-gates.js)
    CREATE TABLE IF NOT EXISTS global_submissions (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      submitter_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      gate_results_json TEXT,
      submitted_at TEXT NOT NULL,
      decided_at TEXT,
      UNIQUE(dtu_id, status)
    );
    CREATE INDEX IF NOT EXISTS idx_global_sub_dtu ON global_submissions(dtu_id);
    CREATE INDEX IF NOT EXISTS idx_global_sub_status ON global_submissions(status);

    CREATE TABLE IF NOT EXISTS global_reviews (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      reviewer_type TEXT NOT NULL DEFAULT 'council',
      action TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES global_submissions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_global_rev_sub ON global_reviews(submission_id);

    CREATE TABLE IF NOT EXISTS global_challenges (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      challenger_id TEXT NOT NULL,
      evidence TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_global_chal_dtu ON global_challenges(dtu_id);
    CREATE INDEX IF NOT EXISTS idx_global_chal_status ON global_challenges(status);

    CREATE TABLE IF NOT EXISTS global_health_log (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      details TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_global_health_dtu ON global_health_log(dtu_id);

    -- DTU licensing (was in economy/rights-enforcement.js)
    CREATE TABLE IF NOT EXISTS dtu_licenses (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      license_tier TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      tx_id TEXT,
      expires_at TEXT,
      revoked INTEGER DEFAULT 0,
      UNIQUE(dtu_id, user_id, license_tier)
    );
    CREATE INDEX IF NOT EXISTS idx_licenses_dtu ON dtu_licenses(dtu_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_user ON dtu_licenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_user_dtu ON dtu_licenses(user_id, dtu_id);

    -- Marketplace pack metadata (was in economy/routes.js)
    CREATE TABLE IF NOT EXISTS marketplace_pack_meta (
      listing_id TEXT PRIMARY KEY,
      dtu_ids_json TEXT NOT NULL,
      dtu_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- DMCA cases (was in routes/legal.js)
    CREATE TABLE IF NOT EXISTS dmca_cases (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'pending',
      claimant_name TEXT NOT NULL,
      claimant_email TEXT NOT NULL,
      claimant_address TEXT,
      copyright_work TEXT NOT NULL,
      infringing_url TEXT,
      dtu_id TEXT,
      description TEXT NOT NULL,
      good_faith_statement INTEGER DEFAULT 0,
      accuracy_statement INTEGER DEFAULT 0,
      signature TEXT NOT NULL,
      counter_respondent_name TEXT,
      counter_respondent_email TEXT,
      counter_respondent_address TEXT,
      counter_statement TEXT,
      counter_consent_to_jurisdiction INTEGER DEFAULT 0,
      counter_signature TEXT,
      resolution TEXT,
      resolution_notes TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    -- Dispute metadata (was in routes/disputes.js)
    CREATE TABLE IF NOT EXISTS dispute_metadata (
      dispute_id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      original_type TEXT NOT NULL,
      amount REAL NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT,
      seller_response_deadline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Content moderation actions (referenced in global-gates.js but NEVER created)
    CREATE TABLE IF NOT EXISTS content_moderation_actions (
      id TEXT PRIMARY KEY,
      target_user_id TEXT,
      content_id TEXT,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reason TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_moderation_user ON content_moderation_actions(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_moderation_content ON content_moderation_actions(content_id);
    CREATE INDEX IF NOT EXISTS idx_moderation_status ON content_moderation_actions(status);

    -- Royalty citations (referenced in global-gates.js but NEVER created)
    CREATE TABLE IF NOT EXISTS royalty_citations (
      id TEXT PRIMARY KEY,
      source_dtu_id TEXT NOT NULL,
      cited_by_dtu_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_citations_source ON royalty_citations(source_dtu_id);
    CREATE INDEX IF NOT EXISTS idx_citations_cited_by ON royalty_citations(cited_by_dtu_id);

    -- Missing index on sessions table (frequent lookups by user_id during auth)
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS commission_messages;
    DROP TABLE IF EXISTS commission_requests;
    DROP TABLE IF EXISTS commission_types;
    DROP INDEX IF EXISTS idx_global_sub_dtu;
    DROP INDEX IF EXISTS idx_global_sub_status;
    DROP INDEX IF EXISTS idx_global_rev_sub;
    DROP INDEX IF EXISTS idx_global_chal_dtu;
    DROP INDEX IF EXISTS idx_global_chal_status;
    DROP INDEX IF EXISTS idx_global_health_dtu;
    DROP TABLE IF EXISTS global_reviews;
    DROP TABLE IF EXISTS global_submissions;
    DROP TABLE IF EXISTS global_challenges;
    DROP TABLE IF EXISTS global_health_log;
    DROP INDEX IF EXISTS idx_licenses_dtu;
    DROP INDEX IF EXISTS idx_licenses_user;
    DROP INDEX IF EXISTS idx_licenses_user_dtu;
    DROP TABLE IF EXISTS dtu_licenses;
    DROP TABLE IF EXISTS marketplace_pack_meta;
    DROP TABLE IF EXISTS dmca_cases;
    DROP TABLE IF EXISTS dispute_metadata;
    DROP INDEX IF EXISTS idx_moderation_user;
    DROP INDEX IF EXISTS idx_moderation_content;
    DROP INDEX IF EXISTS idx_moderation_status;
    DROP TABLE IF EXISTS content_moderation_actions;
    DROP INDEX IF EXISTS idx_citations_source;
    DROP INDEX IF EXISTS idx_citations_cited_by;
    DROP TABLE IF EXISTS royalty_citations;
    DROP INDEX IF EXISTS idx_sessions_user_id;
  `);
}
