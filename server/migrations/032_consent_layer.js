/**
 * Migration 032: Consent Layer — Nothing Leaves Without Permission
 *
 * Every action that moves user data beyond their personal universe
 * requires explicit, specific, per-action consent. Not a blanket TOS.
 * Binary. Explicit. Sovereign.
 *
 * x²-x=0 — data is either shared (1) or private (0).
 * There is no ambiguous middle state.
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- User consent records — one row per user per action
    -- Each consent is specific to a single action type
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS user_consent (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL
        CHECK (action IN (
          'publish_to_marketplace',
          'publish_to_regional',
          'publish_to_feed',
          'promote_to_national',
          'promote_to_global',
          'show_profile_regional',
          'show_profile_national',
          'show_profile_global',
          'allow_citation',
          'allow_emergent_learning',
          'allow_global_dtu_creation'
        )),
      granted INTEGER NOT NULL DEFAULT 0
        CHECK (granted IN (0, 1)),
      granted_at TEXT,
      revoked_at TEXT,
      revocable INTEGER NOT NULL DEFAULT 1
        CHECK (revocable IN (0, 1)),
      prompt_text TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, action)
    );

    CREATE INDEX IF NOT EXISTS idx_user_consent_user
      ON user_consent(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_consent_action
      ON user_consent(action, granted);

    -- ═══════════════════════════════════════════════════
    -- Consent audit log — immutable trail of every
    -- consent grant and revocation
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS consent_audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      event TEXT NOT NULL
        CHECK (event IN ('granted', 'revoked', 'anonymized', 'denied')),
      ip TEXT,
      user_agent TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_consent_audit_user
      ON consent_audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_consent_audit_action
      ON consent_audit_log(action);

    -- ═══════════════════════════════════════════════════
    -- Anonymized attributions — when user revokes consent
    -- but their DTU is cited at national/global
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS anonymized_attributions (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      original_user_id TEXT NOT NULL,
      anonymous_wallet_id TEXT NOT NULL,
      anonymized_at TEXT NOT NULL DEFAULT (datetime('now')),
      reason TEXT DEFAULT 'consent_revoked',
      UNIQUE(dtu_id)
    );

    CREATE INDEX IF NOT EXISTS idx_anon_attr_user
      ON anonymized_attributions(original_user_id);
    CREATE INDEX IF NOT EXISTS idx_anon_attr_dtu
      ON anonymized_attributions(dtu_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS anonymized_attributions;
    DROP TABLE IF EXISTS consent_audit_log;
    DROP TABLE IF EXISTS user_consent;
  `);
}
