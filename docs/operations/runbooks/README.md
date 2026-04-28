# Concord Operations Runbooks

This directory contains on-call runbooks for the Concord Cognitive Engine platform. Each runbook covers a specific failure scenario with diagnosis steps, resolution procedures, and prevention guidance.

**Last Updated:** 2026-04-28
**Stack:** Node.js · Express · SQLite · Socket.IO · Prometheus · optional Redis · Ollama
**Server port:** 5050 | **Metrics:** `/metrics` | **Health:** `/health` | **DB path:** `$DATA_DIR`

---

## Runbook Index

| # | File | Alert / Trigger | Severity |
|---|------|-----------------|----------|
| RB-01 | [01-server-down.md](./01-server-down.md) | `ConcordServerDown` — Prometheus cannot scrape backend | critical |
| RB-02 | [02-high-memory.md](./02-high-memory.md) | `ConcordHighMemory` / `ConcordMemoryCritical` — heap > 85% or > 1.7 GB | warning / critical |
| RB-03 | [03-brain-offline.md](./03-brain-offline.md) | `ConcordBrainAllDown` / `ConcordSlowBrain` / `ConcordBrainErrors` — Ollama / AI unavailable | critical / warning |
| RB-04 | [04-no-heartbeat.md](./04-no-heartbeat.md) | `ConcordNoHeartbeat` — heartbeat ticks stopped for 3+ minutes | critical |
| RB-05 | [05-synthetic-check-failing.md](./05-synthetic-check-failing.md) | `ConcordSyntheticCheckFailing` — a critical-path check failing for 2+ minutes | warning |
| RB-06 | [06-database-locked.md](./06-database-locked.md) | `SQLITE_BUSY` / `health-db` 503 / WAL growth | critical |
| RB-07 | [07-redis-unavailable.md](./07-redis-unavailable.md) | Redis `ECONNREFUSED` — optional dependency down | warning |
| RB-08 | [08-high-error-rate.md](./08-high-error-rate.md) | HTTP 500 spike — elevated error rate on any route | critical / warning |
| RB-09 | [09-websocket-disconnect-storm.md](./09-websocket-disconnect-storm.md) | Mass Socket.IO disconnects / `health-ws` failing | critical / warning |
| RB-10 | [10-disk-full.md](./10-disk-full.md) | `ENOSPC` / `SQLITE_FULL` — disk space exhausted | critical |

---

## Alert → Runbook Quick Reference

| Prometheus Alert | Runbook |
|---|---|
| `ConcordServerDown` | [RB-01](./01-server-down.md) |
| `ConcordHighMemory` | [RB-02](./02-high-memory.md) |
| `ConcordMemoryCritical` | [RB-02](./02-high-memory.md) |
| `ConcordBrainAllDown` | [RB-03](./03-brain-offline.md) |
| `ConcordSlowBrain` | [RB-03](./03-brain-offline.md) |
| `ConcordBrainErrors` | [RB-03](./03-brain-offline.md) |
| `ConcordNoHeartbeat` | [RB-04](./04-no-heartbeat.md) |
| `ConcordSyntheticCheckFailing` | [RB-05](./05-synthetic-check-failing.md) |
| `ConcordUptime` (info) | [RB-01](./01-server-down.md) |
| `health-db` check failing | [RB-06](./06-database-locked.md) |
| Redis connection errors | [RB-07](./07-redis-unavailable.md) |
| HTTP 500 spike | [RB-08](./08-high-error-rate.md) |
| `health-ws` check failing | [RB-09](./09-websocket-disconnect-storm.md) |
| `ENOSPC` / disk full | [RB-10](./10-disk-full.md) |

---

## Synthetic Checks Covered

The following checks from `monitoring/synthetic/critical-paths.js` are covered in [RB-05](./05-synthetic-check-failing.md):

| Check | Endpoint | Related Runbook(s) |
|---|---|---|
| `homepage-loads` | `GET /` | RB-05, RB-01 |
| `health-endpoint` | `GET /health` | RB-05, RB-01 |
| `ready-endpoint` | `GET /ready` | RB-05 |
| `health-db` | `GET /api/health/db` | RB-05, RB-06 |
| `health-ws` | `GET /api/health/ws` | RB-05, RB-09 |
| `auth-endpoint-responds` | `GET /api/auth/csrf-token` | RB-05, RB-08 |
| `brain-status` | `GET /api/brain/status` | RB-05, RB-03 |
| `metrics-endpoint` | `GET /metrics` | RB-05 |
| `api-status` | `GET /api/status` | RB-05, RB-08 |

---

## Runbook Format

Each runbook follows this structure:

1. **Symptoms** — what you observe when the incident occurs
2. **Immediate Actions** — steps to take within the first 5 minutes
3. **Diagnosis** — shell commands to understand root cause
4. **Resolution Steps** — step-by-step fix procedures organized by scenario
5. **Verification** — commands to confirm the incident is resolved
6. **Escalation** — when and to whom to escalate
7. **Prevention** — long-term measures to prevent recurrence

---

## Common First-Response Commands

```bash
# Server health
curl -s http://localhost:5050/health

# API status
curl -s http://localhost:5050/api/status

# All synthetic checks
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js

# Full smoke test
bash /home/user/concord-cognitive-engine/server/scripts/smoke.sh http://localhost:5050

# Process status
pm2 list

# Recent logs
pm2 logs concord-backend --lines 100 --nostream

# Metrics snapshot
curl -s http://localhost:5050/metrics | grep "^concord_" | head -30

# Disk usage
df -h / && du -sh "${DATA_DIR:-/home/user/concord-cognitive-engine/data}"

# Database integrity
sqlite3 "${DATA_DIR:-/home/user/concord-cognitive-engine/data}/concord.db" "PRAGMA integrity_check;"
```

---

## Monitoring Stack Reference

| Component | Location | Purpose |
|---|---|---|
| Prometheus | `monitoring/prometheus/prometheus.yml` | Scrapes `backend:5050/metrics` and `pushgateway:9091` |
| Alert rules | `monitoring/prometheus/alerts.yml` | Defines all Prometheus alert conditions |
| Synthetic monitor | `monitoring/synthetic/critical-paths.js` | Runs 9 critical-path checks every minute |
| Pushgateway | `pushgateway:9091` | Receives synthetic check results from the monitor |
| Smoke tests | `server/scripts/smoke.sh` | Manual post-deploy functional verification |
