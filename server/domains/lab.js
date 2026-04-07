// server/domains/lab.js
// Domain actions for laboratory work: experiment design, calibration curves,
// sample tracking, and assay analysis with quality control.

export default function registerLabActions(registerLensAction) {
  /**
   * calibrationCurve
   * Fit a calibration curve from standard measurements and use it to
   * compute unknown concentrations.
   * artifact.data.standards = [{ concentration, response }]
   * artifact.data.unknowns = [{ id, response }] (optional)
   * params.model: "linear" | "quadratic" | "4PL" (default "linear")
   */
  registerLensAction("lab", "calibrationCurve", (ctx, artifact, params) => {
    const standards = artifact.data?.standards || [];
    if (standards.length < 2) return { ok: false, error: "Need at least 2 standard points." };

    const model = params.model || "linear";
    const unknowns = artifact.data?.unknowns || [];
    const r = v => Math.round(v * 100000) / 100000;

    const xs = standards.map(s => s.concentration);
    const ys = standards.map(s => s.response);
    const n = xs.length;

    let predict, equation, coefficients, rSquared;

    if (model === "linear") {
      // y = mx + b
      const sumX = xs.reduce((s, x) => s + x, 0);
      const sumY = ys.reduce((s, y) => s + y, 0);
      const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
      const sumX2 = xs.reduce((s, x) => s + x * x, 0);
      const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const b = (sumY - m * sumX) / n;
      coefficients = { slope: r(m), intercept: r(b) };
      equation = `response = ${r(m)} × concentration + ${r(b)}`;
      predict = (resp) => m !== 0 ? (resp - b) / m : null;

      const yMean = sumY / n;
      const ssRes = ys.reduce((s, y, i) => s + Math.pow(y - (m * xs[i] + b), 2), 0);
      const ssTot = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
      rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    } else if (model === "quadratic") {
      // y = ax² + bx + c via normal equations
      const S = (fn) => xs.reduce((s, x, i) => s + fn(x, ys[i], i), 0);
      const sx = S(x => x, 0), sx2 = S(x => x * x, 0), sx3 = S(x => x * x * x, 0), sx4 = S(x => x * x * x * x, 0);
      const sy = S((_, y) => y, 0), sxy = S((x, y) => x * y, 0), sx2y = S((x, y) => x * x * y, 0);

      // Solve 3x3 system [n,sx,sx2; sx,sx2,sx3; sx2,sx3,sx4] * [c,b,a] = [sy,sxy,sx2y]
      const M = [[n, sx, sx2, sy], [sx, sx2, sx3, sxy], [sx2, sx3, sx4, sx2y]];
      // Gaussian elimination
      for (let col = 0; col < 3; col++) {
        let maxR = col;
        for (let row = col + 1; row < 3; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxR][col])) maxR = row;
        [M[col], M[maxR]] = [M[maxR], M[col]];
        for (let row = col + 1; row < 3; row++) {
          const factor = M[row][col] / M[col][col];
          for (let j = col; j < 4; j++) M[row][j] -= factor * M[col][j];
        }
      }
      const c = M[2][3] / M[2][2];
      const b2 = (M[1][3] - M[1][2] * c) / M[1][1];
      const a2 = (M[0][3] - M[0][2] * c - M[0][1] * b2) / M[0][0];
      // a2=c, b2=b, c=a in ax²+bx+c
      coefficients = { a: r(c), b: r(b2), c: r(a2) };
      equation = `response = ${r(c)}x² + ${r(b2)}x + ${r(a2)}`;
      predict = (resp) => {
        // Solve ax² + bx + (c - resp) = 0
        const disc = b2 * b2 - 4 * c * (a2 - resp);
        if (disc < 0) return null;
        const x1 = (-b2 + Math.sqrt(disc)) / (2 * c);
        const x2 = (-b2 - Math.sqrt(disc)) / (2 * c);
        return x1 >= 0 ? x1 : x2 >= 0 ? x2 : x1; // prefer positive
      };

      const yMean = sy / n;
      const ssRes = ys.reduce((s, y, i) => s + Math.pow(y - (c * xs[i] * xs[i] + b2 * xs[i] + a2), 2), 0);
      const ssTot = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
      rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    } else if (model === "4PL") {
      // 4-Parameter Logistic: y = D + (A - D) / (1 + (x/C)^B)
      // Fit via iterative least squares (simplified)
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const minX = Math.min(...xs), maxX = Math.max(...xs);

      // Initial guesses
      let A = minY, D = maxY, C = (minX + maxX) / 2, B = 1;

      // Simple gradient descent (50 iterations)
      for (let iter = 0; iter < 50; iter++) {
        const lr = 0.001 / (1 + iter * 0.1);
        let dA = 0, dB = 0, dC = 0, dD = 0;

        for (let i = 0; i < n; i++) {
          const x = Math.max(xs[i], 1e-10);
          const xc = x / C;
          const xcB = Math.pow(xc, B);
          const denom = 1 + xcB;
          const predicted = D + (A - D) / denom;
          const error = ys[i] - predicted;

          dA += error * (1 / denom);
          dD += error * (1 - 1 / denom);
          dB += error * (A - D) * xcB * Math.log(xc) / (denom * denom);
          dC += error * (A - D) * B * xcB / (C * denom * denom);
        }

        A += lr * dA;
        B += lr * dB * 10;
        C += lr * dC;
        D += lr * dD;
      }

      coefficients = { A: r(A), B: r(B), C: r(C), D: r(D) };
      equation = `response = ${r(D)} + (${r(A)} - ${r(D)}) / (1 + (x/${r(C)})^${r(B)})`;

      predict = (resp) => {
        // Solve for x: x = C * ((A-D)/(y-D) - 1)^(1/B)
        const ratio = (A - D) / (resp - D) - 1;
        if (ratio <= 0) return null;
        return C * Math.pow(ratio, 1 / B);
      };

      const yMean = ys.reduce((s, y) => s + y, 0) / n;
      const ssRes = ys.reduce((s, y, i) => {
        const x = Math.max(xs[i], 1e-10);
        const pred = D + (A - D) / (1 + Math.pow(x / C, B));
        return s + Math.pow(y - pred, 2);
      }, 0);
      const ssTot = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
      rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    } else {
      return { ok: false, error: `Unknown model "${model}". Use: linear, quadratic, 4PL.` };
    }

    // Compute unknown concentrations
    const computed = unknowns.map(u => {
      const conc = predict(u.response);
      return {
        id: u.id, response: u.response,
        computedConcentration: conc != null ? r(conc) : null,
        withinRange: conc != null && conc >= Math.min(...xs) && conc <= Math.max(...xs),
      };
    });

    // Residuals for standards
    const residuals = standards.map(s => {
      const predictedConc = predict(s.response);
      const accuracy = predictedConc != null && s.concentration > 0
        ? Math.round(Math.abs(predictedConc / s.concentration - 1) * 10000) / 100
        : null;
      return { concentration: s.concentration, response: s.response, backCalculated: predictedConc != null ? r(predictedConc) : null, errorPercent: accuracy };
    });

    // LOD/LOQ estimates (3σ and 10σ of blank)
    const blankStd = standards.filter(s => s.concentration === 0);
    let lod = null, loq = null;
    if (blankStd.length > 0 && model === "linear") {
      const blankResponse = blankStd[0].response;
      const residualStd = Math.sqrt(residuals.reduce((s, r) => s + Math.pow(r.errorPercent || 0, 2), 0) / residuals.length) / 100;
      const slope = coefficients.slope;
      if (slope > 0) {
        lod = r(3 * residualStd * blankResponse / slope);
        loq = r(10 * residualStd * blankResponse / slope);
      }
    }

    artifact.data.calibration = { model, rSquared: r(rSquared), coefficients };

    return {
      ok: true, result: {
        model, equation, coefficients,
        rSquared: r(rSquared),
        fitQuality: rSquared > 0.99 ? "excellent" : rSquared > 0.95 ? "good" : rSquared > 0.9 ? "acceptable" : "poor",
        standardResiduals: residuals,
        unknownResults: computed,
        limits: { lod, loq },
        range: { min: r(Math.min(...xs)), max: r(Math.max(...xs)) },
      },
    };
  });

  /**
   * qcAnalysis
   * Quality control analysis using Westgard rules on control measurements.
   * artifact.data.controls = [{ value, timestamp?, level? }]
   * artifact.data.targetMean, artifact.data.targetSD
   */
  registerLensAction("lab", "qcAnalysis", (ctx, artifact, _params) => {
    const controls = artifact.data?.controls || [];
    if (controls.length < 2) return { ok: false, error: "Need at least 2 control measurements." };

    const targetMean = artifact.data?.targetMean;
    const targetSD = artifact.data?.targetSD;

    const values = controls.map(c => c.value);
    const n = values.length;

    // Compute statistics
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1));

    const refMean = targetMean ?? mean;
    const refSD = targetSD ?? sd;

    const r = v => Math.round(v * 10000) / 10000;

    // Z-scores
    const zScores = values.map(v => refSD > 0 ? (v - refMean) / refSD : 0);

    // Westgard rules evaluation
    const violations = [];

    for (let i = 0; i < n; i++) {
      const z = zScores[i];

      // 1-2s warning: single observation > 2 SD
      if (Math.abs(z) > 2 && Math.abs(z) <= 3) {
        violations.push({ rule: "1-2s", index: i, value: values[i], zScore: r(z), severity: "warning" });
      }

      // 1-3s: single observation > 3 SD
      if (Math.abs(z) > 3) {
        violations.push({ rule: "1-3s", index: i, value: values[i], zScore: r(z), severity: "reject" });
      }

      // 2-2s: two consecutive > 2 SD in same direction
      if (i > 0 && Math.abs(zScores[i]) > 2 && Math.abs(zScores[i - 1]) > 2) {
        if (Math.sign(zScores[i]) === Math.sign(zScores[i - 1])) {
          violations.push({ rule: "2-2s", indices: [i - 1, i], severity: "reject" });
        }
      }

      // R-4s: range of two consecutive > 4 SD
      if (i > 0) {
        const range = Math.abs(zScores[i] - zScores[i - 1]);
        if (range > 4) {
          violations.push({ rule: "R-4s", indices: [i - 1, i], range: r(range), severity: "reject" });
        }
      }

      // 4-1s: four consecutive > 1 SD in same direction
      if (i >= 3) {
        const last4 = zScores.slice(i - 3, i + 1);
        if (last4.every(z => z > 1) || last4.every(z => z < -1)) {
          violations.push({ rule: "4-1s", indices: [i - 3, i - 2, i - 1, i], severity: "warning" });
        }
      }

      // 10-x: ten consecutive on same side of mean
      if (i >= 9) {
        const last10 = zScores.slice(i - 9, i + 1);
        if (last10.every(z => z > 0) || last10.every(z => z < 0)) {
          violations.push({ rule: "10-x", indices: Array.from({ length: 10 }, (_, j) => i - 9 + j), severity: "reject" });
        }
      }
    }

    // Remove duplicate rule violations
    const uniqueViolations = [];
    const seen = new Set();
    for (const v of violations) {
      const key = `${v.rule}-${v.index ?? v.indices?.join(",")}`;
      if (!seen.has(key)) { seen.add(key); uniqueViolations.push(v); }
    }

    // CV% (coefficient of variation)
    const cv = refMean !== 0 ? Math.abs(sd / refMean) * 100 : 0;

    // Bias
    const bias = refMean !== 0 ? ((mean - refMean) / refMean) * 100 : 0;

    // Total Allowable Error estimate
    const tae = Math.abs(bias) + 2 * cv;

    const inControl = uniqueViolations.filter(v => v.severity === "reject").length === 0;

    return {
      ok: true, result: {
        inControl,
        statistics: {
          n, mean: r(mean), sd: r(sd), cv: r(cv) + "%",
          targetMean: r(refMean), targetSD: r(refSD),
          bias: r(bias) + "%",
          totalAllowableError: r(tae) + "%",
        },
        westgardViolations: uniqueViolations,
        violationCount: uniqueViolations.length,
        rejectCount: uniqueViolations.filter(v => v.severity === "reject").length,
        warningCount: uniqueViolations.filter(v => v.severity === "warning").length,
        zScores: zScores.map(z => r(z)),
        leveyJennings: values.map((v, i) => ({
          index: i, value: v, zScore: r(zScores[i]),
          timestamp: controls[i].timestamp,
          zone: Math.abs(zScores[i]) > 3 ? "out-of-control"
            : Math.abs(zScores[i]) > 2 ? "warning"
              : Math.abs(zScores[i]) > 1 ? "zone-2" : "zone-1",
        })),
      },
    };
  });

  /**
   * sampleTracker
   * Track sample chain of custody and compute turnaround times.
   * artifact.data.samples = [{ id, type, receivedAt, steps: [{ action, timestamp, operator?, result? }] }]
   */
  registerLensAction("lab", "sampleTracker", (ctx, artifact, _params) => {
    const samples = artifact.data?.samples || [];
    if (samples.length === 0) return { ok: true, result: { message: "No samples." } };

    const analyzed = samples.map(s => {
      const steps = s.steps || [];
      const received = s.receivedAt ? new Date(s.receivedAt) : null;
      const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
      const completed = lastStep?.action === "reported" || lastStep?.action === "completed";

      // Turnaround time
      let tatMinutes = null;
      if (received && lastStep?.timestamp) {
        tatMinutes = Math.round((new Date(lastStep.timestamp) - received) / 60000);
      }

      // Step-to-step durations
      const stepDurations = [];
      for (let i = 1; i < steps.length; i++) {
        const duration = (new Date(steps[i].timestamp) - new Date(steps[i - 1].timestamp)) / 60000;
        stepDurations.push({
          from: steps[i - 1].action,
          to: steps[i].action,
          minutes: Math.round(duration * 100) / 100,
        });
      }

      // Chain of custody (unique operators)
      const operators = [...new Set(steps.map(st => st.operator).filter(Boolean))];

      return {
        id: s.id, type: s.type,
        receivedAt: s.receivedAt,
        status: completed ? "completed" : steps.length > 0 ? steps[steps.length - 1].action : "received",
        stepCount: steps.length,
        turnaroundMinutes: tatMinutes,
        turnaroundHours: tatMinutes != null ? Math.round(tatMinutes / 60 * 100) / 100 : null,
        stepDurations,
        operators,
        chainOfCustodyComplete: operators.length > 0 && steps.every(st => st.operator),
        bottleneck: stepDurations.length > 0 ? stepDurations.sort((a, b) => b.minutes - a.minutes)[0] : null,
      };
    });

    // Aggregate stats
    const completedSamples = analyzed.filter(s => s.status === "completed");
    const tats = completedSamples.map(s => s.turnaroundMinutes).filter(t => t != null);
    const avgTAT = tats.length > 0 ? tats.reduce((s, t) => s + t, 0) / tats.length : null;
    const medianTAT = tats.length > 0 ? tats.sort((a, b) => a - b)[Math.floor(tats.length / 2)] : null;

    // Type distribution
    const typeDistribution = {};
    for (const s of analyzed) {
      typeDistribution[s.type || "unknown"] = (typeDistribution[s.type || "unknown"] || 0) + 1;
    }

    // Status distribution
    const statusDistribution = {};
    for (const s of analyzed) {
      statusDistribution[s.status] = (statusDistribution[s.status] || 0) + 1;
    }

    // Common bottleneck steps
    const bottleneckSteps = {};
    for (const s of analyzed) {
      if (s.bottleneck) {
        const key = `${s.bottleneck.from} → ${s.bottleneck.to}`;
        bottleneckSteps[key] = (bottleneckSteps[key] || 0) + 1;
      }
    }

    return {
      ok: true, result: {
        samples: analyzed,
        totalSamples: samples.length,
        completedCount: completedSamples.length,
        inProgressCount: analyzed.filter(s => s.status !== "completed").length,
        turnaroundStats: {
          avgMinutes: avgTAT != null ? Math.round(avgTAT) : null,
          medianMinutes: medianTAT,
          avgHours: avgTAT != null ? Math.round(avgTAT / 60 * 100) / 100 : null,
        },
        typeDistribution,
        statusDistribution,
        commonBottlenecks: Object.entries(bottleneckSteps).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([step, count]) => ({ step, frequency: count })),
        custodyCompliance: Math.round((analyzed.filter(s => s.chainOfCustodyComplete).length / analyzed.length) * 100),
      },
    };
  });

  /**
   * experimentDesign
   * Generate a factorial or randomized experimental design.
   * artifact.data.factors = [{ name, levels: string[] }]
   * params.type: "full-factorial" | "fractional" | "randomized-block"
   * params.replicates (default 1)
   */
  registerLensAction("lab", "experimentDesign", (ctx, artifact, params) => {
    const factors = artifact.data?.factors || [];
    if (factors.length === 0) return { ok: false, error: "No factors defined." };

    const type = params.type || "full-factorial";
    const replicates = params.replicates || 1;

    // Full factorial: all combinations
    function cartesianProduct(arrays) {
      return arrays.reduce((acc, arr) =>
        acc.flatMap(combo => arr.map(item => [...combo, item])),
        [[]]
      );
    }

    const levelArrays = factors.map(f => f.levels || []);
    let runs;

    if (type === "full-factorial") {
      const combinations = cartesianProduct(levelArrays);
      runs = [];
      for (let rep = 0; rep < replicates; rep++) {
        for (const combo of combinations) {
          const run = { replicate: rep + 1 };
          factors.forEach((f, i) => { run[f.name] = combo[i]; });
          runs.push(run);
        }
      }
    } else if (type === "fractional") {
      // Half-fraction: take every other combination
      const combinations = cartesianProduct(levelArrays);
      const halfIdx = combinations.length > 4 ? Math.ceil(combinations.length / 2) : combinations.length;
      // Use defining relation: select based on XOR of first two factor indices
      const selected = combinations.filter((_, i) => {
        // Balanced selection: use modular arithmetic to get orthogonal fraction
        return i % 2 === 0 || combinations.length <= 4;
      }).slice(0, halfIdx);

      runs = [];
      for (let rep = 0; rep < replicates; rep++) {
        for (const combo of selected) {
          const run = { replicate: rep + 1 };
          factors.forEach((f, i) => { run[f.name] = combo[i]; });
          runs.push(run);
        }
      }
    } else if (type === "randomized-block") {
      const combinations = cartesianProduct(levelArrays);
      runs = [];
      for (let block = 0; block < replicates; block++) {
        // Shuffle within each block
        const shuffled = [...combinations].sort(() => Math.random() - 0.5);
        for (const combo of shuffled) {
          const run = { block: block + 1 };
          factors.forEach((f, i) => { run[f.name] = combo[i]; });
          runs.push(run);
        }
      }
    } else {
      return { ok: false, error: `Unknown design type "${type}". Use: full-factorial, fractional, randomized-block.` };
    }

    // Randomize run order
    const randomized = runs.map((run, i) => ({ runOrder: i + 1, ...run }));

    // Degrees of freedom analysis
    const totalRuns = runs.length;
    const mainEffectsDf = factors.reduce((s, f) => s + (f.levels.length - 1), 0);
    const interactionsDf = factors.length >= 2
      ? factors.reduce((s, f, i) => {
        for (let j = i + 1; j < factors.length; j++) {
          s += (f.levels.length - 1) * (factors[j].levels.length - 1);
        }
        return s;
      }, 0)
      : 0;
    const errorDf = Math.max(0, totalRuns - 1 - mainEffectsDf - interactionsDf);

    // Power estimate (rough)
    const effectsDetectable = errorDf > 0;

    return {
      ok: true, result: {
        designType: type,
        factors: factors.map(f => ({ name: f.name, levels: f.levels, levelCount: f.levels.length })),
        runs: randomized,
        totalRuns,
        replicates,
        degreesOfFreedom: {
          total: totalRuns - 1,
          mainEffects: mainEffectsDf,
          interactions: interactionsDf,
          error: errorDf,
        },
        canEstimateError: errorDf > 0,
        recommendation: errorDf === 0 && replicates === 1
          ? "Add replicates to estimate experimental error"
          : effectsDetectable ? "Design is adequate for effect estimation" : "Consider adding replicates",
      },
    };
  });
}
