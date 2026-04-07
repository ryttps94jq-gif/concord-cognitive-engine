// server/domains/eco.js
// Domain actions for ecology and sustainability: carbon footprint calculation,
// biodiversity index computation, and multi-criteria sustainability assessment.

export default function registerEcoActions(registerLensAction) {
  /**
   * carbonFootprint
   * Calculate carbon footprint from activity data.
   * Scope 1/2/3 emissions, emission factors, offset calculations.
   * artifact.data.activities = [{ category, type, quantity, unit, scope? }]
   * artifact.data.offsets = [{ type, quantity, unit }]  (optional)
   */
  registerLensAction("eco", "carbonFootprint", (ctx, artifact, _params) => {
    const activities = artifact.data?.activities || [];
    const offsets = artifact.data?.offsets || [];

    if (activities.length === 0) {
      return { ok: true, result: { message: "No activities provided." } };
    }

    // Emission factors in kgCO2e per unit
    const emissionFactors = {
      // Energy (scope 1 & 2)
      "natural_gas_kwh": 0.181,
      "natural_gas_m3": 2.0,
      "electricity_kwh": 0.233,
      "electricity_kwh_renewable": 0.0,
      "diesel_liter": 2.68,
      "gasoline_liter": 2.31,
      "propane_liter": 1.51,
      "coal_kg": 2.42,
      "heating_oil_liter": 2.52,
      // Transport (scope 1 & 3)
      "car_km": 0.171,
      "car_mile": 0.275,
      "bus_km": 0.089,
      "train_km": 0.041,
      "flight_short_km": 0.255,
      "flight_long_km": 0.195,
      "flight_short_passenger_km": 0.255,
      "flight_long_passenger_km": 0.195,
      "shipping_tonne_km": 0.016,
      "truck_tonne_km": 0.107,
      // Materials (scope 3)
      "paper_kg": 1.07,
      "plastic_kg": 3.1,
      "steel_kg": 1.85,
      "aluminum_kg": 8.24,
      "concrete_kg": 0.13,
      "glass_kg": 0.87,
      "wood_kg": 0.31,
      "textile_kg": 15.0,
      // Food (scope 3)
      "beef_kg": 27.0,
      "pork_kg": 6.1,
      "poultry_kg": 3.7,
      "fish_kg": 3.5,
      "dairy_kg": 3.2,
      "vegetables_kg": 0.5,
      "grains_kg": 0.8,
      "fruit_kg": 0.7,
      // Waste
      "landfill_waste_kg": 0.58,
      "recycled_waste_kg": 0.02,
      "compost_waste_kg": 0.01,
      // Digital
      "data_center_kwh": 0.233,
      "cloud_compute_hour": 0.06,
      "email_count": 0.004,
      "video_streaming_hour": 0.036,
      // Water
      "water_m3": 0.344,
    };

    // Scope inference
    function inferScope(category, type) {
      const key = `${category}_${type}`.toLowerCase();
      if (key.match(/natural_gas|diesel|gasoline|propane|coal|heating_oil/)) return 1;
      if (key.match(/electricity|data_center/)) return 2;
      return 3;
    }

    // Process each activity
    const processed = [];
    const scopeTotals = { 1: 0, 2: 0, 3: 0 };
    const categoryTotals = {};
    let totalEmissions = 0;

    for (const activity of activities) {
      const key = `${activity.category}_${activity.type}`.toLowerCase().replace(/\s+/g, "_");
      const factor = emissionFactors[key] || activity.emissionFactor || 0;
      const quantity = activity.quantity || 0;
      const emissions = quantity * factor;
      const scope = activity.scope || inferScope(activity.category, activity.type);

      scopeTotals[scope] = (scopeTotals[scope] || 0) + emissions;
      totalEmissions += emissions;

      const cat = activity.category || "other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + emissions;

      processed.push({
        category: activity.category,
        type: activity.type,
        quantity,
        unit: activity.unit,
        emissionFactor: factor,
        emissionFactorUnit: "kgCO2e/unit",
        emissionsKgCO2e: Math.round(emissions * 100) / 100,
        scope,
        factorSource: key in emissionFactors ? "built-in" : "user-provided",
      });
    }

    // Process offsets
    const offsetFactors = {
      "tree_planting_tree": 22, // kg CO2e per tree per year
      "solar_kwh": 0.233,
      "wind_kwh": 0.233,
      "carbon_credit_tonne": 1000,
      "reforestation_hectare": 3670,
      "biochar_kg": 2.6,
    };

    let totalOffsets = 0;
    const processedOffsets = offsets.map(o => {
      const key = `${o.type}_${o.unit}`.toLowerCase().replace(/\s+/g, "_");
      const factor = offsetFactors[key] || o.offsetFactor || 0;
      const offsetAmount = (o.quantity || 0) * factor;
      totalOffsets += offsetAmount;
      return {
        type: o.type,
        quantity: o.quantity,
        unit: o.unit,
        offsetKgCO2e: Math.round(offsetAmount * 100) / 100,
      };
    });

    const netEmissions = totalEmissions - totalOffsets;

    // Per-category breakdown
    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, emissions]) => ({
        category,
        emissionsKgCO2e: Math.round(emissions * 100) / 100,
        percentage: Math.round((emissions / Math.max(totalEmissions, 1)) * 10000) / 100,
      }))
      .sort((a, b) => b.emissionsKgCO2e - a.emissionsKgCO2e);

    // Equivalencies
    const treesNeeded = Math.ceil(netEmissions / 22); // trees to offset annually
    const carKmEquivalent = Math.round(netEmissions / 0.171);
    const flightsLondon2NY = Math.round(netEmissions / (5570 * 0.195) * 100) / 100; // ~5570 km

    return {
      ok: true,
      result: {
        totalEmissionsKgCO2e: Math.round(totalEmissions * 100) / 100,
        totalEmissionsTonneCO2e: Math.round(totalEmissions / 10) / 100,
        totalOffsetsKgCO2e: Math.round(totalOffsets * 100) / 100,
        netEmissionsKgCO2e: Math.round(netEmissions * 100) / 100,
        offsetPercentage: totalEmissions > 0 ? Math.round((totalOffsets / totalEmissions) * 10000) / 100 : 0,
        carbonNeutral: netEmissions <= 0,
        scopeBreakdown: {
          scope1: { kgCO2e: Math.round(scopeTotals[1] * 100) / 100, percentage: Math.round((scopeTotals[1] / Math.max(totalEmissions, 1)) * 10000) / 100, label: "Direct emissions" },
          scope2: { kgCO2e: Math.round(scopeTotals[2] * 100) / 100, percentage: Math.round((scopeTotals[2] / Math.max(totalEmissions, 1)) * 10000) / 100, label: "Indirect energy emissions" },
          scope3: { kgCO2e: Math.round(scopeTotals[3] * 100) / 100, percentage: Math.round((scopeTotals[3] / Math.max(totalEmissions, 1)) * 10000) / 100, label: "Value chain emissions" },
        },
        categoryBreakdown,
        equivalencies: {
          treesNeededToOffset: treesNeeded,
          carKmEquivalent,
          londonToNewYorkFlights: flightsLondon2NY,
        },
        activities: processed,
        offsets: processedOffsets,
      },
    };
  });

  /**
   * biodiversityIndex
   * Compute biodiversity metrics: Shannon diversity, Simpson's index,
   * species richness, evenness, and rarefaction curves.
   * artifact.data.observations = [{ species, count }] or artifact.data.species = { speciesName: count }
   */
  registerLensAction("eco", "biodiversityIndex", (ctx, artifact, _params) => {
    // Accept either array or object format
    let speciesCounts = {};
    if (Array.isArray(artifact.data?.observations)) {
      for (const obs of artifact.data.observations) {
        const name = obs.species || obs.name || "unknown";
        speciesCounts[name] = (speciesCounts[name] || 0) + (obs.count || 1);
      }
    } else if (artifact.data?.species) {
      speciesCounts = { ...artifact.data.species };
    } else {
      return { ok: true, result: { message: "No species data provided." } };
    }

    const species = Object.keys(speciesCounts);
    const counts = Object.values(speciesCounts).map(Number);
    const S = species.length; // species richness
    const N = counts.reduce((s, c) => s + c, 0); // total individuals

    if (S === 0 || N === 0) {
      return { ok: true, result: { message: "No valid species data." } };
    }

    // Proportions
    const proportions = counts.map(c => c / N);

    // Shannon diversity index: H' = -sum(p_i * ln(p_i))
    const shannonH = -proportions.reduce((s, p) => {
      return p > 0 ? s + p * Math.log(p) : s;
    }, 0);

    // Maximum possible Shannon index
    const shannonMax = Math.log(S);

    // Shannon evenness (Pielou's J)
    const shannonEvenness = shannonMax > 0 ? shannonH / shannonMax : 0;

    // Simpson's index: D = sum(p_i^2)
    const simpsonsD = proportions.reduce((s, p) => s + p * p, 0);

    // Simpson's diversity (1 - D)
    const simpsonsDiversity = 1 - simpsonsD;

    // Simpson's reciprocal (1/D)
    const simpsonsReciprocal = simpsonsD > 0 ? 1 / simpsonsD : 0;

    // Berger-Parker dominance: d = N_max / N
    const maxCount = Math.max(...counts);
    const bergerParkerD = maxCount / N;

    // Margalef richness index: D_Mg = (S-1) / ln(N)
    const margalefIndex = Math.log(N) > 0 ? (S - 1) / Math.log(N) : 0;

    // Menhinick richness index: D_Mn = S / sqrt(N)
    const menhinickIndex = S / Math.sqrt(N);

    // Rarefaction curve: E(S_n) = S - sum(C(N-N_i, n)/C(N, n)) for various n
    // Using simplified computation
    function logCombination(a, b) {
      if (b > a || b < 0) return -Infinity;
      if (b === 0 || b === a) return 0;
      b = Math.min(b, a - b);
      let result = 0;
      for (let i = 0; i < b; i++) {
        result += Math.log(a - i) - Math.log(i + 1);
      }
      return result;
    }

    const rarefactionPoints = [];
    const sampleSizes = [];
    for (let k = 1; k <= 10; k++) {
      sampleSizes.push(Math.min(Math.round(N * k / 10), N));
    }
    // Add small sample sizes too
    for (const n of [1, 2, 5, 10, 20, 50]) {
      if (n < N && !sampleSizes.includes(n)) sampleSizes.push(n);
    }
    sampleSizes.sort((a, b) => a - b);

    for (const n of sampleSizes) {
      if (n > N) continue;
      const logCN = logCombination(N, n);
      let expectedS = S;
      for (const ni of counts) {
        const logCNn = logCombination(N - ni, n);
        if (logCNn > -Infinity) {
          expectedS -= Math.exp(logCNn - logCN);
        }
      }
      rarefactionPoints.push({
        sampleSize: n,
        expectedSpecies: Math.round(Math.max(0, expectedS) * 100) / 100,
      });
    }

    // Rank-abundance
    const ranked = species.map((name, i) => ({
      rank: 0,
      species: name,
      count: counts[i],
      proportion: Math.round(proportions[i] * 10000) / 10000,
    }))
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Dominance classification
    const dominantSpecies = ranked.filter(r => r.proportion > 0.1);
    const rareSpecies = ranked.filter(r => r.count === 1); // singletons

    const r = (v) => Math.round(v * 10000) / 10000;

    return {
      ok: true,
      result: {
        speciesRichness: S,
        totalIndividuals: N,
        diversityIndices: {
          shannonH: r(shannonH),
          shannonHMax: r(shannonMax),
          shannonEvenness: r(shannonEvenness),
          simpsonsD: r(simpsonsD),
          simpsonsDiversity: r(simpsonsDiversity),
          simpsonsReciprocal: r(simpsonsReciprocal),
          bergerParkerDominance: r(bergerParkerD),
        },
        richnessIndices: {
          margalef: r(margalefIndex),
          menhinick: r(menhinickIndex),
        },
        diversityLabel: shannonH > 3 ? "very high" : shannonH > 2 ? "high" : shannonH > 1 ? "moderate" : "low",
        evennessLabel: shannonEvenness > 0.8 ? "very even" : shannonEvenness > 0.6 ? "moderately even" : shannonEvenness > 0.4 ? "moderately uneven" : "highly uneven",
        dominantSpecies: dominantSpecies.slice(0, 10),
        rareSpecies: { count: rareSpecies.length, singletonPercentage: r((rareSpecies.length / S) * 100) },
        rankAbundance: ranked.slice(0, 20),
        rarefactionCurve: rarefactionPoints,
      },
    };
  });

  /**
   * sustainabilityScore
   * Multi-criteria sustainability assessment across environmental, social,
   * and governance (ESG) pillars with weighted sub-indicators.
   * artifact.data.indicators = {
   *   environmental?: { emissions?, energyEfficiency?, wasteReduction?, waterUsage?, biodiversity? },
   *   social?: { laborPractices?, communityImpact?, healthSafety?, diversity?, humanRights? },
   *   governance?: { boardDiversity?, transparency?, ethics?, riskManagement?, compliance? }
   * }
   * Each indicator value: 0-100 score. params.weights (optional) to override pillar weights.
   */
  registerLensAction("eco", "sustainabilityScore", (ctx, artifact, params) => {
    const indicators = artifact.data?.indicators || {};
    const env = indicators.environmental || {};
    const soc = indicators.social || {};
    const gov = indicators.governance || {};

    // Default pillar weights (can be overridden)
    const weights = params.weights || { environmental: 0.4, social: 0.35, governance: 0.25 };

    // Sub-indicator definitions with default weights within each pillar
    const pillarDefs = {
      environmental: {
        indicators: {
          emissions: { weight: 0.25, value: env.emissions, label: "GHG Emissions Reduction" },
          energyEfficiency: { weight: 0.2, value: env.energyEfficiency, label: "Energy Efficiency" },
          wasteReduction: { weight: 0.2, value: env.wasteReduction, label: "Waste Reduction" },
          waterUsage: { weight: 0.2, value: env.waterUsage, label: "Water Management" },
          biodiversity: { weight: 0.15, value: env.biodiversity, label: "Biodiversity Impact" },
        },
      },
      social: {
        indicators: {
          laborPractices: { weight: 0.25, value: soc.laborPractices, label: "Labor Practices" },
          communityImpact: { weight: 0.2, value: soc.communityImpact, label: "Community Impact" },
          healthSafety: { weight: 0.2, value: soc.healthSafety, label: "Health & Safety" },
          diversity: { weight: 0.2, value: soc.diversity, label: "Diversity & Inclusion" },
          humanRights: { weight: 0.15, value: soc.humanRights, label: "Human Rights" },
        },
      },
      governance: {
        indicators: {
          boardDiversity: { weight: 0.2, value: gov.boardDiversity, label: "Board Diversity" },
          transparency: { weight: 0.25, value: gov.transparency, label: "Transparency & Reporting" },
          ethics: { weight: 0.2, value: gov.ethics, label: "Business Ethics" },
          riskManagement: { weight: 0.2, value: gov.riskManagement, label: "Risk Management" },
          compliance: { weight: 0.15, value: gov.compliance, label: "Regulatory Compliance" },
        },
      },
    };

    // Calculate pillar scores
    const pillarResults = {};
    let overallWeightedSum = 0;
    let overallWeightTotal = 0;

    for (const [pillarName, pillar] of Object.entries(pillarDefs)) {
      let pillarWeightedSum = 0;
      let pillarWeightTotal = 0;
      const subScores = [];
      const gaps = [];

      for (const [key, def] of Object.entries(pillar.indicators)) {
        const value = def.value;
        if (value != null && !isNaN(value)) {
          const clamped = Math.max(0, Math.min(100, Number(value)));
          pillarWeightedSum += clamped * def.weight;
          pillarWeightTotal += def.weight;
          subScores.push({
            indicator: key,
            label: def.label,
            score: clamped,
            weight: def.weight,
            rating: clamped >= 80 ? "excellent" : clamped >= 60 ? "good" : clamped >= 40 ? "fair" : clamped >= 20 ? "poor" : "critical",
          });
          if (clamped < 50) {
            gaps.push({ indicator: key, label: def.label, score: clamped, improvementPotential: 100 - clamped });
          }
        } else {
          subScores.push({
            indicator: key,
            label: def.label,
            score: null,
            weight: def.weight,
            rating: "not reported",
          });
        }
      }

      const pillarScore = pillarWeightTotal > 0 ? pillarWeightedSum / pillarWeightTotal : null;
      const pillarWeight = weights[pillarName] || 0.33;

      if (pillarScore !== null) {
        overallWeightedSum += pillarScore * pillarWeight;
        overallWeightTotal += pillarWeight;
      }

      // Data completeness
      const reported = subScores.filter(s => s.score !== null).length;
      const total = subScores.length;

      pillarResults[pillarName] = {
        score: pillarScore !== null ? Math.round(pillarScore * 100) / 100 : null,
        weight: pillarWeight,
        rating: pillarScore >= 80 ? "excellent" : pillarScore >= 60 ? "good" : pillarScore >= 40 ? "fair" : pillarScore >= 20 ? "poor" : pillarScore !== null ? "critical" : "insufficient data",
        dataCompleteness: Math.round((reported / total) * 100),
        subIndicators: subScores,
        gaps: gaps.sort((a, b) => a.score - b.score),
      };
    }

    const overallScore = overallWeightTotal > 0
      ? Math.round((overallWeightedSum / overallWeightTotal) * 100) / 100
      : null;

    // Identify top strengths and weaknesses
    const allSubScores = Object.values(pillarResults)
      .flatMap(p => p.subIndicators.filter(s => s.score !== null));
    allSubScores.sort((a, b) => b.score - a.score);

    const strengths = allSubScores.filter(s => s.score >= 70).slice(0, 5);
    const weaknesses = allSubScores.filter(s => s.score < 50).sort((a, b) => a.score - b.score).slice(0, 5);

    // Maturity level
    const maturityLevel =
      overallScore >= 80 ? "Leader" :
      overallScore >= 65 ? "Advanced" :
      overallScore >= 50 ? "Developing" :
      overallScore >= 30 ? "Emerging" :
      overallScore !== null ? "Lagging" : "Unrated";

    // Recommendations
    const recommendations = [];
    for (const weakness of weaknesses) {
      recommendations.push(`Improve ${weakness.label} (current score: ${weakness.score}/100)`);
    }
    for (const [pillarName, pillar] of Object.entries(pillarResults)) {
      if (pillar.dataCompleteness < 60) {
        recommendations.push(`Increase ${pillarName} reporting coverage (currently ${pillar.dataCompleteness}%)`);
      }
    }

    return {
      ok: true,
      result: {
        overallScore,
        maturityLevel,
        overallRating: overallScore >= 80 ? "excellent" : overallScore >= 60 ? "good" : overallScore >= 40 ? "fair" : overallScore >= 20 ? "poor" : overallScore !== null ? "critical" : "insufficient data",
        pillars: pillarResults,
        strengths,
        weaknesses,
        recommendations: recommendations.slice(0, 10),
        dataCompleteness: Math.round(
          Object.values(pillarResults).reduce((s, p) => s + p.dataCompleteness, 0) / 3
        ),
      },
    };
  });
}
