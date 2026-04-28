#!/usr/bin/env bash
# Run all lens E2E test suites and write results to reports/lens-e2e-results.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="${REPO_ROOT}/reports"
REPORT_FILE="${REPORT_DIR}/lens-e2e-results.md"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

mkdir -p "$REPORT_DIR"

echo "# Lens E2E Results — ${TIMESTAMP}" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cd "$FRONTEND_DIR"

run_suite() {
  local SUITE_NAME="$1"
  local SPEC_FILE="$2"
  local TMP_OUT="/tmp/lens-e2e-${SUITE_NAME}.txt"

  echo "## ${SUITE_NAME}" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  if npx playwright test "$SPEC_FILE" --project=lens-smoke --reporter=list 2>&1 | tee "$TMP_OUT"; then
    echo "**Status: PASS**" >> "$REPORT_FILE"
  else
    echo "**Status: FAIL**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "### Failures" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -E "✘|FAILED|Error:" "$TMP_OUT" | head -30 >> "$REPORT_FILE" || true
    echo '```' >> "$REPORT_FILE"
  fi
  echo "" >> "$REPORT_FILE"
}

run_suite "Smoke Tests (175 lenses)" "tests/lens-e2e/lens-smoke.spec.ts"
run_suite "Feed Tests (12 lenses × 2)"  "tests/lens-e2e/lens-feed.spec.ts"
run_suite "Creation Tests (5 lenses)"   "tests/lens-e2e/lens-creation.spec.ts"

echo "---" >> "$REPORT_FILE"
echo "Run completed at ${TIMESTAMP}" >> "$REPORT_FILE"

echo ""
echo "Results written to ${REPORT_FILE}"
cat "$REPORT_FILE"
