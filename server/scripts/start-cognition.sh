#!/bin/bash
# start-cognition.sh — Start all four Ollama brain instances with CPU pinning.
# Run on the droplet (bare metal or within a VM with ≥8 cores).

set -euo pipefail

echo "[cognition] Stopping existing Ollama processes..."
pkill -f "ollama serve" 2>/dev/null || true
sleep 2

# Brain 1: Conscious — chat and deep reasoning
echo "[cognition] Starting conscious brain (7B, cores 0-3, port 11434)..."
OLLAMA_HOST=0.0.0.0:11434 taskset -c 0-3 ollama serve &
sleep 3
OLLAMA_HOST=0.0.0.0:11434 ollama pull qwen2.5:7b

# Brain 2: Subconscious — autogen, dream, evolution, synthesis, birth
echo "[cognition] Starting subconscious brain (1.5B, cores 4-5, port 11435)..."
OLLAMA_HOST=0.0.0.0:11435 taskset -c 4-5 ollama serve &
sleep 3
OLLAMA_HOST=0.0.0.0:11435 ollama pull qwen2.5:1.5b

# Brain 3: Utility — lens interactions, entity actions
echo "[cognition] Starting utility brain (3B, cores 6-7, port 11436)..."
OLLAMA_HOST=0.0.0.0:11436 taskset -c 6-7 ollama serve &
sleep 3
OLLAMA_HOST=0.0.0.0:11436 ollama pull qwen2.5:3b

# Brain 4: Repair — error detection, auto-fix (shares cores with subconscious)
echo "[cognition] Starting repair brain (0.5B, cores 4-5, port 11437)..."
OLLAMA_HOST=0.0.0.0:11437 taskset -c 4-5 ollama serve &
sleep 3
OLLAMA_HOST=0.0.0.0:11437 ollama pull qwen2.5:0.5b

echo ""
echo "[cognition] Four brains online"
echo "[conscious]     7B   cores 0-3  port 11434"
echo "[subconscious]  1.5B cores 4-5  port 11435"
echo "[utility]       3B   cores 6-7  port 11436"
echo "[repair]        0.5B cores 4-5  port 11437 (event-driven)"
