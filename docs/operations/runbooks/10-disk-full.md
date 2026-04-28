# RB-10: Disk Full

**Alert:** No dedicated Prometheus alert by default — typically discovered when the server crashes, writes fail, or SQLite returns `SQLITE_FULL`; triggered by logs showing `ENOSPC: no space left on device`
**Severity:** critical
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Server crash or restart with log message: `ENOSPC: no space left on device`
- SQLite writes failing with `SQLITE_FULL` or `disk I/O error`
- File uploads returning 500 errors
- Log files stop growing (log writes silently fail)
- WAL file (`concord.db-wal`) cannot be written, causing database lock cascades
- PM2 cannot write its log files, making diagnosis harder
- `df -h` shows a filesystem at 100% usage
- All synthetic write-path checks (`api-status`, `health-db`) fail

## Immediate Actions (< 5 min)

1. Confirm disk is full:
   ```bash
   df -h /
   df -h "${DATA_DIR:-/home/user/concord-cognitive-engine/data}"
   ```
2. Find the largest disk consumers:
   ```bash
   du -sh /var/log/* 2>/dev/null | sort -rh | head -10
   du -sh "${DATA_DIR:-/home/user/concord-cognitive-engine/data}"/* 2>/dev/null | sort -rh | head -10
   du -sh /tmp/* 2>/dev/null | sort -rh | head -10
   ```
3. Immediately free the quickest wins — clear old PM2 log files:
   ```bash
   pm2 flush concord-backend
   ```
4. Truncate large rotated logs:
   ```bash
   find /var/log -name "*.gz" -mtime +7 -delete 2>/dev/null
   find /var/log -name "*.log.*" -mtime +3 -delete 2>/dev/null
   ```
5. Verify space recovered:
   ```bash
   df -h /
   ```

## Diagnosis

```bash
# --- Disk usage overview ---
df -h
df -i   # also check inode exhaustion (can cause "no space" even with free blocks)

# --- Top space consumers ---
du -sh /* 2>/dev/null | sort -rh | head -20

# --- Data directory breakdown ---
DATA="${DATA_DIR:-/home/user/concord-cognitive-engine/data}"
du -sh "$DATA"/* 2>/dev/null | sort -rh | head -20
ls -lh "$DATA"/*.db "$DATA"/*.db-wal "$DATA"/*.db-shm 2>/dev/null

# --- WAL file size (can grow large without checkpoints) ---
ls -lh "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db-wal" 2>/dev/null

# --- Log files ---
find /var/log /home -name "*.log" -size +100M 2>/dev/null | head -10
pm2 logs concord-backend --lines 1 --nostream 2>/dev/null
ls -lh ~/.pm2/logs/ 2>/dev/null | sort -k5 -rh | head -10

# --- Temporary files ---
du -sh /tmp 2>/dev/null
find /tmp -mtime +1 -size +10M 2>/dev/null | head -10

# --- Artifacts and uploads ---
find "$DATA" -name "*.bin" -o -name "*.wav" -o -name "*.mp3" -o -name "*.mp4" \
  2>/dev/null | xargs du -sh 2>/dev/null | sort -rh | head -10

# --- Node.js / npm cache ---
du -sh ~/.npm 2>/dev/null
du -sh /root/.npm 2>/dev/null

# --- Inode check ---
df -i | grep -v "Use%"
# If IUse% is near 100% even with free blocks: delete many small files (logs, temp files)

# --- Docker (if applicable) ---
docker system df 2>/dev/null
```

## Resolution Steps

### Step 1 — Emergency space recovery (fastest wins)

```bash
# Flush PM2 logs
pm2 flush

# Clear system journal logs (keep last 3 days)
sudo journalctl --vacuum-time=3d 2>/dev/null

# Remove compressed rotated logs older than 7 days
find /var/log -name "*.gz" -mtime +7 -delete 2>/dev/null
find /var/log -name "*.log.[0-9]*" -mtime +7 -delete 2>/dev/null

# Clear /tmp
find /tmp -mtime +1 -delete 2>/dev/null

# Clear npm cache
npm cache clean --force 2>/dev/null

# Check space recovered
df -h /
```

### Step 2 — SQLite WAL cleanup (if WAL is large)

```bash
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"

# Stop the server for exclusive WAL access
pm2 stop concord-backend

# Force WAL checkpoint and truncation
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1
ls -lh "$DB_PATH-wal" 2>/dev/null
# WAL file should now be 0 bytes or very small

# Optionally vacuum the main DB to reclaim freed pages
sqlite3 "$DB_PATH" "VACUUM;" 2>&1
ls -lh "$DB_PATH"

# Restart server
pm2 start ecosystem.config.cjs --only concord-backend
```

### Step 3 — Log rotation configuration

```bash
# Configure PM2 log rotation (install pm2-logrotate if not present)
pm2 install pm2-logrotate 2>/dev/null
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Configure system logrotate for the application
cat > /etc/logrotate.d/concord << 'EOF'
/home/user/concord-cognitive-engine/data/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF

# Test logrotate config
logrotate -d /etc/logrotate.d/concord 2>&1 | head -20
```

### Step 4 — Data archival for large artifact stores

```bash
DATA="${DATA_DIR:-/home/user/concord-cognitive-engine/data}"
ARCHIVE_DIR="${DATA}/archive/$(date +%Y%m)"
mkdir -p "$ARCHIVE_DIR"

# Archive artifacts older than 90 days (adjust path as appropriate)
find "$DATA/uploads" -mtime +90 -type f 2>/dev/null | while read f; do
  mv "$f" "$ARCHIVE_DIR/"
  echo "Archived: $f"
done

# Compress the archive
tar -czf "$ARCHIVE_DIR.tar.gz" "$ARCHIVE_DIR/" && rm -rf "$ARCHIVE_DIR"

# Or move to external storage (adjust destination)
# rsync -av --remove-source-files "$ARCHIVE_DIR/" user@backup-host:/backups/concord/
```

### Step 5 — Docker image and volume cleanup

```bash
# Remove dangling Docker images and stopped containers
docker system prune -f 2>/dev/null
docker image prune -a --filter "until=168h" -f 2>/dev/null  # images older than 7 days

# Check Docker volume usage
docker system df -v 2>/dev/null | head -30
```

### Step 6 — Add disk space alert to Prometheus

If this alert does not exist, add it immediately after recovery:

```yaml
# Add to monitoring/prometheus/alerts.yml:
- alert: ConcordDiskSpaceLow
  expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.15
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Disk space below 15% on /"
    description: "Available: {{ $value | humanizePercentage }}"

- alert: ConcordDiskSpaceCritical
  expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.05
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Disk space below 5% — risk of data loss"
```

### Step 7 — Restart server after space is recovered

```bash
pm2 restart concord-backend --update-env
sleep 10
curl -sf http://localhost:5050/health && echo "RECOVERED"
```

## Verification

```bash
# 1. Disk has sufficient free space (at least 20%)
df -h / | awk 'NR==2 {print "Free:", $4, "Use:", $5}'

# 2. Data directory is writable
touch "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/.write-test" \
  && rm "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/.write-test" \
  && echo "Data dir writable"

# 3. SQLite WAL file is small
ls -lh "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db-wal" 2>/dev/null || echo "No WAL file"

# 4. Server is healthy
curl -sf http://localhost:5050/health

# 5. Database is healthy
curl -s http://localhost:5050/api/health/db

# 6. Write operation succeeds
curl -s -X POST http://localhost:5050/api/dtus/durable \
  -H "Content-Type: application/json" \
  -d '{"title":"disk-recovery-test","body":{"content":"test"},"tags":["test"],"visibility":"private"}' \
  | grep -E '"id"|"error"'

# 7. Synthetic checks pass
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js
```

## Escalation

- Disk fills back up within **1 hour** of clearing: escalate to infrastructure — investigate continuous log flood or runaway file growth
- SQLite database is corrupt after disk-full event: escalate to RB-06 and involve senior data engineer
- Inode exhaustion (not block exhaustion): escalate to infrastructure engineer — may require filesystem remount or cleanup of millions of small files
- External storage mount is full: escalate to infrastructure team to expand the volume
- Data loss suspected after disk-full corruption: escalate to management and engage incident response

## Prevention

- Deploy a `node_exporter` alongside Concord and add `ConcordDiskSpaceLow` (15% free) and `ConcordDiskSpaceCritical` (5% free) Prometheus alerts (see Step 6 above)
- Configure `pm2-logrotate` with `max_size: 50M` and `retain: 7` as part of the standard deployment playbook
- Set SQLite WAL auto-checkpoint (`PRAGMA wal_autocheckpoint = 1000`) to prevent WAL accumulation
- Run `sqlite3 <db> "VACUUM;"` weekly during maintenance windows to reclaim freed pages
- Define a data retention policy: archive or delete artifacts, events, and logs older than N days on a scheduled basis
- Set upload size limits in the Express middleware (`express.json({ limit: '10mb' })`, multer limits) to prevent individual requests from exhausting disk space
- Monitor the `DATA_DIR` volume separately if it is on its own mount point, as `/` free space will not reflect it
