// server/domains/bridge.js
// Domain actions for bridge/integration: connection health, data mapping,
// sync status, throughput analysis, conflict resolution.

export default function registerBridgeActions(registerLensAction) {
  registerLensAction("bridge", "connectionHealth", (ctx, artifact, _params) => {
    const connections = artifact.data?.connections || [];
    if (connections.length === 0) return { ok: true, result: { message: "Add bridge connections to monitor health." } };
    const analyzed = connections.map(c => {
      const latency = parseFloat(c.latencyMs) || 0;
      const uptime = parseFloat(c.uptimePercent) || 99;
      const errorRate = parseFloat(c.errorRate) || 0;
      const health = Math.round((Math.max(0, 1 - latency / 5000) * 30 + uptime / 100 * 40 + Math.max(0, 1 - errorRate) * 30) * 100) / 100;
      return { name: c.name || c.source, source: c.source, target: c.target, latencyMs: latency, uptimePercent: uptime, errorRate, healthScore: health, status: health >= 80 ? "healthy" : health >= 50 ? "degraded" : "critical" };
    });
    return { ok: true, result: { connections: analyzed, totalConnections: analyzed.length, healthy: analyzed.filter(c => c.status === "healthy").length, degraded: analyzed.filter(c => c.status === "degraded").length, critical: analyzed.filter(c => c.status === "critical").length, overallHealth: Math.round(analyzed.reduce((s, c) => s + c.healthScore, 0) / analyzed.length) } };
  });

  registerLensAction("bridge", "dataMapping", (ctx, artifact, _params) => {
    const mappings = artifact.data?.mappings || [];
    if (mappings.length === 0) return { ok: true, result: { message: "Define field mappings between source and target systems." } };
    const analyzed = mappings.map(m => ({ sourceField: m.source, targetField: m.target, transform: m.transform || "direct", dataType: m.dataType || "string", required: m.required || false, valid: !!(m.source && m.target) }));
    const valid = analyzed.filter(m => m.valid).length;
    return { ok: true, result: { mappings: analyzed, total: analyzed.length, valid, invalid: analyzed.length - valid, coverage: analyzed.length > 0 ? Math.round((valid / analyzed.length) * 100) : 0, transforms: [...new Set(analyzed.map(m => m.transform))] } };
  });

  registerLensAction("bridge", "syncStatus", (ctx, artifact, _params) => {
    const syncs = artifact.data?.syncs || [];
    const lastSync = artifact.data?.lastSync ? new Date(artifact.data.lastSync) : null;
    const now = new Date();
    const minutesSinceSync = lastSync ? (now.getTime() - lastSync.getTime()) / 60000 : Infinity;
    const syncHealth = minutesSinceSync < 5 ? "real-time" : minutesSinceSync < 60 ? "recent" : minutesSinceSync < 1440 ? "stale" : "disconnected";
    const totalRecords = syncs.reduce((s, sync) => s + (parseInt(sync.recordsProcessed) || 0), 0);
    const totalErrors = syncs.reduce((s, sync) => s + (parseInt(sync.errors) || 0), 0);
    return { ok: true, result: { lastSync: lastSync?.toISOString() || "never", minutesSinceSync: Math.round(minutesSinceSync), syncHealth, totalSyncs: syncs.length, totalRecordsProcessed: totalRecords, totalErrors, errorRate: totalRecords > 0 ? Math.round((totalErrors / totalRecords) * 10000) / 100 : 0 } };
  });

  registerLensAction("bridge", "throughputAnalysis", (ctx, artifact, _params) => {
    const metrics = artifact.data?.throughputMetrics || [];
    if (metrics.length === 0) return { ok: true, result: { message: "Add throughput metrics to analyze bridge performance." } };
    const values = metrics.map(m => parseFloat(m.recordsPerSecond || m.rps) || 0);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const peak = Math.max(...values);
    const min = Math.min(...values);
    return { ok: true, result: { avgRPS: Math.round(avg * 10) / 10, peakRPS: Math.round(peak * 10) / 10, minRPS: Math.round(min * 10) / 10, dataPoints: metrics.length, bottleneck: avg < 100 ? "Low throughput — check network or rate limits" : "Throughput is healthy" } };
  });
}
