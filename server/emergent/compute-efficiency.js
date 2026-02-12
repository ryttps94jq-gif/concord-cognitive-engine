/**
 * Concord — Compute Efficiency Visualizer
 *
 * Tracks LLM calls saved by substrate reuse, cached reasoning paths,
 * and structured knowledge retrieval vs raw generation.
 * This is Concord's differentiation flex over frontier chat.
 */

// ── Efficiency State ─────────────────────────────────────────────────────

function getEfficiencyState(STATE) {
  if (!STATE._efficiency) {
    STATE._efficiency = {
      // Core tracking
      llmCallsSaved: 0,          // times we reused substrate instead of calling LLM
      llmCallsMade: 0,           // actual LLM calls
      substrateLookups: 0,       // times we retrieved from DTU store
      cacheHits: 0,              // times we used cached reasoning
      cacheMisses: 0,

      // By operation type
      byOperation: {
        chat_response:        { saved: 0, made: 0 },
        dtu_synthesis:        { saved: 0, made: 0 },
        autogen_pipeline:     { saved: 0, made: 0 },
        search_retrieval:     { saved: 0, made: 0 },
        contradiction_check:  { saved: 0, made: 0 },
        evidence_attach:      { saved: 0, made: 0 },
        verification:         { saved: 0, made: 0 },
      },

      // Token tracking
      tokensEstimatedSaved: 0,
      tokensActuallyUsed: 0,
      avgTokensPerLlmCall: 500,

      // Cost tracking (estimated)
      costEstimatedSaved: 0,     // dollars
      costActuallySpent: 0,

      // Time tracking
      timeEstimatedSaved: 0,     // ms saved by substrate reuse
      timeActuallySpent: 0,      // ms spent on LLM calls

      // History for visualization
      history: [],               // periodic snapshots
      lastSnapshotAt: 0,

      // Reasoning path cache
      reasoningPaths: new Map(), // query hash → { answer, usedAt, hitCount }
      maxCachedPaths: 1000,
    };
  }
  return STATE._efficiency;
}

// ── Recording Events ─────────────────────────────────────────────────────

/**
 * Record that an LLM call was saved by substrate reuse.
 */
export function recordSubstrateReuse(STATE, operation, details = {}) {
  const eff = getEfficiencyState(STATE);

  eff.llmCallsSaved++;
  eff.substrateLookups++;

  if (eff.byOperation[operation]) {
    eff.byOperation[operation].saved++;
  }

  // Estimate tokens saved
  const tokensSaved = details.estimatedTokens || eff.avgTokensPerLlmCall;
  eff.tokensEstimatedSaved += tokensSaved;

  // Estimate cost saved (roughly $0.001 per 1K tokens for fast model)
  eff.costEstimatedSaved += (tokensSaved / 1000) * 0.001;

  // Estimate time saved (avg 500ms per LLM call)
  const timeSaved = details.estimatedTimeMs || 500;
  eff.timeEstimatedSaved += timeSaved;

  return {
    ok: true,
    operation,
    saved: true,
    totalSaved: eff.llmCallsSaved,
    tokensSaved,
  };
}

/**
 * Record that an actual LLM call was made.
 */
export function recordLlmCall(STATE, operation, details = {}) {
  const eff = getEfficiencyState(STATE);

  eff.llmCallsMade++;

  if (eff.byOperation[operation]) {
    eff.byOperation[operation].made++;
  }

  const tokensUsed = details.tokensUsed || eff.avgTokensPerLlmCall;
  eff.tokensActuallyUsed += tokensUsed;

  const timeSpent = details.timeMs || 500;
  eff.timeActuallySpent += timeSpent;

  eff.costActuallySpent += (tokensUsed / 1000) * 0.001;

  // Update running average
  if (eff.llmCallsMade > 0) {
    eff.avgTokensPerLlmCall = Math.round(eff.tokensActuallyUsed / eff.llmCallsMade);
  }

  return {
    ok: true,
    operation,
    saved: false,
    tokensUsed,
    timeSpent,
  };
}

/**
 * Record a reasoning cache hit or miss.
 */
export function recordCacheEvent(STATE, queryHash, hit, answer = null) {
  const eff = getEfficiencyState(STATE);

  if (hit) {
    eff.cacheHits++;
    const cached = eff.reasoningPaths.get(queryHash);
    if (cached) {
      cached.hitCount++;
      cached.usedAt = Date.now();
    }
  } else {
    eff.cacheMisses++;
    if (answer && eff.reasoningPaths.size < eff.maxCachedPaths) {
      eff.reasoningPaths.set(queryHash, {
        answer,
        createdAt: Date.now(),
        usedAt: Date.now(),
        hitCount: 0,
      });
    }
  }

  return { ok: true, hit, cacheSize: eff.reasoningPaths.size };
}

// ── Efficiency Dashboard ─────────────────────────────────────────────────

/**
 * Get comprehensive efficiency metrics for display.
 */
export function getEfficiencyDashboard(STATE) {
  const eff = getEfficiencyState(STATE);

  const totalOperations = eff.llmCallsSaved + eff.llmCallsMade;
  const reuseRate = totalOperations > 0
    ? Math.round((eff.llmCallsSaved / totalOperations) * 100)
    : 0;

  const cacheHitRate = (eff.cacheHits + eff.cacheMisses) > 0
    ? Math.round((eff.cacheHits / (eff.cacheHits + eff.cacheMisses)) * 100)
    : 0;

  return {
    ok: true,

    // Headline metrics
    headline: {
      llmCallsSaved: eff.llmCallsSaved,
      reuseRate: `${reuseRate}%`,
      tokensEstimatedSaved: eff.tokensEstimatedSaved,
      costEstimatedSaved: `$${eff.costEstimatedSaved.toFixed(4)}`,
      timeEstimatedSaved: formatTime(eff.timeEstimatedSaved),
    },

    // Comparison
    comparison: {
      substrateReuseCount: eff.llmCallsSaved,
      llmCallCount: eff.llmCallsMade,
      reusePercentage: reuseRate,
      cacheHitRate: `${cacheHitRate}%`,
    },

    // By operation
    byOperation: Object.entries(eff.byOperation).map(([op, data]) => ({
      operation: op,
      ...data,
      reuseRate: (data.saved + data.made) > 0
        ? Math.round((data.saved / (data.saved + data.made)) * 100)
        : 0,
    })),

    // Resource usage
    resources: {
      tokensUsed: eff.tokensActuallyUsed,
      tokensSaved: eff.tokensEstimatedSaved,
      costSpent: `$${eff.costActuallySpent.toFixed(4)}`,
      costSaved: `$${eff.costEstimatedSaved.toFixed(4)}`,
      timeSpent: formatTime(eff.timeActuallySpent),
      timeSaved: formatTime(eff.timeEstimatedSaved),
    },

    // Cache stats
    cache: {
      hits: eff.cacheHits,
      misses: eff.cacheMisses,
      hitRate: `${cacheHitRate}%`,
      cachedPaths: eff.reasoningPaths.size,
      maxPaths: eff.maxCachedPaths,
    },

    // Substrate density
    substrateDensity: {
      totalDtus: STATE.dtus?.size || 0,
      substrateLookups: eff.substrateLookups,
      lookupsPerDtu: (STATE.dtus?.size || 1) > 0
        ? Math.round((eff.substrateLookups / (STATE.dtus?.size || 1)) * 100) / 100
        : 0,
    },
  };
}

// ── Snapshot for History ─────────────────────────────────────────────────

export function takeEfficiencySnapshot(STATE) {
  const eff = getEfficiencyState(STATE);
  const now = Date.now();

  if (now - eff.lastSnapshotAt < 300000) {
    return { ok: true, skipped: true };
  }

  const snapshot = {
    ts: now,
    timestamp: new Date().toISOString(),
    llmCallsSaved: eff.llmCallsSaved,
    llmCallsMade: eff.llmCallsMade,
    reuseRate: (eff.llmCallsSaved + eff.llmCallsMade) > 0
      ? Math.round((eff.llmCallsSaved / (eff.llmCallsSaved + eff.llmCallsMade)) * 100)
      : 0,
    tokensSaved: eff.tokensEstimatedSaved,
    costSaved: eff.costEstimatedSaved,
  };

  eff.history.push(snapshot);
  eff.lastSnapshotAt = now;

  // Keep last 288 snapshots
  if (eff.history.length > 288) {
    eff.history = eff.history.slice(-288);
  }

  return { ok: true, snapshot };
}

export function getEfficiencyHistory(STATE, period = "24h") {
  const eff = getEfficiencyState(STATE);
  const now = Date.now();
  const periodMs = period === "24h" ? 86400000 : period === "7d" ? 604800000 : 86400000;

  const history = eff.history.filter(s => now - s.ts < periodMs);
  return { ok: true, history, period, dataPoints: history.length };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
