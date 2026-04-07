// server/domains/lock.js
// Domain actions for resource locking: deadlock detection via wait-for graphs,
// lock contention analysis, and fairness scoring.

export default function registerLockActions(registerLensAction) {
  /**
   * deadlockDetect
   * Build a wait-for graph from artifact.data.locks [{holder, waiting}],
   * detect cycles using DFS, and return deadlock sets.
   */
  registerLensAction("lock", "deadlockDetect", (ctx, artifact, params) => {
    const locks = artifact.data?.locks || [];
    if (locks.length === 0) {
      return { ok: true, result: { deadlocked: false, cycles: [], message: "No lock data provided." } };
    }

    // Build wait-for graph: waiting -> [holders it waits for]
    const graph = {};
    const allNodes = new Set();
    for (const lock of locks) {
      const { holder, waiting } = lock;
      if (!holder || !waiting) continue;
      const waiters = Array.isArray(waiting) ? waiting : [waiting];
      for (const waiter of waiters) {
        allNodes.add(holder);
        allNodes.add(waiter);
        if (!graph[waiter]) graph[waiter] = [];
        graph[waiter].push(holder);
      }
    }

    for (const node of allNodes) {
      if (!graph[node]) graph[node] = [];
    }

    if (allNodes.size === 0) {
      return { ok: true, result: { deadlocked: false, cycles: [], message: "No valid lock edges found." } };
    }

    // DFS-based cycle detection
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = {};
    const parent = {};
    const cycles = [];

    for (const node of allNodes) {
      color[node] = WHITE;
      parent[node] = null;
    }

    function dfs(node) {
      color[node] = GRAY;
      for (const neighbor of graph[node]) {
        if (color[neighbor] === GRAY) {
          // Back edge found — extract cycle
          const cycle = [neighbor];
          let cur = node;
          while (cur !== neighbor && cur != null) {
            cycle.push(cur);
            cur = parent[cur];
          }
          cycle.push(neighbor);
          cycle.reverse();
          cycles.push(cycle);
        } else if (color[neighbor] === WHITE) {
          parent[neighbor] = node;
          dfs(neighbor);
        }
      }
      color[node] = BLACK;
    }

    for (const node of allNodes) {
      if (color[node] === WHITE) dfs(node);
    }

    // Deduplicate cycles by normalizing (rotate smallest element first)
    const uniqueCycles = [];
    const seen = new Set();
    for (const cycle of cycles) {
      const body = cycle.slice(0, -1);
      if (body.length === 0) continue;
      const minVal = body.reduce((a, b) => (a < b ? a : b));
      const minIdx = body.indexOf(minVal);
      const normalized = [...body.slice(minIdx), ...body.slice(0, minIdx)];
      const key = normalized.join("->");
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCycles.push([...normalized, normalized[0]]);
      }
    }

    // Collect all deadlocked nodes
    const deadlockedNodes = new Set();
    for (const cycle of uniqueCycles) {
      for (const node of cycle) deadlockedNodes.add(node);
    }

    // Build deadlock sets with suggested victims (node with fewest outgoing edges)
    const deadlockSets = uniqueCycles.map((cycle) => {
      const members = cycle.slice(0, -1);
      const victim = members.reduce((best, node) => {
        return (graph[node] || []).length <= (graph[best] || []).length ? node : best;
      }, members[0]);
      return { cycle, length: members.length, members, suggestedVictim: victim };
    });

    return {
      ok: true,
      result: {
        deadlocked: uniqueCycles.length > 0,
        cycleCount: uniqueCycles.length,
        deadlockSets,
        deadlockedNodes: [...deadlockedNodes],
        totalNodes: allNodes.size,
        totalEdges: locks.length,
        waitForGraph: Object.fromEntries(
          Object.entries(graph).filter(([, v]) => v.length > 0)
        ),
      },
    };
  });

  /**
   * contentionAnalysis
   * Compute contention ratios from lock acquisition data, identify hot locks,
   * and suggest granularity changes.
   * artifact.data.lockEvents = [{ resource, type: "acquire"|"release"|"wait", processId, durationMs? }]
   */
  registerLensAction("lock", "contentionAnalysis", (ctx, artifact, params) => {
    const events = artifact.data?.lockEvents || [];
    if (events.length === 0) {
      return { ok: true, result: { message: "No lock events to analyze." } };
    }

    // Aggregate per resource
    const stats = {};
    for (const ev of events) {
      const r = ev.resource || "unknown";
      if (!stats[r]) {
        stats[r] = {
          acquires: 0, waits: 0, releases: 0,
          totalWaitMs: 0, totalHoldMs: 0,
          waitDurations: [], holdDurations: [],
          processes: new Set(),
        };
      }
      const s = stats[r];
      s.processes.add(ev.processId);
      if (ev.type === "acquire") {
        s.acquires++;
        if (ev.durationMs != null) {
          s.totalHoldMs += ev.durationMs;
          s.holdDurations.push(ev.durationMs);
        }
      } else if (ev.type === "wait") {
        s.waits++;
        if (ev.durationMs != null) {
          s.totalWaitMs += ev.durationMs;
          s.waitDurations.push(ev.durationMs);
        }
      } else if (ev.type === "release") {
        s.releases++;
      }
    }

    function percentile(sorted, p) {
      if (sorted.length === 0) return 0;
      const idx = Math.floor(sorted.length * p);
      return sorted[Math.min(idx, sorted.length - 1)];
    }

    const resources = Object.entries(stats).map(([resource, s]) => {
      const contentionRatio = s.acquires > 0 ? s.waits / s.acquires : 0;
      const avgWaitMs = s.waitDurations.length > 0
        ? s.waitDurations.reduce((a, b) => a + b, 0) / s.waitDurations.length : 0;
      const avgHoldMs = s.holdDurations.length > 0
        ? s.holdDurations.reduce((a, b) => a + b, 0) / s.holdDurations.length : 0;
      const sortedWaits = [...s.waitDurations].sort((a, b) => a - b);
      const p95Wait = percentile(sortedWaits, 0.95);
      const maxWait = sortedWaits.length > 0 ? sortedWaits[sortedWaits.length - 1] : 0;

      // Hot lock score: weighted combination of contention ratio, process count, wait time
      const hotScore = Math.min(100, Math.round(
        contentionRatio * 40 +
        Math.min(s.processes.size, 10) * 4 +
        Math.min(avgWaitMs / 100, 20)
      ));

      return {
        resource,
        contentionRatio: Math.round(contentionRatio * 10000) / 10000,
        acquires: s.acquires,
        waits: s.waits,
        processCount: s.processes.size,
        avgWaitMs: Math.round(avgWaitMs * 100) / 100,
        maxWaitMs: Math.round(maxWait * 100) / 100,
        p95WaitMs: Math.round(p95Wait * 100) / 100,
        avgHoldMs: Math.round(avgHoldMs * 100) / 100,
        hotScore,
        isHotLock: hotScore >= 50,
      };
    });

    resources.sort((a, b) => b.hotScore - a.hotScore);

    const hotLocks = resources.filter((r) => r.isHotLock);

    // Granularity suggestions for hot locks
    const suggestions = hotLocks.map((lock) => {
      let recommendation, reason;
      if (lock.avgHoldMs > 100 && lock.contentionRatio > 0.5) {
        recommendation = "split_lock";
        reason = "High hold time with high contention — consider finer-grained locking";
      } else if (lock.processCount > 5 && lock.contentionRatio > 0.3) {
        recommendation = "reader_writer_lock";
        reason = "Many processes contending — use read/write locks if reads dominate";
      } else if (lock.avgHoldMs > 500) {
        recommendation = "reduce_critical_section";
        reason = "Very long hold times — minimize work inside critical section";
      } else {
        recommendation = "monitor";
        reason = "Elevated contention but within manageable bounds";
      }
      return { resource: lock.resource, recommendation, reason };
    });

    const totalWaits = resources.reduce((s, r) => s + r.waits, 0);
    const totalAcquires = resources.reduce((s, r) => s + r.acquires, 0);
    const overallContention = totalAcquires > 0 ? totalWaits / totalAcquires : 0;

    return {
      ok: true,
      result: {
        resources,
        hotLocks,
        suggestions,
        summary: {
          totalResources: resources.length,
          totalEvents: events.length,
          overallContentionRatio: Math.round(overallContention * 10000) / 10000,
          hotLockCount: hotLocks.length,
          contentionLevel: overallContention > 0.5 ? "severe" : overallContention > 0.2 ? "moderate" : "low",
        },
      },
    };
  });

  /**
   * fairnessScore
   * Measure wait time variance, detect starvation, and compute Jain's fairness
   * index: J = (sum(xi))^2 / (n * sum(xi^2)).
   * artifact.data.processWaits = [{ processId, resource, waitMs, attempts? }]
   */
  registerLensAction("lock", "fairnessScore", (ctx, artifact, params) => {
    const waits = artifact.data?.processWaits || [];
    if (waits.length === 0) {
      return { ok: true, result: { message: "No wait data to analyze." } };
    }

    // Per-process aggregation
    const byProcess = {};
    for (const w of waits) {
      const pid = w.processId;
      if (!byProcess[pid]) {
        byProcess[pid] = { totalWait: 0, count: 0, maxWait: 0, attempts: 0, resources: new Set() };
      }
      const s = byProcess[pid];
      s.totalWait += w.waitMs || 0;
      s.count++;
      s.maxWait = Math.max(s.maxWait, w.waitMs || 0);
      s.attempts += w.attempts || 1;
      s.resources.add(w.resource);
    }

    const processes = Object.entries(byProcess).map(([pid, s]) => ({
      processId: pid,
      totalWaitMs: s.totalWait,
      avgWaitMs: Math.round((s.totalWait / s.count) * 100) / 100,
      maxWaitMs: s.maxWait,
      lockRequests: s.count,
      totalAttempts: s.attempts,
      resourceCount: s.resources.size,
    }));

    // Jain's Fairness Index: J = (sum(xi))^2 / (n * sum(xi^2))
    const avgWaits = processes.map((p) => p.avgWaitMs);
    const n = avgWaits.length;
    const sumX = avgWaits.reduce((s, x) => s + x, 0);
    const sumXSq = avgWaits.reduce((s, x) => s + x * x, 0);
    const jainsIndex = n > 0 && sumXSq > 0
      ? (sumX * sumX) / (n * sumXSq)
      : 1;

    // Variance analysis
    const mean = sumX / n;
    const variance = avgWaits.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = mean > 0 ? stdDev / mean : 0;

    // Starvation detection: processes waiting > 3x mean
    const starvationThreshold = mean * 3;
    const starvedProcesses = processes.filter((p) => p.avgWaitMs > starvationThreshold);

    // Max/min ratio
    const positiveWaits = avgWaits.filter((w) => w > 0);
    const maxWait = Math.max(...avgWaits);
    const minWait = positiveWaits.length > 0 ? Math.min(...positiveWaits) : 0;
    const maxMinRatio = minWait > 0 ? maxWait / minWait : (maxWait > 0 ? Infinity : 1);

    // Per-resource Jain's index
    const byResource = {};
    for (const w of waits) {
      const r = w.resource || "unknown";
      if (!byResource[r]) byResource[r] = {};
      if (!byResource[r][w.processId]) byResource[r][w.processId] = [];
      byResource[r][w.processId].push(w.waitMs || 0);
    }

    const resourceFairness = Object.entries(byResource).map(([resource, procMap]) => {
      const procAvgs = Object.values(procMap).map(
        (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
      );
      const rn = procAvgs.length;
      const rSum = procAvgs.reduce((s, v) => s + v, 0);
      const rSumSq = procAvgs.reduce((s, v) => s + v * v, 0);
      const rJains = rn > 0 && rSumSq > 0 ? (rSum * rSum) / (rn * rSumSq) : 1;
      return {
        resource,
        processCount: rn,
        jainsIndex: Math.round(rJains * 10000) / 10000,
        fair: rJains > 0.9,
      };
    });

    let fairnessLevel;
    if (jainsIndex > 0.95) fairnessLevel = "excellent";
    else if (jainsIndex > 0.85) fairnessLevel = "good";
    else if (jainsIndex > 0.7) fairnessLevel = "moderate";
    else fairnessLevel = "poor";

    processes.sort((a, b) => b.avgWaitMs - a.avgWaitMs);

    return {
      ok: true,
      result: {
        jainsIndex: Math.round(jainsIndex * 10000) / 10000,
        fairnessLevel,
        processes,
        starvation: {
          detected: starvedProcesses.length > 0,
          threshold: Math.round(starvationThreshold * 100) / 100,
          starvedProcesses: starvedProcesses.map((p) => ({
            processId: p.processId,
            avgWaitMs: p.avgWaitMs,
            ratioToMean: Math.round((p.avgWaitMs / mean) * 100) / 100,
          })),
        },
        waitDistribution: {
          mean: Math.round(mean * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          coefficientOfVariation: Math.round(coeffOfVariation * 10000) / 10000,
          maxMinRatio: maxMinRatio === Infinity ? "Infinity" : Math.round(maxMinRatio * 100) / 100,
        },
        resourceFairness,
        summary: {
          totalProcesses: n,
          totalWaitEvents: waits.length,
          starvedCount: starvedProcesses.length,
          unfairResources: resourceFairness.filter((r) => !r.fair).length,
        },
      },
    };
  });
}
