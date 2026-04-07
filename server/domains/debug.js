// server/domains/debug.js
// Domain actions for debugging: log pattern analysis, error clustering,
// stack trace parsing, and performance bottleneck detection.

export default function registerDebugActions(registerLensAction) {
  /**
   * logAnalysis
   * Parse and analyze application logs for patterns, error rates, and anomalies.
   * artifact.data.logs = [{ timestamp, level, message, source?, context? }]
   */
  registerLensAction("debug", "logAnalysis", (ctx, artifact, _params) => {
    const logs = artifact.data?.logs || [];
    if (logs.length === 0) return { ok: true, result: { message: "No logs to analyze." } };

    // Level distribution
    const levelCounts = {};
    for (const log of logs) {
      const level = (log.level || "info").toLowerCase();
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    }

    // Error rate over time (bucket into windows)
    const sorted = [...logs]
      .map(l => ({ ...l, ts: new Date(l.timestamp).getTime() }))
      .filter(l => !isNaN(l.ts))
      .sort((a, b) => a.ts - b.ts);

    const timespan = sorted.length > 1 ? sorted[sorted.length - 1].ts - sorted[0].ts : 0;
    const bucketCount = Math.min(20, Math.max(1, Math.ceil(timespan / 60000))); // 1-min buckets
    const bucketSize = timespan > 0 ? timespan / bucketCount : 1;
    const errorTimeline = [];

    for (let i = 0; i < bucketCount; i++) {
      const start = sorted[0].ts + i * bucketSize;
      const end = start + bucketSize;
      const bucket = sorted.filter(l => l.ts >= start && l.ts < end);
      const errors = bucket.filter(l => ["error", "fatal", "critical"].includes((l.level || "").toLowerCase()));
      errorTimeline.push({
        bucket: i,
        start: new Date(start).toISOString(),
        total: bucket.length,
        errors: errors.length,
        errorRate: bucket.length > 0 ? Math.round((errors.length / bucket.length) * 10000) / 100 : 0,
      });
    }

    // Error spike detection
    const avgErrorRate = errorTimeline.length > 0
      ? errorTimeline.reduce((s, b) => s + b.errorRate, 0) / errorTimeline.length
      : 0;
    const spikes = errorTimeline.filter(b => b.errorRate > avgErrorRate * 2 && b.errors > 2);

    // Message pattern extraction (simple n-gram frequency)
    const patterns = {};
    for (const log of logs) {
      if (!log.message) continue;
      // Normalize: remove numbers, UUIDs, timestamps, hashes
      const normalized = log.message
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, "<TIMESTAMP>")
        .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, "<IP>")
        .replace(/\b[0-9a-f]{32,}\b/gi, "<HASH>")
        .replace(/\b\d{3,}\b/g, "<NUM>")
        .trim();

      patterns[normalized] = (patterns[normalized] || 0) + 1;
    }

    const topPatterns = Object.entries(patterns)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern: pattern.slice(0, 150), count, percentage: Math.round((count / logs.length) * 10000) / 100 }));

    // Source hotspots
    const sourceCounts = {};
    const sourceErrors = {};
    for (const log of logs) {
      const src = log.source || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      if (["error", "fatal", "critical"].includes((log.level || "").toLowerCase())) {
        sourceErrors[src] = (sourceErrors[src] || 0) + 1;
      }
    }
    const sourceHotspots = Object.entries(sourceErrors)
      .map(([source, errors]) => ({
        source, errors, total: sourceCounts[source] || errors,
        errorRate: Math.round((errors / (sourceCounts[source] || errors)) * 10000) / 100,
      }))
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 10);

    // Log volume rate (logs per second)
    const logsPerSecond = timespan > 0 ? Math.round((logs.length / (timespan / 1000)) * 100) / 100 : logs.length;

    return {
      ok: true, result: {
        totalLogs: logs.length,
        levelDistribution: levelCounts,
        errorRate: Math.round((((levelCounts.error || 0) + (levelCounts.fatal || 0) + (levelCounts.critical || 0)) / logs.length) * 10000) / 100,
        logsPerSecond,
        errorTimeline,
        spikes: spikes.length > 0 ? spikes : "none_detected",
        topPatterns,
        sourceHotspots,
        timespan: { start: sorted[0] ? new Date(sorted[0].ts).toISOString() : null, end: sorted.length > 0 ? new Date(sorted[sorted.length - 1].ts).toISOString() : null },
      },
    };
  });

  /**
   * errorCluster
   * Cluster errors by similarity to identify unique error classes.
   * artifact.data.errors = [{ message, stack?, count?, firstSeen?, lastSeen?, source? }]
   */
  registerLensAction("debug", "errorCluster", (ctx, artifact, _params) => {
    const errors = artifact.data?.errors || [];
    if (errors.length === 0) return { ok: true, result: { message: "No errors to cluster." } };

    // Normalize error messages for grouping
    function normalize(msg) {
      return (msg || "")
        .replace(/0x[0-9a-fA-F]+/g, "<ADDR>")
        .replace(/\b\d+\b/g, "<N>")
        .replace(/['"][^'"]{0,100}['"]/g, "<STR>")
        .replace(/at .*:\d+:\d+/g, "at <LOC>")
        .replace(/\/[^\s]+/g, "<PATH>")
        .trim()
        .substring(0, 200);
    }

    // Jaccard similarity between two sets of tokens
    function similarity(a, b) {
      const setA = new Set(a.toLowerCase().split(/\s+/));
      const setB = new Set(b.toLowerCase().split(/\s+/));
      const intersection = [...setA].filter(x => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      return union > 0 ? intersection / union : 0;
    }

    // Agglomerative clustering
    const items = errors.map((e, i) => ({
      ...e, id: i, normalized: normalize(e.message), cluster: i,
    }));

    const threshold = 0.5; // similarity threshold for merging
    let merged = true;
    let iterations = 0;
    while (merged && iterations < 50) {
      merged = false;
      iterations++;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          if (items[i].cluster === items[j].cluster) continue;
          const sim = similarity(items[i].normalized, items[j].normalized);
          if (sim >= threshold) {
            // Merge j's cluster into i's
            const oldCluster = items[j].cluster;
            const newCluster = items[i].cluster;
            items.forEach(item => { if (item.cluster === oldCluster) item.cluster = newCluster; });
            merged = true;
          }
        }
      }
    }

    // Build cluster summaries
    const clusterMap = {};
    for (const item of items) {
      if (!clusterMap[item.cluster]) clusterMap[item.cluster] = [];
      clusterMap[item.cluster].push(item);
    }

    const clusters = Object.entries(clusterMap).map(([clusterId, members]) => {
      // Pick the most common message as representative
      const msgFreq = {};
      for (const m of members) {
        const key = m.normalized;
        msgFreq[key] = (msgFreq[key] || 0) + (m.count || 1);
      }
      const representative = Object.entries(msgFreq).sort((a, b) => b[1] - a[1])[0][0];

      const totalCount = members.reduce((s, m) => s + (m.count || 1), 0);
      const sources = [...new Set(members.map(m => m.source).filter(Boolean))];

      // Extract common stack frame (if available)
      const stacks = members.map(m => m.stack).filter(Boolean);
      let commonFrame = null;
      if (stacks.length > 0) {
        const frames = stacks[0].split('\n').slice(0, 5);
        for (const frame of frames) {
          const trimmed = frame.trim();
          if (stacks.every(s => s.includes(trimmed)) && trimmed.startsWith("at ")) {
            commonFrame = trimmed;
            break;
          }
        }
      }

      return {
        clusterId: parseInt(clusterId),
        representative,
        memberCount: members.length,
        totalOccurrences: totalCount,
        sources,
        commonFrame,
        firstSeen: members.map(m => m.firstSeen).filter(Boolean).sort()[0] || null,
        lastSeen: members.map(m => m.lastSeen).filter(Boolean).sort().pop() || null,
        severity: totalCount > 100 ? "critical" : totalCount > 10 ? "high" : totalCount > 3 ? "medium" : "low",
      };
    }).sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    return {
      ok: true, result: {
        clusters,
        totalErrors: errors.length,
        uniqueClusters: clusters.length,
        deduplicationRatio: errors.length > 0 ? Math.round((1 - clusters.length / errors.length) * 10000) / 100 : 0,
        topCluster: clusters[0],
      },
    };
  });

  /**
   * performanceProfile
   * Analyze performance traces to find bottlenecks.
   * artifact.data.traces = [{ name, startMs, endMs, parent?, metadata? }]
   */
  registerLensAction("debug", "performanceProfile", (ctx, artifact, _params) => {
    const traces = artifact.data?.traces || [];
    if (traces.length === 0) return { ok: true, result: { message: "No traces." } };

    const r = v => Math.round(v * 100) / 100;

    // Compute durations
    const spans = traces.map(t => ({
      ...t,
      duration: (t.endMs || 0) - (t.startMs || 0),
    }));

    // Aggregate by name
    const aggregated = {};
    for (const span of spans) {
      const name = span.name || "unknown";
      if (!aggregated[name]) aggregated[name] = { totalDuration: 0, count: 0, min: Infinity, max: 0, durations: [] };
      aggregated[name].totalDuration += span.duration;
      aggregated[name].count++;
      aggregated[name].min = Math.min(aggregated[name].min, span.duration);
      aggregated[name].max = Math.max(aggregated[name].max, span.duration);
      aggregated[name].durations.push(span.duration);
    }

    const profiles = Object.entries(aggregated).map(([name, data]) => {
      const sorted = data.durations.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const avg = data.totalDuration / data.count;
      const stdDev = Math.sqrt(data.durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / data.count);

      return {
        name, invocations: data.count,
        totalMs: r(data.totalDuration),
        avgMs: r(avg), minMs: r(data.min), maxMs: r(data.max),
        p50Ms: r(p50), p95Ms: r(p95), p99Ms: r(p99),
        stdDevMs: r(stdDev),
        percentOfTotal: 0, // filled below
      };
    });

    const totalTime = profiles.reduce((s, p) => s + p.totalMs, 0);
    for (const p of profiles) {
      p.percentOfTotal = totalTime > 0 ? r((p.totalMs / totalTime) * 100) : 0;
    }

    profiles.sort((a, b) => b.totalMs - a.totalMs);

    // Build call tree if parent info available
    const callTree = {};
    for (const span of spans) {
      const parent = span.parent || "__root__";
      if (!callTree[parent]) callTree[parent] = [];
      callTree[parent].push({ name: span.name, duration: span.duration });
    }

    // Self-time computation (time not spent in children)
    const selfTime = {};
    for (const span of spans) {
      const children = spans.filter(s => s.parent === span.name);
      const childTime = children.reduce((s, c) => s + c.duration, 0);
      const self = Math.max(0, span.duration - childTime);
      selfTime[span.name] = (selfTime[span.name] || 0) + self;
    }

    const bottlenecks = Object.entries(selfTime)
      .map(([name, self]) => ({ name, selfTimeMs: r(self), percentSelfTime: totalTime > 0 ? r((self / totalTime) * 100) : 0 }))
      .sort((a, b) => b.selfTimeMs - a.selfTimeMs)
      .slice(0, 10);

    // Detect slow outliers (spans > 2x their average)
    const slowOutliers = spans
      .filter(s => {
        const agg = aggregated[s.name];
        return agg && s.duration > (agg.totalDuration / agg.count) * 2 && s.duration > 10;
      })
      .map(s => ({ name: s.name, durationMs: r(s.duration), avgMs: r(aggregated[s.name].totalDuration / aggregated[s.name].count) }))
      .slice(0, 10);

    return {
      ok: true, result: {
        profiles: profiles.slice(0, 20),
        bottlenecks,
        slowOutliers,
        totalTraces: traces.length,
        totalDurationMs: r(totalTime),
        uniqueOperations: profiles.length,
        hotPath: profiles.slice(0, 3).map(p => p.name),
      },
    };
  });

  /**
   * stackTraceAnalysis
   * Parse and analyze stack traces to extract root causes and common frames.
   * artifact.data.stackTraces = [{ error, stack, timestamp?, context? }]
   */
  registerLensAction("debug", "stackTraceAnalysis", (ctx, artifact, _params) => {
    const traces = artifact.data?.stackTraces || [];
    if (traces.length === 0) return { ok: true, result: { message: "No stack traces." } };

    const parsed = traces.map(t => {
      const lines = (t.stack || "").split("\n").map(l => l.trim()).filter(Boolean);
      const errorLine = lines[0] || t.error || "Unknown error";

      // Parse frames
      const frames = lines.slice(1).map(line => {
        // JS-style: "at functionName (file:line:col)" or "at file:line:col"
        const jsMatch = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
        if (jsMatch) {
          return { fn: jsMatch[1] || "<anonymous>", file: jsMatch[2], line: parseInt(jsMatch[3]), col: parseInt(jsMatch[4]), raw: line };
        }
        // Python-style: 'File "file.py", line N, in function'
        const pyMatch = line.match(/File "(.+?)", line (\d+), in (.+)/);
        if (pyMatch) {
          return { fn: pyMatch[3], file: pyMatch[1], line: parseInt(pyMatch[2]), raw: line };
        }
        return { fn: null, file: null, line: null, raw: line };
      }).filter(f => f.fn || f.file);

      // Classify error type
      const errorType = errorLine.match(/^(\w+Error|\w+Exception)/)?.[1] || "Unknown";

      // Identify user code vs library code
      const userFrames = frames.filter(f => f.file && !f.file.includes("node_modules") && !f.file.includes("site-packages") && !f.file.includes("/lib/"));
      const libraryFrames = frames.filter(f => f.file && (f.file.includes("node_modules") || f.file.includes("site-packages")));

      return {
        error: errorLine, errorType,
        totalFrames: frames.length,
        topUserFrame: userFrames[0] || null,
        topLibraryFrame: libraryFrames[0] || null,
        userFrameCount: userFrames.length,
        libraryFrameCount: libraryFrames.length,
        frames: frames.slice(0, 10),
        timestamp: t.timestamp,
        context: t.context,
      };
    });

    // Find common frames across traces
    const frameFrequency = {};
    for (const p of parsed) {
      const seen = new Set();
      for (const f of p.frames) {
        const key = `${f.file || "?"}:${f.fn || "?"}`;
        if (!seen.has(key)) {
          frameFrequency[key] = (frameFrequency[key] || 0) + 1;
          seen.add(key);
        }
      }
    }

    const commonFrames = Object.entries(frameFrequency)
      .filter(([, count]) => count >= 2)
      .map(([frame, count]) => ({ frame, occurrences: count, percentage: Math.round((count / traces.length) * 100) }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    // Error type distribution
    const errorTypes = {};
    for (const p of parsed) {
      errorTypes[p.errorType] = (errorTypes[p.errorType] || 0) + 1;
    }

    // Root cause candidates (most common top user frames)
    const rootCauses = {};
    for (const p of parsed) {
      if (p.topUserFrame) {
        const key = `${p.topUserFrame.file}:${p.topUserFrame.line} (${p.topUserFrame.fn})`;
        if (!rootCauses[key]) rootCauses[key] = { location: key, errors: [], count: 0 };
        rootCauses[key].count++;
        if (rootCauses[key].errors.length < 3) rootCauses[key].errors.push(p.error);
      }
    }
    const topRootCauses = Object.values(rootCauses).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      ok: true, result: {
        totalTraces: traces.length,
        errorTypeDistribution: errorTypes,
        parsedTraces: parsed.slice(0, 10),
        commonFrames,
        rootCauseCandidates: topRootCauses,
        userVsLibrary: {
          avgUserFrames: Math.round(parsed.reduce((s, p) => s + p.userFrameCount, 0) / parsed.length * 10) / 10,
          avgLibraryFrames: Math.round(parsed.reduce((s, p) => s + p.libraryFrameCount, 0) / parsed.length * 10) / 10,
        },
      },
    };
  });
}
