// server/domains/global.js
// Domain actions for global/cross-domain aggregation: cross-domain search,
// aggregate dashboards, and correlation matrix computation.

export default function registerGlobalActions(registerLensAction) {
  /**
   * crossDomainSearch
   * Search across multiple domains — merge results with relevance scoring,
   * deduplication, and source attribution.
   * artifact.data.sources = [{ domain, items: [{ id, title?, text?, tags?: string[], score?, metadata?: {} }] }]
   * params.query (search query string)
   * params.maxResults (default: 20)
   * params.weights (domain weight overrides, e.g. { "finance": 1.5 })
   */
  registerLensAction("global", "crossDomainSearch", (ctx, artifact, params) => {
    const sources = artifact.data?.sources || [];
    const query = (params.query || "").toLowerCase().trim();
    const maxResults = params.maxResults || 20;
    const domainWeights = params.weights || {};

    if (sources.length === 0) return { ok: false, error: "No sources provided." };
    if (!query) return { ok: false, error: "Search query is required." };

    const r = (v) => Math.round(v * 1000) / 1000;

    // Tokenize query
    const queryTokens = query.split(/\s+/).filter(t => t.length > 1);

    // Score each item across all sources
    const allResults = [];
    const fingerprints = new Map(); // for deduplication

    for (const source of sources) {
      const domain = source.domain || "unknown";
      const domainWeight = domainWeights[domain] || 1.0;

      for (const item of (source.items || [])) {
        const title = (item.title || "").toLowerCase();
        const text = (item.text || "").toLowerCase();
        const tags = (item.tags || []).map(t => t.toLowerCase());
        const combined = `${title} ${text} ${tags.join(" ")}`;

        // TF-based relevance scoring
        let titleScore = 0;
        let textScore = 0;
        let tagScore = 0;
        let exactMatchBonus = 0;

        for (const token of queryTokens) {
          // Title matches are weighted heavily
          if (title.includes(token)) {
            titleScore += 3;
            // Exact word match bonus
            if (title.split(/\s+/).includes(token)) titleScore += 2;
          }

          // Text matches
          const textMatches = (text.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
          textScore += Math.min(textMatches, 5); // cap at 5 to avoid keyword stuffing

          // Tag matches
          if (tags.includes(token)) tagScore += 4;
          else if (tags.some(t => t.includes(token))) tagScore += 2;
        }

        // Exact phrase match bonus
        if (combined.includes(query)) exactMatchBonus = 5;

        // Combine scores
        const rawScore = titleScore * 0.4 + textScore * 0.3 + tagScore * 0.2 + exactMatchBonus * 0.1;
        const baseScore = item.score || 0;
        const relevanceScore = (rawScore + baseScore * 0.5) * domainWeight;

        if (relevanceScore <= 0) continue;

        // Deduplication fingerprint: first 100 chars of normalized text
        const fingerprint = (title + text.slice(0, 100)).replace(/\s+/g, " ").trim();
        const fpKey = fingerprint.slice(0, 80);

        if (fingerprints.has(fpKey)) {
          // Merge: keep higher score, note multiple sources
          const existing = fingerprints.get(fpKey);
          if (relevanceScore > existing.relevanceScore) {
            existing.relevanceScore = relevanceScore;
          }
          if (!existing.sources.includes(domain)) {
            existing.sources.push(domain);
          }
          existing.duplicateCount++;
          continue;
        }

        const result = {
          id: item.id,
          title: item.title,
          text: item.text ? (item.text.length > 200 ? item.text.slice(0, 200) + "..." : item.text) : null,
          tags: item.tags,
          domain,
          sources: [domain],
          relevanceScore: r(relevanceScore),
          duplicateCount: 0,
          metadata: item.metadata,
        };
        allResults.push(result);
        fingerprints.set(fpKey, result);
      }
    }

    // Sort by relevance and take top results
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topResults = allResults.slice(0, maxResults);

    // Source distribution in results
    const sourceDistribution = {};
    for (const result of topResults) {
      for (const src of result.sources) {
        sourceDistribution[src] = (sourceDistribution[src] || 0) + 1;
      }
    }

    // Compute diversity score: how evenly distributed across domains
    const domainCounts = Object.values(sourceDistribution);
    const totalInResults = domainCounts.reduce((s, v) => s + v, 0);
    let diversityEntropy = 0;
    for (const count of domainCounts) {
      const p = count / totalInResults;
      if (p > 0) diversityEntropy -= p * Math.log2(p);
    }
    const maxDiversityEntropy = Math.log2(sources.length || 1);
    const diversityScore = maxDiversityEntropy > 0 ? diversityEntropy / maxDiversityEntropy : 0;

    // Deduplication stats
    const totalDuplicates = allResults.reduce((s, r) => s + r.duplicateCount, 0);

    return {
      ok: true,
      result: {
        query,
        totalCandidates: sources.reduce((s, src) => s + (src.items || []).length, 0),
        matchCount: allResults.length,
        results: topResults.map(({ duplicateCount, ...rest }) => rest),
        sourceDistribution,
        diversityScore: r(diversityScore),
        diversityLabel: diversityScore > 0.8 ? "excellent" : diversityScore > 0.5 ? "good" : diversityScore > 0.3 ? "moderate" : "dominated by single source",
        deduplication: { duplicatesFound: totalDuplicates, uniqueResults: allResults.length },
        sourcesSearched: sources.length,
      },
    };
  });

  /**
   * aggregateDashboard
   * Build aggregate dashboard from multiple domain metrics — normalize scales,
   * compute composite indices.
   * artifact.data.metrics = [{ domain, name, value, unit?, min?, max?, higherIsBetter? }]
   * params.weights (optional: { "metricName": weight })
   * params.normalization: "min-max" | "z-score" | "percentile" (default: "min-max")
   */
  registerLensAction("global", "aggregateDashboard", (ctx, artifact, params) => {
    const metrics = artifact.data?.metrics || [];
    if (metrics.length === 0) return { ok: false, error: "No metrics provided." };

    const weights = params.weights || {};
    const normMethod = params.normalization || "min-max";
    const r = (v) => Math.round(v * 1000) / 1000;

    // Group metrics by name for normalization
    const metricGroups = {};
    for (const m of metrics) {
      const key = m.name;
      if (!metricGroups[key]) metricGroups[key] = [];
      metricGroups[key].push(m);
    }

    // Normalize each metric group
    const normalized = [];
    const groupStats = {};

    for (const [name, group] of Object.entries(metricGroups)) {
      const values = group.map(m => Number(m.value)).filter(v => !isNaN(v));
      if (values.length === 0) continue;

      const min = group[0].min !== undefined ? group[0].min : Math.min(...values);
      const max = group[0].max !== undefined ? group[0].max : Math.max(...values);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
      const sorted = [...values].sort((a, b) => a - b);
      const higherIsBetter = group[0].higherIsBetter !== false;

      groupStats[name] = { min: r(min), max: r(max), mean: r(mean), std: r(std), count: values.length };

      for (const m of group) {
        const val = Number(m.value);
        if (isNaN(val)) continue;

        let normValue;
        switch (normMethod) {
          case "z-score":
            normValue = (val - mean) / std;
            break;
          case "percentile": {
            const rank = sorted.filter(v => v <= val).length;
            normValue = rank / sorted.length;
            break;
          }
          case "min-max":
          default:
            normValue = max > min ? (val - min) / (max - min) : 0.5;
            break;
        }

        // Invert if lower is better
        if (!higherIsBetter && normMethod !== "z-score") {
          normValue = 1 - normValue;
        } else if (!higherIsBetter && normMethod === "z-score") {
          normValue = -normValue;
        }

        normalized.push({
          domain: m.domain,
          name: m.name,
          rawValue: m.value,
          unit: m.unit,
          normalizedValue: r(normValue),
          weight: weights[m.name] || 1,
        });
      }
    }

    // Compute composite index per domain
    const domainGroups = {};
    for (const m of normalized) {
      if (!domainGroups[m.domain]) domainGroups[m.domain] = [];
      domainGroups[m.domain].push(m);
    }

    const domainScores = {};
    for (const [domain, domMetrics] of Object.entries(domainGroups)) {
      const totalWeight = domMetrics.reduce((s, m) => s + m.weight, 0);
      const weightedSum = domMetrics.reduce((s, m) => s + m.normalizedValue * m.weight, 0);
      const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Individual metric scores for the domain
      const breakdown = domMetrics.map(m => ({
        name: m.name,
        raw: m.rawValue,
        unit: m.unit,
        normalized: m.normalizedValue,
        weight: m.weight,
        contribution: r(totalWeight > 0 ? (m.normalizedValue * m.weight) / totalWeight : 0),
      }));

      domainScores[domain] = {
        compositeScore: r(compositeScore),
        metricCount: domMetrics.length,
        breakdown,
        grade: compositeScore > 0.9 ? "A+" : compositeScore > 0.8 ? "A" : compositeScore > 0.7 ? "B" : compositeScore > 0.6 ? "C" : compositeScore > 0.5 ? "D" : "F",
      };
    }

    // Overall composite
    const allComposites = Object.values(domainScores).map(d => d.compositeScore);
    const overallComposite = allComposites.length > 0
      ? allComposites.reduce((s, v) => s + v, 0) / allComposites.length
      : 0;

    // Rankings
    const rankings = Object.entries(domainScores)
      .map(([domain, data]) => ({ domain, compositeScore: data.compositeScore, grade: data.grade }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    // Identify strengths and weaknesses across all normalized metrics
    const sortedByNorm = [...normalized].sort((a, b) => b.normalizedValue - a.normalizedValue);
    const strengths = sortedByNorm.slice(0, 5).map(m => ({ domain: m.domain, metric: m.name, score: m.normalizedValue }));
    const weaknesses = sortedByNorm.slice(-5).reverse().map(m => ({ domain: m.domain, metric: m.name, score: m.normalizedValue }));

    return {
      ok: true,
      result: {
        totalMetrics: metrics.length,
        domains: Object.keys(domainScores).length,
        normalization: normMethod,
        domainScores,
        rankings,
        overallComposite: r(overallComposite),
        overallGrade: overallComposite > 0.9 ? "A+" : overallComposite > 0.8 ? "A" : overallComposite > 0.7 ? "B" : overallComposite > 0.6 ? "C" : "D",
        strengths,
        weaknesses,
        metricStatistics: groupStats,
      },
    };
  });

  /**
   * correlationMatrix
   * Compute cross-domain correlation matrix — Pearson and Spearman correlations,
   * identify unexpected relationships.
   * artifact.data.variables = [{ name, domain?, values: number[] }]
   * params.method: "pearson" | "spearman" | "both" (default: "both")
   * params.significanceThreshold (p-value threshold, default: 0.05)
   */
  registerLensAction("global", "correlationMatrix", (ctx, artifact, params) => {
    const variables = artifact.data?.variables || [];
    if (variables.length < 2) return { ok: false, error: "Need at least 2 variables." };

    const method = params.method || "both";
    const sigThreshold = params.significanceThreshold || 0.05;
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // Ensure all variables have the same length (truncate to shortest)
    const minLen = Math.min(...variables.map(v => (v.values || []).length));
    if (minLen < 3) return { ok: false, error: "Need at least 3 observations per variable." };

    const vars = variables.map(v => ({
      name: v.name,
      domain: v.domain || "unknown",
      values: (v.values || []).slice(0, minLen).map(Number),
    }));
    const n = minLen;
    const numVars = vars.length;

    // Pearson correlation
    function pearson(x, y) {
      const mx = x.reduce((s, v) => s + v, 0) / n;
      const my = y.reduce((s, v) => s + v, 0) / n;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < n; i++) {
        num += (x[i] - mx) * (y[i] - my);
        dx += (x[i] - mx) ** 2;
        dy += (y[i] - my) ** 2;
      }
      return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
    }

    // Spearman correlation (rank-based)
    function spearman(x, y) {
      function rank(arr) {
        const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
        const ranks = new Array(arr.length);
        let i = 0;
        while (i < sorted.length) {
          let j = i;
          while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
          const avgRank = (i + j - 1) / 2 + 1;
          for (let k = i; k < j; k++) ranks[sorted[k].i] = avgRank;
          i = j;
        }
        return ranks;
      }
      return pearson(rank(x), rank(y));
    }

    // Approximate p-value for correlation using t-distribution approximation
    function corrPValue(corr, n) {
      if (Math.abs(corr) >= 1) return 0;
      const t = corr * Math.sqrt((n - 2) / (1 - corr * corr));
      // Approximate p-value using normal distribution for large n
      const z = Math.abs(t);
      // Simple approximation of 2-tailed p-value
      const p = 2 * (1 - normalCDF(z));
      return p;
    }

    // Normal CDF approximation
    function normalCDF(z) {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = z < 0 ? -1 : 1;
      z = Math.abs(z) / Math.SQRT2;
      const t = 1 / (1 + p * z);
      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
      return 0.5 * (1 + sign * y);
    }

    // Build correlation matrices
    const pearsonMatrix = {};
    const spearmanMatrix = {};
    const pValueMatrix = {};
    const significantPairs = [];
    const unexpectedRelationships = [];

    for (let i = 0; i < numVars; i++) {
      const ni = vars[i].name;
      if (!pearsonMatrix[ni]) pearsonMatrix[ni] = {};
      if (!spearmanMatrix[ni]) spearmanMatrix[ni] = {};
      if (!pValueMatrix[ni]) pValueMatrix[ni] = {};

      for (let j = 0; j < numVars; j++) {
        const nj = vars[j].name;

        if (i === j) {
          pearsonMatrix[ni][nj] = 1;
          spearmanMatrix[ni][nj] = 1;
          pValueMatrix[ni][nj] = 0;
          continue;
        }

        if (j < i) {
          // Matrix is symmetric, reuse
          pearsonMatrix[ni][nj] = pearsonMatrix[nj][ni];
          spearmanMatrix[ni][nj] = spearmanMatrix[nj][ni];
          pValueMatrix[ni][nj] = pValueMatrix[nj][ni];
          continue;
        }

        const pc = method !== "spearman" ? pearson(vars[i].values, vars[j].values) : 0;
        const sc = method !== "pearson" ? spearman(vars[i].values, vars[j].values) : 0;
        const pVal = corrPValue(method === "spearman" ? sc : pc, n);

        pearsonMatrix[ni][nj] = r(pc);
        spearmanMatrix[ni][nj] = r(sc);
        pValueMatrix[ni][nj] = r(pVal);

        const corr = method === "spearman" ? sc : pc;
        const absCorr = Math.abs(corr);

        if (pVal < sigThreshold && absCorr > 0.3) {
          const pair = {
            var1: ni,
            var2: nj,
            domain1: vars[i].domain,
            domain2: vars[j].domain,
            pearson: r(pc),
            spearman: r(sc),
            pValue: r(pVal),
            strength: absCorr > 0.8 ? "very strong" : absCorr > 0.6 ? "strong" : absCorr > 0.4 ? "moderate" : "weak",
            direction: corr > 0 ? "positive" : "negative",
          };
          significantPairs.push(pair);

          // Cross-domain correlations are "unexpected"
          if (vars[i].domain !== vars[j].domain) {
            unexpectedRelationships.push(pair);
          }
        }
      }
    }

    // Sort by absolute correlation strength
    significantPairs.sort((a, b) => Math.abs(method === "spearman" ? b.spearman : b.pearson) - Math.abs(method === "spearman" ? a.spearman : a.pearson));
    unexpectedRelationships.sort((a, b) => Math.abs(method === "spearman" ? b.spearman : b.pearson) - Math.abs(method === "spearman" ? a.spearman : a.pearson));

    // Variable statistics
    const varStats = vars.map(v => {
      const mean = v.values.reduce((s, val) => s + val, 0) / n;
      const std = Math.sqrt(v.values.reduce((s, val) => s + (val - mean) ** 2, 0) / n);
      return { name: v.name, domain: v.domain, mean: r(mean), std: r(std), min: r(Math.min(...v.values)), max: r(Math.max(...v.values)) };
    });

    // Multicollinearity detection: groups of highly correlated variables
    const collinearGroups = [];
    const collinearThreshold = 0.85;
    const visited = new Set();
    for (let i = 0; i < numVars; i++) {
      if (visited.has(i)) continue;
      const group = [vars[i].name];
      visited.add(i);
      for (let j = i + 1; j < numVars; j++) {
        if (visited.has(j)) continue;
        const corr = Math.abs(pearsonMatrix[vars[i].name]?.[vars[j].name] || 0);
        if (corr >= collinearThreshold) {
          group.push(vars[j].name);
          visited.add(j);
        }
      }
      if (group.length > 1) collinearGroups.push(group);
    }

    return {
      ok: true,
      result: {
        variables: numVars,
        observations: n,
        method,
        pearsonMatrix: method !== "spearman" ? pearsonMatrix : undefined,
        spearmanMatrix: method !== "pearson" ? spearmanMatrix : undefined,
        pValueMatrix,
        significantCorrelations: significantPairs.slice(0, 20),
        significantCount: significantPairs.length,
        unexpectedRelationships: unexpectedRelationships.slice(0, 10),
        collinearGroups,
        variableStatistics: varStats,
        significanceThreshold: sigThreshold,
      },
    };
  });
}
