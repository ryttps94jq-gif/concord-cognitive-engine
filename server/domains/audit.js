// server/domains/audit.js
// Domain actions for auditing and compliance: compliance checks, trail analysis, risk scoring, sampling plans.

export default function registerAuditActions(registerLensAction) {
  /**
   * complianceCheck
   * Check data records against compliance rules — pattern matching, field validation,
   * cross-reference checks, gap detection.
   * artifact.data.records: [{ id, fields: { fieldName: value } }]
   * artifact.data.rules: [{ id, name, field, type: "required"|"pattern"|"range"|"crossRef"|"enum", pattern?, min?, max?, refField?, enumValues? }]
   */
  registerLensAction("audit", "complianceCheck", (ctx, artifact, params) => {
    const records = artifact.data.records || [];
    const rules = artifact.data.rules || [];

    if (records.length === 0) {
      return { ok: true, result: { message: "No records to check." } };
    }
    if (rules.length === 0) {
      return { ok: true, result: { message: "No compliance rules defined." } };
    }

    const violations = [];
    const recordResults = [];

    for (const record of records) {
      const fields = record.fields || {};
      const recordViolations = [];

      for (const rule of rules) {
        const value = fields[rule.field];
        let passed = true;
        let detail = "";

        switch (rule.type) {
          case "required":
            if (value === undefined || value === null || value === "") {
              passed = false;
              detail = `Field '${rule.field}' is required but missing or empty`;
            }
            break;

          case "pattern":
            if (value !== undefined && value !== null) {
              try {
                const regex = new RegExp(rule.pattern);
                if (!regex.test(String(value))) {
                  passed = false;
                  detail = `Field '${rule.field}' value '${value}' does not match pattern '${rule.pattern}'`;
                }
              } catch (e) {
                detail = `Invalid regex pattern: ${rule.pattern}`;
                passed = false;
              }
            }
            break;

          case "range":
            if (value !== undefined && value !== null) {
              const numVal = parseFloat(value);
              if (isNaN(numVal)) {
                passed = false;
                detail = `Field '${rule.field}' is not numeric`;
              } else {
                if (rule.min !== undefined && numVal < rule.min) {
                  passed = false;
                  detail = `Field '${rule.field}' value ${numVal} is below minimum ${rule.min}`;
                }
                if (rule.max !== undefined && numVal > rule.max) {
                  passed = false;
                  detail = `Field '${rule.field}' value ${numVal} exceeds maximum ${rule.max}`;
                }
              }
            }
            break;

          case "crossRef":
            if (value !== undefined && rule.refField) {
              const refValue = fields[rule.refField];
              if (refValue !== undefined && value !== refValue) {
                passed = false;
                detail = `Field '${rule.field}' (${value}) does not match reference field '${rule.refField}' (${refValue})`;
              }
            }
            break;

          case "enum":
            if (value !== undefined && value !== null && rule.enumValues) {
              if (!rule.enumValues.includes(value)) {
                passed = false;
                detail = `Field '${rule.field}' value '${value}' not in allowed values: ${rule.enumValues.join(", ")}`;
              }
            }
            break;
        }

        if (!passed) {
          const violation = {
            recordId: record.id,
            ruleId: rule.id,
            ruleName: rule.name,
            field: rule.field,
            value: value !== undefined ? value : null,
            detail,
          };
          violations.push(violation);
          recordViolations.push(violation);
        }
      }

      recordResults.push({
        recordId: record.id,
        totalRules: rules.length,
        passed: rules.length - recordViolations.length,
        failed: recordViolations.length,
        complianceRate: Math.round(((rules.length - recordViolations.length) / rules.length) * 10000) / 100,
        violations: recordViolations,
      });
    }

    // Gap detection: fields referenced in rules but never present in any record
    const ruleFields = new Set(rules.map(r => r.field));
    const presentFields = new Set();
    for (const record of records) {
      for (const key of Object.keys(record.fields || {})) {
        presentFields.add(key);
      }
    }
    const fieldGaps = [...ruleFields].filter(f => !presentFields.has(f));

    // Rule effectiveness: rules that never trigger violations may be redundant
    const ruleTriggerCounts = {};
    for (const rule of rules) ruleTriggerCounts[rule.id] = 0;
    for (const v of violations) ruleTriggerCounts[v.ruleId]++;

    const ruleEffectiveness = rules.map(r => ({
      ruleId: r.id,
      ruleName: r.name,
      violationCount: ruleTriggerCounts[r.id],
      triggerRate: Math.round((ruleTriggerCounts[r.id] / records.length) * 10000) / 100,
    }));

    const overallCompliance = records.length > 0
      ? Math.round(
          (recordResults.reduce((s, r) => s + r.complianceRate, 0) / records.length) * 100
        ) / 100
      : 100;

    const result = {
      analyzedAt: new Date().toISOString(),
      totalRecords: records.length,
      totalRules: rules.length,
      totalViolations: violations.length,
      overallComplianceRate: overallCompliance,
      fieldGaps,
      ruleEffectiveness,
      recordResults,
      violationsByRule: rules.map(r => ({
        ruleId: r.id,
        ruleName: r.name,
        count: ruleTriggerCounts[r.id],
      })).sort((a, b) => b.count - a.count),
    };

    artifact.data.complianceCheck = result;
    return { ok: true, result };
  });

  /**
   * trailAnalysis
   * Analyze audit trails for chain-of-custody integrity — detect gaps,
   * out-of-sequence entries, unauthorized modifications.
   * artifact.data.trail: [{ sequenceNumber, timestamp, actor, action, objectId, hash?, previousHash? }]
   * params.expectedActors — list of authorized actors (optional)
   */
  registerLensAction("audit", "trailAnalysis", (ctx, artifact, params) => {
    const trail = artifact.data.trail || [];
    if (trail.length === 0) {
      return { ok: true, result: { message: "No audit trail entries provided." } };
    }

    const expectedActors = params.expectedActors ? new Set(params.expectedActors) : null;

    // Sort by sequence number
    const sorted = [...trail].sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    const issues = [];

    // 1. Sequence gap detection
    for (let i = 1; i < sorted.length; i++) {
      const expected = sorted[i - 1].sequenceNumber + 1;
      const actual = sorted[i].sequenceNumber;
      if (actual !== expected) {
        issues.push({
          type: "sequence-gap",
          severity: "high",
          detail: `Gap between sequence ${sorted[i - 1].sequenceNumber} and ${actual} (expected ${expected})`,
          missingCount: actual - expected,
          afterEntry: sorted[i - 1].sequenceNumber,
          beforeEntry: actual,
        });
      }
    }

    // 2. Timestamp ordering: entries should have monotonically increasing timestamps
    for (let i = 1; i < sorted.length; i++) {
      const prevTs = new Date(sorted[i - 1].timestamp).getTime();
      const currTs = new Date(sorted[i].timestamp).getTime();
      if (!isNaN(prevTs) && !isNaN(currTs) && currTs < prevTs) {
        issues.push({
          type: "out-of-sequence-timestamp",
          severity: "high",
          detail: `Entry ${sorted[i].sequenceNumber} timestamp (${sorted[i].timestamp}) is before entry ${sorted[i - 1].sequenceNumber} (${sorted[i - 1].timestamp})`,
          sequenceNumber: sorted[i].sequenceNumber,
          timeDifferenceMs: prevTs - currTs,
        });
      }
    }

    // 3. Hash chain integrity
    let hashChainValid = true;
    const hashIssues = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].previousHash && sorted[i - 1].hash) {
        if (sorted[i].previousHash !== sorted[i - 1].hash) {
          hashChainValid = false;
          hashIssues.push({
            type: "hash-chain-break",
            severity: "critical",
            detail: `Entry ${sorted[i].sequenceNumber} previousHash does not match entry ${sorted[i - 1].sequenceNumber} hash`,
            sequenceNumber: sorted[i].sequenceNumber,
            expectedHash: sorted[i - 1].hash,
            actualPreviousHash: sorted[i].previousHash,
          });
        }
      }
    }
    issues.push(...hashIssues);

    // 4. Unauthorized actor detection
    const unauthorizedActions = [];
    if (expectedActors) {
      for (const entry of sorted) {
        if (!expectedActors.has(entry.actor)) {
          unauthorizedActions.push({
            type: "unauthorized-actor",
            severity: "critical",
            sequenceNumber: entry.sequenceNumber,
            actor: entry.actor,
            action: entry.action,
            objectId: entry.objectId,
            timestamp: entry.timestamp,
          });
        }
      }
      issues.push(...unauthorizedActions);
    }

    // 5. Duplicate sequence numbers
    const seqCounts = {};
    for (const entry of sorted) {
      seqCounts[entry.sequenceNumber] = (seqCounts[entry.sequenceNumber] || 0) + 1;
    }
    for (const [seq, count] of Object.entries(seqCounts)) {
      if (count > 1) {
        issues.push({
          type: "duplicate-sequence",
          severity: "high",
          detail: `Sequence number ${seq} appears ${count} times`,
          sequenceNumber: parseInt(seq),
          count,
        });
      }
    }

    // 6. Time gap analysis: unusually long gaps may indicate missing entries
    const timeGaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevTs = new Date(sorted[i - 1].timestamp).getTime();
      const currTs = new Date(sorted[i].timestamp).getTime();
      if (!isNaN(prevTs) && !isNaN(currTs)) {
        timeGaps.push(currTs - prevTs);
      }
    }

    const avgGap = timeGaps.length > 0 ? timeGaps.reduce((s, g) => s + g, 0) / timeGaps.length : 0;
    const gapStdDev = timeGaps.length > 1
      ? Math.sqrt(timeGaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / timeGaps.length)
      : 0;

    for (let i = 0; i < timeGaps.length; i++) {
      if (gapStdDev > 0 && (timeGaps[i] - avgGap) / gapStdDev > 3) {
        issues.push({
          type: "suspicious-time-gap",
          severity: "medium",
          detail: `Unusually long gap of ${Math.round(timeGaps[i] / 1000)}s between entries ${sorted[i].sequenceNumber} and ${sorted[i + 1].sequenceNumber}`,
          gapMs: timeGaps[i],
          zScore: Math.round(((timeGaps[i] - avgGap) / gapStdDev) * 100) / 100,
        });
      }
    }

    // Actor summary
    const actorSummary = {};
    for (const entry of sorted) {
      if (!actorSummary[entry.actor]) {
        actorSummary[entry.actor] = { actionCount: 0, actions: {}, firstSeen: entry.timestamp, lastSeen: entry.timestamp };
      }
      actorSummary[entry.actor].actionCount++;
      actorSummary[entry.actor].actions[entry.action] = (actorSummary[entry.actor].actions[entry.action] || 0) + 1;
      actorSummary[entry.actor].lastSeen = entry.timestamp;
    }

    // Integrity score: 100 minus deductions
    let integrityScore = 100;
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    const highCount = issues.filter(i => i.severity === "high").length;
    const mediumCount = issues.filter(i => i.severity === "medium").length;
    integrityScore -= criticalCount * 20;
    integrityScore -= highCount * 10;
    integrityScore -= mediumCount * 3;
    integrityScore = Math.max(0, integrityScore);

    const result = {
      analyzedAt: new Date().toISOString(),
      totalEntries: trail.length,
      sequenceRange: sorted.length > 0
        ? { first: sorted[0].sequenceNumber, last: sorted[sorted.length - 1].sequenceNumber }
        : null,
      integrityScore,
      hashChainValid: hashIssues.length === 0,
      issues,
      issueSummary: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        total: issues.length,
      },
      actorSummary,
      timeAnalysis: {
        avgGapMs: Math.round(avgGap),
        gapStdDevMs: Math.round(gapStdDev),
      },
    };

    artifact.data.trailAnalysis = result;
    return { ok: true, result };
  });

  /**
   * riskScore
   * Compute audit risk using control effectiveness, inherent risk, and detection risk —
   * multiplicative risk model with Bayesian adjustment.
   * artifact.data.controls: [{ id, name, effectiveness: 0-1, testResults?: [{ passed: boolean }] }]
   * artifact.data.inherentRisks: [{ id, name, likelihood: 0-1, impact: 0-1, category? }]
   * params.priorRiskLevel — Bayesian prior for overall risk (default 0.5)
   */
  registerLensAction("audit", "riskScore", (ctx, artifact, params) => {
    const controls = artifact.data.controls || [];
    const inherentRisks = artifact.data.inherentRisks || [];
    const priorRiskLevel = params.priorRiskLevel || 0.5;

    // Evaluate control effectiveness from test results if available
    const controlResults = controls.map(ctrl => {
      let effectiveness = parseFloat(ctrl.effectiveness) || 0;

      if (ctrl.testResults && ctrl.testResults.length > 0) {
        const passRate = ctrl.testResults.filter(t => t.passed).length / ctrl.testResults.length;
        // Bayesian update: combine stated effectiveness with observed pass rate
        effectiveness = (effectiveness + passRate) / 2;
      }

      const controlRisk = 1 - effectiveness; // Risk that control fails
      return {
        id: ctrl.id,
        name: ctrl.name,
        statedEffectiveness: parseFloat(ctrl.effectiveness) || 0,
        observedEffectiveness: ctrl.testResults
          ? Math.round((ctrl.testResults.filter(t => t.passed).length / ctrl.testResults.length) * 10000) / 10000
          : null,
        adjustedEffectiveness: Math.round(effectiveness * 10000) / 10000,
        controlRisk: Math.round(controlRisk * 10000) / 10000,
        testCount: ctrl.testResults ? ctrl.testResults.length : 0,
      };
    });

    // Overall control risk: probability that at least one control fails
    // P(any fail) = 1 - product(effectiveness_i) for independent controls
    const controlProduct = controlResults.reduce((p, c) => p * c.adjustedEffectiveness, 1);
    const overallControlRisk = Math.round((1 - controlProduct) * 10000) / 10000;

    // Detection risk: complement of control effectiveness
    const detectionRisk = controls.length > 0
      ? Math.round((1 - controlResults.reduce((s, c) => s + c.adjustedEffectiveness, 0) / controlResults.length) * 10000) / 10000
      : 0.5;

    // Inherent risk assessment
    const riskAssessments = inherentRisks.map(risk => {
      const likelihood = parseFloat(risk.likelihood) || 0;
      const impact = parseFloat(risk.impact) || 0;
      // Risk score = likelihood * impact
      const riskScore = Math.round(likelihood * impact * 10000) / 10000;
      // Expected loss index
      const expectedLoss = Math.round(riskScore * 100) / 100;

      return {
        id: risk.id,
        name: risk.name,
        category: risk.category || "uncategorized",
        likelihood,
        impact,
        riskScore,
        expectedLoss,
        level: riskScore >= 0.6 ? "high" : riskScore >= 0.3 ? "medium" : "low",
      };
    });

    // Overall inherent risk: weighted average
    const avgInherentRisk = riskAssessments.length > 0
      ? riskAssessments.reduce((s, r) => s + r.riskScore, 0) / riskAssessments.length
      : 0.5;

    // Audit risk model: AR = IR * CR * DR
    // IR = inherent risk, CR = control risk, DR = detection risk
    const auditRisk = Math.round(avgInherentRisk * overallControlRisk * detectionRisk * 10000) / 10000;

    // Bayesian adjustment: update with prior
    // P(risk | evidence) = P(evidence | risk) * P(risk) / P(evidence)
    // Simplified: weighted combination of prior and computed risk
    const evidenceWeight = Math.min(1, (controls.length + inherentRisks.length) / 10);
    const bayesianRisk = Math.round(
      (auditRisk * evidenceWeight + priorRiskLevel * (1 - evidenceWeight)) * 10000
    ) / 10000;

    // Risk by category
    const categoryRisks = {};
    for (const r of riskAssessments) {
      if (!categoryRisks[r.category]) categoryRisks[r.category] = { risks: [], avgScore: 0 };
      categoryRisks[r.category].risks.push(r);
    }
    for (const cat of Object.keys(categoryRisks)) {
      const risks = categoryRisks[cat].risks;
      categoryRisks[cat].avgScore = Math.round(
        (risks.reduce((s, r) => s + r.riskScore, 0) / risks.length) * 10000
      ) / 10000;
    }

    const riskLevel = bayesianRisk >= 0.6 ? "high"
      : bayesianRisk >= 0.3 ? "medium"
      : "low";

    const result = {
      analyzedAt: new Date().toISOString(),
      auditRisk,
      bayesianAdjustedRisk: bayesianRisk,
      riskLevel,
      components: {
        inherentRisk: Math.round(avgInherentRisk * 10000) / 10000,
        controlRisk: overallControlRisk,
        detectionRisk,
      },
      priorRiskLevel,
      evidenceWeight: Math.round(evidenceWeight * 10000) / 10000,
      controlResults,
      riskAssessments: riskAssessments.sort((a, b) => b.riskScore - a.riskScore),
      categoryRisks,
    };

    artifact.data.riskScore = result;
    return { ok: true, result };
  });

  /**
   * samplingPlan
   * Design statistical sampling plan — compute sample sizes for given confidence
   * levels, stratified sampling allocation.
   * artifact.data.population: { total: number, strata?: [{ name, size, riskLevel? }] }
   * params.confidenceLevel — desired confidence level (default 0.95)
   * params.marginOfError — acceptable margin of error (default 0.05)
   * params.expectedDefectRate — expected defect/error rate (default 0.05)
   */
  registerLensAction("audit", "samplingPlan", (ctx, artifact, params) => {
    const population = artifact.data.population || {};
    const total = population.total || 0;

    if (total <= 0) {
      return { ok: true, result: { message: "Population size must be positive." } };
    }

    const confidenceLevel = params.confidenceLevel || 0.95;
    const marginOfError = params.marginOfError || 0.05;
    const expectedDefectRate = params.expectedDefectRate || 0.05;

    // Z-score lookup for common confidence levels
    function zScore(confidence) {
      if (confidence >= 0.99) return 2.576;
      if (confidence >= 0.975) return 2.241;
      if (confidence >= 0.95) return 1.96;
      if (confidence >= 0.9) return 1.645;
      if (confidence >= 0.85) return 1.44;
      if (confidence >= 0.8) return 1.282;
      // Approximation for other values using inverse normal
      // Rational approximation (Abramowitz & Stegun)
      const p = (1 + confidence) / 2;
      const t = Math.sqrt(-2 * Math.log(1 - p));
      return Math.round((t - (2.515517 + 0.802853 * t + 0.010328 * t * t) /
        (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t)) * 10000) / 10000;
    }

    const z = zScore(confidenceLevel);
    const p = expectedDefectRate;
    const q = 1 - p;

    // Sample size formula: n = (Z^2 * p * q / E^2) / (1 + (Z^2 * p * q / (E^2 * N)))
    // This is the finite population correction
    const infiniteSampleSize = (z * z * p * q) / (marginOfError * marginOfError);
    const finiteSampleSize = Math.ceil(infiniteSampleSize / (1 + (infiniteSampleSize - 1) / total));

    // Multiple confidence level comparisons
    const comparisonLevels = [0.80, 0.85, 0.90, 0.95, 0.99];
    const sampleSizeComparison = comparisonLevels.map(cl => {
      const zc = zScore(cl);
      const infN = (zc * zc * p * q) / (marginOfError * marginOfError);
      const finN = Math.ceil(infN / (1 + (infN - 1) / total));
      return {
        confidenceLevel: cl,
        confidencePct: Math.round(cl * 100),
        sampleSize: finN,
        samplingFraction: Math.round((finN / total) * 10000) / 100,
      };
    });

    // Stratified sampling allocation
    const strata = population.strata || [];
    let stratifiedPlan = null;

    if (strata.length > 0) {
      const totalStratumSize = strata.reduce((s, st) => s + (st.size || 0), 0);

      // Risk-weighted allocation: higher risk strata get more samples
      const riskWeights = { high: 3, medium: 2, low: 1 };

      const totalRiskWeight = strata.reduce((s, st) => {
        const weight = riskWeights[st.riskLevel] || 1;
        return s + (st.size || 0) * weight;
      }, 0);

      // Proportional allocation
      const proportionalAllocation = strata.map(st => {
        const proportion = totalStratumSize > 0 ? (st.size || 0) / totalStratumSize : 0;
        return {
          stratum: st.name,
          size: st.size || 0,
          proportionalSample: Math.ceil(finiteSampleSize * proportion),
          proportion: Math.round(proportion * 10000) / 100,
        };
      });

      // Risk-weighted (Neyman-like) allocation
      const riskWeightedAllocation = strata.map(st => {
        const weight = riskWeights[st.riskLevel] || 1;
        const riskProportion = totalRiskWeight > 0 ? ((st.size || 0) * weight) / totalRiskWeight : 0;
        const allocated = Math.ceil(finiteSampleSize * riskProportion);
        // Cap at stratum size
        const sample = Math.min(allocated, st.size || 0);
        return {
          stratum: st.name,
          size: st.size || 0,
          riskLevel: st.riskLevel || "medium",
          riskWeight: weight,
          allocatedSample: sample,
          proportion: Math.round(riskProportion * 10000) / 100,
          samplingRate: st.size > 0 ? Math.round((sample / st.size) * 10000) / 100 : 0,
        };
      });

      stratifiedPlan = {
        totalStrata: strata.length,
        proportionalAllocation,
        riskWeightedAllocation,
        totalProportionalSamples: proportionalAllocation.reduce((s, a) => s + a.proportionalSample, 0),
        totalRiskWeightedSamples: riskWeightedAllocation.reduce((s, a) => s + a.allocatedSample, 0),
      };
    }

    const result = {
      analyzedAt: new Date().toISOString(),
      populationSize: total,
      parameters: {
        confidenceLevel,
        confidencePct: Math.round(confidenceLevel * 100),
        marginOfError,
        marginOfErrorPct: Math.round(marginOfError * 100),
        expectedDefectRate,
        zScore: z,
      },
      requiredSampleSize: finiteSampleSize,
      samplingFraction: Math.round((finiteSampleSize / total) * 10000) / 100,
      infinitePopulationSampleSize: Math.ceil(infiniteSampleSize),
      finitePopulationCorrection: Math.round((finiteSampleSize / infiniteSampleSize) * 10000) / 10000,
      comparisonByConfidence: sampleSizeComparison,
      stratifiedPlan,
    };

    artifact.data.samplingPlan = result;
    return { ok: true, result };
  });
}
