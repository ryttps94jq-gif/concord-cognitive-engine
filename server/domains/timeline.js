// server/domains/timeline.js
// Domain actions for temporal analysis: critical path computation, Gantt
// scheduling, temporal clustering, and event pattern detection.

export default function registerTimelineActions(registerLensAction) {
  /**
   * criticalPath
   * Compute the critical path through a project network using CPM.
   * artifact.data.tasks = [{ id, name, duration, dependencies?: string[] }]
   * Duration in any consistent unit (days, hours, etc.)
   */
  registerLensAction("timeline", "criticalPath", (ctx, artifact, _params) => {
    const tasks = artifact.data?.tasks || [];
    if (tasks.length === 0) return { ok: false, error: "No tasks defined." };

    const taskMap = {};
    for (const t of tasks) taskMap[t.id] = { ...t, dependencies: t.dependencies || [], es: 0, ef: 0, ls: Infinity, lf: Infinity, slack: 0 };

    // Topological sort
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    function visit(id) {
      if (visited.has(id)) return true;
      if (visiting.has(id)) return false; // cycle
      visiting.add(id);
      const task = taskMap[id];
      if (!task) return true;
      for (const dep of task.dependencies) {
        if (!visit(dep)) return false;
      }
      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
      return true;
    }
    for (const t of tasks) {
      if (!visit(t.id)) return { ok: false, error: `Circular dependency detected involving task "${t.id}".` };
    }

    // Forward pass: compute earliest start (ES) and earliest finish (EF)
    for (const id of sorted) {
      const task = taskMap[id];
      task.es = task.dependencies.length > 0
        ? Math.max(...task.dependencies.map(d => taskMap[d]?.ef || 0))
        : 0;
      task.ef = task.es + (task.duration || 0);
    }

    // Project duration
    const projectDuration = Math.max(...Object.values(taskMap).map(t => t.ef));

    // Backward pass: compute latest start (LS) and latest finish (LF)
    for (const id of [...sorted].reverse()) {
      const task = taskMap[id];
      // Find tasks that depend on this one
      const successors = Object.values(taskMap).filter(t => t.dependencies.includes(id));
      task.lf = successors.length > 0
        ? Math.min(...successors.map(s => s.ls))
        : projectDuration;
      task.ls = task.lf - (task.duration || 0);
      task.slack = task.ls - task.es;
    }

    // Critical path: tasks with zero slack
    const criticalTasks = sorted.filter(id => taskMap[id].slack === 0);

    // Build the critical path chain (ordered)
    const criticalChain = [];
    const remaining = new Set(criticalTasks);
    let current = criticalTasks.find(id => taskMap[id].dependencies.filter(d => remaining.has(d)).length === 0);
    while (current && remaining.size > 0) {
      criticalChain.push(current);
      remaining.delete(current);
      const successors = [...remaining].filter(id => taskMap[id].dependencies.includes(current));
      current = successors[0];
    }

    const result = sorted.map(id => {
      const t = taskMap[id];
      return {
        id, name: t.name, duration: t.duration,
        earliestStart: t.es, earliestFinish: t.ef,
        latestStart: t.ls, latestFinish: t.lf,
        slack: t.slack, isCritical: t.slack === 0,
      };
    });

    return {
      ok: true, result: {
        tasks: result,
        projectDuration,
        criticalPath: criticalChain.map(id => ({ id, name: taskMap[id].name, duration: taskMap[id].duration })),
        criticalPathLength: criticalChain.reduce((s, id) => s + (taskMap[id].duration || 0), 0),
        totalTasks: tasks.length,
        criticalTaskCount: criticalChain.length,
        averageSlack: result.length > 0 ? Math.round(result.reduce((s, t) => s + t.slack, 0) / result.length * 100) / 100 : 0,
      },
    };
  });

  /**
   * ganttSchedule
   * Generate a Gantt chart schedule with resource leveling.
   * artifact.data.tasks = [{ id, name, duration, dependencies?, resource?, priority? }]
   * params.maxParallel (resource constraint, default: unlimited)
   */
  registerLensAction("timeline", "ganttSchedule", (ctx, artifact, params) => {
    const tasks = artifact.data?.tasks || [];
    if (tasks.length === 0) return { ok: false, error: "No tasks defined." };

    const maxParallel = params.maxParallel || Infinity;

    // Build dependency graph
    const taskMap = {};
    for (const t of tasks) {
      taskMap[t.id] = { ...t, dependencies: t.dependencies || [], start: null, end: null, scheduled: false };
    }

    // Schedule greedily respecting dependencies and resource limits
    const schedule = [];
    let time = 0;
    let maxTime = 0;
    const maxIterations = tasks.length * tasks.length;
    let iterations = 0;

    while (schedule.length < tasks.length && iterations < maxIterations) {
      iterations++;
      // Find ready tasks (all deps scheduled, not yet scheduled)
      const ready = Object.values(taskMap).filter(t =>
        !t.scheduled &&
        t.dependencies.every(d => taskMap[d]?.scheduled)
      );

      if (ready.length === 0) {
        // Advance time to next task completion
        const nextEnd = Math.min(...schedule.filter(s => s.end > time).map(s => s.end));
        if (nextEnd === Infinity) break;
        time = nextEnd;
        continue;
      }

      // Sort by priority (lower = higher priority), then by dependency chain length
      ready.sort((a, b) => (a.priority || 99) - (b.priority || 99));

      // How many tasks are currently running at this time?
      const running = schedule.filter(s => s.start <= time && s.end > time).length;
      const available = maxParallel - running;

      for (let i = 0; i < Math.min(ready.length, available); i++) {
        const task = ready[i];
        // Earliest start: max of dependency completions and current time
        const depEnd = task.dependencies.length > 0
          ? Math.max(...task.dependencies.map(d => taskMap[d].end || 0))
          : 0;
        const start = Math.max(time, depEnd);
        const end = start + (task.duration || 0);

        task.start = start;
        task.end = end;
        task.scheduled = true;
        schedule.push({ id: task.id, name: task.name, start, end, duration: task.duration, resource: task.resource });
        maxTime = Math.max(maxTime, end);
      }

      // Advance time
      const nextEvents = schedule.filter(s => s.end > time).map(s => s.end);
      if (nextEvents.length > 0) {
        time = Math.min(...nextEvents);
      } else {
        time++;
      }
    }

    // Resource utilization
    const resources = {};
    for (const s of schedule) {
      const r = s.resource || "unassigned";
      if (!resources[r]) resources[r] = { totalDuration: 0, taskCount: 0, tasks: [] };
      resources[r].totalDuration += s.duration || 0;
      resources[r].taskCount++;
      resources[r].tasks.push(s.id);
    }
    for (const r of Object.values(resources)) {
      r.utilization = maxTime > 0 ? Math.round((r.totalDuration / maxTime) * 10000) / 100 : 0;
    }

    // Find bottlenecks (time periods with max parallelism)
    let peakParallel = 0;
    for (let t = 0; t <= maxTime; t++) {
      const parallel = schedule.filter(s => s.start <= t && s.end > t).length;
      peakParallel = Math.max(peakParallel, parallel);
    }

    schedule.sort((a, b) => a.start - b.start);

    return {
      ok: true, result: {
        schedule,
        projectDuration: maxTime,
        peakParallelism: peakParallel,
        resourceUtilization: resources,
        taskCount: schedule.length,
        averageDuration: schedule.length > 0
          ? Math.round(schedule.reduce((s, t) => s + (t.duration || 0), 0) / schedule.length * 100) / 100
          : 0,
      },
    };
  });

  /**
   * temporalClustering
   * Group events into temporal clusters using gap-based detection.
   * artifact.data.events = [{ timestamp, label?, value?, category? }]
   * params.gapThreshold (minimum gap between clusters, in ms)
   */
  registerLensAction("timeline", "temporalClustering", (ctx, artifact, params) => {
    const events = artifact.data?.events || [];
    if (events.length === 0) return { ok: true, result: { message: "No events." } };

    const sorted = [...events]
      .map(e => ({ ...e, ts: new Date(e.timestamp).getTime() }))
      .filter(e => !isNaN(e.ts))
      .sort((a, b) => a.ts - b.ts);

    if (sorted.length === 0) return { ok: false, error: "No valid timestamps." };

    // Auto-detect gap threshold if not provided: use 2x median inter-event gap
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].ts - sorted[i - 1].ts);
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 60000;
    const gapThreshold = params.gapThreshold || medianGap * 2;

    // Cluster by gap
    const clusters = [];
    let currentCluster = { events: [sorted[0]], start: sorted[0].ts, end: sorted[0].ts };

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].ts - sorted[i - 1].ts;
      if (gap > gapThreshold) {
        clusters.push(currentCluster);
        currentCluster = { events: [sorted[i]], start: sorted[i].ts, end: sorted[i].ts };
      } else {
        currentCluster.events.push(sorted[i]);
        currentCluster.end = sorted[i].ts;
      }
    }
    clusters.push(currentCluster);

    // Analyze each cluster
    const analyzed = clusters.map((c, i) => {
      const duration = c.end - c.start;
      const categories = {};
      for (const e of c.events) {
        const cat = e.category || "uncategorized";
        categories[cat] = (categories[cat] || 0) + 1;
      }
      const values = c.events.map(e => e.value).filter(v => v != null);
      const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;

      // Event rate (events per minute)
      const ratePerMinute = duration > 0 ? (c.events.length / (duration / 60000)) : c.events.length;

      return {
        cluster: i + 1,
        eventCount: c.events.length,
        start: new Date(c.start).toISOString(),
        end: new Date(c.end).toISOString(),
        durationMs: duration,
        durationMinutes: Math.round(duration / 60000 * 100) / 100,
        ratePerMinute: Math.round(ratePerMinute * 100) / 100,
        categories,
        avgValue: avgValue != null ? Math.round(avgValue * 1000) / 1000 : null,
        labels: c.events.map(e => e.label).filter(Boolean).slice(0, 5),
      };
    });

    // Periodicity detection: check if clusters are roughly evenly spaced
    const clusterStarts = clusters.map(c => c.start);
    const interClusterGaps = [];
    for (let i = 1; i < clusterStarts.length; i++) {
      interClusterGaps.push(clusterStarts[i] - clusterStarts[i - 1]);
    }
    let periodicity = null;
    if (interClusterGaps.length >= 2) {
      const avgGap = interClusterGaps.reduce((s, g) => s + g, 0) / interClusterGaps.length;
      const gapVariance = interClusterGaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / interClusterGaps.length;
      const cv = avgGap > 0 ? Math.sqrt(gapVariance) / avgGap : Infinity;
      if (cv < 0.3) {
        periodicity = {
          detected: true, periodMs: Math.round(avgGap),
          periodMinutes: Math.round(avgGap / 60000 * 100) / 100,
          regularity: cv < 0.1 ? "highly-regular" : "moderately-regular",
          coefficientOfVariation: Math.round(cv * 10000) / 10000,
        };
      }
    }

    return {
      ok: true, result: {
        clusters: analyzed,
        totalClusters: clusters.length,
        totalEvents: sorted.length,
        gapThresholdMs: gapThreshold,
        timespan: { start: new Date(sorted[0].ts).toISOString(), end: new Date(sorted[sorted.length - 1].ts).toISOString() },
        periodicity: periodicity || { detected: false },
        largestCluster: analyzed.sort((a, b) => b.eventCount - a.eventCount)[0]?.cluster,
      },
    };
  });

  /**
   * trendAnalysis
   * Detect trends, seasonality, and anomalies in time-series data.
   * artifact.data.series = [{ timestamp, value }]
   * params.windowSize (for moving average, default: auto)
   */
  registerLensAction("timeline", "trendAnalysis", (ctx, artifact, _params) => {
    const series = artifact.data?.series || [];
    if (series.length < 3) return { ok: false, error: "Need at least 3 data points." };

    const sorted = [...series]
      .map(s => ({ ts: new Date(s.timestamp).getTime(), value: s.value }))
      .filter(s => !isNaN(s.ts) && !isNaN(s.value))
      .sort((a, b) => a.ts - b.ts);

    const n = sorted.length;
    const values = sorted.map(s => s.value);
    const r = v => Math.round(v * 10000) / 10000;

    // Linear trend (least squares on index)
    const xs = sorted.map((_, i) => i);
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const yMean = sumY / n;
    const ssRes = values.reduce((s, y, i) => s + Math.pow(y - (slope * i + intercept), 2), 0);
    const ssTot = values.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const trendDirection = slope > 0.001 ? "increasing" : slope < -0.001 ? "decreasing" : "flat";

    // Moving average and residuals
    const windowSize = Math.max(3, Math.min(Math.floor(n / 4), 12));
    const movingAvg = [];
    const residuals = [];
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(n, i + Math.ceil(windowSize / 2));
      const window = values.slice(start, end);
      const avg = window.reduce((s, v) => s + v, 0) / window.length;
      movingAvg.push(r(avg));
      residuals.push(r(values[i] - avg));
    }

    // Anomaly detection: values > 2 stddev from moving average
    const residualMean = residuals.reduce((s, r) => s + r, 0) / residuals.length;
    const residualStd = Math.sqrt(residuals.reduce((s, r) => s + Math.pow(r - residualMean, 2), 0) / residuals.length);
    const anomalies = [];
    for (let i = 0; i < n; i++) {
      const zScore = residualStd > 0 ? Math.abs(residuals[i] - residualMean) / residualStd : 0;
      if (zScore > 2) {
        anomalies.push({
          index: i, timestamp: new Date(sorted[i].ts).toISOString(),
          value: sorted[i].value, expected: movingAvg[i],
          deviation: residuals[i], zScore: r(zScore),
          type: residuals[i] > 0 ? "spike" : "dip",
        });
      }
    }

    // Seasonality check via autocorrelation
    const maxLag = Math.min(Math.floor(n / 2), 50);
    const autocorrelations = [];
    for (let lag = 1; lag <= maxLag; lag++) {
      let num = 0, den = 0;
      for (let i = 0; i < n - lag; i++) {
        num += (values[i] - yMean) * (values[i + lag] - yMean);
      }
      den = values.reduce((s, v) => s + Math.pow(v - yMean, 2), 0);
      const acf = den > 0 ? num / den : 0;
      autocorrelations.push({ lag, acf: r(acf) });
    }

    // Find peaks in autocorrelation (possible seasonal periods)
    const seasonalCandidates = [];
    for (let i = 1; i < autocorrelations.length - 1; i++) {
      const ac = autocorrelations[i];
      if (ac.acf > 0.3 && ac.acf > autocorrelations[i - 1].acf && ac.acf > autocorrelations[i + 1].acf) {
        seasonalCandidates.push({ period: ac.lag, strength: ac.acf });
      }
    }

    // Rate of change
    const changes = [];
    for (let i = 1; i < n; i++) {
      const timeDiff = sorted[i].ts - sorted[i - 1].ts;
      const valueDiff = values[i] - values[i - 1];
      const rate = timeDiff > 0 ? valueDiff / (timeDiff / 3600000) : 0; // per hour
      changes.push(rate);
    }
    const maxAcceleration = changes.length > 1
      ? Math.max(...changes.slice(1).map((c, i) => Math.abs(c - changes[i])))
      : 0;

    return {
      ok: true, result: {
        trend: { direction: trendDirection, slope: r(slope), intercept: r(intercept), rSquared: r(rSquared) },
        statistics: {
          count: n, mean: r(yMean),
          min: r(Math.min(...values)), max: r(Math.max(...values)),
          range: r(Math.max(...values) - Math.min(...values)),
        },
        anomalies: anomalies.slice(0, 10),
        anomalyCount: anomalies.length,
        seasonality: seasonalCandidates.length > 0
          ? { detected: true, candidates: seasonalCandidates.slice(0, 3) }
          : { detected: false },
        movingAverage: { windowSize, values: movingAvg.length > 50 ? movingAvg.filter((_, i) => i % Math.ceil(n / 50) === 0) : movingAvg },
        maxRateOfChange: r(Math.max(...changes.map(Math.abs))),
        maxAcceleration: r(maxAcceleration),
      },
    };
  });
}
