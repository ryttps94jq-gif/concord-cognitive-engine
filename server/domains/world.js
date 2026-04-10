// server/domains/world.js
export default function registerWorldActions(registerLensAction) {
  registerLensAction("world", "countryCompare", (ctx, artifact, _params) => {
    const countries = artifact.data?.countries || [];
    if (countries.length < 2) return { ok: true, result: { message: "Provide 2+ countries with metrics to compare." } };
    const metrics = ["gdp", "population", "area", "hdi", "lifeExpectancy", "literacyRate"];
    const comparison = {};
    metrics.forEach(metric => {
      const values = countries.map(c => ({ name: c.name || c.country, value: parseFloat(c[metric]) || 0 })).filter(v => v.value > 0);
      if (values.length > 0) {
        values.sort((a, b) => b.value - a.value);
        comparison[metric] = { values, highest: values[0], lowest: values[values.length - 1], avg: Math.round((values.reduce((s, v) => s + v.value, 0) / values.length) * 100) / 100 };
      }
    });
    const ranked = countries.map(c => {
      let score = 0, factors = 0;
      if (c.hdi) { score += parseFloat(c.hdi) * 100; factors++; }
      if (c.gdpPerCapita) { score += Math.min(100, parseFloat(c.gdpPerCapita) / 500); factors++; }
      if (c.lifeExpectancy) { score += parseFloat(c.lifeExpectancy); factors++; }
      return { name: c.name || c.country, compositeScore: factors > 0 ? Math.round(score / factors) : 0 };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
    return { ok: true, result: { countriesCompared: countries.length, comparison, rankings: ranked, metricsAvailable: Object.keys(comparison) } };
  });

  registerLensAction("world", "indicatorTrack", (ctx, artifact, _params) => {
    const data = artifact.data?.indicators || artifact.data?.series || [];
    if (data.length < 2) return { ok: true, result: { message: "Provide 2+ data points with year and value to track." } };
    const sorted = [...data].sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
    const values = sorted.map(d => parseFloat(d.value) || 0);
    const years = sorted.map(d => parseInt(d.year) || 0);
    const n = values.length;
    const first = values[0], last = values[n - 1];
    const totalChange = last - first;
    const pctChange = first !== 0 ? Math.round((totalChange / Math.abs(first)) * 10000) / 100 : 0;
    const yearSpan = years[n - 1] - years[0];
    const cagr = yearSpan > 0 && first > 0 && last > 0 ? Math.round((Math.pow(last / first, 1 / yearSpan) - 1) * 10000) / 100 : 0;
    const avg = values.reduce((s, v) => s + v, 0) / n;
    const trend = totalChange > 0 ? "increasing" : totalChange < 0 ? "decreasing" : "stable";
    // Year-over-year changes
    const yoyChanges = [];
    for (let i = 1; i < n; i++) {
      yoyChanges.push({ year: years[i], change: Math.round((values[i] - values[i - 1]) * 100) / 100, pct: values[i - 1] !== 0 ? Math.round(((values[i] - values[i - 1]) / Math.abs(values[i - 1])) * 10000) / 100 : 0 });
    }
    return { ok: true, result: { indicator: artifact.data?.name || "Indicator", dataPoints: n, yearRange: `${years[0]}-${years[n - 1]}`, startValue: first, endValue: last, totalChange, percentChange: pctChange, cagr, trend, avg: Math.round(avg * 100) / 100, yoyChanges, bestYear: yoyChanges.sort((a, b) => b.pct - a.pct)[0], worstYear: yoyChanges.sort((a, b) => a.pct - b.pct)[0] } };
  });

  registerLensAction("world", "tradeFlow", (ctx, artifact, _params) => {
    const trades = artifact.data?.trades || artifact.data?.flows || [];
    if (trades.length === 0) return { ok: true, result: { message: "Provide trade flow data with from/to/value fields." } };
    const byCountry = {};
    trades.forEach(t => {
      const from = t.from || t.exporter || "";
      const to = t.to || t.importer || "";
      const value = parseFloat(t.value || t.amount) || 0;
      if (from) { if (!byCountry[from]) byCountry[from] = { exports: 0, imports: 0, partners: new Set() }; byCountry[from].exports += value; byCountry[from].partners.add(to); }
      if (to) { if (!byCountry[to]) byCountry[to] = { exports: 0, imports: 0, partners: new Set() }; byCountry[to].imports += value; byCountry[to].partners.add(from); }
    });
    const summary = Object.entries(byCountry).map(([country, data]) => ({
      country, exports: Math.round(data.exports * 100) / 100, imports: Math.round(data.imports * 100) / 100, balance: Math.round((data.exports - data.imports) * 100) / 100, partners: data.partners.size, status: data.exports > data.imports ? "surplus" : data.exports < data.imports ? "deficit" : "balanced",
    })).sort((a, b) => (b.exports + b.imports) - (a.exports + a.imports));
    const totalVolume = trades.reduce((s, t) => s + (parseFloat(t.value || t.amount) || 0), 0);
    return { ok: true, result: { totalFlows: trades.length, totalVolume: Math.round(totalVolume * 100) / 100, countries: summary.length, summary, topExporter: summary.sort((a, b) => b.exports - a.exports)[0]?.country, topImporter: summary.sort((a, b) => b.imports - a.imports)[0]?.country, largestSurplus: summary.sort((a, b) => b.balance - a.balance)[0]?.country, largestDeficit: summary.sort((a, b) => a.balance - b.balance)[0]?.country } };
  });

  registerLensAction("world", "demographicProfile", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const population = parseFloat(data.population) || 0;
    const area = parseFloat(data.area) || 0;
    const urban = parseFloat(data.urbanPopulation || data.urbanPercent) || 0;
    const growthRate = parseFloat(data.growthRate) || 0;
    const ageGroups = data.ageGroups || {};
    if (population === 0) return { ok: true, result: { message: "Provide population data with demographics." } };
    const density = area > 0 ? Math.round(population / area) : 0;
    const urbanRate = urban > 0 ? (urban > 1 ? urban : Math.round(urban * 100)) : null;
    const medianAge = parseFloat(data.medianAge) || null;
    const ageDistribution = {};
    let totalAgePop = 0;
    Object.entries(ageGroups).forEach(([group, count]) => {
      const val = parseFloat(count) || 0;
      ageDistribution[group] = val;
      totalAgePop += val;
    });
    if (totalAgePop > 0) {
      Object.keys(ageDistribution).forEach(k => {
        ageDistribution[k] = { count: ageDistribution[k], percent: Math.round((ageDistribution[k] / totalAgePop) * 100) };
      });
    }
    const doublingTime = growthRate > 0 ? Math.round(70 / growthRate) : null;
    const projectedPop5yr = Math.round(population * Math.pow(1 + growthRate / 100, 5));
    const projectedPop10yr = Math.round(population * Math.pow(1 + growthRate / 100, 10));
    return { ok: true, result: { population, area: area > 0 ? `${area} km²` : null, density: density > 0 ? `${density}/km²` : null, urbanizationRate: urbanRate ? `${urbanRate}%` : null, growthRate: `${growthRate}%`, doublingTimeYears: doublingTime, medianAge, ageDistribution: Object.keys(ageDistribution).length > 0 ? ageDistribution : null, projections: { fiveYear: projectedPop5yr, tenYear: projectedPop10yr }, classification: density > 500 ? "densely populated" : density > 100 ? "moderately populated" : density > 25 ? "sparsely populated" : "very sparsely populated" } };
  });
}
