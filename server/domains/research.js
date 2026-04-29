// server/domains/research.js
// Domain actions for research: citation network analysis, methodology scoring,
// reproducibility assessment, and literature gap detection.

import { callVision, callVisionUrl, visionPromptForDomain } from "../lib/vision-inference.js";

export default function registerResearchActions(registerLensAction) {
  registerLensAction("research", "vision", async (ctx, artifact, _params) => {
    const { imageB64, imageUrl } = artifact.data || {};
    if (!imageB64 && !imageUrl) return { ok: false, error: "imageB64 or imageUrl required" };
    const prompt = visionPromptForDomain("research");
    return imageUrl ? callVisionUrl(imageUrl, prompt) : callVision(imageB64, prompt);
  });
  /**
   * citationNetwork
   * Analyze citation relationships between papers to find influential works,
   * research clusters, and citation patterns.
   * artifact.data.papers = [{ id, title, authors?, year?, citations?: string[],
   *   references?: string[], abstract?, keywords? }]
   */
  registerLensAction("research", "citationNetwork", (ctx, artifact, _params) => {
    const papers = artifact.data?.papers || [];
    if (papers.length === 0) return { ok: true, result: { message: "No papers." } };

    const paperMap = {};
    for (const p of papers) paperMap[p.id] = { ...p, inDegree: 0, outDegree: 0, citedBy: [] };

    // Build citation graph
    for (const p of papers) {
      const refs = p.references || p.citations || [];
      paperMap[p.id].outDegree = refs.length;
      for (const ref of refs) {
        if (paperMap[ref]) {
          paperMap[ref].inDegree++;
          paperMap[ref].citedBy.push(p.id);
        }
      }
    }

    // PageRank (simplified, 20 iterations)
    const n = papers.length;
    const d = 0.85; // damping factor
    let scores = {};
    for (const p of papers) scores[p.id] = 1 / n;

    for (let iter = 0; iter < 20; iter++) {
      const newScores = {};
      for (const p of papers) {
        let incoming = 0;
        for (const citerId of (paperMap[p.id].citedBy || [])) {
          if (paperMap[citerId] && paperMap[citerId].outDegree > 0) {
            incoming += scores[citerId] / paperMap[citerId].outDegree;
          }
        }
        newScores[p.id] = (1 - d) / n + d * incoming;
      }
      scores = newScores;
    }

    // H-index of the collection
    const citationCounts = Object.values(paperMap).map(p => p.inDegree).sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < citationCounts.length; i++) {
      if (citationCounts[i] >= i + 1) hIndex = i + 1;
      else break;
    }

    // Ranked papers
    const ranked = papers.map(p => ({
      id: p.id, title: p.title, year: p.year,
      inDegree: paperMap[p.id].inDegree,
      outDegree: paperMap[p.id].outDegree,
      pageRank: Math.round(scores[p.id] * 100000) / 100000,
    })).sort((a, b) => b.pageRank - a.pageRank);

    // Keyword co-occurrence for topic clusters
    const kwPairs = {};
    for (const p of papers) {
      const kws = p.keywords || [];
      for (let i = 0; i < kws.length; i++) {
        for (let j = i + 1; j < kws.length; j++) {
          const pair = [kws[i], kws[j]].sort().join("|");
          kwPairs[pair] = (kwPairs[pair] || 0) + 1;
        }
      }
    }
    const topicClusters = Object.entries(kwPairs)
      .filter(([, count]) => count >= 2)
      .map(([pair, count]) => ({ keywords: pair.split("|"), coOccurrences: count }))
      .sort((a, b) => b.coOccurrences - a.coOccurrences)
      .slice(0, 10);

    // Year distribution
    const yearDist = {};
    for (const p of papers) {
      if (p.year) yearDist[p.year] = (yearDist[p.year] || 0) + 1;
    }

    // Identify foundational papers (high in-degree, older)
    const foundational = ranked.filter(p => p.inDegree >= 3 && p.year)
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .slice(0, 5);

    // Identify frontier papers (recent, citing many, low in-degree)
    const frontier = ranked.filter(p => p.outDegree >= 3 && p.inDegree <= 1 && p.year)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 5);

    return {
      ok: true, result: {
        totalPapers: papers.length,
        hIndex,
        rankedPapers: ranked.slice(0, 15),
        foundationalWorks: foundational.map(p => ({ id: p.id, title: p.title, year: p.year, citations: p.inDegree })),
        frontierWorks: frontier.map(p => ({ id: p.id, title: p.title, year: p.year, references: p.outDegree })),
        topicClusters,
        yearDistribution: yearDist,
        networkDensity: n > 1 ? Math.round(ranked.reduce((s, p) => s + p.outDegree, 0) / (n * (n - 1)) * 10000) / 10000 : 0,
      },
    };
  });

  /**
   * methodologyScore
   * Evaluate research methodology quality against a scoring rubric.
   * artifact.data.methodology = {
   *   sampleSize?, controlGroup?, randomization?, blinding?,
   *   measurementValidation?, statisticalTests?, effectSize?,
   *   confidenceIntervals?, reproducibilityInfo?, preregistered?,
   *   conflictsOfInterest?, ethicsApproval?, dataAvailability?
   * }
   */
  registerLensAction("research", "methodologyScore", (ctx, artifact, _params) => {
    const m = artifact.data?.methodology || {};

    // Rubric criteria with weights
    const criteria = [
      { name: "Sample Size", key: "sampleSize", weight: 12, evaluate: (v) => {
        if (!v) return { score: 0, note: "Not reported" };
        const n = parseInt(v);
        if (isNaN(n)) return { score: 6, note: "Reported but not numeric" };
        if (n >= 1000) return { score: 12, note: "Large sample (≥1000)" };
        if (n >= 100) return { score: 10, note: "Adequate sample (≥100)" };
        if (n >= 30) return { score: 7, note: "Small sample (30-99)" };
        return { score: 3, note: "Very small sample (<30)" };
      }},
      { name: "Control Group", key: "controlGroup", weight: 10, evaluate: (v) =>
        v === true ? { score: 10, note: "Control group present" }
        : v === "partial" ? { score: 5, note: "Partial control" }
        : { score: 0, note: "No control group" }
      },
      { name: "Randomization", key: "randomization", weight: 10, evaluate: (v) =>
        v === true ? { score: 10, note: "Randomized" }
        : v === "quasi" ? { score: 5, note: "Quasi-randomized" }
        : { score: 0, note: "Not randomized" }
      },
      { name: "Blinding", key: "blinding", weight: 8, evaluate: (v) =>
        v === "double" ? { score: 8, note: "Double-blind" }
        : v === "single" ? { score: 5, note: "Single-blind" }
        : v === true ? { score: 5, note: "Blinded" }
        : { score: 0, note: "Not blinded" }
      },
      { name: "Measurement Validation", key: "measurementValidation", weight: 8, evaluate: (v) =>
        v === true ? { score: 8, note: "Validated instruments" } : { score: 0, note: "Not reported" }
      },
      { name: "Statistical Tests", key: "statisticalTests", weight: 8, evaluate: (v) =>
        v === true || (Array.isArray(v) && v.length > 0) ? { score: 8, note: "Appropriate tests used" }
        : { score: 0, note: "Not specified" }
      },
      { name: "Effect Size", key: "effectSize", weight: 8, evaluate: (v) =>
        v === true || v != null ? { score: 8, note: "Reported" } : { score: 0, note: "Not reported" }
      },
      { name: "Confidence Intervals", key: "confidenceIntervals", weight: 7, evaluate: (v) =>
        v === true ? { score: 7, note: "Reported" } : { score: 0, note: "Not reported" }
      },
      { name: "Reproducibility Info", key: "reproducibilityInfo", weight: 8, evaluate: (v) =>
        v === true ? { score: 8, note: "Materials/procedures documented" } : { score: 0, note: "Not provided" }
      },
      { name: "Pre-registration", key: "preregistered", weight: 7, evaluate: (v) =>
        v === true ? { score: 7, note: "Pre-registered" } : { score: 0, note: "Not pre-registered" }
      },
      { name: "Conflicts of Interest", key: "conflictsOfInterest", weight: 5, evaluate: (v) =>
        v === "none" || v === false ? { score: 5, note: "No conflicts declared" }
        : v === true || v === "declared" ? { score: 3, note: "Conflicts declared" }
        : { score: 0, note: "Not addressed" }
      },
      { name: "Ethics Approval", key: "ethicsApproval", weight: 5, evaluate: (v) =>
        v === true ? { score: 5, note: "Ethics approved" } : { score: 0, note: "Not reported" }
      },
      { name: "Data Availability", key: "dataAvailability", weight: 4, evaluate: (v) =>
        v === true || v === "open" ? { score: 4, note: "Open data" }
        : v === "upon-request" ? { score: 2, note: "Available on request" }
        : { score: 0, note: "Not available" }
      },
    ];

    const results = criteria.map(c => {
      const result = c.evaluate(m[c.key]);
      return { criterion: c.name, maxScore: c.weight, ...result, percentage: Math.round((result.score / c.weight) * 100) };
    });

    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const maxTotal = results.reduce((s, r) => s + r.maxScore, 0);
    const percentage = Math.round((totalScore / maxTotal) * 100);

    const strengths = results.filter(r => r.percentage >= 80).map(r => r.criterion);
    const weaknesses = results.filter(r => r.percentage === 0).map(r => r.criterion);

    // Evidence level classification (simplified Oxford levels)
    let evidenceLevel;
    if (m.randomization === true && m.controlGroup === true && m.blinding === "double") evidenceLevel = "1a (Systematic review of RCTs)";
    else if (m.randomization === true && m.controlGroup === true) evidenceLevel = "1b (Individual RCT)";
    else if (m.controlGroup === true) evidenceLevel = "2b (Cohort study)";
    else if (m.sampleSize) evidenceLevel = "3 (Case-control study)";
    else evidenceLevel = "4 (Case series / expert opinion)";

    return {
      ok: true, result: {
        totalScore, maxTotal, percentage,
        grade: percentage >= 90 ? "A" : percentage >= 75 ? "B" : percentage >= 60 ? "C" : percentage >= 40 ? "D" : "F",
        criteria: results,
        strengths, weaknesses,
        evidenceLevel,
        recommendations: weaknesses.map(w => `Address: ${w}`).slice(0, 5),
      },
    };
  });

  /**
   * reproducibilityCheck
   * Assess reproducibility indicators from reported methodology and results.
   * artifact.data.study = { pValues?, sampleSizes?, effectSizes?,
   *   materialsSections?, codeAvailable?, dataAvailable?, protocolRegistered?,
   *   replicationAttempts? }
   */
  registerLensAction("research", "reproducibilityCheck", (ctx, artifact, _params) => {
    const study = artifact.data?.study || {};

    const checks = [];
    let totalWeight = 0, totalScore = 0;

    // 1. P-value distribution check (p-hacking detection)
    const pValues = study.pValues || [];
    if (pValues.length > 0) {
      const justBelow05 = pValues.filter(p => p >= 0.04 && p < 0.05).length;
      const justAbove05 = pValues.filter(p => p > 0.05 && p <= 0.06).length;
      const suspiciousRatio = pValues.length > 0 ? justBelow05 / pValues.length : 0;
      const pHackingRisk = suspiciousRatio > 0.3 ? "high" : suspiciousRatio > 0.1 ? "moderate" : "low";

      // P-curve shape: healthy = right-skewed (more small p-values)
      const below01 = pValues.filter(p => p < 0.01).length;
      const between01and05 = pValues.filter(p => p >= 0.01 && p < 0.05).length;
      const pCurveHealthy = below01 > between01and05;

      const score = pHackingRisk === "low" && pCurveHealthy ? 20 : pHackingRisk === "low" ? 15 : pHackingRisk === "moderate" ? 8 : 2;
      checks.push({
        name: "P-value distribution",
        score, maxScore: 20,
        details: { totalPValues: pValues.length, justBelow05, justAbove05, pHackingRisk, pCurveHealthy },
      });
      totalWeight += 20; totalScore += score;
    }

    // 2. Statistical power check
    const sampleSizes = study.sampleSizes || [];
    const effectSizes = study.effectSizes || [];
    if (sampleSizes.length > 0 && effectSizes.length > 0) {
      // Rough power estimate: small effects need large samples
      const avgN = sampleSizes.reduce((s, n) => s + n, 0) / sampleSizes.length;
      const avgEffect = effectSizes.reduce((s, d) => s + Math.abs(d), 0) / effectSizes.length;
      const estimatedPower = Math.min(1, avgEffect * Math.sqrt(avgN) / 2.8); // rough approximation

      const adequate = estimatedPower >= 0.8;
      const score = adequate ? 20 : estimatedPower >= 0.5 ? 12 : 5;
      checks.push({
        name: "Statistical power",
        score, maxScore: 20,
        details: { avgSampleSize: Math.round(avgN), avgEffectSize: Math.round(avgEffect * 1000) / 1000, estimatedPower: Math.round(estimatedPower * 100), adequate },
      });
      totalWeight += 20; totalScore += score;
    }

    // 3. Transparency checks
    const transparencyItems = [
      { name: "Materials/methods detail", available: !!study.materialsSections, weight: 10 },
      { name: "Code availability", available: !!study.codeAvailable, weight: 10 },
      { name: "Data availability", available: !!study.dataAvailable, weight: 10 },
      { name: "Protocol pre-registered", available: !!study.protocolRegistered, weight: 10 },
    ];

    for (const item of transparencyItems) {
      const score = item.available ? item.weight : 0;
      checks.push({ name: item.name, score, maxScore: item.weight, details: { available: item.available } });
      totalWeight += item.weight; totalScore += score;
    }

    // 4. Prior replications
    const reps = study.replicationAttempts || [];
    if (reps.length > 0) {
      const successful = reps.filter(r => r.replicated === true).length;
      const rate = successful / reps.length;
      const score = rate >= 0.8 ? 20 : rate >= 0.5 ? 12 : rate > 0 ? 6 : 0;
      checks.push({
        name: "Replication record",
        score, maxScore: 20,
        details: { attempts: reps.length, successful, rate: Math.round(rate * 100) },
      });
      totalWeight += 20; totalScore += score;
    }

    const percentage = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

    return {
      ok: true, result: {
        checks,
        overallScore: totalScore, maxScore: totalWeight,
        reproducibilityPercentage: percentage,
        assessment: percentage >= 80 ? "highly-reproducible"
          : percentage >= 60 ? "moderately-reproducible"
            : percentage >= 40 ? "concerns-noted"
              : "low-reproducibility",
        criticalIssues: checks.filter(c => c.score < c.maxScore * 0.3).map(c => c.name),
      },
    };
  });
}
