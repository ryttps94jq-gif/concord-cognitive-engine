// server/domains/ml.js
export default function registerMlActions(registerLensAction) {
  registerLensAction("ml", "modelEvaluate", (ctx, artifact, _params) => {
    const predictions = artifact.data?.predictions || [];
    const actuals = artifact.data?.actuals || artifact.data?.labels || [];
    if (predictions.length === 0 || actuals.length === 0) return { ok: true, result: { message: "Provide predictions and actuals arrays to evaluate." } };
    const n = Math.min(predictions.length, actuals.length);
    const classes = [...new Set(actuals.slice(0, n))];
    const isClassification = classes.length <= 20 && classes.every(c => typeof c === "string" || Number.isInteger(c));
    if (isClassification) {
      let correct = 0;
      const matrix = {};
      classes.forEach(c => { matrix[c] = {}; classes.forEach(c2 => { matrix[c][c2] = 0; }); });
      for (let i = 0; i < n; i++) {
        if (predictions[i] === actuals[i]) correct++;
        if (matrix[actuals[i]] && matrix[actuals[i]][predictions[i]] !== undefined) matrix[actuals[i]][predictions[i]]++;
      }
      const accuracy = Math.round((correct / n) * 1000) / 10;
      const perClass = classes.map(cls => {
        const tp = matrix[cls]?.[cls] || 0;
        const fp = classes.reduce((s, c) => s + (c !== cls ? (matrix[c]?.[cls] || 0) : 0), 0);
        const fn = classes.reduce((s, c) => s + (c !== cls ? (matrix[cls]?.[c] || 0) : 0), 0);
        const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 10 : 0;
        const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 10 : 0;
        const f1 = precision + recall > 0 ? Math.round((2 * precision * recall / (precision + recall)) * 10) / 10 : 0;
        return { class: cls, precision, recall, f1, support: tp + fn };
      });
      const avgF1 = Math.round((perClass.reduce((s, c) => s + c.f1, 0) / perClass.length) * 10) / 10;
      return { ok: true, result: { type: "classification", samples: n, accuracy, avgF1, perClass, confusionMatrix: matrix } };
    }
    const preds = predictions.slice(0, n).map(Number);
    const acts = actuals.slice(0, n).map(Number);
    const mse = preds.reduce((s, p, i) => s + Math.pow(p - acts[i], 2), 0) / n;
    const mae = preds.reduce((s, p, i) => s + Math.abs(p - acts[i]), 0) / n;
    const actMean = acts.reduce((s, a) => s + a, 0) / n;
    const ssTot = acts.reduce((s, a) => s + Math.pow(a - actMean, 2), 0);
    const ssRes = preds.reduce((s, p, i) => s + Math.pow(acts[i] - p, 2), 0);
    const r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : 0;
    return { ok: true, result: { type: "regression", samples: n, mse: Math.round(mse * 1000) / 1000, rmse: Math.round(Math.sqrt(mse) * 1000) / 1000, mae: Math.round(mae * 1000) / 1000, r2 } };
  });

  registerLensAction("ml", "featureImportance", (ctx, artifact, _params) => {
    const data = artifact.data?.features || artifact.data?.dataset || [];
    const target = artifact.data?.target || artifact.data?.targetField || null;
    if (data.length < 3) return { ok: true, result: { message: "Provide 3+ data rows with features to analyze." } };
    const fields = Object.keys(data[0]).filter(k => k !== target);
    const numericFields = fields.filter(f => data.every(r => !isNaN(parseFloat(r[f]))));
    const ranked = numericFields.map(field => {
      const values = data.map(r => parseFloat(r[field]) || 0);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      let correlation = 0;
      if (target && data[0][target] !== undefined) {
        const targets = data.map(r => parseFloat(r[target]) || 0);
        const tMean = targets.reduce((s, v) => s + v, 0) / targets.length;
        const cov = values.reduce((s, v, i) => s + (v - mean) * (targets[i] - tMean), 0) / values.length;
        const tStd = Math.sqrt(targets.reduce((s, v) => s + Math.pow(v - tMean, 2), 0) / values.length);
        correlation = stdDev > 0 && tStd > 0 ? Math.round((cov / (stdDev * tStd)) * 1000) / 1000 : 0;
      }
      return { feature: field, variance: Math.round(variance * 1000) / 1000, stdDev: Math.round(stdDev * 1000) / 1000, correlation, absCorrelation: Math.abs(correlation), importance: Math.round((Math.abs(correlation) * 0.7 + Math.min(1, variance) * 0.3) * 100) };
    }).sort((a, b) => b.importance - a.importance);
    return { ok: true, result: { totalFeatures: fields.length, numericFeatures: numericFields.length, targetField: target, rankings: ranked, topFeatures: ranked.slice(0, 5).map(r => r.feature) } };
  });

  registerLensAction("ml", "datasetProfile", (ctx, artifact, _params) => {
    const data = artifact.data?.dataset || artifact.data?.rows || [];
    if (data.length === 0) return { ok: true, result: { message: "Provide dataset rows to profile." } };
    const fields = Object.keys(data[0]);
    const profile = fields.map(field => {
      const values = data.map(r => r[field]);
      const nullCount = values.filter(v => v === null || v === undefined || v === "").length;
      const unique = new Set(values.filter(v => v !== null && v !== undefined && v !== ""));
      const numeric = values.filter(v => !isNaN(parseFloat(v)) && v !== null && v !== "");
      const isNumeric = numeric.length > values.length * 0.8;
      const result = { field, type: isNumeric ? "numeric" : unique.size <= 10 ? "categorical" : "text", nullCount, nullRate: Math.round((nullCount / values.length) * 100), cardinality: unique.size };
      if (isNumeric) {
        const nums = numeric.map(Number).sort((a, b) => a - b);
        const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
        const q1 = nums[Math.floor(nums.length * 0.25)];
        const median = nums[Math.floor(nums.length * 0.5)];
        const q3 = nums[Math.floor(nums.length * 0.75)];
        const iqr = q3 - q1;
        const outliers = nums.filter(n => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr).length;
        result.stats = { min: nums[0], max: nums[nums.length - 1], mean: Math.round(mean * 100) / 100, median, q1, q3, outliers };
      }
      return result;
    });
    return { ok: true, result: { rows: data.length, columns: fields.length, profile, qualityScore: Math.round((1 - profile.reduce((s, p) => s + p.nullRate, 0) / (profile.length * 100)) * 100) } };
  });

  registerLensAction("ml", "hyperparameterSuggest", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const modelType = (data.model || data.modelType || "neural-network").toLowerCase();
    const datasetSize = parseInt(data.datasetSize || data.rows) || 1000;
    const featureCount = parseInt(data.features || data.featureCount) || 10;
    const taskType = (data.task || "classification").toLowerCase();
    const suggestions = {};
    if (modelType.includes("neural") || modelType.includes("nn") || modelType.includes("deep")) {
      const layers = datasetSize > 10000 ? 4 : datasetSize > 1000 ? 3 : 2;
      suggestions.architecture = { hiddenLayers: layers, unitsPerLayer: Math.min(512, Math.max(32, Math.round(featureCount * 4))), activation: "relu", outputActivation: taskType === "regression" ? "linear" : "softmax" };
      suggestions.learningRate = datasetSize > 50000 ? 0.001 : datasetSize > 5000 ? 0.01 : 0.1;
      suggestions.batchSize = Math.min(256, Math.max(16, Math.pow(2, Math.round(Math.log2(datasetSize / 50)))));
      suggestions.epochs = datasetSize > 50000 ? 50 : datasetSize > 5000 ? 100 : 200;
      suggestions.dropout = featureCount > 50 ? 0.5 : 0.3;
      suggestions.optimizer = "adam";
      suggestions.regularization = { l2: featureCount > 100 ? 0.01 : 0.001 };
    } else if (modelType.includes("tree") || modelType.includes("forest") || modelType.includes("xgb") || modelType.includes("gradient")) {
      suggestions.nEstimators = datasetSize > 10000 ? 500 : 200;
      suggestions.maxDepth = Math.min(20, Math.max(3, Math.round(Math.log2(datasetSize))));
      suggestions.minSamplesSplit = Math.max(2, Math.round(datasetSize * 0.01));
      suggestions.learningRate = modelType.includes("xgb") || modelType.includes("gradient") ? 0.1 : null;
      suggestions.subsample = 0.8;
      suggestions.maxFeatures = modelType.includes("forest") ? Math.round(Math.sqrt(featureCount)) : featureCount;
    } else {
      suggestions.regularization = featureCount > datasetSize / 10 ? "l1" : "l2";
      suggestions.alpha = 0.01;
      suggestions.maxIterations = 1000;
    }
    suggestions.crossValidation = datasetSize < 1000 ? 10 : 5;
    suggestions.testSplit = 0.2;
    return { ok: true, result: { modelType, taskType, datasetSize, featureCount, suggestions, notes: [`Dataset ratio: ${Math.round(datasetSize / featureCount)}:1 samples per feature`, datasetSize / featureCount < 10 ? "Warning: Low sample-to-feature ratio — consider dimensionality reduction" : "Adequate sample-to-feature ratio"] } };
  });
}
