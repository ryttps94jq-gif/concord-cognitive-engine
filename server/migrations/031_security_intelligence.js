/**
 * Migration 031 — Security Intelligence System
 *
 * Creates tables for the security intelligence layer that integrates with
 * the repair cortex. Enables ingestion of antivirus signatures, CVE feeds,
 * and codebase security patterns, plus real-time matching and event logging.
 *
 * Tables created:
 *   - security_signatures: Ingested AV/threat signatures (ClamAV, YARA, CVE, codebase)
 *   - security_codebases: Tracked security-focused repositories
 *   - security_fixes: Before/after code patterns from security commits
 *   - security_events: Real-time security event log
 */

export function up(db) {
  // ── security_signatures ──────────────────────────────────────────────────
  // Ingested antivirus/threat signatures from multiple sources.
  // Pattern matching is deterministic (regex/hash); no LLM in the hot path.
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_signatures (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL CHECK(source IN ('clamav', 'yara', 'cve_feed', 'codebase_scan', 'custom')),
      signature_type TEXT NOT NULL CHECK(signature_type IN ('malware', 'exploit', 'vulnerability', 'injection', 'misconfiguration')),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      pattern TEXT NOT NULL,
      compiled_pattern TEXT,
      pattern_hash TEXT,
      severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
      cve_id TEXT,
      cwe_id TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      match_count INTEGER NOT NULL DEFAULT 0,
      false_positive_count INTEGER NOT NULL DEFAULT 0,
      effective_rate REAL NOT NULL DEFAULT 1.0,
      deprecated INTEGER NOT NULL DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      source_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_source ON security_signatures(source)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_type ON security_signatures(signature_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_severity ON security_signatures(severity)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_cve ON security_signatures(cve_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_hash ON security_signatures(pattern_hash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_deprecated ON security_signatures(deprecated)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_sig_effective ON security_signatures(effective_rate)`);

  // ── security_codebases ───────────────────────────────────────────────────
  // Tracked security-focused repositories linked to existing code_repositories.
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_codebases (
      id TEXT PRIMARY KEY,
      repo_id TEXT,
      repo_url TEXT NOT NULL,
      name TEXT NOT NULL,
      security_focus TEXT NOT NULL CHECK(security_focus IN ('vulnerability_fix', 'security_library', 'patch_set', 'security_tool', 'av_rules')),
      license TEXT,
      license_ok INTEGER NOT NULL DEFAULT 0,
      last_scanned_at TEXT,
      last_commit_hash TEXT,
      patterns_extracted INTEGER NOT NULL DEFAULT 0,
      fixes_extracted INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_cb_focus ON security_codebases(security_focus)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_cb_active ON security_codebases(active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_cb_repo ON security_codebases(repo_id)`);

  // ── security_fixes ───────────────────────────────────────────────────────
  // Before/after code patterns extracted from security-related commits.
  // Used by the security matcher to deterministically apply known fixes.
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_fixes (
      id TEXT PRIMARY KEY,
      codebase_id TEXT,
      commit_hash TEXT,
      vulnerability_type TEXT NOT NULL,
      before_pattern TEXT NOT NULL,
      after_pattern TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'javascript',
      description TEXT DEFAULT '',
      cve_id TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      applied_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0.0,
      deprecated INTEGER NOT NULL DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (codebase_id) REFERENCES security_codebases(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_type ON security_fixes(vulnerability_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_lang ON security_fixes(language)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_cve ON security_fixes(cve_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_confidence ON security_fixes(confidence DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_success ON security_fixes(success_rate DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_codebase ON security_fixes(codebase_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_fix_deprecated ON security_fixes(deprecated)`);

  // ── security_events ──────────────────────────────────────────────────────
  // Real-time security event log — every scan, match, fix, and false positive.
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL CHECK(event_type IN ('scan_detection', 'pattern_match', 'fix_applied', 'false_positive', 'signature_update', 'cve_ingested', 'quarantine', 'alert')),
      signature_id TEXT,
      fix_id TEXT,
      target TEXT,
      target_type TEXT DEFAULT 'unknown',
      severity TEXT NOT NULL DEFAULT 'info',
      result TEXT NOT NULL DEFAULT 'logged' CHECK(result IN ('blocked', 'quarantined', 'repaired', 'allowed', 'logged', 'escalated')),
      details TEXT DEFAULT '{}',
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (signature_id) REFERENCES security_signatures(id),
      FOREIGN KEY (fix_id) REFERENCES security_fixes(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_type ON security_events(event_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_severity ON security_events(severity)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_result ON security_events(result)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_sig ON security_events(signature_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_created ON security_events(created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sec_evt_session ON security_events(session_id)`);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS security_events");
  db.exec("DROP TABLE IF EXISTS security_fixes");
  db.exec("DROP TABLE IF EXISTS security_codebases");
  db.exec("DROP TABLE IF EXISTS security_signatures");
}
