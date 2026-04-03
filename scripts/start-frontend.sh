#!/bin/bash
# Start the Next.js frontend using the standalone build.
# The standalone build bundles server.js + node_modules — no npx next start needed.
# Static assets must be copied into the standalone dir (see build step below).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/concord-frontend"
STANDALONE_DIR="$FRONTEND_DIR/.next/standalone"

# Verify standalone build exists
if [ ! -f "$STANDALONE_DIR/server.js" ]; then
  echo "[start-frontend] Standalone build not found. Building..."
  cd "$FRONTEND_DIR"
  rm -rf .next
  npm run build

  # Copy static assets into standalone (Next.js doesn't do this automatically)
  cp -r "$FRONTEND_DIR/public" "$STANDALONE_DIR/" 2>/dev/null || true
  cp -r "$FRONTEND_DIR/.next/static" "$STANDALONE_DIR/.next/" 2>/dev/null || true
fi

cd "$STANDALONE_DIR"
PORT="${PORT:-3000}" exec node server.js
