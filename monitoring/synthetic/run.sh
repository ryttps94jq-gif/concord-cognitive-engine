#!/usr/bin/env bash
# Concord Synthetic Monitor Runner
#
# Runs critical-paths.js and optionally pushes results to Prometheus Pushgateway.
#
# Usage (add to crontab for 1-minute checks):
#   * * * * * /path/to/concord/monitoring/synthetic/run.sh >> /var/log/concord-synthetic.log 2>&1
#
# Environment variables:
#   BASE_URL              Target URL (default: http://localhost:5050)
#   PUSHGATEWAY_URL       Prometheus Pushgateway URL (optional)
#   ALERT_WEBHOOK_URL     Slack/webhook URL for failure alerts (optional)
#   CHECK_TIMEOUT_MS      Per-check timeout in ms (default: 5000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_PREFIX="[concord-synthetic $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

export BASE_URL="${BASE_URL:-http://localhost:5050}"
export CHECK_TIMEOUT_MS="${CHECK_TIMEOUT_MS:-5000}"

echo "$LOG_PREFIX Running checks against $BASE_URL"

# Run checks and capture output
OUTPUT=$(node "$SCRIPT_DIR/critical-paths.js" 2>&1) || CHECK_EXIT=$?
CHECK_EXIT="${CHECK_EXIT:-0}"

echo "$OUTPUT"

# Push metrics to Prometheus Pushgateway if configured
if [[ -n "${PUSHGATEWAY_URL:-}" ]]; then
  # Build prometheus metrics from output
  METRICS=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^(PASS|FAIL)\ ([a-z_-]+)\ status=([0-9]+)\ duration=([0-9]+)ms ]]; then
      check_name="${BASH_REMATCH[2]}"
      check_status="${BASH_REMATCH[1]}"
      duration_ms="${BASH_REMATCH[4]}"
      pass_val=$([[ "$check_status" == "PASS" ]] && echo 1 || echo 0)
      METRICS+="concord_synthetic_check_pass{check=\"${check_name}\"} ${pass_val}\n"
      METRICS+="concord_synthetic_check_duration_ms{check=\"${check_name}\"} ${duration_ms}\n"
    fi
  done <<< "$OUTPUT"

  if [[ -n "$METRICS" ]]; then
    printf "# HELP concord_synthetic_check_pass 1 if check passed, 0 if failed\n# TYPE concord_synthetic_check_pass gauge\n%b" "$METRICS" | \
      curl --silent --max-time 5 --data-binary @- \
        "${PUSHGATEWAY_URL}/metrics/job/concord_synthetic" || \
      echo "$LOG_PREFIX Warning: failed to push metrics to Pushgateway"
  fi
fi

if [[ $CHECK_EXIT -ne 0 ]]; then
  echo "$LOG_PREFIX ALERT: $CHECK_EXIT check(s) failed"
  exit 1
fi

echo "$LOG_PREFIX All checks passed"
exit 0
