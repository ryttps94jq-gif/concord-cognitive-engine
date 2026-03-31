#!/usr/bin/env bash
# Concord Cognitive Engine — Schema Export
#
# Exports the current database schema to server/migrations/schema-export.sql.
# Uses sqlite3 CLI if available, otherwise falls back to Node.js with better-sqlite3.
#
# Usage:
#   ./scripts/db-export-schema.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATA_DIR="${DATA_DIR:-$PROJECT_ROOT/data}"
DB_PATH="$DATA_DIR/concord.db"
OUTPUT_DIR="$PROJECT_ROOT/server/migrations"
OUTPUT_FILE="$OUTPUT_DIR/schema-export.sql"

# --- Validate database exists ---
if [ ! -f "$DB_PATH" ]; then
  echo "[db-export-schema] ERROR: Database not found at $DB_PATH"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "[db-export-schema] Exporting schema from $DB_PATH"

if command -v sqlite3 &>/dev/null; then
  # --- Primary method: sqlite3 CLI ---
  echo "[db-export-schema] Using sqlite3 CLI"
  {
    echo "-- Concord Cognitive Engine — Schema Export"
    echo "-- Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "-- Source: $DB_PATH"
    echo ""
    sqlite3 "$DB_PATH" ".schema"
  } > "$OUTPUT_FILE"
else
  # --- Fallback: Node.js with better-sqlite3 ---
  echo "[db-export-schema] sqlite3 CLI not found, falling back to Node.js + better-sqlite3"

  node -e "
    import Database from 'better-sqlite3';
    import fs from 'fs';

    const db = new Database('$DB_PATH', { readonly: true });
    const rows = db.prepare(\"SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type DESC, name\").all();
    db.close();

    const header = [
      '-- Concord Cognitive Engine — Schema Export',
      '-- Generated: ' + new Date().toISOString(),
      '-- Source: $DB_PATH',
      ''
    ].join('\n');

    const schema = rows.map(r => r.sql + ';').join('\n\n');
    fs.writeFileSync('$OUTPUT_FILE', header + schema + '\n');
  "
fi

LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
echo "[db-export-schema] Exported to $OUTPUT_FILE ($LINE_COUNT lines)"
echo "[db-export-schema] Done."
