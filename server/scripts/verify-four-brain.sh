#!/bin/bash
# verify-four-brain.sh — Post-merge recursive verification for all four brains.
# Runs tests, triggers repair cortex for failures, repeats until green or max cycles.

set -uo pipefail

echo "========================================"
echo "FOUR-BRAIN INTEGRATION VERIFICATION"
echo "========================================"

MAX_CYCLES=10
CYCLE=0
BASE_DIR="${1:-/var/www/concord-cognitive-engine}"
API_URL="${2:-http://localhost:5050}"

# Step 1: Verify all four brains are online
echo "[verify] Checking brain endpoints..."
for PORT in 11434 11435 11436 11437; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/tags" 2>/dev/null || echo "000")
  if [ "$RESPONSE" = "200" ]; then
    echo "[verify] Port $PORT — ONLINE"
  else
    echo "[verify] Port $PORT — OFFLINE (status: $RESPONSE). Aborting."
    exit 1
  fi
done

# Step 2: Verify CPU pinning
echo "[verify] Checking CPU affinity..."
for PID in $(pgrep -f "ollama serve" 2>/dev/null); do
  AFFINITY=$(taskset -p "$PID" 2>/dev/null | grep -o '[0-9a-f]*$' || echo "unknown")
  echo "[verify] PID $PID affinity: $AFFINITY"
done

# Step 3: Run the recursive repair loop
echo "[verify] Starting recursive repair loop..."

while [ "$CYCLE" -lt "$MAX_CYCLES" ]; do
  CYCLE=$((CYCLE + 1))
  echo ""
  echo "========== CYCLE $CYCLE of $MAX_CYCLES =========="

  ISSUES=0

  # Run server tests
  echo "[cycle $CYCLE] Running server tests..."
  SERVER_RESULT=$(cd "$BASE_DIR/server" && node --test tests/**/*.test.js 2>&1) || true
  SERVER_PASS=$(echo "$SERVER_RESULT" | grep "^# pass" | awk '{print $3}')
  SERVER_FAIL=$(echo "$SERVER_RESULT" | grep "^# fail" | awk '{print $3}')
  echo "[cycle $CYCLE] Server: ${SERVER_PASS:-0} passed, ${SERVER_FAIL:-0} failed"
  [ "${SERVER_FAIL:-0}" != "0" ] && ISSUES=$((ISSUES + 1))

  # Run TypeScript check
  echo "[cycle $CYCLE] Running TypeScript check..."
  TSC_RESULT=$(cd "$BASE_DIR/concord-frontend" && npx tsc --noEmit 2>&1) || true
  TSC_ERRORS=$(echo "$TSC_RESULT" | grep -c "error TS" || echo "0")
  echo "[cycle $CYCLE] TypeScript errors: $TSC_ERRORS"
  [ "$TSC_ERRORS" != "0" ] && ISSUES=$((ISSUES + 1))

  # Run build
  echo "[cycle $CYCLE] Running build check..."
  BUILD_RESULT=$(cd "$BASE_DIR/concord-frontend" && npm run build 2>&1)
  BUILD_STATUS=$?
  echo "[cycle $CYCLE] Build: $([ $BUILD_STATUS -eq 0 ] && echo 'PASS' || echo 'FAIL')"
  [ $BUILD_STATUS -ne 0 ] && ISSUES=$((ISSUES + 1))

  # Check if everything passes
  if [ "$ISSUES" -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "ALL GREEN after $CYCLE cycle(s)"
    echo "========================================"

    # Test the repair cortex itself
    echo "[verify] Testing repair cortex brain..."
    REPAIR_TEST=$(curl -s -X POST "$API_URL/api/admin/repair/trigger" \
      -H "Content-Type: application/json" \
      -d '{"type":"test","message":"Verification test - ignore"}' 2>/dev/null || echo '{"error":"unreachable"}')
    echo "[verify] Repair cortex response: $REPAIR_TEST"

    # Verify brain health
    echo "[verify] Checking brain health..."
    curl -s "$API_URL/api/brain/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "[verify] Brain health endpoint unreachable"

    echo ""
    echo "VERIFICATION COMPLETE — SYSTEM IS PRODUCTION READY"
    exit 0
  fi

  # Not green — trigger repair cortex for each failure
  echo "[cycle $CYCLE] Triggering repair cortex..."

  if [ "${SERVER_FAIL:-0}" != "0" ]; then
    FAILURES=$(echo "$SERVER_RESULT" | grep -E "✗|FAIL|not ok" | head -5)
    curl -s -X POST "$API_URL/api/admin/repair/trigger" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"test-failure\",\"message\":\"$FAILURES\"}" 2>/dev/null || true
  fi

  if [ "$TSC_ERRORS" != "0" ]; then
    TS_ERRORS=$(echo "$TSC_RESULT" | grep "error TS" | head -5)
    curl -s -X POST "$API_URL/api/admin/repair/trigger" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"type-error\",\"message\":\"$TS_ERRORS\"}" 2>/dev/null || true
  fi

  if [ $BUILD_STATUS -ne 0 ]; then
    BUILD_ERR=$(echo "$BUILD_RESULT" | grep -iE "Error|error" | head -5)
    curl -s -X POST "$API_URL/api/admin/repair/trigger" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"build-error\",\"message\":\"$BUILD_ERR\"}" 2>/dev/null || true
  fi

  # Wait for repairs to apply
  sleep 10
done

echo ""
echo "========================================"
echo "WARNING: $MAX_CYCLES cycles exhausted"
echo "Remaining issues need manual intervention"
echo "========================================"
exit 1
