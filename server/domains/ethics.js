// server/domains/ethics.js
// Domain actions for ethical analysis: multi-framework evaluation, stakeholder
// impact assessment, bias detection, and fairness metrics.

export default function registerEthicsActions(registerLensAction) {
  /**
   * frameworkAnalysis
   * Evaluate a decision/action against multiple ethical frameworks simultaneously.
   * artifact.data.action = { description, consequences?, stakeholders?, principles? }
   * artifact.data.context = { domain?, urgency?, reversibility?, scope? }
   */
  registerLensAction("ethics", "frameworkAnalysis", (ctx, artifact, _params) => {
    const action = artifact.data?.action || {};
    const context = artifact.data?.context || {};
    const consequences = action.consequences || [];
    const stakeholders = action.stakeholders || [];
    const principles = action.principles || [];

    // Framework evaluations
    const frameworks = {};

    // 1. Utilitarianism: greatest good for greatest number
    const positiveConsequences = consequences.filter(c => (c.impact || c.value || 0) > 0);
    const negativeConsequences = consequences.filter(c => (c.impact || c.value || 0) < 0);
    const totalUtility = consequences.reduce((s, c) => {
      const impact = c.impact || c.value || 0;
      const affected = c.affectedCount || c.scope || 1;
      const probability = c.probability || 1;
      return s + impact * affected * probability;
    }, 0);
    const maxPossibleHarm = negativeConsequences.reduce((s, c) =>
      s + Math.abs(c.impact || c.value || 0) * (c.affectedCount || 1), 0);

    frameworks.utilitarian = {
      name: "Utilitarianism",
      score: consequences.length > 0
        ? Math.round(Math.max(-1, Math.min(1, totalUtility / Math.max(Math.abs(totalUtility), maxPossibleHarm, 1))) * 100)
        : 0,
      assessment: totalUtility > 0 ? "net-positive" : totalUtility < 0 ? "net-negative" : "neutral",
      details: {
        totalUtility: Math.round(totalUtility * 100) / 100,
        positiveConsequences: positiveConsequences.length,
        negativeConsequences: negativeConsequences.length,
        totalAffected: consequences.reduce((s, c) => s + (c.affectedCount || 1), 0),
      },
    };

    // 2. Deontology (Kantian): duty-based, universalizability test
    const dutyKeywords = {
      positive: ["truth", "honest", "consent", "respect", "dignity", "rights", "promise", "duty", "fair", "transparent", "autonomous"],
      negative: ["deceive", "coerce", "manipulate", "exploit", "violate", "discriminate", "surveil", "harm", "force", "lie"],
    };
    const desc = (action.description || "").toLowerCase();
    const principleLower = principles.map(p => (typeof p === "string" ? p : p.name || "").toLowerCase());

    let dutyScore = 50; // neutral baseline
    for (const kw of dutyKeywords.positive) {
      if (desc.includes(kw) || principleLower.some(p => p.includes(kw))) dutyScore += 10;
    }
    for (const kw of dutyKeywords.negative) {
      if (desc.includes(kw) || principleLower.some(p => p.includes(kw))) dutyScore -= 15;
    }

    // Universalizability: could everyone do this?
    const universalizable = !dutyKeywords.negative.some(kw => desc.includes(kw));

    frameworks.deontological = {
      name: "Deontological (Kantian)",
      score: Math.max(-100, Math.min(100, dutyScore)),
      assessment: dutyScore >= 60 ? "duty-aligned" : dutyScore >= 30 ? "partially-aligned" : "duty-violating",
      details: {
        universalizable,
        respectsAutonomy: desc.includes("consent") || desc.includes("autonomous") || desc.includes("choice"),
        treatsPeopleAsEnds: !desc.includes("exploit") && !desc.includes("manipulate"),
      },
    };

    // 3. Virtue Ethics: character and virtues
    const virtues = {
      courage: ["brave", "courage", "stand up", "challenge", "risk"],
      justice: ["fair", "just", "equitable", "equal", "right"],
      temperance: ["moderate", "balanced", "restrained", "prudent"],
      wisdom: ["wise", "thoughtful", "considered", "informed", "evidence"],
      compassion: ["care", "empathy", "compassion", "kind", "help"],
      integrity: ["honest", "truthful", "transparent", "accountable", "consistent"],
      humility: ["humble", "listen", "acknowledge", "learn", "admit"],
    };

    const virtueScores = {};
    for (const [virtue, keywords] of Object.entries(virtues)) {
      const matches = keywords.filter(kw => desc.includes(kw) || principleLower.some(p => p.includes(kw)));
      virtueScores[virtue] = matches.length > 0 ? Math.min(100, matches.length * 30) : 0;
    }
    const avgVirtue = Object.values(virtueScores).reduce((s, v) => s + v, 0) / Object.keys(virtueScores).length;

    frameworks.virtue = {
      name: "Virtue Ethics",
      score: Math.round(avgVirtue),
      assessment: avgVirtue >= 50 ? "virtuous" : avgVirtue >= 25 ? "partially-virtuous" : "virtue-deficient",
      details: { virtueScores, strongestVirtue: Object.entries(virtueScores).sort((a, b) => b[1] - a[1])[0]?.[0] },
    };

    // 4. Care Ethics: relationships and vulnerability
    const vulnerableStakeholders = stakeholders.filter(s =>
      (s.vulnerable || s.powerLevel === "low" || (s.description || "").toLowerCase().match(/child|elder|disabled|marginalized|minority/))
    );
    const careScore = stakeholders.length > 0
      ? Math.round((1 - vulnerableStakeholders.filter(s => (s.impact || 0) < 0).length / Math.max(vulnerableStakeholders.length, 1)) * 100)
      : 50;

    frameworks.care = {
      name: "Care Ethics",
      score: careScore,
      assessment: careScore >= 70 ? "care-centered" : careScore >= 40 ? "partially-caring" : "care-deficient",
      details: {
        totalStakeholders: stakeholders.length,
        vulnerableStakeholders: vulnerableStakeholders.length,
        vulnerableHarmed: vulnerableStakeholders.filter(s => (s.impact || 0) < 0).length,
      },
    };

    // Overall synthesis
    const allScores = Object.values(frameworks).map(f => f.score);
    const overallScore = Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length);
    const consensus = allScores.every(s => s >= 50) ? "all-frameworks-approve"
      : allScores.every(s => s < 30) ? "all-frameworks-disapprove"
        : "frameworks-disagree";

    // Identify ethical tensions
    const tensions = [];
    if (frameworks.utilitarian.score > 50 && frameworks.deontological.score < 30) {
      tensions.push("Utility-duty tension: beneficial outcome but questionable means");
    }
    if (frameworks.deontological.score > 50 && frameworks.utilitarian.score < 0) {
      tensions.push("Duty-utility tension: principled action but net-negative outcome");
    }
    if (frameworks.care.score < 40 && frameworks.utilitarian.score > 50) {
      tensions.push("Care-utility tension: aggregate benefit but vulnerable groups harmed");
    }

    return {
      ok: true, result: {
        frameworks, overallScore, consensus, tensions,
        recommendation: overallScore >= 60 ? "Ethically supportable across frameworks"
          : overallScore >= 30 ? "Proceed with caution — ethical concerns identified"
            : "Significant ethical concerns — reconsider approach",
      },
    };
  });

  /**
   * stakeholderImpact
   * Map and quantify impacts across all affected stakeholders.
   * artifact.data.stakeholders = [{ name, group, power?, interest?, impact?,
   *   vulnerability?, description? }]
   * artifact.data.action = { description }
   */
  registerLensAction("ethics", "stakeholderImpact", (ctx, artifact, _params) => {
    const stakeholders = artifact.data?.stakeholders || [];
    if (stakeholders.length === 0) return { ok: true, result: { message: "No stakeholders defined." } };

    const analyzed = stakeholders.map(s => {
      const power = s.power ?? 50; // 0-100
      const interest = s.interest ?? 50;
      const impact = s.impact ?? 0; // -100 to 100
      const vulnerability = s.vulnerability ?? 0; // 0-100

      // Stakeholder salience (Mitchell, Agle & Wood)
      const urgency = Math.abs(impact) > 50 ? 100 : Math.abs(impact) * 2;
      const legitimacy = interest > 30 ? 100 : interest * 3;
      const salience = Math.round((power + urgency + legitimacy) / 3);

      // Quadrant classification (power/interest matrix)
      let quadrant;
      if (power >= 50 && interest >= 50) quadrant = "manage-closely";
      else if (power >= 50 && interest < 50) quadrant = "keep-satisfied";
      else if (power < 50 && interest >= 50) quadrant = "keep-informed";
      else quadrant = "monitor";

      // Weighted impact: vulnerability amplifies negative impacts
      const weightedImpact = impact < 0
        ? impact * (1 + vulnerability / 100)
        : impact;

      return {
        name: s.name, group: s.group,
        power, interest, impact, vulnerability,
        urgency: Math.round(urgency), legitimacy: Math.round(legitimacy),
        salience, quadrant,
        weightedImpact: Math.round(weightedImpact * 100) / 100,
        priority: salience > 70 ? "high" : salience > 40 ? "medium" : "low",
      };
    });

    analyzed.sort((a, b) => b.salience - a.salience);

    // Group analysis
    const groups = {};
    for (const s of analyzed) {
      const g = s.group || "ungrouped";
      if (!groups[g]) groups[g] = { members: 0, avgImpact: 0, avgVulnerability: 0, impacts: [] };
      groups[g].members++;
      groups[g].impacts.push(s.weightedImpact);
      groups[g].avgVulnerability += s.vulnerability;
    }
    for (const [name, g] of Object.entries(groups)) {
      g.avgImpact = Math.round(g.impacts.reduce((s, v) => s + v, 0) / g.members * 100) / 100;
      g.avgVulnerability = Math.round(g.avgVulnerability / g.members);
      g.netSentiment = g.avgImpact > 10 ? "positive" : g.avgImpact < -10 ? "negative" : "neutral";
      delete g.impacts;
    }

    // Equity analysis
    const positiveImpact = analyzed.filter(s => s.weightedImpact > 0);
    const negativeImpact = analyzed.filter(s => s.weightedImpact < 0);
    const vulnerableHarmed = analyzed.filter(s => s.vulnerability > 50 && s.weightedImpact < 0);

    const equityScore = Math.round(Math.max(0, 100 -
      (vulnerableHarmed.length * 20) -
      (negativeImpact.length > positiveImpact.length ? 20 : 0) -
      (analyzed.filter(s => s.power > 70 && s.impact > 50).length > analyzed.filter(s => s.power < 30 && s.impact > 0).length ? 15 : 0)
    ));

    return {
      ok: true, result: {
        stakeholders: analyzed,
        groups,
        summary: {
          total: analyzed.length,
          positivelyAffected: positiveImpact.length,
          negativelyAffected: negativeImpact.length,
          vulnerableHarmed: vulnerableHarmed.length,
          highPriority: analyzed.filter(s => s.priority === "high").length,
        },
        equityScore,
        equityAssessment: equityScore >= 70 ? "equitable" : equityScore >= 40 ? "partially-equitable" : "inequitable",
        quadrantDistribution: {
          "manage-closely": analyzed.filter(s => s.quadrant === "manage-closely").length,
          "keep-satisfied": analyzed.filter(s => s.quadrant === "keep-satisfied").length,
          "keep-informed": analyzed.filter(s => s.quadrant === "keep-informed").length,
          "monitor": analyzed.filter(s => s.quadrant === "monitor").length,
        },
      },
    };
  });

  /**
   * biasDetection
   * Analyze a dataset or decision criteria for potential biases.
   * artifact.data.decisions = [{ id, outcome, attributes: { age?, gender?, race?, income?, ... } }]
   * Computes disparate impact ratios, statistical parity, and identifies
   * attributes with significant outcome disparities.
   */
  registerLensAction("ethics", "biasDetection", (ctx, artifact, _params) => {
    const decisions = artifact.data?.decisions || [];
    if (decisions.length < 10) return { ok: false, error: "Need at least 10 decisions for meaningful bias analysis." };

    const protectedAttributes = artifact.data?.protectedAttributes || ["gender", "race", "age", "disability"];

    // Analyze each protected attribute
    const biasResults = {};

    for (const attr of protectedAttributes) {
      const groups = {};
      for (const d of decisions) {
        const val = d.attributes?.[attr];
        if (val == null) continue;
        const group = String(val);
        if (!groups[group]) groups[group] = { total: 0, positive: 0, negative: 0 };
        groups[group].total++;
        const outcome = d.outcome === true || d.outcome === 1 || d.outcome === "approved" || d.outcome === "positive" || d.outcome === "yes";
        if (outcome) groups[group].positive++;
        else groups[group].negative++;
      }

      const groupNames = Object.keys(groups);
      if (groupNames.length < 2) continue;

      // Compute rates
      const rates = {};
      for (const [name, g] of Object.entries(groups)) {
        rates[name] = { total: g.total, positiveRate: g.total > 0 ? g.positive / g.total : 0 };
      }

      // Disparate impact ratio: min rate / max rate (4/5 rule: should be ≥ 0.8)
      const rateValues = Object.values(rates).map(r => r.positiveRate);
      const maxRate = Math.max(...rateValues);
      const minRate = Math.min(...rateValues);
      const disparateImpact = maxRate > 0 ? minRate / maxRate : 1;

      // Statistical parity difference
      const parityDiff = maxRate - minRate;

      // Chi-squared test approximation
      const totalPositive = Object.values(groups).reduce((s, g) => s + g.positive, 0);
      const totalN = Object.values(groups).reduce((s, g) => s + g.total, 0);
      const expectedRate = totalPositive / totalN;
      let chiSquared = 0;
      for (const g of Object.values(groups)) {
        const expected = g.total * expectedRate;
        const expectedNeg = g.total * (1 - expectedRate);
        if (expected > 0) chiSquared += Math.pow(g.positive - expected, 2) / expected;
        if (expectedNeg > 0) chiSquared += Math.pow(g.negative - expectedNeg, 2) / expectedNeg;
      }
      // Rough p-value from chi-squared (df = groups - 1)
      const df = groupNames.length - 1;
      const chiPValue = Math.exp(-chiSquared / 2); // very rough approximation

      const biasDetected = disparateImpact < 0.8 || parityDiff > 0.1;

      biasResults[attr] = {
        groups: Object.entries(rates).map(([name, r]) => ({ group: name, total: r.total, positiveRate: Math.round(r.positiveRate * 10000) / 100 })),
        disparateImpactRatio: Math.round(disparateImpact * 10000) / 10000,
        fourFifthsRule: disparateImpact >= 0.8 ? "passed" : "FAILED",
        statisticalParityDifference: Math.round(parityDiff * 10000) / 10000,
        chiSquared: Math.round(chiSquared * 1000) / 1000,
        pValueApprox: Math.round(chiPValue * 10000) / 10000,
        biasDetected,
        severity: disparateImpact < 0.5 ? "severe" : disparateImpact < 0.8 ? "moderate" : "none",
        favoredGroup: Object.entries(rates).sort((a, b) => b[1].positiveRate - a[1].positiveRate)[0]?.[0],
        disadvantagedGroup: Object.entries(rates).sort((a, b) => a[1].positiveRate - b[1].positiveRate)[0]?.[0],
      };
    }

    const biasedAttributes = Object.entries(biasResults).filter(([, r]) => r.biasDetected).map(([attr]) => attr);

    return {
      ok: true, result: {
        attributes: biasResults,
        totalDecisions: decisions.length,
        biasedAttributes,
        overallAssessment: biasedAttributes.length === 0 ? "no_significant_bias"
          : biasedAttributes.length <= 1 ? "isolated_bias"
            : "systemic_bias_concern",
        recommendations: [
          ...biasedAttributes.map(a => `Review "${a}" — disparate impact detected (ratio: ${biasResults[a].disparateImpactRatio})`),
          ...(biasedAttributes.length > 0 ? ["Consider bias mitigation: re-weighting, threshold adjustment, or criteria review"] : []),
        ],
      },
    };
  });
}
