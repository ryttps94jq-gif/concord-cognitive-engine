// server/domains/analytics.js
// Domain actions for analytics: funnel analysis, cohort analysis,
// metric aggregation, anomaly detection, trend forecasting.

export default function registerAnalyticsActions(registerLensAction) {
  registerLensAction("analytics", "funnelAnalysis", (ctx, artifact, _params) => {
    const stages = artifact.data?.stages || [];
    if (stages.length < 2) return { ok: true, result: { message: "Add at least 2 funnel stages with counts." } };
    const analyzed = stages.map((s, i) => {
      const count = parseInt(s.count) || 0;
      const prevCount = i > 0 ? (parseInt(stages[i - 1].count) || 1) : count;
      const dropoff = i > 0 ? Math.round((1 - count / prevCount) * 100) : 0;
      const conversionFromTop = stages[0].count > 0 ? Math.round((count / parseInt(stages[0].count)) * 100) : 0;
      return { stage: s.name || `Stage ${i + 1}`, count, dropoff, conversionFromTop };
    });
    const worstDropoff = analyzed.slice(1).sort((a, b) => b.dropoff - a.dropoff)[0];
    return { ok: true, result: { stages: analyzed, overallConversion: analyzed[analyzed.length - 1]?.conversionFromTop || 0, worstDropoff: worstDropoff?.stage, worstDropoffRate: worstDropoff?.dropoff } };
  });

  registerLensAction("analytics", "cohortAnalysis", (ctx, artifact, _params) => {
    const cohorts = artifact.data?.cohorts || [];
    if (cohorts.length === 0) return { ok: true, result: { message: "Add cohort data with retention periods." } };
    const analyzed = cohorts.map(c => {
      const initial = parseInt(c.initialUsers) || 0;
      const periods = (c.retention || []).map((r, i) => ({
        period: i + 1, retained: parseInt(r) || 0, rate: initial > 0 ? Math.round((parseInt(r) / initial) * 100) : 0,
      }));
      return { cohort: c.name || c.period, initialUsers: initial, retentionCurve: periods, avgRetention: periods.length > 0 ? Math.round(periods.reduce((s, p) => s + p.rate, 0) / periods.length) : 0 };
    });
    return { ok: true, result: { cohorts: analyzed, bestCohort: analyzed.sort((a, b) => b.avgRetention - a.avgRetention)[0]?.cohort } };
  });

  registerLensAction("analytics", "detectAnomalies", (ctx, artifact, _params) => {
    const dataPoints = artifact.data?.dataPoints || [];
    if (dataPoints.length < 5) return { ok: true, result: { message: "Need at least 5 data points for anomaly detection." } };
    const values = dataPoints.map(d => parseFloat(d.value) || 0);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
    const threshold = 2; // 2 standard deviations
    const anomalies = dataPoints.map((d, i) => {
      const val = parseFloat(d.value) || 0;
      const zScore = stdDev > 0 ? (val - mean) / stdDev : 0;
      return { date: d.date || d.label || `Point ${i}`, value: val, zScore: Math.round(zScore * 100) / 100, isAnomaly: Math.abs(zScore) > threshold, direction: zScore > 0 ? "high" : "low" };
    }).filter(a => a.isAnomaly);
    return { ok: true, result: { mean: Math.round(mean * 100) / 100, stdDev: Math.round(stdDev * 100) / 100, totalPoints: dataPoints.length, anomaliesFound: anomalies.length, anomalies, threshold: `${threshold} std deviations` } };
  });

  registerLensAction("analytics", "trendForecast", (ctx, artifact, _params) => {
    const dataPoints = artifact.data?.dataPoints || [];
    if (dataPoints.length < 3) return { ok: true, result: { message: "Need at least 3 data points for forecasting." } };
    const values = dataPoints.map(d => parseFloat(d.value) || 0);
    const n = values.length;
    // Simple linear regression
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xMean) * (values[i] - yMean); den += Math.pow(i - xMean, 2); }
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const forecast = [1, 2, 3, 5, 7].map(p => ({ periodsAhead: p, predicted: Math.round((slope * (n - 1 + p) + intercept) * 100) / 100 }));
    const trend = slope > 0.01 ? "upward" : slope < -0.01 ? "downward" : "flat";
    return { ok: true, result: { trend, slope: Math.round(slope * 1000) / 1000, dataPoints: n, lastValue: values[n - 1], forecast, confidence: n >= 10 ? "moderate" : "low" } };
  });
}
