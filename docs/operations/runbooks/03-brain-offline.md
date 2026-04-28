# RB-03: Brain Offline / Slow Brain

**Alert:** `ConcordBrainAllDown` — `sum(concord_brain_enabled) == 0` for 2 minutes
         `ConcordSlowBrain` — `concord_brain_avg_latency_ms > 30000` for 5 minutes
         `ConcordBrainErrors` — brain error rate > 0.1/s for 5 minutes
**Severity:** critical (`ConcordBrainAllDown`) / warning (`ConcordSlowBrain`, `ConcordBrainErrors`)
**Team:** On-call engineer
**Last Updated:** 2026-04-28

## Symptoms
- Prometheus alert `ConcordBrainAllDown` firing: `sum(concord_brain_enabled) == 0`
- `/api/brain/status` returns all brains disabled or error state
- AI-powered features (suggestions, distillation, embeddings, guidance) returning errors or empty results
- `concord_brain_avg_latency_ms` > 30,000 ms sustained
- `concord_brain_errors_total` rate elevated
- Synthetic check `brain-status` failing
- Users report AI responses not working or extremely slow

## Immediate Actions (< 5 min)

1. Check brain status endpoint:
   ```bash
   curl -s http://localhost:5050/api/brain/status | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
   ```
2. Check if Ollama is running:
   ```bash
   curl -sf http://localhost:11434/api/version || echo "Ollama DOWN"
   pgrep -a ollama || echo "Ollama process not found"
   ```
3. If Ollama is down, restart it:
   ```bash
   sudo systemctl restart ollama
   # or
   ollama serve &
   ```
4. If Ollama is up but models are missing:
   ```bash
   ollama list
   ```

## Diagnosis

```bash
# --- Brain status from Concord ---
curl -s http://localhost:5050/api/brain/status

# --- Prometheus metrics for brains ---
curl -s http://localhost:5050/metrics | grep -E 'concord_brain'

# --- Ollama service health ---
curl -s http://localhost:11434/api/version
curl -s http://localhost:11434/api/tags         # list loaded models
curl -s http://localhost:11434/api/ps           # list running models (Ollama >=0.2)

# --- Ollama process and resource usage ---
pgrep -a ollama
ps aux | grep ollama | grep -v grep
# Check GPU availability (if using CUDA/ROCm)
nvidia-smi 2>/dev/null || rocm-smi 2>/dev/null || echo "No GPU tools found"

# --- Ollama logs ---
journalctl -u ollama -n 100 --no-pager
# or if run manually:
# Check the terminal where ollama serve was started

# --- Brain error logs in Concord ---
pm2 logs concord-backend --lines 200 --nostream | grep -iE "brain|ollama|model|timeout|connect ECONNREFUSED"

# --- Network reachability from Concord to Ollama ---
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
curl -sf "$OLLAMA_HOST/api/version" || echo "Cannot reach Ollama at $OLLAMA_HOST"

# --- Environment variable for Ollama host ---
pm2 env concord-backend 2>/dev/null | grep -i ollama
printenv | grep -i ollama
```

## Resolution Steps

### Scenario A — Ollama process is not running

```bash
# Start Ollama
sudo systemctl start ollama
# Wait for it to be ready (up to 30 seconds)
for i in $(seq 1 10); do
  curl -sf http://localhost:11434/api/version && echo "Ollama ready" && break
  sleep 3
done

# Verify the required model is available
ollama list

# If model is missing, pull it (replace with actual model name)
ollama pull llama3.2
# or whichever model Concord is configured to use:
grep -r "model" /home/user/concord-cognitive-engine/server/config/ | grep -i ollama | head -10
```

### Scenario B — Ollama is running but model is missing

```bash
# List available models
ollama list

# Identify which model Concord needs from config or env
grep -r "OLLAMA_MODEL\|ollamaModel\|brain.*model" /home/user/concord-cognitive-engine/server/config/ 2>/dev/null | head -5
printenv | grep -iE "OLLAMA_MODEL|BRAIN_MODEL"

# Pull the missing model (this may take several minutes)
ollama pull <model-name>

# Monitor pull progress
ollama pull <model-name> --insecure 2>&1 | tail -5
```

### Scenario C — ConcordSlowBrain (latency > 30 s)

```bash
# Check system load and memory
uptime
free -h
# Check if GPU is being used (GPU inference is 10-100x faster)
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.free --format=csv 2>/dev/null

# Test Ollama directly with a tiny prompt to measure baseline
time curl -s http://localhost:11434/api/generate \
  -d '{"model":"<model-name>","prompt":"hi","stream":false}' \
  | grep '"done":true'

# If response is slow, Ollama may be CPU-bound — check concurrent requests
curl -s http://localhost:11434/api/ps 2>/dev/null

# Restart Ollama to clear any stuck requests
sudo systemctl restart ollama
sleep 5
```

### Scenario D — Brain enabled in Concord but errors persisting after Ollama recovery

```bash
# Restart Concord to re-initialize brain connections
pm2 restart concord-backend --update-env

# Verify brain re-enables itself
sleep 10
curl -s http://localhost:5050/api/brain/status
curl -s http://localhost:5050/metrics | grep concord_brain_enabled
```

### Scenario E — Temporary disable brain to restore partial service

If Ollama cannot be recovered quickly, disable the brain so the rest of Concord functions:

```bash
# If Concord exposes a brain toggle API (check API docs / admin endpoints):
curl -X POST http://localhost:5050/api/brain/disable \
  -H "Content-Type: application/json" \
  -d '{"reason":"ollama-unavailable"}'

# Or set environment variable and restart
# (brain disable logic depends on implementation)
pm2 restart concord-backend --update-env
```

### Scenario F — Re-enable brain after recovery

```bash
curl -X POST http://localhost:5050/api/brain/enable \
  -H "Content-Type: application/json"
# or restart with brain env var re-enabled
pm2 restart concord-backend --update-env
```

## Verification

```bash
# 1. Ollama is healthy
curl -sf http://localhost:11434/api/version && echo "Ollama OK"

# 2. Model is loaded
ollama list | grep -v "^NAME"

# 3. Brain status shows at least one enabled brain
curl -s http://localhost:5050/api/brain/status

# 4. Prometheus metric shows brain enabled
curl -s http://localhost:5050/metrics | grep 'concord_brain_enabled'
# Expected: concord_brain_enabled{brain="..."} 1

# 5. Brain latency is within threshold
curl -s http://localhost:5050/metrics | grep 'concord_brain_avg_latency_ms'
# Expected: value < 30000

# 6. Synthetic check for brain-status passes
BASE_URL=http://localhost:5050 node /home/user/concord-cognitive-engine/monitoring/synthetic/critical-paths.js 2>&1 | grep brain-status
```

## Escalation

- `ConcordBrainAllDown` not resolved within **15 minutes**: escalate to ML/infrastructure engineer
- Model pull failing (network issues, disk space): check RB-10 for disk space; escalate if network blocked
- GPU OOM or CUDA errors in Ollama logs: escalate to infrastructure team to resize GPU memory or switch to smaller model
- If brain is in a crash-loop with errors: escalate to application engineer to review brain initialization code

## Prevention

- Monitor Ollama as a separate Prometheus target if possible, or add a `/api/health` check that probes Ollama directly
- Pre-pull all required models during deployment so model downloads never happen in production
- Configure Ollama `OLLAMA_NUM_PARALLEL` and `OLLAMA_MAX_LOADED_MODELS` appropriately for available VRAM
- Add a circuit breaker in the brain module: after N consecutive Ollama errors, mark the brain offline and stop sending requests until a health check recovers
- Set up a separate `ConcordBrainErrors` alert dashboard panel to distinguish transient vs. persistent errors
