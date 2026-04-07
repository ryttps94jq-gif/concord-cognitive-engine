// server/domains/hypothesis.js
// Domain actions for hypothesis testing: statistical tests, A/B experiment
// analysis, Bayesian inference, and power analysis.

export default function registerHypothesisActions(registerLensAction) {
  // Standard normal CDF approximation (Abramowitz & Stegun)
  function normCDF(z) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + p * z);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1 + sign * y);
  }

  // Inverse normal CDF (rational approximation)
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;
    const a = [
      -3.969683028665376e+01, 2.209460984245205e+02,
      -2.759285104469687e+02, 1.383577518672690e+02,
      -3.066479806614716e+01, 2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01, 1.615858368580409e+02,
      -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00,
      4.374664141464968e+00, 2.938163982698783e+00
    ];
    const d = [
      7.784695709041462e-03, 3.224671290700398e-01,
      2.445134137142996e+00, 3.754408661907416e+00
    ];
    const pLow = 0.02425, pHigh = 1 - pLow;
    let q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5; r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  const rd = v => Math.round(v * 100000) / 100000;

  /**
   * zTest
   * One-sample or two-sample Z-test for means.
   * artifact.data.sample = { mean, stdDev, n }
   * artifact.data.sample2 = { mean, stdDev, n } (for two-sample)
   * artifact.data.populationMean (for one-sample)
   * params.alpha (default 0.05), params.alternative: "two-sided" | "greater" | "less"
   */
  registerLensAction("hypothesis", "zTest", (ctx, artifact, params) => {
    const s1 = artifact.data?.sample;
    if (!s1) return { ok: false, error: "sample data required: { mean, stdDev, n }" };

    const alpha = params.alpha || 0.05;
    const alt = params.alternative || "two-sided";
    const s2 = artifact.data?.sample2;

    let z, se, effectSize, testType;

    if (s2) {
      // Two-sample Z-test
      testType = "two-sample";
      se = Math.sqrt((s1.stdDev * s1.stdDev) / s1.n + (s2.stdDev * s2.stdDev) / s2.n);
      z = (s1.mean - s2.mean) / se;
      const pooledSD = Math.sqrt((s1.stdDev * s1.stdDev + s2.stdDev * s2.stdDev) / 2);
      effectSize = pooledSD > 0 ? Math.abs(s1.mean - s2.mean) / pooledSD : 0; // Cohen's d
    } else {
      // One-sample Z-test
      testType = "one-sample";
      const mu0 = artifact.data?.populationMean ?? 0;
      se = s1.stdDev / Math.sqrt(s1.n);
      z = (s1.mean - mu0) / se;
      effectSize = s1.stdDev > 0 ? Math.abs(s1.mean - mu0) / s1.stdDev : 0;
    }

    let pValue;
    if (alt === "greater") pValue = 1 - normCDF(z);
    else if (alt === "less") pValue = normCDF(z);
    else pValue = 2 * (1 - normCDF(Math.abs(z)));

    const reject = pValue < alpha;
    const zCrit = alt === "two-sided" ? normInv(1 - alpha / 2) : normInv(1 - alpha);

    // Confidence interval
    const marginOfError = zCrit * se;
    const ciLow = (s2 ? s1.mean - s2.mean : s1.mean) - marginOfError;
    const ciHigh = (s2 ? s1.mean - s2.mean : s1.mean) + marginOfError;

    return {
      ok: true, result: {
        testType, alternative: alt, alpha,
        zStatistic: rd(z), pValue: rd(pValue),
        criticalValue: rd(zCrit),
        reject, conclusion: reject
          ? `Reject H₀ at α=${alpha} (p=${rd(pValue)} < ${alpha})`
          : `Fail to reject H₀ at α=${alpha} (p=${rd(pValue)} ≥ ${alpha})`,
        confidenceInterval: { level: 1 - alpha, lower: rd(ciLow), upper: rd(ciHigh) },
        effectSize: rd(effectSize),
        effectMagnitude: effectSize < 0.2 ? "negligible" : effectSize < 0.5 ? "small" : effectSize < 0.8 ? "medium" : "large",
        standardError: rd(se),
      },
    };
  });

  /**
   * abTest
   * Analyze A/B test results for conversion rate experiments.
   * artifact.data.control = { visitors, conversions }
   * artifact.data.variant = { visitors, conversions }
   * params.alpha (default 0.05)
   */
  registerLensAction("hypothesis", "abTest", (ctx, artifact, params) => {
    const control = artifact.data?.control;
    const variant = artifact.data?.variant;
    if (!control || !variant) return { ok: false, error: "Both control and variant data required." };

    const alpha = params.alpha || 0.05;

    const pC = control.conversions / control.visitors;
    const pV = variant.conversions / variant.visitors;
    const nC = control.visitors;
    const nV = variant.visitors;

    // Pooled proportion under H₀
    const pPooled = (control.conversions + variant.conversions) / (nC + nV);
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nC + 1 / nV));
    const z = se > 0 ? (pV - pC) / se : 0;
    const pValue = 2 * (1 - normCDF(Math.abs(z)));

    // Unpooled SE for confidence interval
    const seUnpooled = Math.sqrt(pC * (1 - pC) / nC + pV * (1 - pV) / nV);
    const zCrit = normInv(1 - alpha / 2);
    const diff = pV - pC;
    const ciLow = diff - zCrit * seUnpooled;
    const ciHigh = diff + zCrit * seUnpooled;

    // Relative uplift
    const relativeUplift = pC > 0 ? (pV - pC) / pC : 0;

    // Required sample size for detecting this effect at 80% power
    const z80 = normInv(0.9); // one-sided 80% power
    const zAlpha = normInv(1 - alpha / 2);
    const avgP = (pC + pV) / 2;
    const requiredN = diff !== 0
      ? Math.ceil(Math.pow(zAlpha * Math.sqrt(2 * avgP * (1 - avgP)) + z80 * Math.sqrt(pC * (1 - pC) + pV * (1 - pV)), 2) / (diff * diff))
      : Infinity;

    // Current statistical power
    const nonCentrality = Math.abs(diff) / seUnpooled;
    const power = 1 - normCDF(zCrit - nonCentrality);

    const significant = pValue < alpha;

    return {
      ok: true, result: {
        control: { visitors: nC, conversions: control.conversions, rate: rd(pC * 100) + "%" },
        variant: { visitors: nV, conversions: variant.conversions, rate: rd(pV * 100) + "%" },
        absoluteDifference: rd(diff * 100) + " pp",
        relativeUplift: rd(relativeUplift * 100) + "%",
        zStatistic: rd(z), pValue: rd(pValue),
        significant,
        confidenceInterval: { level: (1 - alpha) * 100 + "%", lower: rd(ciLow * 100) + " pp", upper: rd(ciHigh * 100) + " pp" },
        statisticalPower: rd(power * 100) + "%",
        sampleSizeForPower80: requiredN < Infinity ? requiredN : "no detectable effect",
        recommendation: !significant ? "Not statistically significant — continue collecting data"
          : pV > pC ? `Variant wins with ${rd(relativeUplift * 100)}% uplift (p=${rd(pValue)})`
          : `Control wins — variant decreases conversion by ${rd(Math.abs(relativeUplift) * 100)}%`,
      },
    };
  });

  /**
   * bayesianInference
   * Update prior beliefs with observed data using conjugate priors.
   * artifact.data.prior = { distribution: "beta", alpha, beta } (for proportions)
   * OR { distribution: "normal", mean, precision }
   * artifact.data.observations = { successes, trials } or { values: number[] }
   */
  registerLensAction("hypothesis", "bayesianInference", (ctx, artifact, _params) => {
    const prior = artifact.data?.prior || { distribution: "beta", alpha: 1, beta: 1 };
    const obs = artifact.data?.observations || {};

    if (prior.distribution === "beta") {
      // Beta-Binomial conjugate update
      const a0 = prior.alpha || 1;
      const b0 = prior.beta || 1;
      const successes = obs.successes || 0;
      const trials = obs.trials || 0;
      const failures = trials - successes;

      const aPost = a0 + successes;
      const bPost = b0 + failures;

      // Posterior statistics
      const mean = aPost / (aPost + bPost);
      const mode = (aPost > 1 && bPost > 1) ? (aPost - 1) / (aPost + bPost - 2) : mean;
      const variance = (aPost * bPost) / ((aPost + bPost) * (aPost + bPost) * (aPost + bPost + 1));
      const stdDev = Math.sqrt(variance);

      // Credible interval (approximate using normal for large α, β)
      const z975 = 1.96;
      const ciLow = Math.max(0, mean - z975 * stdDev);
      const ciHigh = Math.min(1, mean + z975 * stdDev);

      // Prior vs posterior comparison
      const priorMean = a0 / (a0 + b0);
      const priorVar = (a0 * b0) / ((a0 + b0) * (a0 + b0) * (a0 + b0 + 1));

      // Bayes factor approximation (Savage-Dickey at point null p=0.5)
      // BF₁₀ = prior density at 0.5 / posterior density at 0.5
      function betaPDF(x, a, b) {
        // Log-beta for numerical stability
        const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
        return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta);
      }
      function logGamma(z) {
        // Stirling approximation
        if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
        z -= 1;
        const g = 7;
        const coefs = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
          771.32342877765313, -176.61502916214059, 12.507343278686905,
          -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        let x = coefs[0];
        for (let i = 1; i < g + 2; i++) x += coefs[i] / (z + i);
        const t = z + g + 0.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
      }

      const priorAt05 = betaPDF(0.5, a0, b0);
      const posteriorAt05 = betaPDF(0.5, aPost, bPost);
      const bayesFactor = posteriorAt05 > 0 ? priorAt05 / posteriorAt05 : Infinity;

      // Evidence interpretation
      let evidence;
      if (bayesFactor > 100) evidence = "decisive";
      else if (bayesFactor > 30) evidence = "very_strong";
      else if (bayesFactor > 10) evidence = "strong";
      else if (bayesFactor > 3) evidence = "substantial";
      else if (bayesFactor > 1) evidence = "anecdotal";
      else evidence = "supports_null";

      artifact.data.posterior = { distribution: "beta", alpha: aPost, beta: bPost };

      return {
        ok: true, result: {
          prior: { distribution: "Beta", alpha: a0, beta: b0, mean: rd(priorMean), variance: rd(priorVar) },
          likelihood: { successes, failures, trials },
          posterior: {
            distribution: "Beta", alpha: aPost, beta: bPost,
            mean: rd(mean), mode: rd(mode), stdDev: rd(stdDev), variance: rd(variance),
          },
          credibleInterval: { level: "95%", lower: rd(ciLow), upper: rd(ciHigh) },
          bayesFactor: rd(bayesFactor),
          evidenceStrength: evidence,
          shrinkage: rd(Math.abs(mean - priorMean) / Math.abs(successes / Math.max(trials, 1) - priorMean)),
        },
      };
    }

    if (prior.distribution === "normal") {
      // Normal-Normal conjugate update
      const mu0 = prior.mean || 0;
      const tau0 = prior.precision || 1; // 1/σ²
      const values = obs.values || [];
      if (values.length === 0) return { ok: false, error: "No observation values provided." };

      const n = values.length;
      const xBar = values.reduce((s, v) => s + v, 0) / n;
      const sampleVar = n > 1 ? values.reduce((s, v) => s + Math.pow(v - xBar, 2), 0) / (n - 1) : 1;
      const tauData = n / sampleVar;

      const tauPost = tau0 + tauData;
      const muPost = (tau0 * mu0 + tauData * xBar) / tauPost;
      const sigmaPost = Math.sqrt(1 / tauPost);

      const ciLow = muPost - 1.96 * sigmaPost;
      const ciHigh = muPost + 1.96 * sigmaPost;

      artifact.data.posterior = { distribution: "normal", mean: muPost, precision: tauPost };

      return {
        ok: true, result: {
          prior: { distribution: "Normal", mean: rd(mu0), precision: rd(tau0), stdDev: rd(Math.sqrt(1 / tau0)) },
          data: { sampleMean: rd(xBar), sampleVariance: rd(sampleVar), n },
          posterior: {
            distribution: "Normal", mean: rd(muPost), precision: rd(tauPost), stdDev: rd(sigmaPost),
          },
          credibleInterval: { level: "95%", lower: rd(ciLow), upper: rd(ciHigh) },
          weightOfPrior: rd(tau0 / tauPost * 100) + "%",
          weightOfData: rd(tauData / tauPost * 100) + "%",
        },
      };
    }

    return { ok: false, error: `Unsupported prior distribution: ${prior.distribution}. Use "beta" or "normal".` };
  });

  /**
   * powerAnalysis
   * Calculate required sample size, detectable effect, or statistical power.
   * params.solve: "sampleSize" | "power" | "effectSize"
   * params.alpha, params.power, params.effectSize, params.sampleSize
   */
  registerLensAction("hypothesis", "powerAnalysis", (ctx, artifact, params) => {
    const solve = params.solve || "sampleSize";
    const alpha = params.alpha || 0.05;

    if (solve === "sampleSize") {
      const power = params.power || 0.8;
      const d = params.effectSize || 0.5; // Cohen's d
      if (d <= 0) return { ok: false, error: "effectSize must be > 0." };

      const zAlpha = normInv(1 - alpha / 2);
      const zBeta = normInv(power);
      const n = Math.ceil(Math.pow((zAlpha + zBeta) / d, 2));

      return {
        ok: true, result: {
          solve: "sampleSize", requiredN: n, perGroup: n,
          totalForTwoGroups: n * 2,
          effectSize: d, alpha, power,
          effectMagnitude: d < 0.2 ? "negligible" : d < 0.5 ? "small" : d < 0.8 ? "medium" : "large",
        },
      };
    }

    if (solve === "power") {
      const n = params.sampleSize || 100;
      const d = params.effectSize || 0.5;
      const zAlpha = normInv(1 - alpha / 2);
      const nonCentrality = d * Math.sqrt(n);
      const power = 1 - normCDF(zAlpha - nonCentrality);

      return {
        ok: true, result: {
          solve: "power", power: rd(power), powerPercent: rd(power * 100) + "%",
          sampleSize: n, effectSize: d, alpha,
          adequate: power >= 0.8,
          recommendation: power < 0.8 ? `Need ~${Math.ceil(Math.pow((normInv(1 - alpha / 2) + normInv(0.8)) / d, 2))} per group for 80% power` : "Adequate power",
        },
      };
    }

    if (solve === "effectSize") {
      const n = params.sampleSize || 100;
      const power = params.power || 0.8;
      const zAlpha = normInv(1 - alpha / 2);
      const zBeta = normInv(power);
      const d = (zAlpha + zBeta) / Math.sqrt(n);

      return {
        ok: true, result: {
          solve: "effectSize", minimumDetectableEffect: rd(d),
          effectMagnitude: d < 0.2 ? "negligible" : d < 0.5 ? "small" : d < 0.8 ? "medium" : "large",
          sampleSize: n, alpha, power,
        },
      };
    }

    return { ok: false, error: `Unknown solve target "${solve}". Use: sampleSize, power, effectSize.` };
  });
}
