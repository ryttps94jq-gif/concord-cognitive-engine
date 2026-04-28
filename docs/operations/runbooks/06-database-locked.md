# RB-06: Database Locked / WAL Issues

**Alert:** `health-db` synthetic check returning 503 or error; application logs showing `SQLITE_BUSY`, `database is locked`, or WAL-related errors
**Severity:** critical
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Application logs contain: `SQLITE_BUSY: database is locked`, `SQLITE_LOCKED`, or `database table is locked`
- `GET /api/health/db` returns 503 with error status
- Write operations (DTU creation, artifact upload, economy transactions) failing with 500 errors
- Read operations may still work (WAL mode allows concurrent reads during a write lock)
- WAL file (`concord.db-wal`) has grown very large (> 100 MB)
- Server appears up and healthy for reads but writes are queued indefinitely
- Synthetic check `health-db` failing

## Immediate Actions (< 5 min)

1. Confirm the database health endpoint:
   ```bash
   curl -s http://localhost:5050/api/health/db
   ```
2. Check if the WAL file is unusually large:
   ```bash
   DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
   ls -lh "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null
   ```
3. Check server logs for lock errors:
   ```bash
   pm2 logs concord-backend --lines 100 --nostream | grep -iE "SQLITE|locked|busy|WAL"
   ```
4. If the lock is caused by an external process (e.g., a migration script left running), identify and stop it:
   ```bash
   fuser "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
   lsof | grep concord.db | grep -v node
   ```

## Diagnosis

```bash
# --- Database file state ---
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
ls -lh "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null

# --- WAL checkpoint status ---
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint;" 2>&1
# Output: "busy|log|checkpointed" — if busy==0 the checkpoint is not blocked

# --- Integrity check ---
sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1
# Expected: "ok"

# --- Lock holders ---
fuser "$DB_PATH" 2>/dev/null
lsof "$DB_PATH" 2>/dev/null | awk 'NR>1 {print $1, $2, $4}'

# --- Application log errors ---
pm2 logs concord-backend --lines 300 --nostream | grep -iE "sqlite|locked|busy|database|wal|transaction"

# --- Check if a migration is running ---
ps aux | grep -E "migrate|migration" | grep -v grep

# --- WAL mode is active ---
sqlite3 "$DB_PATH" "PRAGMA journal_mode;" 2>&1
# Expected: "wal"

# --- Page count and size ---
sqlite3 "$DB_PATH" "PRAGMA page_count; PRAGMA page_size; PRAGMA freelist_count;" 2>&1

# --- Active transactions visible in WAL ---
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(PASSIVE);" 2>&1
```

## Resolution Steps

### Step 1 — Attempt WAL checkpoint to flush pending writes

```bash
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"

# PASSIVE checkpoint (does not block readers)
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(PASSIVE);" 2>&1

# If passive fails or WAL is still large, try FULL
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(FULL);" 2>&1

# As a last resort, TRUNCATE (requires exclusive access — server must be stopped)
# See Step 3
```

### Step 2 — Restart Concord to clear any stuck transactions

Most SQLITE_BUSY errors are caused by application-level transactions not being committed or rolled back. A restart releases all connections.

```bash
pm2 restart concord-backend
sleep 10
# Re-check database health
curl -s http://localhost:5050/api/health/db
```

### Step 3 — Force WAL checkpoint with exclusive access (if WAL > 100 MB)

```bash
# Stop the server first
pm2 stop concord-backend

DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"

# Verify no other processes hold the database
fuser "$DB_PATH" 2>/dev/null || echo "No other processes"

# Force truncating checkpoint
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1

# Verify WAL is now small/empty
ls -lh "$DB_PATH-wal" 2>/dev/null

# Restart
pm2 start ecosystem.config.cjs --only concord-backend
```

### Step 4 — Database backup procedure (run BEFORE any recovery)

```bash
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
BACKUP_DIR="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Use SQLite's online backup API (safe even while server runs)
sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/concord_backup_$TIMESTAMP.db"
echo "Backup written to: $BACKUP_DIR/concord_backup_$TIMESTAMP.db"

# Verify the backup
sqlite3 "$BACKUP_DIR/concord_backup_$TIMESTAMP.db" "PRAGMA integrity_check;" | head -3
```

### Step 5 — Recovery from corruption (integrity_check returns errors)

```bash
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
BACKUP_DIR="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Stop server
pm2 stop concord-backend

# Try to export all data from the corrupt database
sqlite3 "$DB_PATH" ".recover" > "$BACKUP_DIR/recovered_$TIMESTAMP.sql" 2>&1
echo "Recovery SQL written to: $BACKUP_DIR/recovered_$TIMESTAMP.sql"

# Create a new clean database from the recovered SQL
sqlite3 "$BACKUP_DIR/concord_recovered_$TIMESTAMP.db" < "$BACKUP_DIR/recovered_$TIMESTAMP.sql"
sqlite3 "$BACKUP_DIR/concord_recovered_$TIMESTAMP.db" "PRAGMA integrity_check;"

# If recovered DB is clean, replace the original
cp "$DB_PATH" "$BACKUP_DIR/concord_corrupt_$TIMESTAMP.db"  # keep original as evidence
cp "$BACKUP_DIR/concord_recovered_$TIMESTAMP.db" "$DB_PATH"
rm -f "$DB_PATH-wal" "$DB_PATH-shm"

# Restart server
pm2 start ecosystem.config.cjs --only concord-backend
```

### Step 6 — Enable WAL auto-checkpoint tuning (permanent fix)

If checkpoints are not happening automatically, ensure the app configures `PRAGMA wal_autocheckpoint`:

```bash
# Verify current autocheckpoint setting
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" \
  "PRAGMA wal_autocheckpoint;" 2>&1
# Expected: 1000 (checkpoint after every 1000 pages = ~4 MB by default)
# If 0, autocheckpoint is disabled — enable it in the application's DB init code
```

## Verification

```bash
# 1. Database health endpoint returns OK
curl -s http://localhost:5050/api/health/db | grep '"status"'

# 2. Integrity check passes
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" "PRAGMA integrity_check;" | grep -c "^ok$"

# 3. WAL file is small (< 10 MB)
ls -lh "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db-wal" 2>/dev/null

# 4. Write operation succeeds
curl -s -X POST http://localhost:5050/api/dtus/durable \
  -H "Content-Type: application/json" \
  -d '{"title":"lock-test","body":{"content":"test"},"tags":["test"],"visibility":"private"}' \
  | grep -E '"id"|"error"'

# 5. Synthetic check passes
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js 2>&1 | grep health-db
```

## Escalation

- Integrity check reports corruption after recovery attempt: escalate immediately to senior data engineer — restore from most recent clean backup
- Lock held by an unknown external process (not the Concord server): escalate to security team to investigate unauthorized DB access
- WAL grows back to > 100 MB within minutes of checkpoint: escalate to application engineer — likely a large transaction not being committed
- Data loss confirmed after recovery: escalate to management and notify affected users per incident response policy

## Prevention

- Configure `PRAGMA wal_autocheckpoint = 1000` (default) at application startup; do not disable it
- Set `busy_timeout = 5000` (5 seconds) in the SQLite connection so the app retries rather than immediately throwing `SQLITE_BUSY`
- Ensure all database transactions use `try/finally` to guarantee rollback on error — uncommitted transactions are the primary cause of SQLITE_BUSY
- Run nightly backups using `sqlite3 .backup` and store off-host
- Monitor WAL file size with a Prometheus metric or file-size alert; checkpoint proactively when WAL exceeds 50 MB
- Never run manual SQLite CLI sessions against the production database while the server is running without a plan to release the connection
