# Task 5.1: Synthetic Monitoring

**Date:** 2026-04-28  
**Approach:** Self-hosted (cron + Node.js) integrated with existing Prometheus + Grafana stack

---

## Files Created

| File | Purpose |
|------|---------|
| `monitoring/synthetic/critical-paths.js` | 9 critical path checks — health, ready, db, ws, brain, auth, metrics, api-status |
| `monitoring/synthetic/run.sh` | Shell wrapper for cron; optionally pushes to Prometheus Pushgateway |
| `monitoring/prometheus/alerts.yml` | 9 Prometheus alert rules covering server down, memory, brain errors, heartbeat, synthetic failures |
| `monitoring/prometheus/prometheus.yml` | Updated: added `rule_files` reference + synthetic pushgateway scrape target |

---

## Checks Configured

| Check | Endpoint | Validates |
|-------|----------|-----------|
| `homepage-loads` | `GET /` | `ok: true` in body |
| `health-endpoint` | `GET /health` | `status` is "healthy" or "degraded" |
| `ready-endpoint` | `GET /ready` | `ready` is boolean |
| `health-db` | `GET /api/health/db` | Has `status` and `checks` fields |
| `health-ws` | `GET /api/health/ws` | Has `status` field |
| `auth-endpoint-responds` | `GET /api/auth/csrf-token` | Any 2xx/4xx (not 5xx or timeout) |
| `brain-status` | `GET /api/brain/status` | 200 OK |
| `metrics-endpoint` | `GET /metrics` | Response body contains `concord_` |
| `api-status` | `GET /api/status` | `ok: true` |

---

## Alert Rules

| Alert | Trigger | Severity |
|-------|---------|----------|
| `ConcordServerDown` | Prometheus cannot scrape for 1 min | critical |
| `ConcordHighMemory` | Heap > 85% for 5 min | warning |
| `ConcordMemoryCritical` | Heap > 1.7 GB for 2 min | critical |
| `ConcordBrainErrors` | Brain error rate > 0.1/s for 5 min | warning |
| `ConcordBrainAllDown` | All brains disabled for 2 min | critical |
| `ConcordSlowBrain` | Brain latency > 30s for 5 min | warning |
| `ConcordNoHeartbeat` | No heartbeat ticks in 5 min for 3 min | critical |
| `ConcordSyntheticCheckFailing` | Any synthetic check failing for 2 min | warning |
| `ConcordUptime` | Uptime < 60s (restart detection) | info |

---

## Deployment

### Cron (every minute)

```bash
# Add to crontab:
* * * * * BASE_URL=https://concord-os.org ALERT_WEBHOOK_URL=https://hooks.slack.com/... \
  /path/to/concord/monitoring/synthetic/run.sh >> /var/log/concord-synthetic.log 2>&1
```

### With Pushgateway (metrics in Prometheus)

```bash
PUSHGATEWAY_URL=http://pushgateway:9091 \
BASE_URL=https://concord-os.org \
monitoring/synthetic/run.sh
```

### Manual run

```bash
BASE_URL=http://localhost:5050 node monitoring/synthetic/critical-paths.js
```

### Alert webhook

Set `ALERT_WEBHOOK_URL` to a Slack incoming webhook URL. Failed checks POST a message automatically.
