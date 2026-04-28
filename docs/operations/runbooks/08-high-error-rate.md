# RB-08: High Error Rate (500 Spike)

**Alert:** Elevated rate of HTTP 500 responses detected via Prometheus metrics, logs, or synthetic check failures; no single dedicated alert — typically surfaced by `ConcordSyntheticCheckFailing` on `api-status` or `health-endpoint`, combined with error log spikes
**Severity:** critical (if core paths failing) / warning (if isolated to one route)
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Spike in HTTP 500 responses visible in Prometheus or access logs
- `api-status` synthetic check failing (`ok !== true`)
- Elevated error rate in `concord_http_errors_total` or similar metric
- Users reporting "Internal Server Error" on specific operations
- PM2 / application logs flooded with stack traces
- `GET /health` returning `degraded` or `error`
- Possible correlation with a recent deployment or config change

## Immediate Actions (< 5 min)

1. Check the current error rate from metrics:
   ```bash
   curl -s http://localhost:5050/metrics | grep -E 'http_requests_total|errors_total' | head -20
   ```
2. Identify the erroring routes from recent logs:
   ```bash
   pm2 logs concord-backend --lines 100 --nostream | grep -E "500|Error:|at " | head -40
   ```
3. Check the API status endpoint:
   ```bash
   curl -s http://localhost:5050/api/status
   curl -s http://localhost:5050/health
   ```
4. Check if a recent deploy happened:
   ```bash
   pm2 describe concord-backend | grep -E "restart|started|uptime"
   git -C /home/user/concord-cognitive-engine log --oneline -10
   ```

## Diagnosis

```bash
# --- Error log tail ---
pm2 logs concord-backend --lines 300 --nostream | grep -E "Error|500|FATAL|Unhandled|at " | head -60

# --- Route-level error breakdown ---
# If the app logs route + status:
pm2 logs concord-backend --lines 500 --nostream | grep -oE "(GET|POST|PUT|DELETE|PATCH) [^ ]+ [0-9]+" \
  | awk '$3 ~ /^5/ {cnt[$2]++} END {for(r in cnt) print cnt[r], r}' | sort -rn | head -20

# --- Stack traces ---
pm2 logs concord-backend --err --lines 200 --nostream | head -100

# --- Recent git changes ---
git -C /home/user/concord-cognitive-engine log --oneline --since="2 hours ago"
git -C /home/user/concord-cognitive-engine diff HEAD~1 --stat

# --- Database errors (common cause) ---
pm2 logs concord-backend --lines 300 --nostream | grep -iE "sqlite|database|locked|ENOENT|foreign key"

# --- Memory-related errors ---
pm2 logs concord-backend --lines 300 --nostream | grep -iE "heap|OOM|Cannot read|undefined is not"

# --- Dependency errors (Redis, Ollama) ---
pm2 logs concord-backend --lines 300 --nostream | grep -iE "ECONNREFUSED|ETIMEDOUT|ENOTFOUND"

# --- Unhandled promise rejections ---
pm2 logs concord-backend --lines 300 --nostream | grep -i "unhandledRejection\|UnhandledPromise"

# --- Check current metrics snapshot ---
curl -s http://localhost:5050/metrics | grep -E "concord_brain_errors|http_" | head -30

# --- Smoke test to isolate which routes are broken ---
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050 2>&1 | grep -E "FAIL|PASS"
```

## Resolution Steps

### Scenario A — Error introduced by recent deploy

```bash
# Identify the breaking commit
git -C /home/user/concord-cognitive-engine log --oneline -5

# Option 1: Hot-fix the issue and redeploy
# (make the fix, then:)
pm2 restart concord-backend --update-env

# Option 2: Roll back to the previous working commit
git -C /home/user/concord-cognitive-engine stash
git -C /home/user/concord-cognitive-engine checkout <previous-commit-sha>
pm2 restart concord-backend --update-env
# Verify rollback resolved the errors:
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050
```

### Scenario B — Database errors causing 500s

```bash
# Check database health
curl -s http://localhost:5050/api/health/db
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" "PRAGMA integrity_check;" | head -5

# If locked or corrupt: follow RB-06
# Restart Concord to release stuck transactions
pm2 restart concord-backend
```

### Scenario C — Dependency failure (Redis, Ollama) causing unhandled errors

```bash
# Check dependencies
redis-cli ping 2>/dev/null || echo "Redis DOWN — see RB-07"
curl -sf http://localhost:11434/api/version || echo "Ollama DOWN — see RB-03"

# If a dependency is down, the app should handle it gracefully
# If it is throwing unhandled 500s instead, temporarily disable the feature:
# - Disable brain features: see RB-03 Scenario E
# - Operate without Redis: see RB-07 Step 5
```

### Scenario D — Unhandled promise rejection / null dereference

```bash
# Find the exact stack trace
pm2 logs concord-backend --err --lines 200 --nostream | grep -A 15 "UnhandledRejection\|TypeError\|Cannot read"

# The stack trace will point to the file and line
# Fix the null-check or missing await in the identified file, then:
pm2 restart concord-backend --update-env
```

### Scenario E — Memory pressure causing sporadic 500s

```bash
# Check heap usage
curl -s http://localhost:5050/metrics | grep 'concord_process_memory_bytes'

# If heap > 85%: follow RB-02 before investigating the error further
pm2 restart concord-backend
```

### Scenario F — Route returns 500 for a specific input (not global)

```bash
# Identify the specific route and input from logs
pm2 logs concord-backend --lines 200 --nostream | grep -B5 "500" | head -40

# Test the route in isolation with curl to reproduce
curl -v -X POST http://localhost:5050/api/<failing-route> \
  -H "Content-Type: application/json" \
  -d '<minimal-payload>'

# Add input validation / guard clause, redeploy
```

### Rollback Procedure

```bash
# 1. Identify last known-good commit
git -C /home/user/concord-cognitive-engine log --oneline | head -10

# 2. Stop server
pm2 stop concord-backend

# 3. Checkout previous version
git -C /home/user/concord-cognitive-engine checkout <good-sha>

# 4. Install dependencies if package.json changed
cd /home/user/concord-cognitive-engine && npm ci --omit=dev 2>/dev/null || npm install

# 5. Restart
pm2 start ecosystem.config.cjs --only concord-backend

# 6. Verify
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050
```

## Verification

```bash
# 1. Error rate drops — check logs for clean requests
pm2 logs concord-backend --lines 50 --nostream | grep -c "500"
# Expected: 0 or very low

# 2. Health endpoint returns healthy
curl -s http://localhost:5050/health | grep '"status"'

# 3. API status returns ok
curl -s http://localhost:5050/api/status | grep '"ok":true'

# 4. Smoke tests pass
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050

# 5. Synthetic checks pass
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js
```

## Escalation

- Errors persist after restart and rollback: escalate to application engineer with the stack trace and reproduction steps
- Errors are data-corruption related (invalid DB state): escalate to senior engineer and pause write operations
- Error rate > 50% of all requests for > 10 minutes: consider taking the service offline gracefully (`pm2 stop concord-backend`) and displaying a maintenance page via nginx
- Suspected security incident (unusual patterns like SQL injection attempts causing 500s): escalate to security team

## Prevention

- Implement a global Express error handler that catches unhandled errors, logs them with structured context (route, user, input shape), and returns 500 with a safe message
- Add input validation middleware (e.g., Zod, Joi) on all POST/PUT routes to return 400 before reaching business logic
- Run smoke tests in CI on every deploy and block merge if any test fails
- Use feature flags to disable new, high-risk features without a full rollback
- Set up a Prometheus alert on `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05` (>5% error rate)
- Monitor the PM2 restart count; an increase in restarts often precedes a 500 spike
