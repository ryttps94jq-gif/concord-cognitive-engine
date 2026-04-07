// server/domains/integrations.js
// Domain actions for system integrations: API health checking, data flow
// mapping, and version compatibility analysis.

export default function registerIntegrationsActions(registerLensAction) {
  /**
   * apiHealthCheck
   * Check integration health: endpoint latency percentiles, error rates,
   * throughput, and availability scoring.
   * artifact.data.endpoints = [{ name, url?, samples: [{ latencyMs, statusCode, timestamp }] }]
   */
  registerLensAction("integrations", "apiHealthCheck", (ctx, artifact, params) => {
    const endpoints = artifact.data?.endpoints || [];
    if (endpoints.length === 0) return { ok: true, result: { message: "No endpoints to check." } };

    const endpointHealth = endpoints.map(ep => {
      const samples = ep.samples || [];
      if (samples.length === 0) {
        return { name: ep.name, status: "no_data", availability: 0, sampleCount: 0 };
      }

      // Latency analysis
      const latencies = samples.map(s => s.latencyMs).filter(l => l != null && l >= 0).sort((a, b) => a - b);
      const n = latencies.length;

      function percentile(sorted, p) {
        if (sorted.length === 0) return 0;
        const idx = Math.ceil(p / 100 * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
      }

      const latencyStats = n > 0 ? {
        p50: percentile(latencies, 50),
        p75: percentile(latencies, 75),
        p90: percentile(latencies, 90),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        min: latencies[0],
        max: latencies[n - 1],
        avg: Math.round(latencies.reduce((s, v) => s + v, 0) / n * 100) / 100,
      } : null;

      // Error rate analysis
      const statusCodes = samples.map(s => s.statusCode).filter(c => c != null);
      const errors = statusCodes.filter(c => c >= 400);
      const serverErrors = statusCodes.filter(c => c >= 500);
      const clientErrors = statusCodes.filter(c => c >= 400 && c < 500);
      const errorRate = statusCodes.length > 0
        ? Math.round((errors.length / statusCodes.length) * 10000) / 100
        : 0;

      // Status code distribution
      const codeDistribution = {};
      for (const code of statusCodes) {
        codeDistribution[code] = (codeDistribution[code] || 0) + 1;
      }

      // Availability: percentage of successful responses (2xx/3xx)
      const successCount = statusCodes.filter(c => c >= 200 && c < 400).length;
      const availability = statusCodes.length > 0
        ? Math.round((successCount / statusCodes.length) * 10000) / 100
        : 0;

      // Throughput: requests per second (from timestamp spread)
      let throughput = null;
      const timestamps = samples.map(s => new Date(s.timestamp).getTime()).filter(t => !isNaN(t)).sort((a, b) => a - b);
      if (timestamps.length >= 2) {
        const spanSeconds = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
        throughput = spanSeconds > 0 ? Math.round((timestamps.length / spanSeconds) * 100) / 100 : null;
      }

      // Health score (0-100)
      const latencyScore = latencyStats ? Math.max(0, 100 - (latencyStats.p95 / 10)) : 50;
      const availabilityScore = availability;
      const errorScore = Math.max(0, 100 - errorRate * 5);
      const healthScore = Math.round((latencyScore * 0.3 + availabilityScore * 0.5 + errorScore * 0.2) * 100) / 100;

      const status = healthScore >= 90 ? "healthy" : healthScore >= 70 ? "degraded" : healthScore >= 50 ? "unhealthy" : "critical";

      return {
        name: ep.name,
        url: ep.url,
        status,
        healthScore,
        availability,
        errorRate,
        latency: latencyStats,
        throughputRps: throughput,
        statusCodeDistribution: codeDistribution,
        errors: { total: errors.length, server: serverErrors.length, client: clientErrors.length },
        sampleCount: samples.length,
      };
    });

    // Overall health
    const avgHealth = endpointHealth.reduce((s, e) => s + (e.healthScore || 0), 0) / endpointHealth.length;
    const overallStatus = avgHealth >= 90 ? "healthy" : avgHealth >= 70 ? "degraded" : avgHealth >= 50 ? "unhealthy" : "critical";

    artifact.data.healthReport = { timestamp: new Date().toISOString(), overallStatus, avgHealth: Math.round(avgHealth * 100) / 100 };

    return {
      ok: true, result: {
        overallStatus,
        overallHealthScore: Math.round(avgHealth * 100) / 100,
        endpoints: endpointHealth,
        summary: {
          total: endpoints.length,
          healthy: endpointHealth.filter(e => e.status === "healthy").length,
          degraded: endpointHealth.filter(e => e.status === "degraded").length,
          unhealthy: endpointHealth.filter(e => e.status === "unhealthy").length,
          critical: endpointHealth.filter(e => e.status === "critical").length,
        },
      },
    };
  });

  /**
   * dataFlowMapping
   * Map data flows between systems: build flow graph, identify bottlenecks,
   * and compute throughput capacity.
   * artifact.data.flows = [{ source, target, dataType?, throughputMbps?, latencyMs?, protocol? }]
   */
  registerLensAction("integrations", "dataFlowMapping", (ctx, artifact, params) => {
    const flows = artifact.data?.flows || [];
    if (flows.length === 0) return { ok: true, result: { message: "No flows to map." } };

    // Build adjacency graph
    const graph = {};
    const nodeSet = new Set();
    for (const flow of flows) {
      nodeSet.add(flow.source);
      nodeSet.add(flow.target);
      if (!graph[flow.source]) graph[flow.source] = [];
      graph[flow.source].push({
        target: flow.target,
        throughput: flow.throughputMbps || 0,
        latency: flow.latencyMs || 0,
        dataType: flow.dataType || "unknown",
        protocol: flow.protocol || "unknown",
      });
    }

    const nodes = [...nodeSet];

    // Node degree analysis
    const inDegree = {};
    const outDegree = {};
    for (const node of nodes) { inDegree[node] = 0; outDegree[node] = 0; }
    for (const flow of flows) {
      outDegree[flow.source] = (outDegree[flow.source] || 0) + 1;
      inDegree[flow.target] = (inDegree[flow.target] || 0) + 1;
    }

    // Identify bottlenecks: nodes with high in-degree and low outgoing throughput
    const nodeAnalysis = nodes.map(node => {
      const incoming = flows.filter(f => f.target === node);
      const outgoing = flows.filter(f => f.source === node);
      const incomingThroughput = incoming.reduce((s, f) => s + (f.throughputMbps || 0), 0);
      const outgoingThroughput = outgoing.reduce((s, f) => s + (f.throughputMbps || 0), 0);

      // Bottleneck score: high incoming vs low outgoing throughput
      const bottleneckScore = outgoingThroughput > 0 && incomingThroughput > 0
        ? Math.round((incomingThroughput / outgoingThroughput) * 100) / 100
        : 0;

      return {
        node,
        inDegree: inDegree[node],
        outDegree: outDegree[node],
        incomingThroughputMbps: Math.round(incomingThroughput * 100) / 100,
        outgoingThroughputMbps: Math.round(outgoingThroughput * 100) / 100,
        bottleneckScore,
        isBottleneck: bottleneckScore > 2.0,
        role: inDegree[node] === 0 ? "source" : outDegree[node] === 0 ? "sink" : "intermediary",
      };
    });

    const bottlenecks = nodeAnalysis.filter(n => n.isBottleneck).sort((a, b) => b.bottleneckScore - a.bottleneckScore);

    // Find all paths between sources and sinks (BFS, capped)
    const sources = nodeAnalysis.filter(n => n.role === "source").map(n => n.node);
    const sinks = nodeAnalysis.filter(n => n.role === "sink").map(n => n.node);

    const paths = [];
    for (const source of sources) {
      const bfsQueue = [[source]];
      while (bfsQueue.length > 0 && paths.length < 50) {
        const path = bfsQueue.shift();
        const current = path[path.length - 1];
        if (sinks.includes(current) && path.length > 1) {
          // Compute path throughput (min of edges) and latency (sum of edges)
          let minThroughput = Infinity;
          let totalLatency = 0;
          for (let i = 0; i < path.length - 1; i++) {
            const edge = flows.find(f => f.source === path[i] && f.target === path[i + 1]);
            if (edge) {
              if (edge.throughputMbps && edge.throughputMbps < minThroughput) minThroughput = edge.throughputMbps;
              totalLatency += edge.latencyMs || 0;
            }
          }
          paths.push({
            path,
            hops: path.length - 1,
            throughputCapacityMbps: minThroughput === Infinity ? 0 : minThroughput,
            totalLatencyMs: totalLatency,
          });
          continue;
        }
        if (path.length > 10) continue;
        for (const edge of graph[current] || []) {
          if (!path.includes(edge.target)) {
            bfsQueue.push([...path, edge.target]);
          }
        }
      }
    }

    // Protocol summary
    const protocols = {};
    for (const flow of flows) {
      const proto = flow.protocol || "unknown";
      if (!protocols[proto]) protocols[proto] = { count: 0, avgThroughput: 0, totalThroughput: 0 };
      protocols[proto].count++;
      protocols[proto].totalThroughput += flow.throughputMbps || 0;
    }
    for (const proto of Object.values(protocols)) {
      proto.avgThroughput = Math.round((proto.totalThroughput / proto.count) * 100) / 100;
    }

    artifact.data.flowGraph = { nodes, edges: flows.length, bottlenecks: bottlenecks.map(b => b.node) };

    return {
      ok: true, result: {
        nodes: nodeAnalysis,
        bottlenecks,
        paths: paths.sort((a, b) => b.throughputCapacityMbps - a.throughputCapacityMbps),
        protocolSummary: protocols,
        metrics: {
          totalNodes: nodes.length,
          totalFlows: flows.length,
          sourceCount: sources.length,
          sinkCount: sinks.length,
          bottleneckCount: bottlenecks.length,
          maxThroughputPath: paths.length > 0 ? Math.max(...paths.map(p => p.throughputCapacityMbps)) : 0,
          minLatencyPath: paths.length > 0 ? Math.min(...paths.map(p => p.totalLatencyMs)) : 0,
        },
      },
    };
  });

  /**
   * compatibilityCheck
   * Check API version compatibility: semantic versioning comparison,
   * breaking change detection, and migration effort scoring.
   * artifact.data.apis = [{ name, currentVersion, targetVersion, changes?: [{ type: "added"|"removed"|"modified", field, breaking?: bool }] }]
   */
  registerLensAction("integrations", "compatibilityCheck", (ctx, artifact, params) => {
    const apis = artifact.data?.apis || [];
    if (apis.length === 0) return { ok: true, result: { message: "No APIs to check." } };

    function parseSemver(version) {
      const match = String(version || "0.0.0").match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
      if (!match) return { major: 0, minor: 0, patch: 0, prerelease: null, valid: false };
      return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]), prerelease: match[4] || null, valid: true };
    }

    function compareVersions(a, b) {
      if (a.major !== b.major) return a.major - b.major;
      if (a.minor !== b.minor) return a.minor - b.minor;
      return a.patch - b.patch;
    }

    const results = apis.map(api => {
      const current = parseSemver(api.currentVersion);
      const target = parseSemver(api.targetVersion);

      // Version comparison
      const comparison = compareVersions(target, current);
      let versionJump;
      if (target.major > current.major) versionJump = "major";
      else if (target.minor > current.minor) versionJump = "minor";
      else if (target.patch > current.patch) versionJump = "patch";
      else if (comparison === 0) versionJump = "same";
      else versionJump = "downgrade";

      // Breaking change detection from changes list
      const changes = api.changes || [];
      const breakingChanges = changes.filter(c => c.breaking || c.type === "removed");
      const nonBreakingChanges = changes.filter(c => !c.breaking && c.type !== "removed");
      const addedFields = changes.filter(c => c.type === "added");
      const removedFields = changes.filter(c => c.type === "removed");
      const modifiedFields = changes.filter(c => c.type === "modified");

      // Infer breaking if major version bump and no explicit changes
      const inferredBreaking = changes.length === 0 && versionJump === "major";

      // Migration effort scoring
      // Each breaking change = 8 effort points, non-breaking = 2, major version = 15 base
      let migrationEffort = 0;
      migrationEffort += breakingChanges.length * 8;
      migrationEffort += nonBreakingChanges.length * 2;
      if (versionJump === "major") migrationEffort += 15;
      else if (versionJump === "minor") migrationEffort += 5;

      // Cap to 100-point scale
      const migrationScore = Math.min(100, migrationEffort);
      const migrationLevel = migrationScore >= 60 ? "high" : migrationScore >= 30 ? "moderate" : migrationScore >= 10 ? "low" : "trivial";

      // Estimated hours (rough heuristic)
      const estimatedHours = Math.round(migrationScore * 0.4 * 10) / 10;

      // Backward compatibility
      const backwardCompatible = breakingChanges.length === 0 && versionJump !== "major" && !inferredBreaking;

      return {
        name: api.name,
        currentVersion: api.currentVersion,
        targetVersion: api.targetVersion,
        versionJump,
        backwardCompatible,
        changes: {
          total: changes.length,
          breaking: breakingChanges.length,
          nonBreaking: nonBreakingChanges.length,
          added: addedFields.map(c => c.field),
          removed: removedFields.map(c => c.field),
          modified: modifiedFields.map(c => c.field),
        },
        inferredBreaking,
        migration: {
          effortScore: migrationScore,
          level: migrationLevel,
          estimatedHours,
          breakingChangeDetails: breakingChanges,
        },
      };
    });

    // Aggregate
    const totalBreaking = results.reduce((s, r) => s + r.changes.breaking, 0);
    const allCompatible = results.every(r => r.backwardCompatible);
    const totalMigrationEffort = results.reduce((s, r) => s + r.migration.effortScore, 0);

    return {
      ok: true, result: {
        apis: results,
        summary: {
          totalApis: apis.length,
          compatible: results.filter(r => r.backwardCompatible).length,
          incompatible: results.filter(r => !r.backwardCompatible).length,
          totalBreakingChanges: totalBreaking,
          allBackwardCompatible: allCompatible,
          aggregateMigrationEffort: Math.min(100, totalMigrationEffort),
          totalEstimatedHours: Math.round(results.reduce((s, r) => s + r.migration.estimatedHours, 0) * 10) / 10,
        },
      },
    };
  });
}
