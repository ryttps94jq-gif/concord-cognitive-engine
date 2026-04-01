#!/usr/bin/env bash
# Concord Cognitive Engine — Local Database Backup
#
# Creates a timestamped, gzip-compressed backup of data/concord.db
# and data/concord_state.json (if present). Keeps last 10 backups.
#
# Usage:
#   ./scripts/db-backup.sh                     # backups go to ./data/backups
#   ./scripts/db-backup.sh /tmp/my-backups     # custom backup directory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATA_DIR="${DATA_DIR:-$PROJECT_ROOT/data}"
DB_PATH="$DATA_DIR/concord.db"
STATE_PATH="$DATA_DIR/concord_state.json"
BACKUP_DIR="${1:-$DATA_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETAIN_COUNT=10

mkdir -p "$BACKUP_DIR"

# --- Validate source database exists ---
if [ ! -f "$DB_PATH" ]; then
  echo "[db-backup] ERROR: Database not found at $DB_PATH"
  exit 1
fi

echo "[db-backup] Starting backup at $TIMESTAMP"
echo "[db-backup] Source DB: $DB_PATH"

# --- Create a safe copy of the database ---
STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

echo "[db-backup] Copying database..."
if command -v sqlite3 &>/dev/null; then
  # Use SQLite online backup API for a consistent snapshot
  sqlite3 "$DB_PATH" ".backup '$STAGING_DIR/concord.db'"
else
  # Fallback: direct copy (safe if WAL mode and no active writers)
  cp "$DB_PATH" "$STAGING_DIR/concord.db"
  # Also copy WAL/SHM if they exist
  [ -f "$DB_PATH-wal" ] && cp "$DB_PATH-wal" "$STAGING_DIR/concord.db-wal"
  [ -f "$DB_PATH-shm" ] && cp "$DB_PATH-shm" "$STAGING_DIR/concord.db-shm"
fi

# --- Integrity check ---
if command -v sqlite3 &>/dev/null; then
  echo "[db-backup] Verifying integrity..."
  INTEGRITY=$(sqlite3 "$STAGING_DIR/concord.db" "PRAGMA integrity_check;" 2>&1)
  if [ "$INTEGRITY" != "ok" ]; then
    echo "[db-backup] INTEGRITY CHECK FAILED: $INTEGRITY"
    exit 1
  fi
  echo "[db-backup] Integrity check: OK"
fi

# --- Copy state file if present ---
if [ -f "$STATE_PATH" ]; then
  cp "$STATE_PATH" "$STAGING_DIR/concord_state.json"
  echo "[db-backup] Including concord_state.json"
fi

# --- Compress into a single archive ---
BACKUP_NAME="concord-backup-${TIMESTAMP}.tar.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

tar -czf "$BACKUP_PATH" -C "$STAGING_DIR" .

# --- Print results ---
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "[db-backup] Backup complete: $BACKUP_PATH ($BACKUP_SIZE)"

# --- Rotate old backups (keep last $RETAIN_COUNT) ---
REMOVED=0
while IFS= read -r old_backup; do
  rm -f "$old_backup"
  REMOVED=$((REMOVED + 1))
done < <(ls -t "$BACKUP_DIR"/concord-backup-*.tar.gz 2>/dev/null | tail -n +$((RETAIN_COUNT + 1)))

if [ "$REMOVED" -gt 0 ]; then
  echo "[db-backup] Pruned $REMOVED old backup(s) (keeping $RETAIN_COUNT)"
fi

echo "[db-backup] Done."
