// server/domains/fractal.js
// Domain actions for fractal/self-similar pattern analysis: fractal dimension
// computation, self-similarity detection, and structural complexity measurement.

export default function registerFractalActions(registerLensAction) {
  /**
   * fractalDimension
   * Compute fractal dimension using box-counting method for 2D point sets
   * and Hurst exponent for time series.
   * artifact.data.points = [{ x, y }]  (for box-counting)
   * OR artifact.data.values = number[]  (for Hurst exponent)
   * params.method: "box-counting" | "hurst" | "auto" (default: auto)
   */
  registerLensAction("fractal", "fractalDimension", (ctx, artifact, params) => {
    const points = artifact.data?.points || [];
    const values = artifact.data?.values || [];
    const method = params.method || "auto";
    const r = (v) => Math.round(v * 1e6) / 1e6;

    const useBoxCounting = method === "box-counting" || (method === "auto" && points.length > 0);
    const useHurst = method === "hurst" || (method === "auto" && points.length === 0 && values.length > 0);

    if (!useBoxCounting && !useHurst) {
      return { ok: false, error: "Provide points (for box-counting) or values (for Hurst exponent)." };
    }

    if (useBoxCounting) {
      if (points.length < 3) return { ok: false, error: "Need at least 3 points for box-counting." };

      // Find bounding box
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const maxRange = Math.max(rangeX, rangeY);

      // Box-counting at multiple scales
      const scales = [];
      const logData = [];
      let epsilon = maxRange;
      while (epsilon > maxRange / 256 && epsilon > 0) {
        // Count non-empty boxes
        const boxSet = new Set();
        for (const p of points) {
          const bx = Math.floor((p.x - minX) / epsilon);
          const by = Math.floor((p.y - minY) / epsilon);
          boxSet.add(`${bx},${by}`);
        }
        const count = boxSet.size;
        if (count > 0) {
          scales.push({ epsilon: r(epsilon), boxCount: count });
          logData.push({ logEpsilon: Math.log(1 / epsilon), logCount: Math.log(count) });
        }
        epsilon /= 2;
      }

      // Linear regression on log-log data to get fractal dimension
      if (logData.length < 2) {
        return { ok: false, error: "Not enough scale levels for dimension estimation." };
      }

      const n = logData.length;
      const sumX = logData.reduce((s, d) => s + d.logEpsilon, 0);
      const sumY = logData.reduce((s, d) => s + d.logCount, 0);
      const sumXY = logData.reduce((s, d) => s + d.logEpsilon * d.logCount, 0);
      const sumX2 = logData.reduce((s, d) => s + d.logEpsilon * d.logEpsilon, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // R-squared
      const yMean = sumY / n;
      const ssRes = logData.reduce((s, d) => s + (d.logCount - (slope * d.logEpsilon + intercept)) ** 2, 0);
      const ssTot = logData.reduce((s, d) => s + (d.logCount - yMean) ** 2, 0);
      const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      const fractalDim = slope;

      // Classify
      let classification;
      if (fractalDim < 0.5) classification = "sparse point set";
      else if (fractalDim < 1.1) classification = "approximately 1D (line-like)";
      else if (fractalDim < 1.5) classification = "fractal between line and plane";
      else if (fractalDim < 1.9) classification = "fractal approaching plane-filling";
      else classification = "approximately 2D (plane-filling)";

      return {
        ok: true,
        result: {
          method: "box-counting",
          fractalDimension: r(fractalDim),
          rSquared: r(rSquared),
          classification,
          pointCount: points.length,
          scalesAnalyzed: scales.length,
          scales,
          confidence: rSquared > 0.95 ? "high" : rSquared > 0.85 ? "medium" : "low",
        },
      };
    }

    // Hurst exponent via rescaled range (R/S) analysis
    if (values.length < 10) return { ok: false, error: "Need at least 10 values for Hurst exponent." };

    const n = values.length;
    const logData = [];

    // Compute R/S for different sub-series lengths
    const subLengths = [];
    let len = 8;
    while (len <= n) {
      subLengths.push(len);
      len = Math.floor(len * 1.5);
    }
    if (!subLengths.includes(n) && n >= 8) subLengths.push(n);

    for (const m of subLengths) {
      const numBlocks = Math.floor(n / m);
      if (numBlocks === 0) continue;

      let rsSum = 0;
      for (let block = 0; block < numBlocks; block++) {
        const segment = values.slice(block * m, block * m + m);
        const mean = segment.reduce((s, v) => s + v, 0) / m;

        // Cumulative deviations from mean
        const cumDev = [];
        let cumSum = 0;
        for (const v of segment) {
          cumSum += v - mean;
          cumDev.push(cumSum);
        }

        // Range
        const range = Math.max(...cumDev) - Math.min(...cumDev);

        // Standard deviation
        const std = Math.sqrt(segment.reduce((s, v) => s + (v - mean) ** 2, 0) / m);

        // Rescaled range
        const rs = std > 0 ? range / std : 0;
        rsSum += rs;
      }

      const avgRS = rsSum / numBlocks;
      if (avgRS > 0) {
        logData.push({ logN: Math.log(m), logRS: Math.log(avgRS) });
      }
    }

    if (logData.length < 2) {
      return { ok: false, error: "Not enough data for R/S analysis." };
    }

    // Linear regression on log-log data
    const ld = logData.length;
    const sumX = logData.reduce((s, d) => s + d.logN, 0);
    const sumY = logData.reduce((s, d) => s + d.logRS, 0);
    const sumXY = logData.reduce((s, d) => s + d.logN * d.logRS, 0);
    const sumX2 = logData.reduce((s, d) => s + d.logN * d.logN, 0);
    const hurstExponent = (ld * sumXY - sumX * sumY) / (ld * sumX2 - sumX * sumX);

    // R-squared
    const yMean = sumY / ld;
    const intercept = (sumY - hurstExponent * sumX) / ld;
    const ssRes = logData.reduce((s, d) => s + (d.logRS - (hurstExponent * d.logN + intercept)) ** 2, 0);
    const ssTot = logData.reduce((s, d) => s + (d.logRS - yMean) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Classification
    let behavior;
    if (hurstExponent > 0.55) behavior = "persistent (trending)";
    else if (hurstExponent < 0.45) behavior = "anti-persistent (mean-reverting)";
    else behavior = "random walk";

    // Fractal dimension from Hurst: D = 2 - H
    const fractalDim = 2 - hurstExponent;

    return {
      ok: true,
      result: {
        method: "hurst-exponent",
        hurstExponent: r(hurstExponent),
        fractalDimension: r(fractalDim),
        rSquared: r(rSquared),
        behavior,
        seriesLength: n,
        scalesAnalyzed: logData.length,
        confidence: rSquared > 0.9 ? "high" : rSquared > 0.75 ? "medium" : "low",
        interpretation: {
          "H > 0.5": "Long-term positive autocorrelation (trending)",
          "H = 0.5": "Random walk (no memory)",
          "H < 0.5": "Long-term negative autocorrelation (mean-reverting)",
          current: `H = ${r(hurstExponent)} → ${behavior}`,
        },
      },
    };
  });

  /**
   * selfSimilarity
   * Detect self-similar patterns at multiple scales — compute scale-invariant
   * features and identify repeating motifs.
   * artifact.data.values = number[] (1D signal)
   * params.minMotifLength (default: 3), params.maxMotifLength (default: auto)
   * params.numScales (default: 4)
   */
  registerLensAction("fractal", "selfSimilarity", (ctx, artifact, _params) => {
    const values = (artifact.data?.values || []).map(Number).filter(v => !isNaN(v));
    if (values.length < 8) return { ok: false, error: "Need at least 8 data points." };

    const n = values.length;
    const params = _params || {};
    const minMotifLen = params.minMotifLength || 3;
    const maxMotifLen = params.maxMotifLength || Math.min(Math.floor(n / 3), 50);
    const numScales = params.numScales || 4;
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // Normalize the series
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
    const normalized = values.map(v => (v - mean) / std);

    // Create multi-scale representations (downsample by averaging)
    const scales = [{ scale: 1, data: normalized }];
    let current = normalized;
    for (let s = 2; s <= numScales; s++) {
      const downsampled = [];
      for (let i = 0; i < current.length - 1; i += 2) {
        downsampled.push((current[i] + current[i + 1]) / 2);
      }
      if (downsampled.length >= minMotifLen) {
        scales.push({ scale: s, data: downsampled });
        current = downsampled;
      }
    }

    // Compute Euclidean distance between two subsequences (z-normalized)
    function subseqDistance(series, i, j, len) {
      // Z-normalize both subsequences
      const sub1 = series.slice(i, i + len);
      const sub2 = series.slice(j, j + len);
      const m1 = sub1.reduce((s, v) => s + v, 0) / len;
      const m2 = sub2.reduce((s, v) => s + v, 0) / len;
      const s1 = Math.sqrt(sub1.reduce((s, v) => s + (v - m1) ** 2, 0) / len) || 1;
      const s2 = Math.sqrt(sub2.reduce((s, v) => s + (v - m2) ** 2, 0) / len) || 1;
      let dist = 0;
      for (let k = 0; k < len; k++) {
        const d = (sub1[k] - m1) / s1 - (sub2[k] - m2) / s2;
        dist += d * d;
      }
      return Math.sqrt(dist / len);
    }

    // Find motifs (repeating patterns) at the original scale
    const motifs = [];
    for (let len = minMotifLen; len <= maxMotifLen; len += Math.max(1, Math.floor((maxMotifLen - minMotifLen) / 5))) {
      let bestDist = Infinity;
      let bestI = 0, bestJ = 0;

      // Use a stride to speed up for large series
      const stride = Math.max(1, Math.floor(n / 200));
      for (let i = 0; i < n - len; i += stride) {
        for (let j = i + len; j < n - len; j += stride) {
          const dist = subseqDistance(normalized, i, j, len);
          if (dist < bestDist) {
            bestDist = dist;
            bestI = i;
            bestJ = j;
          }
        }
      }

      if (bestDist < 1.0) { // threshold for "similar enough"
        motifs.push({
          length: len,
          position1: bestI,
          position2: bestJ,
          distance: r(bestDist),
          similarity: r(Math.max(0, 1 - bestDist)),
        });
      }
    }

    // Cross-scale similarity: compare patterns between scales
    const crossScaleSimilarity = [];
    for (let si = 0; si < scales.length - 1; si++) {
      const s1 = scales[si];
      const s2 = scales[si + 1];
      const compareLen = Math.min(minMotifLen * 2, s2.data.length);

      if (s2.data.length < compareLen) continue;

      // Compare the overall shape at each scale
      // Resample s1 to match s2 length, then compute correlation
      const resampledLen = Math.min(s1.data.length, s2.data.length * 2);
      const resampled = [];
      for (let i = 0; i < s2.data.length; i++) {
        const srcIdx = Math.floor(i * resampledLen / s2.data.length);
        resampled.push(s1.data[Math.min(srcIdx, s1.data.length - 1)]);
      }

      // Pearson correlation
      const len = Math.min(resampled.length, s2.data.length);
      const m1 = resampled.slice(0, len).reduce((s, v) => s + v, 0) / len;
      const m2 = s2.data.slice(0, len).reduce((s, v) => s + v, 0) / len;
      let num = 0, den1 = 0, den2 = 0;
      for (let i = 0; i < len; i++) {
        num += (resampled[i] - m1) * (s2.data[i] - m2);
        den1 += (resampled[i] - m1) ** 2;
        den2 += (s2.data[i] - m2) ** 2;
      }
      const corr = den1 > 0 && den2 > 0 ? num / Math.sqrt(den1 * den2) : 0;

      crossScaleSimilarity.push({
        scale1: s1.scale,
        scale2: s2.scale,
        correlation: r(corr),
        isSelfSimilar: Math.abs(corr) > 0.7,
      });
    }

    const selfSimilarCount = crossScaleSimilarity.filter(c => c.isSelfSimilar).length;
    const selfSimilarityScore = crossScaleSimilarity.length > 0
      ? selfSimilarCount / crossScaleSimilarity.length
      : 0;

    // Scale-invariant features: statistics that are preserved across scales
    const scaleStats = scales.map(s => {
      const d = s.data;
      const m = d.reduce((sum, v) => sum + v, 0) / d.length;
      const variance = d.reduce((sum, v) => sum + (v - m) ** 2, 0) / d.length;
      const skewness = variance > 0
        ? d.reduce((sum, v) => sum + ((v - m) / Math.sqrt(variance)) ** 3, 0) / d.length
        : 0;
      return {
        scale: s.scale,
        length: d.length,
        mean: r(m),
        variance: r(variance),
        skewness: r(skewness),
      };
    });

    return {
      ok: true,
      result: {
        seriesLength: n,
        scalesAnalyzed: scales.length,
        motifs: motifs.sort((a, b) => a.distance - b.distance).slice(0, 10),
        motifCount: motifs.length,
        crossScaleSimilarity,
        selfSimilarityScore: r(selfSimilarityScore),
        selfSimilarityLabel: selfSimilarityScore > 0.7 ? "strongly self-similar" : selfSimilarityScore > 0.4 ? "moderately self-similar" : "weakly self-similar",
        scaleStatistics: scaleStats,
        bestMotif: motifs.length > 0 ? motifs.sort((a, b) => a.distance - b.distance)[0] : null,
      },
    };
  });

  /**
   * complexityMeasure
   * Measure structural complexity — Lempel-Ziv complexity, Shannon entropy
   * at multiple scales, and multi-scale entropy.
   * artifact.data.values = number[] or artifact.data.sequence = string
   * params.symbolize (number of bins for numeric data, default: 8)
   * params.maxScale (for multi-scale entropy, default: 10)
   */
  registerLensAction("fractal", "complexityMeasure", (ctx, artifact, params) => {
    const rawValues = artifact.data?.values || [];
    const rawSequence = artifact.data?.sequence || "";
    const numBins = params.symbolize || 8;
    const maxScale = params.maxScale || 10;
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // Convert input to symbol sequence
    let symbols;
    if (rawSequence.length > 0) {
      symbols = rawSequence.split("");
    } else if (rawValues.length > 0) {
      const vals = rawValues.map(Number).filter(v => !isNaN(v));
      if (vals.length === 0) return { ok: false, error: "No valid numeric data." };

      // Bin the values into symbols
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      symbols = vals.map(v => {
        const bin = Math.min(numBins - 1, Math.floor((v - min) / range * numBins));
        return String(bin);
      });
    } else {
      return { ok: false, error: "Provide values (numeric array) or sequence (string)." };
    }

    const n = symbols.length;
    if (n < 4) return { ok: false, error: "Need at least 4 data points." };

    // --- Lempel-Ziv complexity (LZ76) ---
    // Count the number of distinct substrings in sequential parsing
    let lzComplexity = 0;
    let i = 0;
    const dictionary = new Set();
    let currentWord = "";

    while (i < n) {
      currentWord += symbols[i];
      if (!dictionary.has(currentWord)) {
        dictionary.add(currentWord);
        lzComplexity++;
        currentWord = "";
      }
      i++;
    }
    if (currentWord.length > 0) lzComplexity++;

    // Normalized LZ complexity: C(n) / (n / log_b(n))
    const uniqueSymbols = new Set(symbols);
    const b = uniqueSymbols.size || 2;
    const logBn = Math.log(n) / Math.log(b);
    const normalizedLZ = logBn > 0 ? lzComplexity / (n / logBn) : 0;

    // --- Shannon entropy ---
    function shannonEntropy(seq) {
      const freq = {};
      for (const s of seq) freq[s] = (freq[s] || 0) + 1;
      let entropy = 0;
      for (const count of Object.values(freq)) {
        const p = count / seq.length;
        if (p > 0) entropy -= p * Math.log2(p);
      }
      return entropy;
    }

    const baseEntropy = shannonEntropy(symbols);
    const maxEntropy = Math.log2(uniqueSymbols.size || 1);
    const normalizedEntropy = maxEntropy > 0 ? baseEntropy / maxEntropy : 0;

    // --- Multi-scale entropy (coarse-graining) ---
    // For numeric data, use sample entropy at multiple scales
    const numericValues = rawValues.length > 0
      ? rawValues.map(Number).filter(v => !isNaN(v))
      : symbols.map(Number).filter(v => !isNaN(v));

    const multiScaleEntropy = [];

    if (numericValues.length >= 10) {
      // Sample entropy computation
      function sampleEntropy(data, m, tolerance) {
        const N = data.length;
        if (N < m + 1) return 0;

        function countMatches(templateLen) {
          let count = 0;
          for (let i = 0; i < N - templateLen; i++) {
            for (let j = i + 1; j < N - templateLen; j++) {
              let match = true;
              for (let k = 0; k < templateLen; k++) {
                if (Math.abs(data[i + k] - data[j + k]) > tolerance) {
                  match = false;
                  break;
                }
              }
              if (match) count++;
            }
          }
          return count;
        }

        const A = countMatches(m + 1);
        const B = countMatches(m);
        return B > 0 ? -Math.log(A / B) : 0;
      }

      // Standard deviation for tolerance
      const vMean = numericValues.reduce((s, v) => s + v, 0) / numericValues.length;
      const vStd = Math.sqrt(numericValues.reduce((s, v) => s + (v - vMean) ** 2, 0) / numericValues.length) || 1;
      const tolerance = 0.2 * vStd;
      const templateLen = 2;

      for (let scale = 1; scale <= Math.min(maxScale, Math.floor(numericValues.length / 10)); scale++) {
        // Coarse-grain: average consecutive scale-length segments
        const coarsened = [];
        for (let i = 0; i <= numericValues.length - scale; i += scale) {
          const seg = numericValues.slice(i, i + scale);
          coarsened.push(seg.reduce((s, v) => s + v, 0) / scale);
        }

        if (coarsened.length >= templateLen + 2) {
          const se = sampleEntropy(coarsened, templateLen, tolerance);
          multiScaleEntropy.push({ scale, sampleEntropy: r(se), coarsenedLength: coarsened.length });
        }
      }
    }

    // Entropy at multiple block sizes (Shannon)
    const blockEntropies = [];
    for (let blockSize = 1; blockSize <= Math.min(5, Math.floor(n / 4)); blockSize++) {
      const blocks = [];
      for (let i = 0; i <= n - blockSize; i++) {
        blocks.push(symbols.slice(i, i + blockSize).join(""));
      }
      const entropy = shannonEntropy(blocks);
      const entropyRate = blockSize > 1 ? entropy - blockEntropies[blockEntropies.length - 1]?.entropy : entropy;
      blockEntropies.push({ blockSize, entropy: r(entropy), entropyRate: r(entropyRate) });
    }

    // Complexity classification
    let complexityLabel;
    if (normalizedLZ > 0.9 && normalizedEntropy > 0.9) complexityLabel = "random/maximum complexity";
    else if (normalizedLZ > 0.5) complexityLabel = "complex/structured";
    else if (normalizedLZ > 0.2) complexityLabel = "moderately complex";
    else complexityLabel = "low complexity/highly regular";

    return {
      ok: true,
      result: {
        sequenceLength: n,
        uniqueSymbols: uniqueSymbols.size,
        lempelZiv: {
          complexity: lzComplexity,
          normalized: r(normalizedLZ),
          dictionarySize: dictionary.size,
        },
        shannonEntropy: {
          value: r(baseEntropy),
          maxPossible: r(maxEntropy),
          normalized: r(normalizedEntropy),
        },
        blockEntropies,
        multiScaleEntropy: multiScaleEntropy.length > 0 ? multiScaleEntropy : null,
        complexityLabel,
        compositeScore: r((normalizedLZ + normalizedEntropy) / 2),
      },
    };
  });
}
