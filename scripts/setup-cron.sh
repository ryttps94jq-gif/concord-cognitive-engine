#!/usr/bin/env bash
# Concord — Setup Automated Backup Cron + Health Check
#
# Installs cron jobs for:
#   1. Database backup every 6 hours
#   2. Health check every 5 minutes (logs failures)
#   3. Log rotation daily
#
# Usage: ./scripts/setup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Concord Cron Setup ==="

# Ensure scripts are executable
chmod +x "$SCRIPT_DIR/db-backup.sh"
chmod +x "$SCRIPT_DIR/health-check.sh" 2>/dev/null || true

# Build cron entries
CRON_MARKER="# CONCORD-AUTOMATED"
BACKUP_JOB="0 */6 * * * cd $PROJECT_ROOT && bash scripts/db-backup.sh >> data/logs/backup.log 2>&1 $CRON_MARKER"
HEALTH_JOB="*/5 * * * * cd $PROJECT_ROOT && bash scripts/health-check.sh >> data/logs/health.log 2>&1 $CRON_MARKER"
LOGROTATE_JOB="0 3 * * * cd $PROJECT_ROOT && find data/logs -name '*.log' -size +50M -exec truncate -s 10M {} \; $CRON_MARKER"

# Ensure log directory
mkdir -p "$PROJECT_ROOT/data/logs"

# Remove old Concord cron entries, add new ones
(crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true; echo "$BACKUP_JOB"; echo "$HEALTH_JOB"; echo "$LOGROTATE_JOB") | crontab -

echo "[OK] Cron jobs installed:"
echo "  - Database backup: every 6 hours"
echo "  - Health check: every 5 minutes"
echo "  - Log rotation: daily at 3 AM"
echo ""
echo "View with: crontab -l"
echo "Logs at: data/logs/backup.log, data/logs/health.log"
