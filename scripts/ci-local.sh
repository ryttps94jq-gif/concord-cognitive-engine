#!/usr/bin/env bash
#
# ci-local.sh — Run the same checks GitHub CI runs, locally.
# Mirrors .github/workflows/ci.yml step-by-step.
#
# Usage:
#   ./scripts/ci-local.sh              # run all jobs
#   ./scripts/ci-local.sh lint-test     # only Lint & Test (server + frontend)
#   ./scripts/ci-local.sh mobile       # only Mobile Lint, Typecheck & Test
#   ./scripts/ci-local.sh mobile-perf  # only Mobile Performance Tests
#   ./scripts/ci-local.sh security     # only Security Scan
#   ./scripts/ci-local.sh docker       # only Docker Build
#   ./scripts/ci-local.sh smoke        # only Smoke Test
#   ./scripts/ci-local.sh integration  # only Integration Test (needs Redis)
#   ./scripts/ci-local.sh e2e          # only E2E Tests (needs Playwright)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
SKIP=0
FAILED_JOBS=()

# ── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

step() {
  echo -e "\n${BLUE}${BOLD}▶ $1${RESET}"
}

pass() {
  echo -e "${GREEN}✓ $1${RESET}"
  ((PASS++))
}

fail() {
  echo -e "${RED}✗ $1${RESET}"
  ((FAIL++))
  FAILED_JOBS+=("$1")
}

skip() {
  echo -e "${YELLOW}⊘ $1 (skipped)${RESET}"
  ((SKIP++))
}

run_step() {
  local name="$1"
  shift
  step "$name"
  if "$@"; then
    pass "$name"
  else
    fail "$name"
    if [[ "${CI_FAIL_FAST:-}" == "1" ]]; then
      echo -e "${RED}Stopping early (CI_FAIL_FAST=1)${RESET}"
      summary
      exit 1
    fi
  fi
}

summary() {
  echo -e "\n${BOLD}═══════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  CI Local Results${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${RESET}"
  echo -e "  ${GREEN}Passed:  $PASS${RESET}"
  echo -e "  ${RED}Failed:  $FAIL${RESET}"
  echo -e "  ${YELLOW}Skipped: $SKIP${RESET}"
  if [[ ${#FAILED_JOBS[@]} -gt 0 ]]; then
    echo -e "\n  ${RED}Failed jobs:${RESET}"
    for job in "${FAILED_JOBS[@]}"; do
      echo -e "    ${RED}• $job${RESET}"
    done
  fi
  echo -e "${BOLD}═══════════════════════════════════════════════════${RESET}"
}

should_run() {
  local job="$1"
  [[ -z "${TARGET:-}" ]] || [[ "$TARGET" == "$job" ]]
}

# ── Parse args ───────────────────────────────────────────────────────────────

TARGET="${1:-}"

# ── Job: Lint & Test (server + frontend) ─────────────────────────────────────

if should_run "lint-test"; then
  echo -e "\n${BOLD}━━━ JOB: Lint & Test (server + frontend) ━━━${RESET}"

  run_step "Server: lint" \
    bash -c "cd '$ROOT/server' && npm run lint"

  run_step "Server: typecheck" \
    bash -c "cd '$ROOT/server' && npm run typecheck"

  run_step "Server: check emergent module dependencies" \
    bash -c "cd '$ROOT/server' && npm run check-deps"

  run_step "Frontend: lint" \
    bash -c "cd '$ROOT/concord-frontend' && npm run lint"

  run_step "Frontend: validate lens quality gate" \
    bash -c "cd '$ROOT/concord-frontend' && npm run validate-lens-quality"

  run_step "Frontend: build" \
    bash -c "cd '$ROOT/concord-frontend' && npm run build"

  run_step "Frontend: unit tests with coverage" \
    bash -c "cd '$ROOT/concord-frontend' && npm run test:coverage"

  run_step "Server: tests with coverage" \
    bash -c "cd '$ROOT/server' && NODE_ENV=test JWT_SECRET=test-secret-for-ci-only-do-not-use-in-production ADMIN_PASSWORD=testpassword123 npx c8 --check-coverage --statements 45 --branches 45 --functions 38 --lines 45 node --test --test-force-exit --test-timeout 15000 tests/*.test.js"
fi

# ── Job: Mobile Lint, Typecheck & Test ───────────────────────────────────────

if should_run "mobile"; then
  echo -e "\n${BOLD}━━━ JOB: Mobile Lint, Typecheck & Test ━━━${RESET}"

  run_step "Mobile: lint" \
    bash -c "cd '$ROOT/concord-mobile' && npm run lint"

  run_step "Mobile: typecheck" \
    bash -c "cd '$ROOT/concord-mobile' && npm run typecheck"

  run_step "Mobile: unit tests with coverage" \
    bash -c "cd '$ROOT/concord-mobile' && npm run test:coverage"
fi

# ── Job: Mobile Performance Tests ────────────────────────────────────────────

if should_run "mobile-perf"; then
  echo -e "\n${BOLD}━━━ JOB: Mobile Performance Tests ━━━${RESET}"

  run_step "Mobile: performance benchmarks" \
    bash -c "cd '$ROOT/concord-mobile' && npx jest --testPathPattern='perf/' --testPathIgnorePatterns='/node_modules/' '/e2e/' --no-coverage"
fi

# ── Job: Security Scan ───────────────────────────────────────────────────────

if should_run "security"; then
  echo -e "\n${BOLD}━━━ JOB: Security Scan ━━━${RESET}"

  run_step "Server: npm audit (critical)" \
    bash -c "cd '$ROOT/server' && npm audit --audit-level=critical"

  run_step "Frontend: npm audit (critical)" \
    bash -c "cd '$ROOT/concord-frontend' && npm audit --audit-level=critical"

  run_step "Mobile: npm audit (critical)" \
    bash -c "cd '$ROOT/concord-mobile' && npm audit --audit-level=critical"
fi

# ── Job: Docker Build ────────────────────────────────────────────────────────

if should_run "docker"; then
  echo -e "\n${BOLD}━━━ JOB: Docker Build ━━━${RESET}"

  if command -v docker &>/dev/null; then
    run_step "Docker: build backend image" \
      bash -c "cd '$ROOT/server' && docker build -t concord-backend:test ."

    run_step "Docker: build frontend image" \
      bash -c "cd '$ROOT/concord-frontend' && docker build -t concord-frontend:test ."
  else
    skip "Docker Build (docker not available)"
  fi
fi

# ── Job: Smoke Test ──────────────────────────────────────────────────────────

if should_run "smoke"; then
  echo -e "\n${BOLD}━━━ JOB: Smoke Test ━━━${RESET}"

  run_step "Smoke: migration + server + smoke tests" \
    bash -c "
      cd '$ROOT/server'
      export NODE_ENV=ci PORT=5050 DATA_DIR=/tmp/concord-ci-smoke
      export JWT_SECRET=test-secret-for-ci-only-do-not-use-in-production
      export ADMIN_PASSWORD=testpassword123 AUTH_MODE=public
      rm -rf /tmp/concord-ci-smoke && mkdir -p /tmp/concord-ci-smoke
      node migrate.js
      node server.js > /tmp/concord-ci-smoke/server.log 2>&1 &
      SERVER_PID=\$!
      trap 'kill \$SERVER_PID 2>/dev/null || true' EXIT
      for i in \$(seq 1 30); do
        curl -sf http://localhost:5050/ready >/dev/null 2>&1 && break
        sleep 1
      done
      curl -sf http://localhost:5050/ready >/dev/null 2>&1 || { cat /tmp/concord-ci-smoke/server.log; exit 1; }
      bash scripts/smoke.sh http://localhost:5050
    "
fi

# ── Job: Integration Test ────────────────────────────────────────────────────

if should_run "integration"; then
  echo -e "\n${BOLD}━━━ JOB: Integration Test ━━━${RESET}"

  if redis-cli ping &>/dev/null 2>&1; then
    run_step "Integration: server + auth-security tests" \
      bash -c "
        cd '$ROOT/server'
        export NODE_ENV=ci PORT=5050
        export JWT_SECRET=test-secret-for-ci-only-do-not-use-in-production
        export ADMIN_PASSWORD=testpassword123
        export REDIS_URL=redis://localhost:6379
        node server.js > /tmp/concord-integration.log 2>&1 &
        SERVER_PID=\$!
        trap 'kill \$SERVER_PID 2>/dev/null || true' EXIT
        for i in \$(seq 1 30); do
          curl -sf http://localhost:5050/health >/dev/null 2>&1 && break
          sleep 1
        done
        curl -sf http://localhost:5050/health >/dev/null 2>&1 || { cat /tmp/concord-integration.log; exit 1; }
        API_BASE=http://localhost:5050 node --test tests/auth-security.test.js
      "
  else
    skip "Integration Test (Redis not running — start with: redis-server)"
  fi
fi

# ── Job: E2E Tests ───────────────────────────────────────────────────────────

if should_run "e2e"; then
  echo -e "\n${BOLD}━━━ JOB: E2E Tests ━━━${RESET}"

  if npx playwright --version &>/dev/null 2>&1; then
    run_step "E2E: Playwright (chromium + firefox)" \
      bash -c "
        cd '$ROOT/server'
        export NODE_ENV=ci PORT=5050
        export JWT_SECRET=test-secret-for-ci-only-do-not-use-in-production
        export ADMIN_PASSWORD=testpassword123
        node server.js > /tmp/concord-e2e.log 2>&1 &
        SERVER_PID=\$!
        trap 'kill \$SERVER_PID 2>/dev/null || true' EXIT
        for i in \$(seq 1 30); do
          curl -sf http://localhost:5050/health >/dev/null 2>&1 && break
          sleep 1
        done
        cd '$ROOT/concord-frontend'
        BASE_URL=http://localhost:3000 NEXT_PUBLIC_API_URL=http://localhost:5050 npx playwright test --project=chromium --project=firefox
      "
  else
    skip "E2E Tests (Playwright not installed — run: npx playwright install)"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

summary

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
