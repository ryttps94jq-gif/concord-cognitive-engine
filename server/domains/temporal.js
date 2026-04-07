// server/domains/temporal.js
// Domain actions for time-series and temporal reasoning: decomposition,
// anomaly detection, and forecasting with exponential smoothing.

export default function registerTemporalActions(registerLensAction) {
  /**
   * timeSeriesDecompose
   * Decompose time series into trend, seasonality, and residual components.
   * artifact.data.series = [{ timestamp?, value }] or artifact.data.values = number[]
   * params.period (seasonal period, auto-detected if omitted)
   */
  registerLensAction("temporal", "timeSeriesDecompose", (ctx, artifact, params) => {
    const raw = artifact.data?.values || (artifact.data?.series || []).map(s => s.value);
    const values = raw.map(Number).filter(v => !isNaN(v));
    if (values.length < 4) return { ok: false, error: "Need at least 4 data points." };

    const n = values.length;
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // --- Trend extraction via centered moving average ---
    // Auto-detect period via autocorrelation if not specified
    let period = params.period || null;
    if (!period) {
      const mean = values.reduce((s, v) => s + v, 0) / n;
      const maxLag = Math.min(Math.floor(n / 2), 100);
      let bestLag = 1;
      let bestAcf = -Infinity;
      const denom = values.reduce((s, v) => s + (v - mean) ** 2, 0);

      for (let lag = 2; lag <= maxLag; lag++) {
        let num = 0;
        for (let i = 0; i < n - lag; i++) {
          num += (values[i] - mean) * (values[i + lag] - mean);
        }
        const acf = denom > 0 ? num / denom : 0;
        // Find first significant peak after lag=1
        if (lag > 1 && acf > bestAcf && acf > 0.2) {
          // Check it's a local peak
          let numPrev = 0;
          for (let i = 0; i < n - (lag - 1); i++) {
            numPrev += (values[i] - mean) * (values[i + lag - 1] - mean);
          }
          const prevAcf = denom > 0 ? numPrev / denom : 0;
          if (acf > prevAcf) {
            bestAcf = acf;
            bestLag = lag;
          }
        }
      }
      period = bestLag;
    }
    period = Math.max(2, Math.min(period, Math.floor(n / 2)));

    // Centered moving average for trend
    const trend = new Array(n).fill(null);
    const halfWin = Math.floor(period / 2);
    for (let i = halfWin; i < n - halfWin; i++) {
      let sum = 0;
      let count = 0;
      for (let j = i - halfWin; j <= i + halfWin; j++) {
        if (j >= 0 && j < n) { sum += values[j]; count++; }
      }
      trend[i] = sum / count;
    }
    // Extend trend to edges using linear extrapolation
    const firstTrend = trend.findIndex(v => v !== null);
    const lastTrend = trend.length - 1 - [...trend].reverse().findIndex(v => v !== null);
    if (firstTrend > 0 && firstTrend < lastTrend) {
      const slope = (trend[firstTrend + 1] - trend[firstTrend]);
      for (let i = firstTrend - 1; i >= 0; i--) trend[i] = trend[i + 1] - slope;
    }
    if (lastTrend < n - 1 && lastTrend > firstTrend) {
      const slope = (trend[lastTrend] - trend[lastTrend - 1]);
      for (let i = lastTrend + 1; i < n; i++) trend[i] = trend[i - 1] + slope;
    }

    // --- Seasonality: average of detrended values at each position in the period ---
    const detrended = values.map((v, i) => v - (trend[i] ?? v));
    const seasonalPattern = new Array(period).fill(0);
    const seasonalCounts = new Array(period).fill(0);
    for (let i = 0; i < n; i++) {
      const pos = i % period;
      seasonalPattern[pos] += detrended[i];
      seasonalCounts[pos]++;
    }
    for (let i = 0; i < period; i++) {
      seasonalPattern[i] = seasonalCounts[i] > 0 ? seasonalPattern[i] / seasonalCounts[i] : 0;
    }
    // Center seasonal pattern (subtract mean)
    const seasonalMean = seasonalPattern.reduce((s, v) => s + v, 0) / period;
    for (let i = 0; i < period; i++) seasonalPattern[i] -= seasonalMean;

    // Full seasonal component
    const seasonal = values.map((_, i) => seasonalPattern[i % period]);

    // --- Residual ---
    const residual = values.map((v, i) => v - (trend[i] ?? v) - seasonal[i]);

    // Strength of components
    const varTotal = (() => {
      const m = values.reduce((s, v) => s + v, 0) / n;
      return values.reduce((s, v) => s + (v - m) ** 2, 0) / n;
    })();
    const varTrend = (() => {
      const validTrend = trend.filter(v => v !== null);
      if (validTrend.length === 0) return 0;
      const m = validTrend.reduce((s, v) => s + v, 0) / validTrend.length;
      return validTrend.reduce((s, v) => s + (v - m) ** 2, 0) / validTrend.length;
    })();
    const varSeasonal = seasonal.reduce((s, v) => s + v * v, 0) / n;
    const varResidual = residual.reduce((s, v) => s + v * v, 0) / n;

    const trendStrength = varTotal > 0 ? Math.max(0, 1 - varResidual / (varTotal - varSeasonal || 1)) : 0;
    const seasonalStrength = varTotal > 0 ? Math.max(0, 1 - varResidual / (varTotal - varTrend || 1)) : 0;

    return {
      ok: true,
      result: {
        n,
        detectedPeriod: period,
        trend: trend.map(v => r(v ?? 0)),
        seasonalPattern: seasonalPattern.map(r),
        seasonal: seasonal.map(r),
        residual: residual.map(r),
        strength: {
          trend: r(Math.min(1, Math.max(0, trendStrength))),
          seasonal: r(Math.min(1, Math.max(0, seasonalStrength))),
          trendLabel: trendStrength > 0.7 ? "strong" : trendStrength > 0.3 ? "moderate" : "weak",
          seasonalLabel: seasonalStrength > 0.7 ? "strong" : seasonalStrength > 0.3 ? "moderate" : "weak",
        },
        variance: { total: r(varTotal), trend: r(varTrend), seasonal: r(varSeasonal), residual: r(varResidual) },
      },
    };
  });

  /**
   * anomalyDetection
   * Detect temporal anomalies using Z-score with sliding window and IQR method.
   * artifact.data.values = number[] or artifact.data.series = [{ timestamp?, value }]
   * params.windowSize (default: auto), params.threshold (z-score threshold, default: 2.5)
   */
  registerLensAction("temporal", "anomalyDetection", (ctx, artifact, params) => {
    const raw = artifact.data?.values || (artifact.data?.series || []).map(s => s.value);
    const timestamps = artifact.data?.series?.map(s => s.timestamp) || null;
    const values = raw.map(Number).filter(v => !isNaN(v));
    if (values.length < 5) return { ok: false, error: "Need at least 5 data points." };

    const n = values.length;
    const threshold = params.threshold || 2.5;
    const windowSize = params.windowSize || Math.max(5, Math.floor(n / 10));
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // --- Method 1: Z-score with sliding window ---
    const zScoreAnomalies = [];
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(n, i + Math.ceil(windowSize / 2));
      const window = values.slice(start, end);
      const wMean = window.reduce((s, v) => s + v, 0) / window.length;
      const wStd = Math.sqrt(window.reduce((s, v) => s + (v - wMean) ** 2, 0) / window.length);
      const zScore = wStd > 0 ? Math.abs(values[i] - wMean) / wStd : 0;
      if (zScore > threshold) {
        zScoreAnomalies.push({
          index: i,
          value: values[i],
          zScore: r(zScore),
          windowMean: r(wMean),
          windowStd: r(wStd),
          direction: values[i] > wMean ? "above" : "below",
          timestamp: timestamps ? timestamps[i] : undefined,
        });
      }
    }

    // --- Method 2: IQR method (global) ---
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const extremeLower = q1 - 3 * iqr;
    const extremeUpper = q3 + 3 * iqr;

    const iqrAnomalies = [];
    for (let i = 0; i < n; i++) {
      if (values[i] < lowerFence || values[i] > upperFence) {
        iqrAnomalies.push({
          index: i,
          value: values[i],
          severity: values[i] < extremeLower || values[i] > extremeUpper ? "extreme" : "mild",
          direction: values[i] > upperFence ? "above" : "below",
          timestamp: timestamps ? timestamps[i] : undefined,
        });
      }
    }

    // --- Consecutive anomaly clustering ---
    // Group anomalies that occur in consecutive runs
    const allAnomalyIndices = new Set([
      ...zScoreAnomalies.map(a => a.index),
      ...iqrAnomalies.map(a => a.index),
    ]);
    const sortedIndices = [...allAnomalyIndices].sort((a, b) => a - b);
    const clusters = [];
    if (sortedIndices.length > 0) {
      let clusterStart = sortedIndices[0];
      let clusterEnd = sortedIndices[0];
      for (let i = 1; i < sortedIndices.length; i++) {
        if (sortedIndices[i] - sortedIndices[i - 1] <= 2) {
          clusterEnd = sortedIndices[i];
        } else {
          clusters.push({ startIndex: clusterStart, endIndex: clusterEnd, length: clusterEnd - clusterStart + 1 });
          clusterStart = sortedIndices[i];
          clusterEnd = sortedIndices[i];
        }
      }
      clusters.push({ startIndex: clusterStart, endIndex: clusterEnd, length: clusterEnd - clusterStart + 1 });
    }

    // Compute consensus anomalies (detected by both methods)
    const iqrSet = new Set(iqrAnomalies.map(a => a.index));
    const consensus = zScoreAnomalies.filter(a => iqrSet.has(a.index)).map(a => ({
      index: a.index,
      value: a.value,
      zScore: a.zScore,
      timestamp: a.timestamp,
    }));

    // Overall anomaly rate
    const anomalyRate = allAnomalyIndices.size / n;

    return {
      ok: true,
      result: {
        n,
        windowSize,
        zScoreThreshold: threshold,
        zScoreAnomalies: zScoreAnomalies.slice(0, 50),
        zScoreCount: zScoreAnomalies.length,
        iqrAnomalies: iqrAnomalies.slice(0, 50),
        iqrCount: iqrAnomalies.length,
        iqrBounds: { q1: r(q1), q3: r(q3), iqr: r(iqr), lowerFence: r(lowerFence), upperFence: r(upperFence) },
        consensusAnomalies: consensus,
        consensusCount: consensus.length,
        anomalyClusters: clusters,
        longestCluster: clusters.length > 0 ? Math.max(...clusters.map(c => c.length)) : 0,
        anomalyRate: r(anomalyRate),
        anomalyRateLabel: anomalyRate > 0.1 ? "high" : anomalyRate > 0.03 ? "moderate" : "low",
      },
    };
  });

  /**
   * forecast
   * Simple forecasting using exponential smoothing (Holt-Winters additive method).
   * artifact.data.values = number[] or artifact.data.series = [{ value }]
   * params.horizon (number of periods to forecast, default: 10)
   * params.period (seasonal period, default: auto or no seasonality)
   * params.alpha, params.beta, params.gamma (smoothing parameters, default: auto-tuned)
   */
  registerLensAction("temporal", "forecast", (ctx, artifact, params) => {
    const raw = artifact.data?.values || (artifact.data?.series || []).map(s => s.value);
    const values = raw.map(Number).filter(v => !isNaN(v));
    if (values.length < 4) return { ok: false, error: "Need at least 4 data points." };

    const n = values.length;
    const horizon = params.horizon || Math.max(1, Math.floor(n * 0.2));
    const r = (v) => Math.round(v * 1e6) / 1e6;

    // Determine if we should use seasonal model
    const period = params.period || 0;
    const useSeasonal = period >= 2 && n >= period * 2;

    // --- Auto-tune parameters using grid search to minimize MSE ---
    function holtwinters(alpha, beta, gamma) {
      const level = new Array(n).fill(0);
      const trend = new Array(n).fill(0);
      const season = new Array(n + horizon).fill(0);

      if (useSeasonal) {
        // Initialize seasonal indices from first period
        const firstPeriodMean = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
        for (let i = 0; i < period; i++) {
          season[i] = values[i] - firstPeriodMean;
        }
        level[0] = firstPeriodMean;
        trend[0] = (values[period] !== undefined)
          ? (values.slice(period, period * 2).reduce((s, v) => s + v, 0) / period - firstPeriodMean) / period
          : 0;

        for (let i = 1; i < n; i++) {
          level[i] = alpha * (values[i] - season[i % period]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
          trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
          season[i + period] = gamma * (values[i] - level[i]) + (1 - gamma) * season[i % period];
        }
      } else {
        // Holt's double exponential (no seasonality)
        level[0] = values[0];
        trend[0] = values.length > 1 ? values[1] - values[0] : 0;

        for (let i = 1; i < n; i++) {
          level[i] = alpha * values[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
          trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
        }
      }

      // Compute in-sample MSE
      let mse = 0;
      for (let i = 1; i < n; i++) {
        const fitted = useSeasonal
          ? level[i - 1] + trend[i - 1] + season[i % period]
          : level[i - 1] + trend[i - 1];
        mse += (values[i] - fitted) ** 2;
      }
      mse /= (n - 1);

      // Generate forecasts
      const forecasts = [];
      for (let h = 1; h <= horizon; h++) {
        const fc = useSeasonal
          ? level[n - 1] + h * trend[n - 1] + season[(n - 1 + h) % period + (n - 1 + h >= period ? period : 0)]
          : level[n - 1] + h * trend[n - 1];
        forecasts.push(fc);
      }

      return { mse, forecasts, lastLevel: level[n - 1], lastTrend: trend[n - 1] };
    }

    // Grid search for best parameters
    let bestAlpha = params.alpha || 0.3;
    let bestBeta = params.beta || 0.1;
    let bestGamma = params.gamma || 0.1;
    let bestMSE = Infinity;

    if (!params.alpha || !params.beta) {
      const grid = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];
      const gammaGrid = useSeasonal ? [0.05, 0.1, 0.3, 0.5] : [0];
      for (const a of grid) {
        for (const b of grid) {
          for (const g of gammaGrid) {
            const result = holtwinters(a, b, g);
            if (result.mse < bestMSE) {
              bestMSE = result.mse;
              bestAlpha = a;
              bestBeta = b;
              bestGamma = g;
            }
          }
        }
      }
    }

    const best = holtwinters(bestAlpha, bestBeta, bestGamma);

    // Compute prediction intervals (based on residual standard deviation)
    const residualStd = Math.sqrt(best.mse);
    const predictions = best.forecasts.map((fc, i) => {
      const h = i + 1;
      // Prediction interval widens with horizon
      const intervalWidth = residualStd * Math.sqrt(h) * 1.96;
      return {
        step: h,
        forecast: r(fc),
        lower95: r(fc - intervalWidth),
        upper95: r(fc + intervalWidth),
        lower80: r(fc - residualStd * Math.sqrt(h) * 1.28),
        upper80: r(fc + residualStd * Math.sqrt(h) * 1.28),
      };
    });

    // Trend extrapolation summary
    const trendDirection = best.lastTrend > 0.001 ? "increasing" : best.lastTrend < -0.001 ? "decreasing" : "flat";
    const trendPerPeriod = best.lastTrend;

    // Fitted values and MAPE
    const fitted = [];
    let mapeSum = 0;
    let mapeCount = 0;
    const lvl = [values[0]];
    const trn = [values.length > 1 ? values[1] - values[0] : 0];
    for (let i = 1; i < n; i++) {
      lvl[i] = bestAlpha * values[i] + (1 - bestAlpha) * (lvl[i - 1] + trn[i - 1]);
      trn[i] = bestBeta * (lvl[i] - lvl[i - 1]) + (1 - bestBeta) * trn[i - 1];
      const fv = lvl[i - 1] + trn[i - 1];
      fitted.push(r(fv));
      if (values[i] !== 0) {
        mapeSum += Math.abs((values[i] - fv) / values[i]);
        mapeCount++;
      }
    }
    const mape = mapeCount > 0 ? (mapeSum / mapeCount) * 100 : 0;

    return {
      ok: true,
      result: {
        n,
        horizon,
        method: useSeasonal ? "holt-winters-additive" : "holt-double-exponential",
        parameters: { alpha: bestAlpha, beta: bestBeta, gamma: useSeasonal ? bestGamma : null },
        period: useSeasonal ? period : null,
        predictions,
        trend: { direction: trendDirection, perPeriod: r(trendPerPeriod), lastLevel: r(best.lastLevel) },
        accuracy: { mse: r(best.mse), rmse: r(residualStd), mape: r(mape) + "%" },
        accuracyLabel: mape < 5 ? "excellent" : mape < 15 ? "good" : mape < 30 ? "moderate" : "poor",
      },
    };
  });
}
