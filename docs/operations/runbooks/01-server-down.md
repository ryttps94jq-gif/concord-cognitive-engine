# RB-01: Server Down

**Alert:** `ConcordServerDown` — `up{job="concord-backend"} == 0` for 1 minute
**Severity:** critical
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Prometheus alert `ConcordServerDown` firing
- Prometheus cannot scrape `backend:5050/metrics`
- All synthetic checks (`homepage-loads`, `health-endpoint`, `api-status`, etc.) failing simultaneously
- No response on `http://localhost:5050/health`
- Users report the application is completely unreachable

## Immediate Actions (< 5 min)

1. Confirm the server is actually down (not a Prometheus networking issue):
   ```bash
   curl -sf http://localhost:5050/health || echo "SERVER DOWN"
   ```
2. Check if the process is running:
   ```bash
   pgrep -a node | grep -i concord
   # or if using PM2:
   pm2 list
   ```
3. If the process is missing, attempt an immediate restart:
   ```bash
   # PM2
   pm2 restart concord-backend
   # or systemd
   sudo systemctl restart concord
   # or Docker
   docker compose restart backend
   ```
4. Re-check health within 30 seconds:
   ```bash
   curl -sf http://localhost:5050/health && echo "UP"
   ```

## Diagnosis

```bash
# --- Process state ---
pgrep -a node | grep -i concord
pm2 list
pm2 show concord-backend        # if using PM2
sudo systemctl status concord   # if using systemd

# --- Recent logs (last 200 lines) ---
pm2 logs concord-backend --lines 200 --nostream
# or
journalctl -u concord -n 200 --no-pager
# or Docker
docker compose logs --tail=200 backend

# --- OOM / kernel kill ---
dmesg -T | grep -i "killed process" | tail -20
journalctl -k --since "30 min ago" | grep -i oom

# --- Disk and port ---
df -h /                          # check disk space (full disk can prevent start)
ss -tlnp | grep 5050             # confirm nothing else holding the port

# --- Exit code from last run ---
pm2 describe concord-backend | grep -E "exit code|status|restarts"

# --- Environment / config ---
printenv | grep -E "DATA_DIR|NODE_ENV|PORT|REDIS|OLLAMA" | sort
ls -la "$DATA_DIR"               # confirm data directory exists and is writable
```

## Resolution Steps

1. **Process not running — clean restart:**
   ```bash
   pm2 restart concord-backend --update-env
   # Watch startup logs
   pm2 logs concord-backend --lines 50
   ```

2. **Port 5050 already bound by another process:**
   ```bash
   ss -tlnp | grep 5050
   # Kill the stale process (replace <PID>)
   kill -9 <PID>
   pm2 restart concord-backend
   ```

3. **Data directory missing or unwritable:**
   ```bash
   mkdir -p "$DATA_DIR"
   chown -R $(whoami) "$DATA_DIR"
   pm2 restart concord-backend
   ```

4. **Startup crash (check logs for error):**
   ```bash
   pm2 logs concord-backend --lines 100 --nostream | grep -E "Error|FATAL|Cannot|ENOENT"
   # Fix the underlying error (missing env var, bad config), then:
   pm2 restart concord-backend
   ```

5. **Docker container exited:**
   ```bash
   docker compose ps backend
   docker compose logs backend --tail=100
   docker compose up -d backend
   ```

6. **OOM kill — increase memory limit before restarting:**
   ```bash
   # In ecosystem.config.cjs, raise max_memory_restart or node --max-old-space-size
   # Then restart:
   pm2 restart concord-backend
   ```

## Verification

```bash
# 1. Health endpoint returns healthy/degraded
curl -s http://localhost:5050/health | node -e "process.stdin||(x=>x)();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).status))"

# 2. Metrics endpoint is scrapable
curl -sf http://localhost:5050/metrics | grep "^concord_uptime_seconds" | head -3

# 3. API status
curl -sf http://localhost:5050/api/status | grep '"ok":true'

# 4. Run smoke tests
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050

# 5. Confirm PM2 shows online
pm2 list | grep concord

# 6. Confirm Prometheus will scrape (check after ~1 min):
# Open Prometheus UI → Status → Targets → concord-backend should show UP
```

## Escalation

- If not resolved within **10 minutes**: page the senior on-call engineer
- If repeated restarts loop (>3 restarts in 10 min): do NOT keep restarting — escalate and capture a heap dump first (see RB-02)
- If data directory is corrupted: escalate to database recovery (see RB-06)
- If disk is full: follow RB-10 first, then restart

## Prevention

- Set PM2 `max_memory_restart: "2G"` to auto-restart on OOM before the kernel kills the process
- Configure `min_uptime: "30s"` and `max_restarts: 5` in `ecosystem.config.cjs` to catch crash-loop early
- Monitor `ConcordUptime` (info alert) to detect unexpected restarts proactively
- Ensure `DATA_DIR` is on a volume with sufficient space and proper permissions in CI/CD and deployment scripts
- Add a liveness probe in Docker Compose / Kubernetes that hits `/health` every 10 seconds
