/**
 * Replace console.log/console.error in server.js with structuredLog where appropriate.
 *
 * Preserves:
 * - console.log inside structuredLog function itself (lines ~432-438)
 * - Shutdown messages (reliability concern)
 * - Startup banner (console.log `\nConcord v2...`) — cosmetic, keep as-is
 */

import fs from "fs";
import path from "path";

const serverPath = path.resolve("server.js");
let content = fs.readFileSync(serverPath, "utf-8");

// Mapping: [pattern, replacement]
const replacements = [
  // Operational: Shadow cleanup
  ['console.log(`[Shadow] Cleanup: removed ${expired} expired, ${STATE.shadowDtus.size} remaining`)',
   'structuredLog("info", "shadow_cleanup", { expired, remaining: STATE.shadowDtus.size })'],

  // Database
  ['console.log("[DB] SQLite database initialized")',
   'structuredLog("info", "db_initialized", { backend: "sqlite" })'],
  ['console.log(`[DB] Migrated ${migrated} records from JSON to SQLite`)',
   'structuredLog("info", "db_migration_complete", { migrated })'],

  // Auth
  ['console.log("[Auth] Created default admin user (username: admin)")',
   'structuredLog("info", "auth_admin_created", { username: "admin" })'],

  // Audit — use structuredLog instead of console.log for audit trail
  ['console.log(`[Audit] ${category}.${action}`, JSON.stringify(entry.details).slice(0, 200))',
   'structuredLog("info", `audit.${category}.${action}`, { details: JSON.stringify(entry.details).slice(0, 200) })'],

  // Metrics
  ['console.log("[Metrics] Prometheus metrics initialized")',
   'structuredLog("info", "metrics_initialized", { provider: "prometheus" })'],

  // Backup
  ['console.log(`[Backup] Created: ${backupPath}`)',
   'structuredLog("info", "backup_created", { path: backupPath })'],
  ['console.log(`[Backup] Restored from: ${backupPath}`)',
   'structuredLog("info", "backup_restored", { path: backupPath })'],
  ['console.log(`[Backup] Auto-backup enabled (every ${intervalHours}h)`)',
   'structuredLog("info", "autobackup_enabled", { intervalHours })'],

  // Realtime
  ['console.log(`[Realtime] Socket.IO enabled on port ${PORT}`)',
   'structuredLog("info", "socketio_enabled", { port: PORT })'],
  ['console.log(`[Realtime] Native WebSockets enabled at ws://localhost:${PORT}/ws`)',
   'structuredLog("info", "websocket_enabled", { port: PORT })'],

  // Persistence
  ['console.log("[Persistence] SQLite state backend enabled (production mode)")',
   'structuredLog("info", "persistence_backend", { backend: "sqlite", mode: "production" })'],
  ['console.log("[Persistence] State loaded from SQLite")',
   'structuredLog("info", "state_loaded", { source: "sqlite" })'],
  ['console.log("[Persistence] No SQLite snapshot yet, checking JSON for migration...")',
   'structuredLog("info", "state_migration_check", { source: "json" })'],
  ['console.log("[Persistence] Migrated JSON state to SQLite")',
   'structuredLog("info", "state_migrated", { from: "json", to: "sqlite" })'],

  // DTU loading
  ['console.log(`[DTU-Pack] Loaded ${dtus.length} DTUs from ${manifest.chunks.length} chunks`)',
   'structuredLog("info", "dtu_pack_loaded", { count: dtus.length, chunks: manifest.chunks.length })'],
  ['console.log(`[Seed] Loaded ${arr.length} DTUs from dtus.js in ${Date.now() - t0}ms`)',
   'structuredLog("info", "seed_loaded", { count: arr.length, durationMs: Date.now() - t0 })'],

  // Attachments
  ['if (cleaned > 0) console.log(`[Attachments] Cleaned ${cleaned} attachments, freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB`)',
   'if (cleaned > 0) structuredLog("info", "attachments_cleaned", { cleaned, freedMB: (freedBytes / 1024 / 1024).toFixed(1) })'],

  // Embeddings
  ['console.log("[Embeddings] @xenova/transformers not available")',
   'structuredLog("warn", "embeddings_unavailable", { reason: "transformers not installed" })'],
  ['console.log("[Embeddings] Local embedding model loaded (all-MiniLM-L6-v2)")',
   'structuredLog("info", "embeddings_loaded", { model: "all-MiniLM-L6-v2" })'],

  // LLM Pipeline
  ['console.log(`[LLM Pipeline] Initialized - Ollama: ${LLM_PIPELINE.providers.ollama.enabled ? \'enabled\' : \'disabled\'}, OpenAI: ${LLM_PIPELINE.providers.openai.enabled ? \'enabled\' : \'disabled\'}`)',
   'structuredLog("info", "llm_pipeline_initialized", { ollama: LLM_PIPELINE.providers.ollama.enabled, openai: LLM_PIPELINE.providers.openai.enabled })'],
  ['console.log("[LLM Pipeline] Ollama draft failed, falling back to OpenAI")',
   'structuredLog("warn", "llm_ollama_fallback", { reason: "draft_failed", fallback: "openai" })'],
  ['console.log("[LLM Pipeline] OpenAI polish failed, returning draft")',
   'structuredLog("warn", "llm_openai_fallback", { reason: "polish_failed", fallback: "draft" })'],

  // Plugins
  ['console.log(`[Plugins] Registered: ${plugin.name} v${registered.version}`)',
   'structuredLog("info", "plugin_registered", { name: plugin.name, version: registered.version })'],

  // LLM synthesis fallback
  ['console.log("[MEGA] LLM synthesis failed, using template:", e.message)',
   'structuredLog("warn", "mega_llm_fallback", { error: e.message })'],
  ['console.log("[HYPER] LLM synthesis failed, using template:", e.message)',
   'structuredLog("warn", "hyper_llm_fallback", { error: e.message })'],

  // Reminders
  ['if (cleaned > 0) console.log(`[Reminders] Cleaned ${cleaned} old reminders`)',
   'if (cleaned > 0) structuredLog("info", "reminders_cleaned", { cleaned })'],

  // PostgreSQL
  ['console.log("[PostgreSQL] Connected successfully")',
   'structuredLog("info", "postgres_connected")'],

  // Redis
  ['console.log("[Redis] Connected successfully")',
   'structuredLog("info", "redis_connected")'],

  // Chicken3
  ['console.log(`[Chicken3] Autonomous cron active — interval ${(ms/60000).toFixed(2)} min`)',
   'structuredLog("info", "chicken3_cron_active", { intervalMin: (ms/60000).toFixed(2) })'],
  ['console.log(`[Chicken3] Federation enabled — channel ${channel}`)',
   'structuredLog("info", "chicken3_federation_enabled", { channel })'],

  // Governor
  ['console.log(`[Governor] Heartbeat active — interval ${(ms/1000).toFixed(2)}s`)',
   'structuredLog("info", "governor_heartbeat_active", { intervalSec: (ms/1000).toFixed(2) })'],

  // Economic
  ['console.log(`[Economic] Engine initialized | Stripe: ${STRIPE_ENABLED ? \'enabled\' : \'disabled\'}`)',
   'structuredLog("info", "economic_initialized", { stripe: STRIPE_ENABLED })'],
];

// Also replace console.error patterns
const errorReplacements = [
  ['console.error("[Metrics] Failed to initialize:", e.message)',
   'structuredLog("error", "metrics_init_failed", { error: e.message })'],
];

let count = 0;
for (const [pattern, replacement] of [...replacements, ...errorReplacements]) {
  if (content.includes(pattern)) {
    content = content.replace(pattern, replacement);
    count++;
  }
}

fs.writeFileSync(serverPath, content);
console.log(`Replaced ${count} console.log/error calls with structuredLog`);
