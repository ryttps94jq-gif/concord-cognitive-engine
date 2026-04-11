#!/bin/bash
# startup.sh — Concord Cognitive Engine startup script
# Survives pod restart. Handles: dependency checks, state recovery, service start.
#
# Usage:
#   ./startup.sh              # Full startup (Docker Compose)
#   ./startup.sh --dev        # Dev mode (no Docker, direct node)
#   ./startup.sh --recover    # Recovery mode (restore from latest backup)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="${DATA_DIR:-/data}/startup.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

# ── Pre-flight checks ──────────────────────────────────────────────
log "=== Concord Cognitive Engine Startup ==="
log "Mode: ${1:-production}"
log "Working directory: $(pwd)"

# Check for .env file
if [ ! -f .env ] && [ "${1:-}" != "--dev" ]; then
  log "WARNING: No .env file found. Copy .env.example to .env and configure."
fi

# ── Dev mode: direct node startup ──────────────────────────────────
if [ "${1:-}" = "--dev" ]; then
  log "Starting in dev mode..."

  # Install deps if needed
  if [ ! -d server/node_modules ]; then
    log "Installing server dependencies..."
    (cd server && npm install)
  fi
  if [ ! -d concord-frontend/node_modules ]; then
    log "Installing frontend dependencies..."
    (cd concord-frontend && npm install)
  fi

  # Start server
  log "Starting backend server..."
  (cd server && node server.js) &
  SERVER_PID=$!

  # Start frontend
  log "Starting frontend dev server..."
  (cd concord-frontend && npm run dev) &
  FRONTEND_PID=$!

  log "Backend PID: $SERVER_PID, Frontend PID: $FRONTEND_PID"
  log "Backend: http://localhost:5050"
  log "Frontend: http://localhost:3000"

  # Trap signals for clean shutdown
  trap "log 'Shutting down...'; kill $SERVER_PID $FRONTEND_PID 2>/dev/null; wait" SIGTERM SIGINT
  wait
  exit 0
fi

# ── Recovery mode ──────────────────────────────────────────────────
if [ "${1:-}" = "--recover" ]; then
  log "Recovery mode: restoring from latest backup..."
  BACKUP_DIR="${DATA_DIR:-./server/data}/backups"
  if [ -d "$BACKUP_DIR" ]; then
    LATEST=$(ls -t "$BACKUP_DIR"/*.json 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
      STATE_PATH="${STATE_PATH:-${DATA_DIR:-./server/data}/concord_state.json}"
      cp "$LATEST" "$STATE_PATH"
      log "Restored from: $LATEST"
    else
      log "No backups found in $BACKUP_DIR"
    fi
  else
    log "Backup directory not found: $BACKUP_DIR"
  fi
fi

# ── Docker Compose startup ────────────────────────────────────────
if command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  if ! docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  fi

  log "Starting with $COMPOSE_CMD..."

  # Ensure data directories exist
  mkdir -p "${DATA_DIR:-/data}/db" "${DATA_DIR:-/data}/backups" 2>/dev/null || true

  # Pull latest images
  log "Pulling images..."
  $COMPOSE_CMD pull --quiet 2>/dev/null || log "Image pull skipped (offline or already up to date)"

  # Start all services
  log "Starting services..."
  $COMPOSE_CMD up -d --remove-orphans

  # Wait for backend health
  log "Waiting for backend health..."
  RETRIES=30
  while [ $RETRIES -gt 0 ]; do
    if curl -sf http://localhost:5050/health >/dev/null 2>&1; then
      log "Backend is healthy!"
      break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 5
  done

  if [ $RETRIES -eq 0 ]; then
    log "WARNING: Backend did not become healthy within timeout"
    $COMPOSE_CMD logs --tail=50 backend
  fi

  # Show status
  $COMPOSE_CMD ps
  log "=== Startup complete ==="
else
  log "ERROR: Docker Compose not found. Install Docker or use --dev mode."
  exit 1
fi
