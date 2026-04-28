# RB-04: No Heartbeat

**Alert:** `ConcordNoHeartbeat` — `rate(concord_heartbeat_tick_total[5m]) == 0` for 3 minutes
**Severity:** critical
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Prometheus alert `ConcordNoHeartbeat` firing
- `rate(concord_heartbeat_tick_total[5m])` has dropped to zero
- The process appears to be running (so `ConcordServerDown` may NOT fire simultaneously) but is unresponsive or hung
- HTTP requests to `/health` time out or hang without returning
- `/metrics` endpoint stops updating (stale timestamps in Prometheus)
- Node.js event loop is blocked — no new requests are being processed
- WebSocket clients may still show as "connected" but not receiving events
- PM2 reports the process as `online` even though it is functionally dead

## Immediate Actions (< 5 min)

1. Confirm the process is responding at all:
   ```bash
   timeout 5 curl -sf http://localhost:5050/health && echo "ALIVE" || echo "HUNG or DOWN"
   ```
2. Check if the heartbeat metric is actually stale in Prometheus (not just a scrape gap):
   ```bash
   curl -s http://localhost:5050/metrics | grep 'concord_heartbeat_tick_total'
   ```
3. If the process is hung (no HTTP response within 5 seconds), force a restart:
   ```bash
   pm2 restart concord-backend
   ```
4. If PM2 restart does not release the port or the process lingers:
   ```bash
   kill -9 $(pgrep -f "node.*concord" | head -1)
   pm2 start ecosystem.config.cjs --only concord-backend
   ```

## Diagnosis

```bash
# --- Is the Node process alive? ---
pgrep -a node | grep -i concord
ps aux | grep -E "node.*concord|concord.*node" | grep -v grep

# --- Is the event loop blocked? Try a quick HTTP probe ---
timeout 3 curl -sv http://localhost:5050/health 2>&1 | tail -20

# --- Heartbeat metric value ---
curl -s http://localhost:5050/metrics | grep heartbeat

# --- PM2 status and restart count ---
pm2 list
pm2 describe concord-backend | grep -E "restart|status|uptime|pid"

# --- Thread/CPU usage (blocked event loop shows 100% single core) ---
top -b -n 1 -p $(pgrep -f "node.*concord" | head -1) | tail -5
# or
ps aux | grep node | grep -v grep | awk '{print "CPU: "$3"% MEM: "$4"% PID: "$2}'

# --- Strace to see what syscall the process is stuck in (requires root) ---
strace -p $(pgrep -f "node.*concord" | head -1) -e trace=network,file -c 2>&1 &
sleep 5 && kill %1

# --- Check for blocking SQLite operations ---
# Long-running queries or locked writes can block the JS event loop via synchronous SQLite calls
lsof -p $(pgrep -f "node.*concord" | head -1) | grep -i sqlite

# --- Recent logs before the hang ---
pm2 logs concord-backend --lines 500 --nostream | tail -100
# Look for: "WARN", "blocked", "slow query", large data processing start with no end log

# --- System load ---
uptime
vmstat 1 5

# --- File descriptor exhaustion ---
ls /proc/$(pgrep -f "node.*concord" | head -1)/fd | wc -l
cat /proc/sys/fs/file-max
```

## Resolution Steps

### Step 1 — Attempt graceful restart

```bash
pm2 restart concord-backend
sleep 10
curl -sf http://localhost:5050/health && echo "RECOVERED"
```

### Step 2 — Force kill if graceful restart hangs

```bash
# SIGKILL the Node process
kill -9 $(pgrep -f "node.*concord" | head -1)
sleep 2
pm2 start ecosystem.config.cjs --only concord-backend
```

### Step 3 — Verify data integrity after forced kill

A forced kill during a SQLite write may leave the WAL in an intermediate state. Run an integrity check:

```bash
# Locate the database
DB_PATH="${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db"
ls -lh "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null

# Run SQLite integrity check
sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1 | head -20
# Expected output: "ok"
# If "corruption" appears, see RB-06 for database recovery

# Checkpoint WAL to ensure data is flushed
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1
```

### Step 4 — Investigate root cause of event-loop block

```bash
# Identify the last operation logged before the hang
pm2 logs concord-backend --lines 200 --nostream | grep -B5 -A5 "blocking\|slow\|sync\|WARN"

# Check for synchronous file/DB operations that could block:
# - Large synchronous SQLite reads without pagination
# - CPU-intensive JSON serialization of large objects
# - Synchronous fs.readFileSync on large files
# Search codebase for known synchronous patterns:
grep -r "execSync\|readFileSync\|writeFileSync" /home/user/concord-cognitive-engine/server/ \
  --include="*.js" | grep -v node_modules | grep -v "test\|spec\|smoke"
```

### Step 5 — Add watchdog timeout to prevent future hangs

If the heartbeat uses `setInterval`, ensure it has a watchdog that force-exits the process if it misses N ticks. This allows PM2 to auto-restart rather than leaving a hung process indefinitely.

## Verification

```bash
# 1. Heartbeat counter is incrementing
BEFORE=$(curl -s http://localhost:5050/metrics | awk '/concord_heartbeat_tick_total/ {print $2}')
sleep 35
AFTER=$(curl -s http://localhost:5050/metrics | awk '/concord_heartbeat_tick_total/ {print $2}')
echo "Before: $BEFORE  After: $AFTER"
# After should be larger than Before

# 2. Health endpoint responds within 2 seconds
time curl -sf http://localhost:5050/health

# 3. SQLite integrity check passes
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" "PRAGMA integrity_check;" | grep -c "^ok$"

# 4. Prometheus alert should clear within 5 minutes
# Open Prometheus UI → Alerts → ConcordNoHeartbeat should become inactive

# 5. Smoke test passes
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050
```

## Escalation

- If the process hangs again within **30 minutes** of restart: escalate to application engineer — likely a recurring blocking operation
- If `strace` shows the process is stuck in a syscall with no progress for > 60 seconds: escalate to senior engineer for live debugging
- If SQLite integrity check fails: escalate immediately to RB-06 (database recovery) before restarting the server
- If file descriptor exhaustion is found: escalate to infrastructure engineer to raise `ulimit -n`

## Prevention

- Implement a heartbeat watchdog: if the heartbeat timer misses 3+ consecutive ticks, call `process.exit(1)` to trigger PM2 auto-restart
- Audit all synchronous Node.js operations (`execSync`, `readFileSync` on large files, synchronous SQLite) and convert to async
- Set `ulimit -n 65536` in the process environment to prevent FD exhaustion
- Add a Prometheus alert on event loop lag (if a `concord_event_loop_lag_ms` metric exists) to catch slowdowns before a full hang
- Configure PM2 `listen_timeout` and `kill_timeout` so PM2 forcefully kills hung processes within a bounded time window
