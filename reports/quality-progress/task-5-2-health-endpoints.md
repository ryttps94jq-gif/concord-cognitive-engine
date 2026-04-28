# Task 5.2: Health Check Endpoints

**Date:** 2026-04-28

---

## Pre-existing Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /health` | ✅ Exists | Comprehensive — checks DB, memory pressure, postgres, redis, save failures. Returns `{status, version, uptime, checks}` |
| `GET /ready` | ✅ Exists | Checks state initialization, macros loaded, DB. Returns `{ready, checks}` |
| `GET /metrics` | ✅ Exists | Prometheus-compatible text format — entities, DTUs, brain stats, memory, uptime |
| `GET /api/brain/health` | ✅ Exists | Probes Ollama for each brain via `/api/tags`. Failure threshold = 3 consecutive failures before marking offline |
| `GET /api/brain/status` | ✅ Exists | Returns brain configuration and enabled status |
| `GET /api/db/status` | ✅ Exists | Via macro "db"→"status" |
| `GET /api/system/health` | ✅ Exists | System-level health summary |

## Added Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | 307 redirect to `/health` (monitoring tools expecting `/api/` prefix) |
| `GET /api/health/db` | `{status, checks: {sqlite, postgres, redis}}` — each sub-check shows connected status |
| `GET /api/health/ws` | `{status, details: {ready, connectedClients}}` — WebSocket readiness and client count |
| `GET /api/health/brain` | 307 redirect to `/api/brain/health` |

## Response Format

All new endpoints follow the spec format:
```json
{ "status": "healthy" | "degraded" | "unhealthy", "details": {...} }
```

HTTP 200 for healthy/degraded, 503 for unhealthy.

## Changes

- `server/routes/system.js`: Added 4 endpoints after existing `/ready` handler
- `server/server.js`: Added `globalThis._concordREALTIME = REALTIME` after Socket.IO initialization so `/api/health/ws` can check WebSocket state without a module dependency cycle
