/**
 * Visualization Lens Template
 *
 * Generates a domain handler for data visualization lenses:
 * chart rendering configuration, dataset transformation, insight extraction,
 * and dashboard composition.
 */

export const id = "visualization";
export const name = "Data Visualization";
export const description = "Chart configuration, dataset transforms, insight extraction, and dashboard composition for data-viz lenses.";
export const category = "data-visualization";
export const tags = ["chart", "dashboard", "visualization", "data", "graph", "insight", "analytics"];

/**
 * Generate domain handler code for a visualization lens.
 *
 * @param {object} config
 * @param {string} config.domain - Domain/lens ID (e.g. "sales-dashboard")
 * @param {string} [config.entityName] - Primary data entity (e.g. "Metric")
 * @param {string[]} [config.chartTypes] - Supported chart types (default: bar, line, pie, scatter)
 * @param {boolean} [config.realtime] - Include real-time streaming support (default false)
 * @returns {{ handler: string, page: string }}
 */
export function generate(config) {
  const domain = config.domain || "my-viz";
  const entity = config.entityName || "Dataset";
  const entityLower = entity.toLowerCase();
  const chartTypes = config.chartTypes || ["bar", "line", "pie", "scatter", "area"];
  const realtime = config.realtime === true;

  const handler = `// server/domains/${domain}.js
// Domain actions for ${domain}: data visualization, charting, and dashboard composition.

export default function register${pascal(domain)}Actions(registerLensAction) {
  /**
   * configureChart
   * Build a chart configuration from a dataset.
   * artifact.data = { series: [{ label, values: number[] }], xLabels?: string[] }
   * params.chartType = ${JSON.stringify(chartTypes).replace(/"/g, '"')}
   */
  registerLensAction("${domain}", "configureChart", (ctx, artifact, params) => {
    const series = artifact.data?.series || [];
    const chartType = params.chartType || "bar";
    const supportedTypes = ${JSON.stringify(chartTypes)};

    if (!supportedTypes.includes(chartType)) {
      return { ok: false, error: \`Unsupported chart type "\${chartType}". Use one of: \${supportedTypes.join(", ")}\` };
    }
    if (series.length === 0) {
      return { ok: true, result: { message: "No data series provided." } };
    }

    const xLabels = artifact.data?.xLabels || series[0].values.map((_, i) => \`Point \${i + 1}\`);

    // Compute per-series stats
    const seriesConfigs = series.map(s => {
      const vals = (s.values || []).map(Number).filter(v => !isNaN(v));
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = vals.length > 0 ? sum / vals.length : 0;
      const min = vals.length > 0 ? Math.min(...vals) : 0;
      const max = vals.length > 0 ? Math.max(...vals) : 0;
      return {
        label: s.label || "Series",
        dataPoints: vals.length,
        stats: {
          sum: Math.round(sum * 100) / 100,
          mean: Math.round(mean * 100) / 100,
          min,
          max,
          range: max - min,
        },
      };
    });

    // Auto-suggest best chart type based on data shape
    let suggestedType = chartType;
    const totalPoints = seriesConfigs.reduce((s, c) => s + c.dataPoints, 0);
    if (series.length === 1 && totalPoints <= 6) suggestedType = "pie";
    else if (series.length > 1 && totalPoints > 20) suggestedType = "line";
    else if (series.length === 2) suggestedType = "scatter";

    return {
      ok: true,
      result: {
        chartType,
        suggestedType,
        xLabels,
        series: seriesConfigs,
        totalDataPoints: totalPoints,
        config: {
          type: chartType,
          responsive: true,
          legend: series.length > 1,
          tooltip: true,
          animation: totalPoints < 200,
        },
      },
    };
  });

  /**
   * transformDataset
   * Transform raw data into chart-ready format: pivot, aggregate, normalize.
   * artifact.data.rows = [{ ...fields }]
   * params.groupBy, params.valueField, params.aggregation ("sum"|"avg"|"count"|"min"|"max")
   */
  registerLensAction("${domain}", "transformDataset", (ctx, artifact, params) => {
    const rows = artifact.data?.rows || [];
    if (rows.length === 0) return { ok: true, result: { message: "No rows to transform." } };

    const groupBy = params.groupBy || Object.keys(rows[0])[0];
    const valueField = params.valueField || Object.keys(rows[0]).find(k => typeof rows[0][k] === "number") || Object.keys(rows[0])[1];
    const aggregation = params.aggregation || "sum";

    // Group rows
    const groups = {};
    for (const row of rows) {
      const key = String(row[groupBy] ?? "unknown");
      if (!groups[key]) groups[key] = [];
      groups[key].push(Number(row[valueField]) || 0);
    }

    // Aggregate
    const aggregated = {};
    for (const [key, vals] of Object.entries(groups)) {
      switch (aggregation) {
        case "sum":   aggregated[key] = vals.reduce((a, b) => a + b, 0); break;
        case "avg":   aggregated[key] = vals.reduce((a, b) => a + b, 0) / vals.length; break;
        case "count": aggregated[key] = vals.length; break;
        case "min":   aggregated[key] = Math.min(...vals); break;
        case "max":   aggregated[key] = Math.max(...vals); break;
        default:      aggregated[key] = vals.reduce((a, b) => a + b, 0);
      }
      aggregated[key] = Math.round(aggregated[key] * 100) / 100;
    }

    // Build chart-ready series
    const labels = Object.keys(aggregated);
    const values = Object.values(aggregated);

    return {
      ok: true,
      result: {
        series: [{ label: \`\${valueField} (\${aggregation})\`, values }],
        xLabels: labels,
        groupBy,
        valueField,
        aggregation,
        groupCount: labels.length,
        originalRows: rows.length,
      },
    };
  });

  /**
   * extractInsights
   * Analyze a dataset and surface notable insights: outliers, trends, correlations.
   * artifact.data.series = [{ label, values: number[] }]
   */
  registerLensAction("${domain}", "extractInsights", (ctx, artifact, params) => {
    const series = artifact.data?.series || [];
    if (series.length === 0) return { ok: true, result: { message: "No series to analyze." } };

    const insights = [];

    for (const s of series) {
      const vals = (s.values || []).map(Number).filter(v => !isNaN(v));
      if (vals.length < 2) continue;

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const stdDev = Math.sqrt(vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length);

      // Outlier detection (2 std deviations)
      const outliers = vals
        .map((v, i) => ({ index: i, value: v, zScore: stdDev > 0 ? (v - mean) / stdDev : 0 }))
        .filter(o => Math.abs(o.zScore) > 2);
      if (outliers.length > 0) {
        insights.push({
          type: "outlier",
          series: s.label,
          message: \`\${outliers.length} outlier(s) detected in "\${s.label}" (> 2 std deviations)\`,
          details: outliers,
        });
      }

      // Trend detection (linear regression slope)
      const n = vals.length;
      const xMean = (n - 1) / 2;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { num += (i - xMean) * (vals[i] - mean); den += Math.pow(i - xMean, 2); }
      const slope = den !== 0 ? num / den : 0;
      const trend = slope > 0.01 * mean ? "upward" : slope < -0.01 * mean ? "downward" : "flat";
      insights.push({
        type: "trend",
        series: s.label,
        message: \`"\${s.label}" shows a \${trend} trend (slope: \${(slope).toFixed(3)})\`,
        trend,
        slope: Math.round(slope * 1000) / 1000,
      });

      // Peak/trough
      const maxVal = Math.max(...vals);
      const minVal = Math.min(...vals);
      const maxIdx = vals.indexOf(maxVal);
      const minIdx = vals.indexOf(minVal);
      insights.push({
        type: "extremes",
        series: s.label,
        message: \`"\${s.label}" peaks at index \${maxIdx} (\${maxVal}) and troughs at index \${minIdx} (\${minVal})\`,
        peak: { index: maxIdx, value: maxVal },
        trough: { index: minIdx, value: minVal },
      });
    }

    // Cross-series correlation (if 2+ series with same length)
    if (series.length >= 2) {
      const s1 = (series[0].values || []).map(Number);
      const s2 = (series[1].values || []).map(Number);
      if (s1.length === s2.length && s1.length >= 3) {
        const m1 = s1.reduce((a, b) => a + b, 0) / s1.length;
        const m2 = s2.reduce((a, b) => a + b, 0) / s2.length;
        let cov = 0, v1 = 0, v2 = 0;
        for (let i = 0; i < s1.length; i++) {
          cov += (s1[i] - m1) * (s2[i] - m2);
          v1 += Math.pow(s1[i] - m1, 2);
          v2 += Math.pow(s2[i] - m2, 2);
        }
        const denom = Math.sqrt(v1 * v2);
        const correlation = denom > 0 ? cov / denom : 0;
        const strength = Math.abs(correlation) > 0.7 ? "strong" : Math.abs(correlation) > 0.4 ? "moderate" : "weak";
        insights.push({
          type: "correlation",
          series: [series[0].label, series[1].label],
          message: \`\${strength} \${correlation > 0 ? "positive" : "negative"} correlation (\${correlation.toFixed(3)}) between "\${series[0].label}" and "\${series[1].label}"\`,
          correlation: Math.round(correlation * 1000) / 1000,
          strength,
        });
      }
    }

    return { ok: true, result: { insights, insightCount: insights.length } };
  });

  /**
   * composeDashboard
   * Assemble a dashboard layout from multiple chart configurations.
   * artifact.data.panels = [{ title, chartType, series, width?, height? }]
   */
  registerLensAction("${domain}", "composeDashboard", (ctx, artifact, params) => {
    const panels = artifact.data?.panels || [];
    if (panels.length === 0) return { ok: true, result: { message: "No panels defined for dashboard." } };

    const columns = parseInt(params.columns) || (panels.length <= 2 ? 1 : panels.length <= 4 ? 2 : 3);
    const layout = [];
    let row = 0, col = 0;

    for (const panel of panels) {
      const width = panel.width || Math.floor(12 / columns);
      layout.push({
        title: panel.title || "Untitled Panel",
        chartType: panel.chartType || "bar",
        gridPosition: { row, col, width, height: panel.height || 1 },
        seriesCount: (panel.series || []).length,
        dataPoints: (panel.series || []).reduce((s, sr) => s + (sr.values || []).length, 0),
      });
      col += width;
      if (col >= 12) { col = 0; row++; }
    }

    return {
      ok: true,
      result: {
        layout,
        grid: { columns, rows: row + 1, totalPanels: panels.length },
        metrics: {
          totalDataPoints: layout.reduce((s, p) => s + p.dataPoints, 0),
          chartTypes: [...new Set(layout.map(p => p.chartType))],
        },
      },
    };
  });${realtime ? `

  /**
   * streamConfig
   * Configure real-time data streaming for live dashboards.
   * params.interval (ms), params.maxBuffer, params.channels
   */
  registerLensAction("${domain}", "streamConfig", (ctx, artifact, params) => {
    const interval = Math.max(100, parseInt(params.interval) || 1000);
    const maxBuffer = Math.min(10000, parseInt(params.maxBuffer) || 500);
    const channels = params.channels || ["default"];

    return {
      ok: true,
      result: {
        streaming: {
          interval,
          maxBuffer,
          channels,
          protocol: "sse",
          endpoint: \`/api/lens/${domain}/stream\`,
        },
        warnings: interval < 250 ? ["Interval < 250ms may cause performance issues."] : [],
      },
    };
  });` : ""}
}
`;

  const actions = [
    "configureChart", "transformDataset", "extractInsights", "composeDashboard",
    ...(realtime ? ["streamConfig"] : []),
  ];

  const page = generatePageTemplate(domain, entity, actions);
  return { handler, page };
}

/** Convert kebab-case to PascalCase */
function pascal(str) {
  return str.replace(/(^|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}

/** Generate a Next.js page template for the visualization lens */
function generatePageTemplate(domain, entity, actions) {
  return `"use client";
import { useState } from "react";

export default function ${pascal(domain)}Lens() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runAction(action, data = {}) {
    setLoading(true);
    try {
      const res = await fetch(\`/api/lens/${domain}/action\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">${entity} Visualization</h1>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {${JSON.stringify(actions)}.map(action => (
          <button
            key={action}
            onClick={() => runAction(action)}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {action}
          </button>
        ))}
      </div>
      {result && (
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
`;
}

export default { id, name, description, category, tags, generate };
