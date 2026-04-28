# RB-07: Redis Unavailable

**Alert:** Application logs showing `Redis connection refused`, `ECONNREFUSED`, or Redis-dependent features failing; no dedicated Prometheus alert (Redis is optional)
**Severity:** warning (Redis is optional — Concord degrades gracefully)
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Server logs show `Redis connection refused` or `Error: connect ECONNREFUSED 127.0.0.1:6379`
- Session-related errors if Redis is used for session storage
- Rate limiting not enforcing (if Redis backs the rate limiter)
- Pub/sub or Socket.IO adapter features degraded or falling back to in-memory
- Possible increase in memory usage if in-memory fallback accumulates state
- `GET /health` or `GET /api/health` may return `degraded` status with Redis listed as unhealthy
- Background job queues (if Redis-backed) draining slowly or not processing

## Understanding Concord's Redis Fallback Behavior

Redis is **optional** in Concord. When Redis is unavailable:
- The application falls back to in-memory equivalents (single-process only)
- Session data stored in Redis will be lost on reconnect — users may need to re-authenticate
- Socket.IO adapter reverts to in-process (no cross-process pub/sub)
- Rate limiting may be bypassed or handled in-memory
- Any job queue backed by Redis (Bull/BullMQ) will stop processing

## Immediate Actions (< 5 min)

1. Confirm Redis is down:
   ```bash
   redis-cli ping || echo "Redis DOWN"
   # or
   nc -zv localhost 6379 || echo "Redis port closed"
   ```
2. Check if the Concord server has already fallen back gracefully:
   ```bash
   curl -s http://localhost:5050/health
   # Look for redis in the response body
   ```
3. Attempt to restart Redis:
   ```bash
   sudo systemctl restart redis
   # or Docker
   docker compose restart redis
   ```
4. Verify Redis is back:
   ```bash
   redis-cli ping
   # Expected: PONG
   ```

## Diagnosis

```bash
# --- Redis process state ---
pgrep -a redis
sudo systemctl status redis 2>/dev/null || docker compose ps redis 2>/dev/null

# --- Redis port reachability ---
nc -zv localhost 6379
redis-cli -h localhost -p 6379 ping 2>&1

# --- Redis logs ---
sudo journalctl -u redis -n 100 --no-pager 2>/dev/null
# or Docker
docker compose logs --tail=100 redis 2>/dev/null

# --- Redis info (if running) ---
redis-cli info server | grep -E "redis_version|uptime_in_seconds|tcp_port"
redis-cli info memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy"
redis-cli info stats | grep -E "rejected_connections|keyspace_hits|keyspace_misses"
redis-cli info clients | grep connected_clients

# --- OOM eviction ---
redis-cli info stats | grep evicted_keys
# High evictions = maxmemory policy kicking in

# --- Concord logs for Redis errors ---
pm2 logs concord-backend --lines 200 --nostream | grep -iE "redis|ECONNREFUSED|BullMQ|ioredis|session"

# --- Environment configuration ---
printenv | grep -iE "REDIS_URL|REDIS_HOST|REDIS_PORT|REDIS_PASSWORD" | sed 's/PASSWORD=.*/PASSWORD=REDACTED/'
pm2 env concord-backend | grep -iE "redis"

# --- Docker Compose Redis config ---
docker compose config 2>/dev/null | grep -A10 "redis:"
```

## Resolution Steps

### Step 1 — Restart Redis

```bash
# systemd
sudo systemctl start redis
sudo systemctl enable redis  # ensure it starts on boot

# Docker Compose
docker compose up -d redis

# Wait for Redis to be ready
for i in $(seq 1 10); do
  redis-cli ping 2>/dev/null && echo "Redis ready" && break
  sleep 2
done
```

### Step 2 — Reconnect Concord to Redis

Most Node.js Redis clients (ioredis, node-redis) have built-in reconnection logic with exponential backoff. After Redis restarts, the client should reconnect automatically within 30–60 seconds.

```bash
# Wait for auto-reconnect
sleep 30
curl -s http://localhost:5050/health | grep -i redis
pm2 logs concord-backend --lines 30 --nostream | grep -i "redis.*connect\|reconnect"
```

If automatic reconnection does not occur within 60 seconds, restart Concord:

```bash
pm2 restart concord-backend --update-env
```

### Step 3 — Redis out of memory (maxmemory reached)

```bash
# Check current memory usage
redis-cli info memory | grep -E "used_memory_human|maxmemory_human"

# If near/at maxmemory, flush volatile keys or expand memory limit
# Option A: flush expired/volatile keys
redis-cli FLUSHDB ASYNC  # WARNING: this clears all data in the current DB

# Option B: increase memory limit (temporary)
redis-cli CONFIG SET maxmemory 2gb

# Option C: Set eviction policy to allow Redis to auto-evict
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Step 4 — Redis data persistence issue (AOF/RDB corrupt)

```bash
# Check Redis log for persistence errors
sudo journalctl -u redis -n 200 | grep -iE "error|corrupt|failed|rdb|aof"

# If RDB file is corrupt, Redis may refuse to start
# Locate the RDB file
redis-cli CONFIG GET dir
redis-cli CONFIG GET dbfilename

# Rename/move the corrupt RDB and restart Redis (data loss for that snapshot)
sudo mv /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.corrupt.$(date +%Y%m%d)
sudo systemctl restart redis
```

### Step 5 — Operate without Redis (extended outage)

Redis is optional. If it cannot be restored quickly, Concord continues operating in degraded mode:

```bash
# Confirm Concord is still serving requests
curl -sf http://localhost:5050/api/status | grep '"ok":true'

# Notify users that session persistence and real-time features may be impacted
# Document expected degraded behaviors for this deployment in a status post
```

### Step 6 — Verify Redis configuration for production readiness

```bash
# Ensure Redis is bound correctly and has a password if exposed
redis-cli CONFIG GET bind
redis-cli CONFIG GET requirepass  # should not be empty in production
redis-cli CONFIG GET maxmemory
redis-cli CONFIG GET maxmemory-policy

# Ensure persistence is configured appropriately
redis-cli CONFIG GET save           # RDB snapshots
redis-cli CONFIG GET appendonly     # AOF
```

## Verification

```bash
# 1. Redis is responding
redis-cli ping
# Expected: PONG

# 2. Concord health shows Redis OK
curl -s http://localhost:5050/health | grep -i redis

# 3. No Redis errors in recent logs
pm2 logs concord-backend --lines 50 --nostream | grep -i redis | grep -v "connected\|ready"

# 4. Session-dependent endpoints work (if sessions are Redis-backed)
curl -sf http://localhost:5050/api/auth/csrf-token

# 5. Synthetic checks pass
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js
```

## Escalation

- Redis not recoverable within **20 minutes**: escalate to infrastructure engineer; evaluate running without Redis if Concord's fallback is sufficient for the workload
- Redis data corruption: escalate to data engineer — assess whether lost session data or job queue data requires manual remediation
- Redis OOM in a loop: escalate to application engineer to audit key TTLs and eviction policies
- Redis used for distributed locks and lock contention is causing cascading failures: escalate immediately to senior engineer

## Prevention

- Set `maxmemory` and `maxmemory-policy allkeys-lru` in `redis.conf` to prevent OOM halts
- Enable Redis persistence (AOF with `appendfsync everysec`) to limit data loss on restart
- Add Redis to a Docker Compose health check so the container restarts automatically: `healthcheck: test: ["CMD", "redis-cli", "ping"]`
- Configure ioredis/node-redis with `retryStrategy` and `reconnectOnError` so the client reconnects aggressively
- Add a Prometheus Redis exporter (`redis_exporter`) to scrape Redis metrics and alert on connection count, memory, and evictions
- Document which Concord features degrade gracefully without Redis vs. which require it, so on-call engineers can communicate impact accurately
