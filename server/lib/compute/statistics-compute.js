// server/lib/compute/statistics-compute.js
/**
 * Statistics Compute — Beyond basic descriptive stats.
 *
 * Bayesian inference, regression analysis, hypothesis testing,
 * distribution fitting, and time series. Called by the Oracle Engine
 * for quantitative analysis across domains.
 *
 * Pure ES module. Native Math only. Each function returns a structured
 * result { value, unit?, formula?, inputs, ... } or { error, inputs }.
 */

// --------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------

const PI = Math.PI;
const SQRT_2PI = Math.sqrt(2 * PI);

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function isArr(a) {
  return Array.isArray(a) && a.length > 0 && a.every(isNum);
}

function err(message, inputs) {
  return { error: message, inputs };
}

function ok(value, extra = {}) {
  return { value, ...extra };
}

function mean(arr) {
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

function variance(arr, sample = true) {
  const m = mean(arr);
  let s = 0;
  for (const x of arr) s += (x - m) * (x - m);
  return s / (sample ? arr.length - 1 : arr.length);
}

function stdev(arr, sample = true) {
  return Math.sqrt(variance(arr, sample));
}

function sum(arr) {
  let s = 0;
  for (const x of arr) s += x;
  return s;
}

// --------------------------------------------------------------------
// Special functions (erf, gamma, beta, logs)
// --------------------------------------------------------------------

/** Abramowitz & Stegun 7.1.26 numerical erf approximation. */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Lanczos approximation for log Γ(x). Good to ~15 digits for x > 0. */
function logGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(PI / Math.sin(PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function gamma(x) {
  return Math.exp(logGamma(x));
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** Lower regularized incomplete gamma P(a, x) via series / continued fraction. */
function gammaP(a, x) {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series representation.
    let ap = a;
    let sumS = 1 / a;
    let del = sumS;
    for (let i = 0; i < 200; i++) {
      ap += 1;
      del *= x / ap;
      sumS += del;
      if (Math.abs(del) < Math.abs(sumS) * 1e-12) break;
    }
    return sumS * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction.
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - h * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized incomplete beta I_x(a, b) via continued fraction (NR §6.4). */
function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logBeta(a, b);
  const bt = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - lbeta,
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaCF(x, a, b)) / a;
  }
  return 1 - (bt * betaCF(1 - x, b, a)) / b;
}

function betaCF(x, a, b) {
  const eps = 1e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

// --------------------------------------------------------------------
// DISTRIBUTIONS
// --------------------------------------------------------------------

export function normalPDF(x, meanVal = 0, stdDev = 1) {
  const inputs = { x, mean: meanVal, stdDev };
  if (!isNum(x) || !isNum(meanVal) || !isNum(stdDev)) return err("numeric required", inputs);
  if (stdDev <= 0) return err("stdDev must be > 0", inputs);
  const z = (x - meanVal) / stdDev;
  const v = Math.exp(-0.5 * z * z) / (stdDev * SQRT_2PI);
  return { value: v, formula: "N(μ,σ)", inputs };
}

export function normalCDF(x, meanVal = 0, stdDev = 1) {
  const inputs = { x, mean: meanVal, stdDev };
  if (!isNum(x) || !isNum(meanVal) || !isNum(stdDev)) return err("numeric required", inputs);
  if (stdDev <= 0) return err("stdDev must be > 0", inputs);
  const z = (x - meanVal) / (stdDev * Math.SQRT2);
  const cdf = 0.5 * (1 + erf(z));
  return { value: cdf, formula: "Φ((x−μ)/σ)", inputs };
}

export function binomialPMF(k, n, p) {
  const inputs = { k, n, p };
  if (!Number.isInteger(k) || !Number.isInteger(n) || !isNum(p)) return err("k,n integer and p numeric", inputs);
  if (k < 0 || k > n || p < 0 || p > 1) return err("invalid range", inputs);
  // log C(n,k) via log Γ
  const logC = logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
  const logPmf = logC + k * Math.log(p || 1e-300) + (n - k) * Math.log(1 - p || 1e-300);
  return { value: Math.exp(logPmf), formula: "C(n,k)p^k(1−p)^(n−k)", inputs };
}

export function poissonPMF(k, lambda) {
  const inputs = { k, lambda };
  if (!Number.isInteger(k) || k < 0) return err("k must be non-negative integer", inputs);
  if (!isNum(lambda) || lambda < 0) return err("lambda ≥ 0 required", inputs);
  const logPmf = -lambda + k * Math.log(lambda || 1e-300) - logGamma(k + 1);
  return { value: Math.exp(logPmf), formula: "e^(−λ)·λ^k/k!", inputs };
}

export function tDistPDF(x, df) {
  const inputs = { x, df };
  if (!isNum(x) || !isNum(df) || df <= 0) return err("x numeric, df > 0", inputs);
  const coeff =
    gamma((df + 1) / 2) / (Math.sqrt(df * PI) * gamma(df / 2));
  const v = coeff * Math.pow(1 + (x * x) / df, -(df + 1) / 2);
  return { value: v, formula: "t(df)", inputs };
}

function tDistCDF(x, df) {
  if (df <= 0) return NaN;
  const xt = df / (df + x * x);
  const p = 0.5 * betaI(xt, df / 2, 0.5);
  return x >= 0 ? 1 - p : p;
}

// --------------------------------------------------------------------
// HYPOTHESIS TESTING
// --------------------------------------------------------------------

export function tTest(sample1, sample2, { paired = false, alpha = 0.05 } = {}) {
  const inputs = { n1: sample1?.length, n2: sample2?.length, paired, alpha };
  if (!isArr(sample1) || !isArr(sample2)) return err("samples must be numeric arrays", inputs);

  let t, df;
  if (paired) {
    if (sample1.length !== sample2.length) return err("paired samples must match length", inputs);
    const diffs = sample1.map((x, i) => x - sample2[i]);
    const dmean = mean(diffs);
    const dsd = stdev(diffs);
    t = dmean / (dsd / Math.sqrt(diffs.length));
    df = diffs.length - 1;
  } else {
    // Welch's t-test
    const m1 = mean(sample1);
    const m2 = mean(sample2);
    const v1 = variance(sample1);
    const v2 = variance(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
    const num = Math.pow(v1 / n1 + v2 / n2, 2);
    const den = (v1 * v1) / (n1 * n1 * (n1 - 1)) + (v2 * v2) / (n2 * n2 * (n2 - 1));
    df = num / den;
  }

  const pValue = 2 * (1 - tDistCDF(Math.abs(t), df));
  return {
    value: t,
    tStatistic: t,
    degreesOfFreedom: df,
    pValue,
    reject: pValue < alpha,
    alpha,
    paired,
    formula: paired ? "paired t-test" : "Welch's t-test",
    inputs,
  };
}

export function chiSquareTest(observed, expected) {
  const inputs = { nObs: observed?.length, nExp: expected?.length };
  if (!isArr(observed) || !isArr(expected)) return err("arrays required", inputs);
  if (observed.length !== expected.length) return err("length mismatch", inputs);
  let chi2 = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] <= 0) return err("expected values must be > 0", inputs);
    const diff = observed[i] - expected[i];
    chi2 += (diff * diff) / expected[i];
  }
  const df = observed.length - 1;
  const pValue = 1 - gammaP(df / 2, chi2 / 2);
  return {
    value: chi2,
    chiSquare: chi2,
    degreesOfFreedom: df,
    pValue,
    formula: "Σ (O−E)²/E",
    inputs,
  };
}

export function anova(groups) {
  const inputs = { k: groups?.length };
  if (!Array.isArray(groups) || groups.length < 2) return err("need ≥ 2 groups", inputs);
  if (!groups.every(isArr)) return err("each group must be non-empty numeric array", inputs);
  const k = groups.length;
  const allValues = groups.flat();
  const grandMean = mean(allValues);
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of groups) {
    const gm = mean(g);
    ssBetween += g.length * (gm - grandMean) ** 2;
    for (const v of g) ssWithin += (v - gm) ** 2;
  }
  const dfB = k - 1;
  const dfW = allValues.length - k;
  const msB = ssBetween / dfB;
  const msW = ssWithin / dfW;
  const F = msB / msW;
  // p-value from F distribution via betaI.
  const x = dfW / (dfW + dfB * F);
  const pValue = betaI(x, dfW / 2, dfB / 2);
  return {
    value: F,
    fStatistic: F,
    dfBetween: dfB,
    dfWithin: dfW,
    ssBetween,
    ssWithin,
    pValue,
    formula: "F = MSB/MSW",
    inputs,
  };
}

export function kolmogorovSmirnov(sample1, sample2) {
  const inputs = { n1: sample1?.length, n2: sample2?.length };
  if (!isArr(sample1) || !isArr(sample2)) return err("numeric arrays required", inputs);
  const a = sample1.slice().sort((x, y) => x - y);
  const b = sample2.slice().sort((x, y) => x - y);
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < a.length && j < b.length) {
    const da = (i + 1) / a.length;
    const dbVal = (j + 1) / b.length;
    if (a[i] <= b[j]) {
      i++;
      if (Math.abs(da - j / b.length) > d) d = Math.abs(da - j / b.length);
    } else {
      j++;
      if (Math.abs(dbVal - i / a.length) > d) d = Math.abs(dbVal - i / a.length);
    }
  }
  const n1 = a.length;
  const n2 = b.length;
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  // Kolmogorov Q approximation.
  const lambda = (en + 0.12 + 0.11 / en) * d;
  let p = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * ((-1) ** (k - 1)) * Math.exp(-2 * k * k * lambda * lambda);
    p += term;
    if (Math.abs(term) < 1e-10) break;
  }
  p = Math.max(0, Math.min(1, p));
  return {
    value: d,
    dStatistic: d,
    pValue: p,
    formula: "sup|F1(x)−F2(x)|",
    inputs,
  };
}

// --------------------------------------------------------------------
// REGRESSION
// --------------------------------------------------------------------

export function linearRegression(xs, ys) {
  const inputs = { n: xs?.length };
  if (!isArr(xs) || !isArr(ys)) return err("numeric arrays required", inputs);
  if (xs.length !== ys.length) return err("length mismatch", inputs);
  const n = xs.length;
  if (n < 2) return err("need at least 2 points", inputs);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return err("zero variance in x", inputs);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rSquared = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  const residuals = xs.map((x, i) => ys[i] - (slope * x + intercept));
  return {
    value: slope,
    slope,
    intercept,
    rSquared,
    predict(x) { return slope * x + intercept; },
    residuals,
    formula: "y = m·x + b",
    inputs,
  };
}

export function polynomialRegression(xs, ys, degree = 2) {
  const inputs = { n: xs?.length, degree };
  if (!isArr(xs) || !isArr(ys)) return err("numeric arrays required", inputs);
  if (xs.length !== ys.length) return err("length mismatch", inputs);
  if (!Number.isInteger(degree) || degree < 1) return err("degree must be integer ≥ 1", inputs);
  const n = xs.length;
  const m = degree + 1;
  // Build design matrix X (n × m) and normal equations XᵀX·β = Xᵀy.
  const XtX = Array.from({ length: m }, () => new Array(m).fill(0));
  const Xty = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    const row = new Array(m);
    let xp = 1;
    for (let j = 0; j < m; j++) { row[j] = xp; xp *= xs[i]; }
    for (let j = 0; j < m; j++) {
      Xty[j] += row[j] * ys[i];
      for (let k = 0; k < m; k++) XtX[j][k] += row[j] * row[k];
    }
  }
  const coeffs = gaussianSolve(XtX, Xty);
  if (!coeffs) return err("singular normal equations", inputs);

  const predict = x => {
    let r = 0;
    let xp = 1;
    for (let j = 0; j < m; j++) { r += coeffs[j] * xp; xp *= x; }
    return r;
  };
  const my = mean(ys);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - predict(xs[i])) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return {
    value: coeffs,
    coefficients: coeffs,
    degree,
    rSquared,
    predict,
    formula: "y = Σ β_i · x^i",
    inputs,
  };
}

/** Gauss-Jordan elimination on a (possibly small) system. */
function gaussianSolve(AIn, bIn) {
  const n = bIn.length;
  const A = AIn.map(r => r.slice());
  const b = bIn.slice();
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[pivot][i])) pivot = k;
    if (Math.abs(A[pivot][i]) < 1e-12) return null;
    [A[i], A[pivot]] = [A[pivot], A[i]];
    [b[i], b[pivot]] = [b[pivot], b[i]];
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
      b[k] -= factor * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

export function logisticRegression(xs, ys, { iterations = 1000, learningRate = 0.1 } = {}) {
  const inputs = { n: xs?.length, iterations };
  if (!isArr(xs) || !isArr(ys)) return err("numeric arrays required", inputs);
  if (xs.length !== ys.length) return err("length mismatch", inputs);
  let w = 0;
  let b = 0;
  const n = xs.length;
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  for (let iter = 0; iter < iterations; iter++) {
    let gw = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const yp = sigmoid(w * xs[i] + b);
      const diff = yp - ys[i];
      gw += diff * xs[i];
      gb += diff;
    }
    w -= (learningRate * gw) / n;
    b -= (learningRate * gb) / n;
  }
  const predict = x => sigmoid(w * x + b);
  return {
    value: { weight: w, bias: b },
    weight: w,
    bias: b,
    predict,
    formula: "p = 1/(1+e^(−(wx+b)))",
    inputs,
  };
}

export function multipleRegression(X, y) {
  const inputs = { rows: X?.length, cols: X?.[0]?.length };
  if (!Array.isArray(X) || !isArr(y)) return err("X matrix and y array required", inputs);
  if (X.length !== y.length) return err("row count mismatch", inputs);
  if (!X.every(r => Array.isArray(r) && r.length === X[0].length && r.every(isNum))) {
    return err("X must be a numeric matrix", inputs);
  }
  const n = X.length;
  // Augment with intercept column.
  const Xa = X.map(r => [1, ...r]);
  const m = Xa[0].length;
  const XtX = Array.from({ length: m }, () => new Array(m).fill(0));
  const Xty = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      Xty[j] += Xa[i][j] * y[i];
      for (let k = 0; k < m; k++) XtX[j][k] += Xa[i][j] * Xa[i][k];
    }
  }
  const beta = gaussianSolve(XtX, Xty);
  if (!beta) return err("singular design matrix", inputs);
  const my = mean(y);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    let yp = 0;
    for (let j = 0; j < m; j++) yp += beta[j] * Xa[i][j];
    ssRes += (y[i] - yp) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return {
    value: beta,
    coefficients: beta,
    intercept: beta[0],
    slopes: beta.slice(1),
    rSquared,
    formula: "β = (XᵀX)⁻¹ Xᵀy",
    inputs,
  };
}

// --------------------------------------------------------------------
// BAYESIAN
// --------------------------------------------------------------------

export function bayesUpdate({ prior, likelihood, evidence }) {
  const inputs = { prior, likelihood, evidence };
  if (!isNum(prior) || !isNum(likelihood) || !isNum(evidence)) return err("numeric required", inputs);
  if (prior < 0 || prior > 1) return err("prior must be in [0,1]", inputs);
  if (evidence <= 0) return err("evidence must be > 0", inputs);
  const posterior = (likelihood * prior) / evidence;
  return {
    value: posterior,
    posterior,
    formula: "P(H|E) = P(E|H)·P(H)/P(E)",
    inputs,
  };
}

export function betaDistribution({ alpha, beta }) {
  const inputs = { alpha, beta };
  if (!isNum(alpha) || !isNum(beta)) return err("alpha, beta numeric", inputs);
  if (alpha <= 0 || beta <= 0) return err("alpha, beta > 0", inputs);
  const meanVal = alpha / (alpha + beta);
  const varVal =
    (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const mode =
    alpha > 1 && beta > 1 ? (alpha - 1) / (alpha + beta - 2) : null;
  const pdf = x => {
    if (x <= 0 || x >= 1) return 0;
    return Math.exp(
      (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta(alpha, beta),
    );
  };
  const cdf = x => betaI(Math.max(0, Math.min(1, x)), alpha, beta);
  return {
    value: meanVal,
    mean: meanVal,
    variance: varVal,
    mode,
    pdf,
    cdf,
    formula: "Beta(α,β)",
    inputs,
  };
}

export function credibleInterval({ samples, confidence = 0.95 }) {
  const inputs = { n: samples?.length, confidence };
  if (!isArr(samples)) return err("numeric samples array required", inputs);
  if (!isNum(confidence) || confidence <= 0 || confidence >= 1) return err("confidence in (0,1)", inputs);
  const sorted = samples.slice().sort((a, b) => a - b);
  const tail = (1 - confidence) / 2;
  const lowerIdx = Math.floor(tail * sorted.length);
  const upperIdx = Math.min(sorted.length - 1, Math.ceil((1 - tail) * sorted.length) - 1);
  return {
    value: [sorted[lowerIdx], sorted[upperIdx]],
    lower: sorted[lowerIdx],
    upper: sorted[upperIdx],
    confidence,
    formula: "percentile-based CI",
    inputs,
  };
}

// --------------------------------------------------------------------
// TIME SERIES
// --------------------------------------------------------------------

export function movingAverage(series, window) {
  const inputs = { n: series?.length, window };
  if (!isArr(series)) return err("numeric array required", inputs);
  if (!Number.isInteger(window) || window <= 0 || window > series.length) {
    return err("window must be 1..series.length", inputs);
  }
  const out = [];
  let running = 0;
  for (let i = 0; i < series.length; i++) {
    running += series[i];
    if (i >= window) running -= series[i - window];
    if (i >= window - 1) out.push(running / window);
  }
  return { value: out, formula: `MA(${window})`, inputs };
}

export function exponentialSmoothing(series, alpha = 0.3) {
  const inputs = { n: series?.length, alpha };
  if (!isArr(series)) return err("numeric array required", inputs);
  if (!isNum(alpha) || alpha <= 0 || alpha > 1) return err("alpha in (0,1]", inputs);
  const out = [series[0]];
  for (let i = 1; i < series.length; i++) {
    out.push(alpha * series[i] + (1 - alpha) * out[i - 1]);
  }
  return { value: out, formula: "S_t = α·y_t + (1−α)·S_(t−1)", inputs };
}

export function autocorrelation(series, lag) {
  const inputs = { n: series?.length, lag };
  if (!isArr(series)) return err("numeric array required", inputs);
  if (!Number.isInteger(lag) || lag < 0 || lag >= series.length) return err("invalid lag", inputs);
  const m = mean(series);
  let num = 0;
  let den = 0;
  for (let i = 0; i < series.length; i++) {
    den += (series[i] - m) ** 2;
    if (i + lag < series.length) num += (series[i] - m) * (series[i + lag] - m);
  }
  if (den === 0) return err("zero variance", inputs);
  return { value: num / den, lag, formula: "ρ(k) = Σ(y_t−μ)(y_{t+k}−μ)/Σ(y_t−μ)²", inputs };
}

export function seasonalDecompose(series, period) {
  const inputs = { n: series?.length, period };
  if (!isArr(series)) return err("numeric array required", inputs);
  if (!Number.isInteger(period) || period < 2 || period > series.length) return err("invalid period", inputs);
  // Trend: centered moving average.
  const trend = new Array(series.length).fill(null);
  const half = Math.floor(period / 2);
  for (let i = half; i < series.length - half; i++) {
    let s = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      if (i + k >= 0 && i + k < series.length) { s += series[i + k]; count++; }
    }
    trend[i] = s / count;
  }
  // Detrended series.
  const detrended = series.map((v, i) => (trend[i] === null ? null : v - trend[i]));
  // Seasonal component: average of detrended per period index.
  const seasonal = new Array(period).fill(0);
  const seasonCount = new Array(period).fill(0);
  for (let i = 0; i < series.length; i++) {
    if (detrended[i] !== null) {
      seasonal[i % period] += detrended[i];
      seasonCount[i % period] += 1;
    }
  }
  for (let i = 0; i < period; i++) {
    seasonal[i] = seasonCount[i] > 0 ? seasonal[i] / seasonCount[i] : 0;
  }
  const seasonalFull = series.map((_, i) => seasonal[i % period]);
  const residual = series.map((v, i) => (trend[i] === null ? null : v - trend[i] - seasonalFull[i]));
  return {
    value: { trend, seasonal: seasonalFull, residual },
    trend,
    seasonal: seasonalFull,
    residual,
    formula: "y = trend + seasonal + residual",
    inputs,
  };
}

// --------------------------------------------------------------------
// CORRELATION
// --------------------------------------------------------------------

export function pearsonCorrelation(xs, ys) {
  const inputs = { n: xs?.length };
  if (!isArr(xs) || !isArr(ys)) return err("numeric arrays required", inputs);
  if (xs.length !== ys.length) return err("length mismatch", inputs);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return err("zero variance", inputs);
  const r = num / Math.sqrt(dx * dy);
  return { value: r, formula: "r = Σ(xᵢ−x̄)(yᵢ−ȳ)/√(ΣΣ)", inputs };
}

export function spearmanCorrelation(xs, ys) {
  const inputs = { n: xs?.length };
  if (!isArr(xs) || !isArr(ys)) return err("numeric arrays required", inputs);
  if (xs.length !== ys.length) return err("length mismatch", inputs);
  const rank = arr => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const r = new Array(arr.length);
    // Average ranks for ties.
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[indexed[k].i] = avgRank;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  return pearsonCorrelation(rx, ry);
}

// --------------------------------------------------------------------
// DISTRIBUTION FITTING
// --------------------------------------------------------------------

export function fitNormal(samples) {
  const inputs = { n: samples?.length };
  if (!isArr(samples)) return err("numeric samples required", inputs);
  if (samples.length < 2) return err("need at least 2 samples", inputs);
  const m = mean(samples);
  const sd = stdev(samples);
  // Log-likelihood under the fitted MLE.
  let ll = 0;
  for (const x of samples) {
    const z = (x - m) / sd;
    ll += -0.5 * z * z - Math.log(sd * SQRT_2PI);
  }
  return {
    value: { mean: m, stdDev: sd },
    mean: m,
    stdDev: sd,
    logLikelihood: ll,
    formula: "MLE normal",
    inputs,
  };
}

export function fitExponential(samples) {
  const inputs = { n: samples?.length };
  if (!isArr(samples)) return err("numeric samples required", inputs);
  if (samples.some(x => x < 0)) return err("samples must be ≥ 0", inputs);
  const m = mean(samples);
  if (m <= 0) return err("mean must be > 0", inputs);
  const rate = 1 / m;
  let ll = 0;
  for (const x of samples) ll += Math.log(rate) - rate * x;
  return {
    value: { rate },
    rate,
    meanLife: m,
    logLikelihood: ll,
    formula: "MLE exponential",
    inputs,
  };
}

// --------------------------------------------------------------------
// Default export — Oracle registry
// --------------------------------------------------------------------

export default {
  normalPDF,
  normalCDF,
  binomialPMF,
  poissonPMF,
  tDistPDF,
  tTest,
  chiSquareTest,
  anova,
  kolmogorovSmirnov,
  linearRegression,
  polynomialRegression,
  logisticRegression,
  multipleRegression,
  bayesUpdate,
  betaDistribution,
  credibleInterval,
  movingAverage,
  exponentialSmoothing,
  autocorrelation,
  seasonalDecompose,
  pearsonCorrelation,
  spearmanCorrelation,
  fitNormal,
  fitExponential,
};
