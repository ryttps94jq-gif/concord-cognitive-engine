#!/bin/bash
# Concord full startup sequence — correct boot order to prevent brain-before-model errors.
# Run: bash scripts/start-concord.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export PATH="/workspace/node-v20.18.0-linux-x64/bin:$PATH"
export NODE_ENV="${NODE_ENV:-production}"

echo "[concord] Starting full stack..."

# 1. Start Ollama (if not already running)
if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
  if [ -f /workspace/start-ollama.sh ]; then
    pm2 start /workspace/start-ollama.sh --name concord-ollama --interpreter bash 2>/dev/null || true
  fi
  echo "[concord] Waiting for Ollama..."
  until curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; do sleep 2; done
  echo "[concord] Ollama is up."
fi

# 2. Warm all models at correct context sizes (prevents default 32768 VRAM blow)
if [ -f "$SCRIPT_DIR/warm-models.sh" ]; then
  echo "[concord] Warming models..."
  bash "$SCRIPT_DIR/warm-models.sh"
fi

# 3. Start backend (AFTER models loaded)
echo "[concord] Starting backend..."
pm2 start "$PROJECT_ROOT/server/server.js" \
  --name concord-backend \
  --cwd "$PROJECT_ROOT/server" \
  --max-memory-restart 4G \
  2>/dev/null || true

# 4. Wait for backend health
echo "[concord] Waiting for backend..."
until curl -s http://127.0.0.1:5050/api/status > /dev/null 2>&1; do sleep 2; done
echo "[concord] Backend is up."

# 5. Start frontend (standalone build)
echo "[concord] Starting frontend..."
if [ -f /workspace/start-frontend.sh ]; then
  pm2 start /workspace/start-frontend.sh --name concord-frontend --interpreter bash 2>/dev/null || true
elif [ -f "$SCRIPT_DIR/start-frontend.sh" ]; then
  pm2 start "$SCRIPT_DIR/start-frontend.sh" --name concord-frontend --interpreter bash 2>/dev/null || true
fi

# 6. Start tunnel (if available)
if [ -f /workspace/start-tunnel.sh ]; then
  echo "[concord] Starting tunnel..."
  pm2 start /workspace/start-tunnel.sh --name concord-tunnel --interpreter bash 2>/dev/null || true
fi

pm2 save 2>/dev/null || true
echo "[concord] All services started. Run 'pm2 list' to verify."
