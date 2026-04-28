# RB-05: Synthetic Check Failing

**Alert:** `ConcordSyntheticCheckFailing` — `concord_synthetic_check_pass{check="<name>"} == 0` for 2 minutes
**Severity:** warning
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Synthetic Checks Inventory

| Check Name | URL | Expected | Notes |
|---|---|---|---|
| `homepage-loads` | `GET /` | 200, body has `ok` field | Serve root / frontend shell |
| `health-endpoint` | `GET /health` | 200, `status` = `healthy` or `degraded` | Core health |
| `ready-endpoint` | `GET /ready` | 200 or 503, `ready` is boolean | Readiness gate |
| `health-db` | `GET /api/health/db` | 200 or 503, has `status` and `checks` | Database connectivity |
| `health-ws` | `GET /api/health/ws` | 200 or 503, has `status` | WebSocket server status |
| `auth-endpoint-responds` | `GET /api/auth/csrf-token` | 200, 204, 403, or 404 | Auth layer alive |
| `brain-status` | `GET /api/brain/status` | 200 | AI brain reachable |
| `metrics-endpoint` | `GET /metrics` | 200, body contains `concord_` | Prometheus metrics |
| `api-status` | `GET /api/status` | 200, `ok == true` | Main API alive |

## Symptoms
- Prometheus alert `ConcordSyntheticCheckFailing` firing with a specific `check` label
- Pushgateway (`pushgateway:9091`) shows `concord_synthetic_check_pass{check="<name>"} 0`
- Specific endpoint(s) returning unexpected status codes or malformed responses
- May affect a single check (isolated failure) or multiple checks (systemic failure)

## Immediate Actions (< 5 min)

1. Identify which check is failing from the alert label:
   ```bash
   # Query Prometheus for all failing checks
   curl -s 'http://localhost:9090/api/v1/query?query=concord_synthetic_check_pass==0' \
     | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);r.data.result.forEach(m=>console.log(m.metric.check))})"
   ```
2. Run the synthetic checks manually to get live output:
   ```bash
   BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js
   ```
3. Manually probe the failing endpoint:
   ```bash
   # Replace <endpoint> with the failing check's URL
   curl -sv http://localhost:5050/<endpoint> 2>&1 | tail -30
   ```

## Diagnosis

```bash
# --- Run all synthetic checks and see full output ---
BASE_URL=http://localhost:5050 \
CHECK_TIMEOUT_MS=10000 \
  node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js

# --- Check each failing endpoint individually ---

# homepage-loads: root endpoint
curl -sv http://localhost:5050/ 2>&1 | grep -E "< HTTP|{|ok"

# health-endpoint
curl -s http://localhost:5050/health

# ready-endpoint
curl -s http://localhost:5050/ready

# health-db
curl -s http://localhost:5050/api/health/db

# health-ws
curl -s http://localhost:5050/api/health/ws

# auth-endpoint-responds
curl -sv http://localhost:5050/api/auth/csrf-token 2>&1 | grep "< HTTP"

# brain-status
curl -s http://localhost:5050/api/brain/status

# metrics-endpoint
curl -s http://localhost:5050/metrics | grep "^concord_" | head -5

# api-status
curl -s http://localhost:5050/api/status

# --- Server logs around the time of the first failure ---
pm2 logs concord-backend --lines 200 --nostream | grep -E "ERROR|WARN|500|503|Cannot"

# --- Check if Pushgateway is actually receiving metrics ---
curl -s http://localhost:9091/metrics | grep 'concord_synthetic_check_pass' | head -20

# --- Check the synthetic monitor cron/scheduler is running ---
pgrep -fa "critical-paths\|synthetic" || echo "Synthetic monitor process not found"
crontab -l | grep synthetic 2>/dev/null || echo "No cron entry found"
```

## Resolution Steps by Check

### `homepage-loads` failing
```bash
# Check if root route is registered
curl -sv http://localhost:5050/ 2>&1 | grep "< HTTP"
# If 404: route missing after deploy — check recent changes to router setup
# If 500: check server logs for unhandled exception in root handler
pm2 logs concord-backend --lines 50 --nostream | grep -E "GET / |500|Error"
```

### `health-endpoint` failing
```bash
curl -s http://localhost:5050/health
# If status == "error" (not healthy/degraded): investigate sub-checks
# If timeout: server may be hung — see RB-04
# If 500: check logs for unhandled error in health handler
```

### `health-db` failing (status 503 is acceptable; 500 or timeout is not)
```bash
curl -s http://localhost:5050/api/health/db
# 503 with structured body = acceptable (degraded but responding)
# Connection error / timeout = database issue, see RB-06
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" "SELECT 1;"
```

### `health-ws` failing
```bash
curl -s http://localhost:5050/api/health/ws
# If ws status is "error": Socket.IO server may not have initialized
# See RB-09 for WebSocket issues
pm2 logs concord-backend --lines 50 --nostream | grep -i "socket\|ws\|websocket"
```

### `brain-status` failing
```bash
curl -s http://localhost:5050/api/brain/status
# If 500 or timeout: likely Ollama is down — follow RB-03
```

### `metrics-endpoint` failing
```bash
curl -s http://localhost:5050/metrics | head -5
# If empty or missing concord_ prefix: Prometheus middleware not registered
# Check that the /metrics route is active:
pm2 logs concord-backend --lines 30 --nostream | grep metrics
```

### `api-status` failing (`ok !== true`)
```bash
curl -s http://localhost:5050/api/status
# Inspect the response body — it may have a `reason` field
# If ok==false: server may be in degraded state post-startup
pm2 logs concord-backend --lines 100 --nostream | grep -E "startup|init|ready|status"
```

### Multiple checks failing simultaneously
```bash
# Likely systemic — check if server is overloaded or restarting
pm2 list
curl -s http://localhost:5050/metrics | grep concord_uptime_seconds
# Low uptime = recent restart; wait 60s and re-run checks
```

### Synthetic monitor itself is not running
```bash
# Check process
pgrep -fa "critical-paths" || echo "NOT RUNNING"
# Restart if managed by PM2
pm2 restart concord-synthetic 2>/dev/null || echo "Not in PM2"
# Restart if cron
# Re-add cron entry: */1 * * * * node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js >> /var/log/synthetic.log 2>&1
```

## Verification

```bash
# 1. All checks pass
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js
# Expected: "SUMMARY: 9/9 passed, 0 failed"

# 2. Pushgateway reflects passing checks (wait 1-2 minutes after fix)
curl -s http://localhost:9091/metrics | grep 'concord_synthetic_check_pass' | grep ' 1$' | wc -l
# Expected: 9 (all 9 checks showing value 1)

# 3. Prometheus alert clears
# Open Prometheus UI → Alerts → ConcordSyntheticCheckFailing should be inactive

# 4. Smoke tests confirm core functionality
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050
```

## Escalation

- Single check failing for > **15 minutes** after investigating: escalate to the team owning that subsystem (DB → data team, brain → ML team, auth → security team)
- Multiple checks failing and server appears healthy: escalate to network/infrastructure (possible proxy or load balancer issue)
- Synthetic monitor itself keeps crashing: escalate to platform engineer to stabilize the monitoring pipeline
- If `ALERT_WEBHOOK_URL` is configured and webhook is not firing: check webhook delivery and alert routing

## Prevention

- Ensure the synthetic monitor runs every 60 seconds via a reliable scheduler (PM2, systemd timer, or Kubernetes CronJob)
- Add the Pushgateway as a monitored target in Prometheus with its own `up` check so you know if the metric pipeline itself is broken
- Review and update the `CHECKS` array in `critical-paths.js` after each new API endpoint is added
- Test `critical-paths.js` in staging before deploying changes that alter endpoint contracts
