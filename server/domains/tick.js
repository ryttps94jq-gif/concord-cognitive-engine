// server/domains/tick.js
// Domain actions for system tick/heartbeat: health pulse computation,
// load prediction, and rhythm/periodicity analysis.

export default function registerTickActions(registerLensAction) {
  /**
   * healthPulse
   * Compute system health from tick data: heartbeat regularity, jitter
   * analysis, and dead component detection.
   * artifact.data.ticks = [{ componentId, timestamp, healthy?: bool, metrics?: { cpu?, memory?, latency? } }]
   * params.expectedIntervalMs = expected heartbeat interval (default 5000)
   * params.deadThresholdMultiplier = multiplier for dead detection (default 3)
   */
  registerLensAction("tick", "healthPulse", (ctx, artifact, params) => {
    const ticks = artifact.data?.ticks || [];
    if (ticks.length === 0) return { ok: true, result: { message: "No tick data to analyze." } };

    const expectedInterval = params.expectedIntervalMs || 5000;
    const deadMultiplier = params.deadThresholdMultiplier || 3;
    const deadThreshold = expectedInterval * deadMultiplier;
    const now = Date.now();

    // Group ticks by component
    const componentTicks = {};
    for (const tick of ticks) {
      const id = tick.componentId || "unknown";
      if (!componentTicks[id]) componentTicks[id] = [];
      componentTicks[id].push({
        timestamp: new Date(tick.timestamp).getTime(),
        healthy: tick.healthy !== false,
        metrics: tick.metrics || {},
      });
    }

    const componentHealth = Object.entries(componentTicks).map(([componentId, tickList]) => {
      // Sort by timestamp
      const sorted = tickList.filter(t => !isNaN(t.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
      if (sorted.length === 0) return { componentId, status: "no_data" };

      // Compute inter-tick intervals
      const intervals = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
      }

      // Interval statistics
      let meanInterval = expectedInterval;
      let jitter = 0;
      let jitterPercent = 0;
      if (intervals.length > 0) {
        meanInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
        // Jitter = standard deviation of inter-arrival times
        const variance = intervals.reduce((s, v) => s + Math.pow(v - meanInterval, 2), 0) / intervals.length;
        jitter = Math.sqrt(variance);
        jitterPercent = meanInterval > 0 ? (jitter / meanInterval) * 100 : 0;
      }

      // Dead component detection
      const lastTick = sorted[sorted.length - 1].timestamp;
      const timeSinceLastTick = now - lastTick;
      const isDead = timeSinceLastTick > deadThreshold;

      // Missed heartbeats
      const missedBeats = intervals.filter(i => i > expectedInterval * 1.5).length;
      const missedBeatRate = intervals.length > 0 ? (missedBeats / intervals.length) * 100 : 0;

      // Health status from reported healthy flags
      const unhealthyTicks = sorted.filter(t => !t.healthy).length;
      const healthyRate = sorted.length > 0 ? ((sorted.length - unhealthyTicks) / sorted.length) * 100 : 0;

      // Aggregate metrics
      const metricSummary = {};
      const metricKeys = new Set();
      for (const tick of sorted) {
        for (const key of Object.keys(tick.metrics)) metricKeys.add(key);
      }
      for (const key of metricKeys) {
        const values = sorted.map(t => t.metrics[key]).filter(v => v != null && typeof v === "number");
        if (values.length > 0) {
          metricSummary[key] = {
            avg: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100,
            min: Math.min(...values),
            max: Math.max(...values),
            latest: values[values.length - 1],
          };
        }
      }

      // Component health score (0-100)
      const regularityScore = Math.max(0, 100 - jitterPercent * 2);
      const missedBeatPenalty = Math.min(30, missedBeatRate * 3);
      const deadPenalty = isDead ? 40 : 0;
      const healthReportPenalty = Math.min(20, (100 - healthyRate) * 0.2);
      const healthScore = Math.round(Math.max(0, regularityScore - missedBeatPenalty - deadPenalty - healthReportPenalty) * 100) / 100;

      let status;
      if (isDead) status = "dead";
      else if (healthScore >= 80) status = "healthy";
      else if (healthScore >= 50) status = "degraded";
      else status = "critical";

      return {
        componentId,
        status,
        healthScore,
        heartbeat: {
          totalTicks: sorted.length,
          meanIntervalMs: Math.round(meanInterval),
          expectedIntervalMs: expectedInterval,
          jitterMs: Math.round(jitter * 100) / 100,
          jitterPercent: Math.round(jitterPercent * 100) / 100,
          missedBeats,
          missedBeatRate: Math.round(missedBeatRate * 100) / 100,
        },
        lastSeen: new Date(lastTick).toISOString(),
        timeSinceLastTickMs: timeSinceLastTick,
        isDead,
        healthyRate: Math.round(healthyRate * 100) / 100,
        metrics: metricSummary,
      };
    });

    // System-wide health
    const aliveComponents = componentHealth.filter(c => !c.isDead && c.status !== "no_data");
    const deadComponents = componentHealth.filter(c => c.isDead);
    const avgHealthScore = aliveComponents.length > 0
      ? aliveComponents.reduce((s, c) => s + c.healthScore, 0) / aliveComponents.length
      : 0;

    const systemStatus = deadComponents.length > 0 ? "degraded" :
      avgHealthScore >= 80 ? "healthy" :
      avgHealthScore >= 50 ? "degraded" : "critical";

    artifact.data.healthPulse = { timestamp: new Date().toISOString(), systemStatus, avgHealthScore: Math.round(avgHealthScore * 100) / 100 };

    return {
      ok: true, result: {
        systemStatus,
        avgHealthScore: Math.round(avgHealthScore * 100) / 100,
        components: componentHealth,
        summary: {
          totalComponents: componentHealth.length,
          healthy: componentHealth.filter(c => c.status === "healthy").length,
          degraded: componentHealth.filter(c => c.status === "degraded").length,
          critical: componentHealth.filter(c => c.status === "critical").length,
          dead: deadComponents.length,
        },
        deadComponents: deadComponents.map(c => ({ componentId: c.componentId, lastSeen: c.lastSeen, timeSinceMs: c.timeSinceLastTickMs })),
      },
    };
  });

  /**
   * loadPredict
   * Predict system load using exponential moving average of tick metrics
   * and capacity planning projections.
   * artifact.data.loadHistory = [{ timestamp, cpu, memory, connections?, requestRate? }]
   * params.forecastPeriods = number of future periods to predict (default 10)
   * params.alpha = EMA smoothing factor (default 0.3)
   */
  registerLensAction("tick", "loadPredict", (ctx, artifact, params) => {
    const history = artifact.data?.loadHistory || [];
    if (history.length < 3) return { ok: true, result: { message: "Need at least 3 data points for prediction." } };

    const alpha = params.alpha || 0.3;
    const forecastPeriods = params.forecastPeriods || 10;

    // Sort by timestamp
    const sorted = history
      .map(h => ({ ...h, ts: new Date(h.timestamp).getTime() }))
      .filter(h => !isNaN(h.ts))
      .sort((a, b) => a.ts - b.ts);

    // Identify metric keys
    const metricKeys = ["cpu", "memory", "connections", "requestRate"].filter(k =>
      sorted.some(h => h[k] != null && typeof h[k] === "number")
    );

    // Compute EMA for each metric
    const emaResults = {};
    for (const key of metricKeys) {
      const values = sorted.map(h => h[key] || 0);
      const ema = [values[0]];
      for (let i = 1; i < values.length; i++) {
        ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
      }

      // Double exponential smoothing (Holt's method) for trend
      const level = [values[0]];
      const trend = [values.length > 1 ? values[1] - values[0] : 0];
      for (let i = 1; i < values.length; i++) {
        const newLevel = alpha * values[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
        const newTrend = alpha * (newLevel - level[i - 1]) + (1 - alpha) * trend[i - 1];
        level.push(newLevel);
        trend.push(newTrend);
      }

      // Forecast
      const lastLevel = level[level.length - 1];
      const lastTrend = trend[trend.length - 1];
      const forecast = [];
      for (let i = 1; i <= forecastPeriods; i++) {
        forecast.push(Math.round((lastLevel + lastTrend * i) * 100) / 100);
      }

      // Compute interval between data points
      const avgInterval = sorted.length > 1
        ? (sorted[sorted.length - 1].ts - sorted[0].ts) / (sorted.length - 1)
        : 60000;

      emaResults[key] = {
        currentEma: Math.round(ema[ema.length - 1] * 100) / 100,
        currentValue: values[values.length - 1],
        trend: Math.round(lastTrend * 1000) / 1000,
        trendDirection: lastTrend > 0.01 ? "increasing" : lastTrend < -0.01 ? "decreasing" : "stable",
        forecast,
        forecastInterval: `${Math.round(avgInterval / 1000)}s per period`,
      };
    }

    // Capacity planning
    const capacityThresholds = { cpu: 90, memory: 90, connections: params.maxConnections || 1000, requestRate: params.maxRequestRate || 10000 };
    const capacityProjections = {};
    for (const key of metricKeys) {
      const ema = emaResults[key];
      const threshold = capacityThresholds[key] || 100;
      if (ema.trend > 0) {
        const periodsToThreshold = (threshold - ema.currentEma) / ema.trend;
        capacityProjections[key] = {
          currentUsage: ema.currentEma,
          threshold,
          periodsUntilThreshold: Math.max(0, Math.round(periodsToThreshold)),
          willExceed: periodsToThreshold <= forecastPeriods,
          urgency: periodsToThreshold <= 3 ? "critical" : periodsToThreshold <= 10 ? "warning" : "ok",
        };
      } else {
        capacityProjections[key] = {
          currentUsage: ema.currentEma,
          threshold,
          periodsUntilThreshold: null,
          willExceed: false,
          urgency: "ok",
        };
      }
    }

    // Anomaly detection: values > 2 std dev from EMA
    const anomalies = [];
    for (const key of metricKeys) {
      const values = sorted.map(h => h[key] || 0);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
      const threshold = mean + 2 * stdDev;
      for (let i = 0; i < sorted.length; i++) {
        if (values[i] > threshold) {
          anomalies.push({ metric: key, timestamp: new Date(sorted[i].ts).toISOString(), value: values[i], threshold: Math.round(threshold * 100) / 100 });
        }
      }
    }

    return {
      ok: true, result: {
        predictions: emaResults,
        capacityPlanning: capacityProjections,
        anomalies: anomalies.slice(0, 20),
        parameters: { alpha, forecastPeriods },
        dataPoints: sorted.length,
      },
    };
  });

  /**
   * rhythmAnalysis
   * Analyze system rhythm: periodogram, detect dominant frequencies,
   * and identify phase drift.
   * artifact.data.timeSeries = [{ timestamp, value }]
   */
  registerLensAction("tick", "rhythmAnalysis", (ctx, artifact, params) => {
    const timeSeries = artifact.data?.timeSeries || [];
    if (timeSeries.length < 8) return { ok: true, result: { message: "Need at least 8 data points for rhythm analysis." } };

    // Sort and extract values with uniform resampling
    const sorted = timeSeries
      .map(p => ({ ts: new Date(p.timestamp).getTime(), value: p.value || 0 }))
      .filter(p => !isNaN(p.ts))
      .sort((a, b) => a.ts - b.ts);

    const values = sorted.map(p => p.value);
    const n = values.length;

    // Mean-center the signal
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const centered = values.map(v => v - mean);

    // Compute sample interval
    const totalDuration = sorted[n - 1].ts - sorted[0].ts;
    const sampleInterval = totalDuration / (n - 1);

    // Periodogram via DFT (for small n) — compute power spectrum
    // For efficiency, limit to first n/2 frequencies
    const maxFreqBins = Math.floor(n / 2);
    const periodogram = [];

    for (let k = 1; k <= maxFreqBins; k++) {
      // DFT at frequency k
      let realPart = 0, imagPart = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        realPart += centered[t] * Math.cos(angle);
        imagPart -= centered[t] * Math.sin(angle);
      }
      const power = (realPart * realPart + imagPart * imagPart) / (n * n);
      const frequency = k / (n * sampleInterval / 1000); // Hz
      const periodMs = (n * sampleInterval) / k;

      periodogram.push({
        bin: k,
        frequency: Math.round(frequency * 1e6) / 1e6,
        periodMs: Math.round(periodMs),
        periodHuman: periodMs >= 86400000 ? `${Math.round(periodMs / 86400000 * 10) / 10}d`
          : periodMs >= 3600000 ? `${Math.round(periodMs / 3600000 * 10) / 10}h`
          : periodMs >= 60000 ? `${Math.round(periodMs / 60000 * 10) / 10}m`
          : `${Math.round(periodMs / 1000 * 10) / 10}s`,
        power: Math.round(power * 1e6) / 1e6,
        phase: Math.round(Math.atan2(-imagPart, realPart) * 10000) / 10000,
      });
    }

    // Sort by power to find dominant frequencies
    const sortedByPower = [...periodogram].sort((a, b) => b.power - a.power);
    const dominantFrequencies = sortedByPower.slice(0, 5);

    // Total spectral power
    const totalPower = periodogram.reduce((s, p) => s + p.power, 0);

    // Spectral concentration: what fraction of power is in top 3 frequencies
    const topPower = sortedByPower.slice(0, 3).reduce((s, p) => s + p.power, 0);
    const spectralConcentration = totalPower > 0 ? topPower / totalPower : 0;

    // Phase drift detection: split signal into halves and compare dominant phase
    let phaseDrift = null;
    if (n >= 16) {
      const halfN = Math.floor(n / 2);
      const firstHalf = centered.slice(0, halfN);
      const secondHalf = centered.slice(halfN);

      // Find dominant frequency's phase in each half
      const domK = dominantFrequencies[0]?.bin || 1;

      function computePhase(signal, k) {
        let re = 0, im = 0;
        const len = signal.length;
        for (let t = 0; t < len; t++) {
          const angle = (2 * Math.PI * k * t) / len;
          re += signal[t] * Math.cos(angle);
          im -= signal[t] * Math.sin(angle);
        }
        return Math.atan2(-im, re);
      }

      const phase1 = computePhase(firstHalf, domK);
      const phase2 = computePhase(secondHalf, domK);
      let drift = phase2 - phase1;
      // Normalize to [-π, π]
      while (drift > Math.PI) drift -= 2 * Math.PI;
      while (drift < -Math.PI) drift += 2 * Math.PI;

      phaseDrift = {
        dominantFrequencyBin: domK,
        firstHalfPhase: Math.round(phase1 * 10000) / 10000,
        secondHalfPhase: Math.round(phase2 * 10000) / 10000,
        driftRadians: Math.round(drift * 10000) / 10000,
        driftDegrees: Math.round((drift * 180 / Math.PI) * 100) / 100,
        significant: Math.abs(drift) > Math.PI / 6, // > 30 degrees
      };
    }

    // Rhythm classification
    let rhythmType;
    if (spectralConcentration > 0.7) rhythmType = "strongly_periodic";
    else if (spectralConcentration > 0.4) rhythmType = "periodic_with_noise";
    else if (spectralConcentration > 0.2) rhythmType = "weakly_periodic";
    else rhythmType = "aperiodic";

    return {
      ok: true, result: {
        dominantFrequencies,
        periodogram: periodogram.slice(0, 30),
        spectralAnalysis: {
          totalPower: Math.round(totalPower * 1e6) / 1e6,
          spectralConcentration: Math.round(spectralConcentration * 10000) / 100,
          rhythmType,
          primaryPeriod: dominantFrequencies[0]?.periodHuman || "N/A",
          primaryPeriodMs: dominantFrequencies[0]?.periodMs || 0,
        },
        phaseDrift,
        signalStats: {
          mean: Math.round(mean * 10000) / 10000,
          sampleCount: n,
          totalDurationMs: totalDuration,
          sampleIntervalMs: Math.round(sampleInterval),
        },
      },
    };
  });
}
