# RB-09: WebSocket Disconnect Storm

**Alert:** `health-ws` synthetic check failing; `ConcordNoHeartbeat` may co-fire; application logs show mass Socket.IO disconnect events
**Severity:** critical (if all clients disconnect) / warning (if partial)
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Large number of `disconnect` events logged in rapid succession
- Socket.IO client reconnect attempts visible in browser consoles / client logs
- `GET /api/health/ws` returning 503 or error status
- `health-ws` synthetic check failing
- Users report real-time features broken: live updates, notifications, collaborative editing not working
- PM2 logs flooded with `socket disconnect` or `transport close` messages
- Server CPU spikes during reconnect storm as all clients try to reconnect simultaneously
- Possible cascading effect: reconnect storms consume server resources causing HTTP 500s

## Understanding Socket.IO Reconnection Behavior

Socket.IO clients reconnect automatically with exponential backoff. A mass disconnect can be caused by:
1. **Server restart** — all connections drop, clients reconnect over 30–120 seconds
2. **Server overload** — event loop lag causes transport timeouts
3. **nginx/proxy timeout** — upstream proxy closing idle WebSocket connections
4. **Network partition** — between clients and server
5. **Socket.IO namespace error** — a crash in a namespace handler disconnects that namespace's clients
6. **Redis adapter failure** — if using Redis pub/sub for multi-process Socket.IO

## Immediate Actions (< 5 min)

1. Check WebSocket health endpoint:
   ```bash
   curl -s http://localhost:5050/api/health/ws
   ```
2. Check if the server itself restarted (which would explain a mass disconnect):
   ```bash
   curl -s http://localhost:5050/metrics | grep concord_uptime_seconds
   pm2 describe concord-backend | grep -E "restart|uptime"
   ```
3. Check current Socket.IO connection count from metrics or logs:
   ```bash
   curl -s http://localhost:5050/metrics | grep -i "socket\|websocket\|connected"
   pm2 logs concord-backend --lines 50 --nostream | grep -iE "socket|connect|disconnect" | tail -20
   ```
4. Check server load:
   ```bash
   uptime
   curl -s http://localhost:5050/metrics | grep 'concord_process_memory_bytes{type="heapUsed"}'
   ```

## Diagnosis

```bash
# --- WebSocket health ---
curl -s http://localhost:5050/api/health/ws

# --- Disconnect event rate in logs ---
pm2 logs concord-backend --lines 500 --nostream | grep -c "disconnect"
pm2 logs concord-backend --lines 500 --nostream | grep -E "disconnect|transport close|socket error" | tail -30

# --- Server uptime (recent restart = expected mass disconnect) ---
curl -s http://localhost:5050/metrics | grep concord_uptime_seconds
pm2 list | grep concord

# --- Active connections estimate ---
ss -tnp | grep 5050 | wc -l
# WebSocket connections are kept as TCP connections

# --- Event loop lag (Socket.IO issues often caused by blocked event loop) ---
# If concord_event_loop_lag_ms metric exists:
curl -s http://localhost:5050/metrics | grep -i "event_loop\|lag"

# --- Memory pressure ---
curl -s http://localhost:5050/metrics | awk '/concord_process_memory_bytes{type="heapUsed"}/ {used=$2} /concord_process_memory_bytes{type="heapTotal"}/ {total=$2} END {if(total>0) printf "Heap: %.1f%%\n", used/total*100}'

# --- Nginx/proxy config for WebSocket timeouts ---
grep -r "proxy_read_timeout\|proxy_send_timeout\|keepalive_timeout\|upgrade\|websocket" \
  /home/user/concord-cognitive-engine/nginx/ 2>/dev/null | head -20

# --- Redis adapter (if using Redis for Socket.IO pub/sub) ---
redis-cli ping 2>/dev/null || echo "Redis DOWN — may cause WS adapter failure"
pm2 logs concord-backend --lines 100 --nostream | grep -i "redis\|adapter"

# --- Socket.IO namespace errors ---
pm2 logs concord-backend --err --lines 200 --nostream | grep -iE "namespace|room|socket" | head -20

# --- Check for connection flood (DoS) ---
ss -tnp | grep 5050 | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
# High count from a single IP may indicate a connection flood
```

## Resolution Steps

### Scenario A — Disconnect caused by a server restart (most common)

```bash
# This is expected after a restart. Clients reconnect automatically.
# Monitor the reconnection storm:
watch -n5 "ss -tnp | grep 5050 | wc -l"
# Connection count should climb back to baseline within 60–120 seconds

# If clients are not reconnecting (client-side reconnection disabled):
# Check client Socket.IO configuration for reconnection: true and appropriate backoff
# Nothing to do server-side — wait or notify users to refresh
```

### Scenario B — Server overload causing transport timeouts

```bash
# Check event loop lag and memory
curl -s http://localhost:5050/metrics | grep -E 'heapUsed|lag|cpu'

# If memory critical: see RB-02
# Shed non-essential load by temporarily disabling brain features: see RB-03 Scenario E

# Increase Socket.IO ping timeout to give a stressed server more room:
# (This requires a code change in socket server initialization)
# pingTimeout: 60000,  // default is 20000
# pingInterval: 25000  // default is 25000

# Restart to apply if recently changed in code
pm2 restart concord-backend
```

### Scenario C — Nginx proxy closing WebSocket connections

```bash
# Check nginx config for WebSocket proxy settings
cat /home/user/concord-cognitive-engine/nginx/nginx.conf 2>/dev/null | grep -A5 -B5 "websocket\|upgrade\|Upgrade"

# WebSocket proxying requires these headers:
# proxy_http_version 1.1;
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";
# proxy_read_timeout 86400;  # or high value for long-lived connections

# If proxy_read_timeout is too low (e.g., 60s), idle WebSocket connections get cut
# Edit nginx config and reload:
sudo nginx -t && sudo nginx -s reload
```

### Scenario D — Socket.IO namespace crash

```bash
# Find namespace errors in logs
pm2 logs concord-backend --err --lines 300 --nostream | grep -B5 -A10 "namespace\|Unhandled.*socket\|socket.*Error"

# A namespace-level error can disconnect all clients in that namespace
# Restart to recover, then apply a fix to add error handling in the namespace handler:
pm2 restart concord-backend
```

### Scenario E — Redis adapter failure (if Socket.IO uses Redis)

```bash
# Check Redis
redis-cli ping || echo "Redis down — fix Redis first (see RB-07)"

# After Redis recovers, restart Concord to re-initialize the adapter
pm2 restart concord-backend --update-env
```

### Scenario F — Connection flood from a misbehaving client

```bash
# Identify the flooding IP
ss -tnp | grep 5050 | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -5

# If one IP is holding hundreds of connections:
# Block at nginx or firewall level temporarily
sudo iptables -A INPUT -s <offending-IP> -p tcp --dport 5050 -j DROP
# or add to nginx:
# deny <offending-IP>;
```

## Verification

```bash
# 1. WebSocket health endpoint is OK
curl -s http://localhost:5050/api/health/ws | grep '"status"'

# 2. Connection count is stable (not spiking/dropping)
for i in 1 2 3 4 5; do
  echo "$(date): $(ss -tnp | grep 5050 | wc -l) connections"
  sleep 10
done

# 3. No mass disconnect events in logs
pm2 logs concord-backend --lines 30 --nostream | grep -c "disconnect"
# Should be low / zero new events

# 4. Synthetic check passes
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js 2>&1 | grep health-ws

# 5. End-to-end: open a browser console and confirm Socket.IO connects without rapid reconnects
# socket.on('connect', () => console.log('connected'))
# socket.on('disconnect', (reason) => console.log('disconnected:', reason))
```

## Escalation

- Reconnect storm does not stabilize within **5 minutes** after server restart: escalate — possible client-side configuration issue or incompatible Socket.IO versions
- WebSocket health check shows error after all other services are healthy: escalate to application engineer for Socket.IO namespace debugging
- Connection count does not recover: check if the client's `reconnect: false` is set, and notify the frontend team
- Suspected DoS/connection flood: escalate to security team and apply rate limiting at the load balancer immediately

## Prevention

- Configure nginx with `proxy_read_timeout 86400` and `proxy_set_header Connection "upgrade"` for all WebSocket endpoints
- Implement Socket.IO connection count metrics (`concord_websocket_connections_total`) for real-time visibility
- Add a `ConcordWebSocketConnectionsDrop` alert: if connected count drops by >80% in 1 minute
- Stagger client reconnection: Socket.IO default exponential backoff is good, but consider setting `randomizationFactor: 0.5` to spread reconnections
- Add error handlers to every Socket.IO namespace and event handler so one bad event does not crash the namespace
- Implement per-IP connection limits in nginx or the Socket.IO middleware to prevent connection floods
- Test reconnect storm behavior in staging by doing a rolling restart with clients connected
