# Redis sticky sessions — prep (not activated on 16 GB Mac)

**Status (2026-09-09):** docs + nginx example + code notes. **Do not** bootstrap a
second Node process on the 16 GB self-host (swap-maxed). Activate on A40 / a box
with RAM headroom together with `docs/MULTI_INSTANCE_LAUNCHD.md`.

## Why

Tier S chat/session state (`STATE.sessions`, socket.io rooms, `_SESSION_ACTIVITY`)
is process-local. Multi-HTTP only stays correct if a given browser session sticks
to one worker **or** those maps move to Redis. Sticky is the interim (audit §2 /
§4); Redis adapter for socket.io already exists when `REDIS_URL` is set
(`server/server.js` `@socket.io/redis-adapter`).

## Already in tree

| Piece | Where |
|---|---|
| `IS_HEARTBEAT_NODE` / `NODE_APP_INSTANCE` | `server/server.js` — only instance `0` runs governor tick |
| Dual-instance launchd examples | `infra/launchd/*.plist.example` |
| socket.io Redis adapter | `server/server.js` (~10279) when Redis connects |
| Token blacklist Redis write-through | `_TOKEN_BLACKLIST` |

## Nginx sticky (cookie) — example

See `infra/nginx/sticky-sessions.conf.example`.

- Cookie name: `concord_upstream` (HttpOnly, Secure, SameSite=Lax).
- Upstream: `concord_backend` with `least_conn` or round-robin + `sticky cookie`.
- Apply sticky to `/api/chat/`, `/socket.io/`, `/godot-ws` (and optionally `/api/lens/run` until Tier U write-through lands).
- Health / public GETs can bypass sticky (`/api/system/health`, static).

`nginx-sticky-module-ng` **or** open-source `sticky cookie` (nginx plus /
`nginx-module-sticky`) — pick what the A40 box already ships; the example uses
the widely packaged `sticky cookie` directive. If unavailable, `ip_hash` is an
acceptable interim (weaker with mobile/CGNAT).

## Redis session affinity helper (optional)

When Redis is up, workers may publish a soft map:

```
SET concord:sticky:<sessionId> <nodeId> EX 86400
```

Node does **not** require this for correctness if nginx sticky holds; it is a
debug/observability aid and a future hook for draining a worker.

Env (inert until multi-instance):

| Env | Default | Meaning |
|---|---|---|
| `CONCORD_STICKY_REDIS=0` | off | When `1`, record sticky map on chat session touch |
| `CONCORD_NODE_ID` | `hostname:PORT` | Value written to the sticky key |

## Activation order (A40 only)

1. RAM headroom confirmed; DTU sidecar running.
2. Redis up (`REDIS_URL`); confirm socket.io adapter log line.
3. Bootstrap instance 0 + 1 per `MULTI_INSTANCE_LAUNCHD.md` (heartbeat only on 0).
4. Enable nginx sticky example; reload nginx; **do not** use pm2 cluster.
5. Chaos: open two chat sessions on different browsers; confirm both healthy and
   no cross-talk; kill instance 1 → sticky clients on 1 reconnect to 0.

## Explicitly out of scope here

- Activating N processes on the 16 GB Mac.
- pm2 `exec_mode: cluster` / `pm2 delete`.
- Full Tier U write-through (`gameProfiles`, etc.) — separate pass.
