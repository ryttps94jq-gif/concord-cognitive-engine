// server/domains/metacognition.js
// Domain actions for metacognitive monitoring: confidence calibration,
// learning curve modeling, and cognitive bias detection.

export default function registerMetacognitionActions(registerLensAction) {
  /**
   * confidenceCalibration
   * Calibrate prediction confidence — compare predicted vs actual outcomes,
   * compute Brier score and calibration curve.
   * artifact.data.predictions = [{ predicted: number(0-1), actual: 0|1, label? }]
   * params.bins — number of calibration bins (default 10)
   */
  registerLensAction("metacognition", "confidenceCalibration", (ctx, artifact, params) => {
    const predictions = artifact.data?.predictions || [];
    if (predictions.length < 2) {
      return { ok: true, result: { message: "Need at least 2 predictions for calibration.", brierScore: null } };
    }

    const numBins = params.bins || 10;
    const r = (v) => Math.round(v * 10000) / 10000;

    // Validate and parse predictions
    const valid = predictions
      .map(p => ({
        predicted: parseFloat(p.predicted),
        actual: parseInt(p.actual),
        label: p.label || null,
      }))
      .filter(p => !isNaN(p.predicted) && (p.actual === 0 || p.actual === 1)
        && p.predicted >= 0 && p.predicted <= 1);

    if (valid.length < 2) {
      return { ok: true, result: { message: "Insufficient valid predictions (need predicted in [0,1] and actual in {0,1})." } };
    }

    const n = valid.length;

    // --- Brier score: mean of (predicted - actual)^2 ---
    const brierScore = valid.reduce((s, p) => s + Math.pow(p.predicted - p.actual, 2), 0) / n;

    // --- Brier skill score (relative to climatological forecast) ---
    const baseRate = valid.reduce((s, p) => s + p.actual, 0) / n;
    const brierClimatology = baseRate * (1 - baseRate);
    const brierSkillScore = brierClimatology > 0 ? 1 - brierScore / brierClimatology : 0;

    // --- Log loss ---
    const epsilon = 1e-15;
    const logLoss = -valid.reduce((s, p) => {
      const clipped = Math.max(epsilon, Math.min(1 - epsilon, p.predicted));
      return s + (p.actual * Math.log(clipped) + (1 - p.actual) * Math.log(1 - clipped));
    }, 0) / n;

    // --- Calibration curve (binned) ---
    const bins = [];
    for (let i = 0; i < numBins; i++) {
      const lower = i / numBins;
      const upper = (i + 1) / numBins;
      const inBin = valid.filter(p => p.predicted >= lower && (i === numBins - 1 ? p.predicted <= upper : p.predicted < upper));
      if (inBin.length === 0) {
        bins.push({ binRange: [r(lower), r(upper)], count: 0, avgPredicted: null, avgActual: null, gap: null });
        continue;
      }
      const avgPredicted = inBin.reduce((s, p) => s + p.predicted, 0) / inBin.length;
      const avgActual = inBin.reduce((s, p) => s + p.actual, 0) / inBin.length;
      const gap = Math.abs(avgPredicted - avgActual);
      bins.push({
        binRange: [r(lower), r(upper)],
        count: inBin.length,
        avgPredicted: r(avgPredicted),
        avgActual: r(avgActual),
        gap: r(gap),
      });
    }

    // --- Expected Calibration Error (ECE) ---
    const ece = bins.reduce((s, bin) => {
      if (bin.count === 0) return s;
      return s + (bin.count / n) * (bin.gap || 0);
    }, 0);

    // --- Maximum Calibration Error (MCE) ---
    const mce = Math.max(...bins.filter(b => b.count > 0).map(b => b.gap || 0), 0);

    // --- Overconfidence / underconfidence analysis ---
    const overconfident = valid.filter(p => p.predicted > 0.5 && p.actual === 0).length;
    const underconfident = valid.filter(p => p.predicted < 0.5 && p.actual === 1).length;
    const correctHigh = valid.filter(p => p.predicted > 0.5 && p.actual === 1).length;
    const correctLow = valid.filter(p => p.predicted <= 0.5 && p.actual === 0).length;

    // --- Discrimination: separate distributions of predicted for actual=0 vs actual=1 ---
    const positivePredictions = valid.filter(p => p.actual === 1).map(p => p.predicted);
    const negativePredictions = valid.filter(p => p.actual === 0).map(p => p.predicted);
    const avgPosPred = positivePredictions.length > 0
      ? positivePredictions.reduce((s, v) => s + v, 0) / positivePredictions.length : 0;
    const avgNegPred = negativePredictions.length > 0
      ? negativePredictions.reduce((s, v) => s + v, 0) / negativePredictions.length : 0;
    const discrimination = avgPosPred - avgNegPred;

    const calibrationQuality = ece < 0.05 ? "excellent" : ece < 0.1 ? "good" : ece < 0.2 ? "moderate" : "poor";

    return {
      ok: true,
      result: {
        n,
        brierScore: r(brierScore),
        brierSkillScore: r(brierSkillScore),
        logLoss: r(logLoss),
        calibration: {
          ece: r(ece),
          mce: r(mce),
          quality: calibrationQuality,
          bins,
        },
        discrimination: {
          avgPredictedForPositive: r(avgPosPred),
          avgPredictedForNegative: r(avgNegPred),
          separation: r(discrimination),
        },
        confusionSummary: {
          overconfident,
          underconfident,
          correctHigh,
          correctLow,
          accuracy: r((correctHigh + correctLow) / n),
        },
        baseRate: r(baseRate),
      },
    };
  });

  /**
   * learningCurve
   * Model learning progress — fit power law and exponential learning curves,
   * predict mastery timeline.
   * artifact.data.progress = [{ trial, performance, timestamp? }]
   * params.masteryThreshold — performance level for mastery (default 0.9)
   */
  registerLensAction("metacognition", "learningCurve", (ctx, artifact, params) => {
    const progress = artifact.data?.progress || [];
    if (progress.length < 3) {
      return { ok: true, result: { message: "Need at least 3 data points to model a learning curve." } };
    }

    const masteryThreshold = params.masteryThreshold || 0.9;
    const r = (v) => Math.round(v * 10000) / 10000;

    const trials = progress.map(p => parseFloat(p.trial) || 0);
    const performance = progress.map(p => parseFloat(p.performance) || 0);
    const n = trials.length;

    // --- Power law fit: P = a * t^b ---
    // Log-log linear regression: ln(P) = ln(a) + b * ln(t)
    const validPower = trials.map((t, i) => ({ t, p: performance[i] })).filter(d => d.t > 0 && d.p > 0);

    let powerFit = null;
    if (validPower.length >= 3) {
      const logT = validPower.map(d => Math.log(d.t));
      const logP = validPower.map(d => Math.log(d.p));
      const nv = logT.length;
      const meanLogT = logT.reduce((s, v) => s + v, 0) / nv;
      const meanLogP = logP.reduce((s, v) => s + v, 0) / nv;

      let ssXY = 0, ssXX = 0, ssYY = 0;
      for (let i = 0; i < nv; i++) {
        ssXY += (logT[i] - meanLogT) * (logP[i] - meanLogP);
        ssXX += (logT[i] - meanLogT) * (logT[i] - meanLogT);
        ssYY += (logP[i] - meanLogP) * (logP[i] - meanLogP);
      }

      const b = ssXX > 1e-10 ? ssXY / ssXX : 0;
      const lnA = meanLogP - b * meanLogT;
      const a = Math.exp(lnA);

      // R-squared for power law
      const predicted = validPower.map(d => a * Math.pow(d.t, b));
      const meanP = validPower.reduce((s, d) => s + d.p, 0) / nv;
      const ssRes = validPower.reduce((s, d, i) => s + Math.pow(d.p - predicted[i], 2), 0);
      const ssTot = validPower.reduce((s, d) => s + Math.pow(d.p - meanP, 2), 0);
      const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      // Predict mastery trial
      let masteryTrial = null;
      if (b > 0 && a > 0) {
        masteryTrial = Math.ceil(Math.pow(masteryThreshold / a, 1 / b));
      }

      powerFit = {
        model: "power_law",
        equation: `P = ${r(a)} * t^${r(b)}`,
        a: r(a), b: r(b),
        rSquared: r(rSquared),
        predictedMasteryTrial: masteryTrial,
      };
    }

    // --- Exponential fit: P = L - (L - P0) * e^(-k*t) ---
    // Simplified: assume L = 1 (ceiling), fit P = 1 - c * e^(-k*t)
    // Linearize: ln(1 - P) = ln(c) - k*t
    const validExp = trials.map((t, i) => ({ t, p: performance[i] })).filter(d => d.p < 1 && d.p > 0);

    let expFit = null;
    if (validExp.length >= 3) {
      const linX = validExp.map(d => d.t);
      const linY = validExp.map(d => Math.log(1 - d.p));
      const ne = linX.length;
      const meanX = linX.reduce((s, v) => s + v, 0) / ne;
      const meanY = linY.reduce((s, v) => s + v, 0) / ne;

      let ssXY = 0, ssXX = 0;
      for (let i = 0; i < ne; i++) {
        ssXY += (linX[i] - meanX) * (linY[i] - meanY);
        ssXX += (linX[i] - meanX) * (linX[i] - meanX);
      }

      const negK = ssXX > 1e-10 ? ssXY / ssXX : 0;
      const k = -negK;
      const c = Math.exp(meanY - negK * meanX);

      // R-squared
      const predicted = validExp.map(d => 1 - c * Math.exp(-k * d.t));
      const meanP = validExp.reduce((s, d) => s + d.p, 0) / ne;
      const ssRes = validExp.reduce((s, d, i) => s + Math.pow(d.p - predicted[i], 2), 0);
      const ssTot = validExp.reduce((s, d) => s + Math.pow(d.p - meanP, 2), 0);
      const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      // Predict mastery trial
      let masteryTrial = null;
      if (k > 0 && c > 0 && masteryThreshold < 1) {
        const val = (1 - masteryThreshold) / c;
        if (val > 0) masteryTrial = Math.ceil(-Math.log(val) / k);
      }

      expFit = {
        model: "exponential",
        equation: `P = 1 - ${r(c)} * e^(-${r(k)} * t)`,
        ceiling: 1, c: r(c), k: r(k),
        rSquared: r(rSquared),
        predictedMasteryTrial: masteryTrial,
      };
    }

    // --- Select best model ---
    const bestFit = (powerFit && expFit)
      ? (powerFit.rSquared >= expFit.rSquared ? powerFit : expFit)
      : (powerFit || expFit);

    // --- Learning rate analysis ---
    const improvements = [];
    for (let i = 1; i < performance.length; i++) {
      improvements.push(performance[i] - performance[i - 1]);
    }
    const avgImprovement = improvements.reduce((s, v) => s + v, 0) / improvements.length;
    const recentImprovement = improvements.length >= 3
      ? improvements.slice(-3).reduce((s, v) => s + v, 0) / 3
      : avgImprovement;

    // Plateau detection: if recent improvement is near zero relative to overall
    const plateauDetected = Math.abs(avgImprovement) > 0.001
      ? Math.abs(recentImprovement) < Math.abs(avgImprovement) * 0.1
      : false;

    // Current performance level
    const latestPerformance = performance[performance.length - 1];
    const mastered = latestPerformance >= masteryThreshold;

    return {
      ok: true,
      result: {
        dataPoints: n,
        currentPerformance: r(latestPerformance),
        masteryThreshold,
        mastered,
        powerLawFit: powerFit,
        exponentialFit: expFit,
        bestModel: bestFit ? bestFit.model : null,
        learningRate: {
          avgImprovement: r(avgImprovement),
          recentImprovement: r(recentImprovement),
          plateauDetected,
          phase: plateauDetected ? "plateau" : (recentImprovement > avgImprovement * 0.5 ? "active_learning" : "diminishing_returns"),
        },
        trialRange: { first: trials[0], last: trials[trials.length - 1] },
      },
    };
  });

  /**
   * biasDetection
   * Detect cognitive biases in decision data — anchoring, confirmation bias,
   * and sunk cost patterns.
   * artifact.data.decisions = [{ id, options: [{ name, score, evidence: [{ supports: bool, strength: number }] }], chosen, initialAnchor?, investedCost?, outcome? }]
   */
  registerLensAction("metacognition", "biasDetection", (ctx, artifact, params) => {
    const decisions = artifact.data?.decisions || [];
    if (decisions.length === 0) {
      return { ok: true, result: { message: "No decision data to analyze." } };
    }

    const r = (v) => Math.round(v * 10000) / 10000;
    const biases = [];

    // --- Anchoring bias: chosen option disproportionately close to initial anchor ---
    const anchoringData = decisions.filter(d => d.initialAnchor !== undefined && d.options && d.options.length > 1);
    if (anchoringData.length >= 2) {
      let anchoredCount = 0;
      let totalAnchorDeviation = 0;
      let totalOptimalDeviation = 0;

      for (const decision of anchoringData) {
        const anchor = parseFloat(decision.initialAnchor);
        const chosen = decision.options.find(o => o.name === decision.chosen);
        if (!chosen) continue;

        const chosenScore = parseFloat(chosen.score) || 0;
        const bestOption = decision.options.reduce((best, o) => (parseFloat(o.score) || 0) > (parseFloat(best.score) || 0) ? o : best);
        const bestScore = parseFloat(bestOption.score) || 0;

        const anchorDist = Math.abs(chosenScore - anchor);
        const optimalDist = Math.abs(chosenScore - bestScore);
        const allScores = decision.options.map(o => parseFloat(o.score) || 0);
        const scoreRange = Math.max(...allScores) - Math.min(...allScores);

        if (scoreRange > 0) {
          totalAnchorDeviation += anchorDist / scoreRange;
          totalOptimalDeviation += optimalDist / scoreRange;
          if (anchorDist / scoreRange < 0.3) anchoredCount++;
        }
      }

      const anchoringRate = anchoredCount / anchoringData.length;
      if (anchoringRate > 0.4) {
        biases.push({
          type: "anchoring",
          description: "Decisions tend to cluster near the initial anchor value",
          severity: anchoringRate > 0.7 ? "high" : "moderate",
          anchoringRate: r(anchoringRate),
          avgAnchorDeviation: r(totalAnchorDeviation / anchoringData.length),
          decisionsAnalyzed: anchoringData.length,
        });
      }
    }

    // --- Confirmation bias: selective weighting of supporting vs. contradicting evidence ---
    const confirmationData = decisions.filter(d => d.options && d.options.some(o => o.evidence && o.evidence.length > 0));
    if (confirmationData.length >= 2) {
      let supportBias = 0;
      let totalDecisions = 0;

      for (const decision of confirmationData) {
        const chosen = decision.options.find(o => o.name === decision.chosen);
        if (!chosen || !chosen.evidence || chosen.evidence.length === 0) continue;

        const supporting = chosen.evidence.filter(e => e.supports);
        const contradicting = chosen.evidence.filter(e => !e.supports);

        if (contradicting.length === 0 && supporting.length > 0) {
          supportBias += 1;
        } else if (supporting.length > 0 && contradicting.length > 0) {
          const avgSupportStrength = supporting.reduce((s, e) => s + (parseFloat(e.strength) || 0), 0) / supporting.length;
          const avgContradictStrength = contradicting.reduce((s, e) => s + (parseFloat(e.strength) || 0), 0) / contradicting.length;
          // Check if contradicting evidence is systematically underweighted
          if (avgSupportStrength > avgContradictStrength * 1.5) {
            supportBias += 0.5;
          }
        }
        totalDecisions++;
      }

      if (totalDecisions > 0) {
        const biasRate = supportBias / totalDecisions;
        if (biasRate > 0.3) {
          biases.push({
            type: "confirmation_bias",
            description: "Contradicting evidence is ignored or underweighted relative to supporting evidence",
            severity: biasRate > 0.6 ? "high" : "moderate",
            biasRate: r(biasRate),
            decisionsAnalyzed: totalDecisions,
          });
        }
      }
    }

    // --- Sunk cost bias: continuing with higher-investment options despite lower expected value ---
    const sunkCostData = decisions.filter(d => d.investedCost !== undefined && d.options && d.options.length > 1);
    if (sunkCostData.length >= 2) {
      let sunkCostCount = 0;
      let totalSunkCostCorrelation = 0;

      for (const decision of sunkCostData) {
        const invested = parseFloat(decision.investedCost) || 0;
        const chosen = decision.options.find(o => o.name === decision.chosen);
        const bestOption = decision.options.reduce((best, o) => (parseFloat(o.score) || 0) > (parseFloat(best.score) || 0) ? o : best);

        if (!chosen) continue;

        const chosenScore = parseFloat(chosen.score) || 0;
        const bestScore = parseFloat(bestOption.score) || 0;

        // If the chosen option is not the best AND investment is high, suspect sunk cost
        if (chosenScore < bestScore * 0.9 && invested > 0) {
          sunkCostCount++;
        }
        totalSunkCostCorrelation++;
      }

      if (totalSunkCostCorrelation > 0) {
        const sunkCostRate = sunkCostCount / totalSunkCostCorrelation;
        if (sunkCostRate > 0.2) {
          biases.push({
            type: "sunk_cost",
            description: "Suboptimal options chosen when prior investment is high, suggesting sunk cost influence",
            severity: sunkCostRate > 0.5 ? "high" : "moderate",
            sunkCostRate: r(sunkCostRate),
            decisionsAnalyzed: sunkCostData.length,
          });
        }
      }
    }

    // --- Overall bias score ---
    const severityWeights = { high: 3, moderate: 2, low: 1 };
    const totalBiasScore = biases.reduce((s, b) => s + (severityWeights[b.severity] || 1), 0);
    const maxPossibleScore = 3 * 3; // 3 biases, max severity each
    const biasIndex = Math.min(1, totalBiasScore / maxPossibleScore);

    return {
      ok: true,
      result: {
        decisionsAnalyzed: decisions.length,
        biasesDetected: biases.length,
        biases,
        biasIndex: r(biasIndex),
        riskLevel: biasIndex > 0.5 ? "high" : biasIndex > 0.2 ? "moderate" : "low",
        recommendations: biases.map(b => {
          switch (b.type) {
            case "anchoring": return "Consider generating options independently before reviewing anchor values";
            case "confirmation_bias": return "Actively seek disconfirming evidence and assign equal weight to contradicting data";
            case "sunk_cost": return "Evaluate options based on future expected value, not past investments";
            default: return "Review decision process for systematic biases";
          }
        }),
      },
    };
  });
}
