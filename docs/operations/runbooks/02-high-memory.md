# RB-02: High Memory / Memory Critical

**Alert:** `ConcordHighMemory` — heap used > 85% of heap total for 5 minutes
         `ConcordMemoryCritical` — heap used > 1.7 GB for 2 minutes
**Severity:** warning (`ConcordHighMemory`) / critical (`ConcordMemoryCritical`)
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Prometheus alert `ConcordHighMemory` or `ConcordMemoryCritical` firing
- `concord_process_memory_bytes{type="heapUsed"}` climbing over time in Prometheus graphs
- Increasing GC pause times; slow API responses
- Possible `FATAL ERROR: Reached heap limit Allocation failed` in logs
- Process restarts logged by PM2 with exit code non-zero
- Clients experiencing timeouts or 503 errors as Node event loop stalls under GC pressure

## Immediate Actions (< 5 min)

1. Check current heap usage:
   ```bash
   curl -s http://localhost:5050/metrics | grep 'concord_process_memory_bytes'
   ```
2. Check for active heap dump capability and capture one **before** restarting:
   ```bash
   kill -USR2 $(pgrep -f "concord") 2>/dev/null || echo "USR2 not handled — skip"
   ```
3. If `ConcordMemoryCritical` is firing (>1.7 GB), restart immediately to prevent OOM kill:
   ```bash
   pm2 restart concord-backend
   ```
4. Verify recovery:
   ```bash
   curl -s http://localhost:5050/metrics | grep 'concord_process_memory_bytes{type="heapUsed"}'
   ```

## Diagnosis

```bash
# --- Current memory from metrics endpoint ---
curl -s http://localhost:5050/metrics | grep -E 'concord_process_memory_bytes|concord_uptime'

# --- Node.js process RSS and heap from OS ---
ps -o pid,rss,vsz,comm -p $(pgrep -f "node.*concord" | head -1)

# --- PM2 monitoring snapshot ---
pm2 monit --no-color 2>/dev/null | head -50
pm2 describe concord-backend

# --- Heap growth over time (requires Prometheus/Grafana) ---
# Query: rate(concord_process_memory_bytes{type="heapUsed"}[10m])
# A positive, sustained rate indicates a leak.

# --- Recent log errors that correlate with memory growth ---
pm2 logs concord-backend --lines 300 --nostream | grep -E "heap|memory|OOM|FATAL|alloc"

# --- Check for large in-memory caches or event accumulation ---
# Look for endpoints that stream large payloads without back-pressure
pm2 logs concord-backend --lines 100 --nostream | grep -E "stream|upload|embed|brain|vector"

# --- Active connections (sockets held in memory) ---
ss -tnp | grep 5050 | wc -l

# --- Heap dump (if --inspect or clinic.js available) ---
# Trigger V8 heap snapshot via kill signal (if app handles SIGUSR2):
kill -USR2 $(pgrep -f "node.*concord" | head -1)
ls -lh /tmp/heapdump-*.heapsnapshot 2>/dev/null || ls -lh "$DATA_DIR"/heapdump* 2>/dev/null
```

## Resolution Steps

### Step 1 — Capture heap snapshot (if server is still alive)

```bash
# If the app handles SIGUSR2 for heapdump:
kill -USR2 $(pgrep -f "node.*concord" | head -1)
# Wait 30 seconds, then locate the file
find /tmp "$DATA_DIR" -name "heapdump-*.heapsnapshot" -newer /tmp -ls 2>/dev/null
```

### Step 2 — Graceful restart to restore service

```bash
pm2 restart concord-backend --update-env
# Verify memory drops
sleep 15
curl -s http://localhost:5050/metrics | grep 'heapUsed'
```

### Step 3 — Memory leak investigation (post-incident)

```bash
# Open the .heapsnapshot in Chrome DevTools:
# DevTools → Memory → Load snapshot
# Look for: retained size of Detached DOM nodes, closures, large arrays

# Common leak sources in Concord:
# 1. Brain/embedding result buffers not freed after long AI calls
# 2. Socket.IO event listeners accumulating without removal
# 3. SQLite query result sets held in module-level caches
# 4. Large file upload buffers (multer/formdata) not released
# 5. Prometheus metric label cardinality explosion

# Check metric label cardinality
curl -s http://localhost:5050/metrics | wc -l
# If >10,000 lines, investigate high-cardinality labels
```

### Step 4 — Tune Node.js heap limit

```bash
# In ecosystem.config.cjs, add to node_args:
# node_args: "--max-old-space-size=3072"
# This gives Node 3 GB before hard OOM, allowing more time to detect via alert

# After editing config, reload:
pm2 reload ecosystem.config.cjs
```

### Step 5 — Identify leaking endpoint with load correlation

```bash
# Compare memory before and after specific traffic patterns
# Check if memory grows only when AI/brain features are used:
pm2 logs concord-backend --lines 500 --nostream | grep -E "POST /api/brain|POST /api/dtus" | wc -l
# If brain calls correlate, see RB-03 for disabling the brain temporarily
```

## Verification

```bash
# 1. Heap usage is back below 85% threshold
curl -s http://localhost:5050/metrics | awk '/concord_process_memory_bytes{type="heapUsed"}/ {used=$2} /concord_process_memory_bytes{type="heapTotal"}/ {total=$2} END {if(total>0) printf "Heap: %.1f%%\n", used/total*100}'

# 2. Prometheus alert should clear within 5 minutes of heap dropping
# Open Prometheus UI → Alerts → ConcordHighMemory should show "inactive"

# 3. Server responds to health check
curl -sf http://localhost:5050/health

# 4. Uptime shows recent restart (if restarted)
curl -s http://localhost:5050/metrics | grep concord_uptime_seconds
```

## Escalation

- `ConcordHighMemory` not resolved within **15 minutes** of restart: escalate to application developer for leak investigation
- `ConcordMemoryCritical` with repeated restarts (>3 in 30 min): escalate immediately — disable memory-intensive features (AI brain, embedding, large uploads) until leak is patched
- If heap dump analysis required: assign to backend engineer with Chrome DevTools access
- If Prometheus metric label cardinality is the cause (>50k label combos): escalate to platform engineer

## Prevention

- Set `--max-old-space-size` to a safe maximum in `ecosystem.config.cjs`
- Implement heap-usage monitoring in the app itself: log a warning at 80% heap and trigger graceful restart at 90%
- Pin a max retention size for all in-memory caches (LRU with bounded size)
- Add integration tests that run 100+ requests against brain/embedding routes and assert memory does not grow unboundedly
- Review Prometheus metric label definitions for cardinality — use bounded label values only
