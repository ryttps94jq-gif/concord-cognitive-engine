// server/domains/metalearning.js
// Domain actions for learning-to-learn: strategy selection via meta-learning,
// transfer analysis between domains, and learner performance profiling.

export default function registerMetalearningActions(registerLensAction) {
  /**
   * strategySelection
   * Select optimal learning strategy based on task features using feature-based
   * meta-learning with k-nearest landmark tasks.
   * artifact.data.taskFeatures = { complexity: number, dimensionality: number, noise: number, sampleSize: number, nonlinearity: number }
   * artifact.data.landmarkTasks = [{ features: {...}, bestStrategy: string, performance: number }]
   * params.k — number of nearest neighbors (default 5)
   */
  registerLensAction("metalearning", "strategySelection", (ctx, artifact, params) => {
    const taskFeatures = artifact.data?.taskFeatures || {};
    const landmarks = artifact.data?.landmarkTasks || [];
    const k = Math.min(params.k || 5, landmarks.length);

    if (landmarks.length === 0) {
      // Use built-in heuristic rules when no landmark data is available
      const complexity = parseFloat(taskFeatures.complexity) || 0.5;
      const dimensionality = parseFloat(taskFeatures.dimensionality) || 0.5;
      const noise = parseFloat(taskFeatures.noise) || 0.5;
      const sampleSize = parseFloat(taskFeatures.sampleSize) || 0.5;
      const nonlinearity = parseFloat(taskFeatures.nonlinearity) || 0.5;

      const scores = {};
      // Decision tree: good for low-dim, handles noise moderately
      scores["decision_tree"] = (1 - dimensionality * 0.5) * (1 - noise * 0.3) * 0.8;
      // Linear model: good for low nonlinearity, scales well
      scores["linear_model"] = (1 - nonlinearity) * (1 - noise * 0.4) * 0.9;
      // Neural network: good for complex, nonlinear, large sample
      scores["neural_network"] = nonlinearity * sampleSize * (1 - noise * 0.2) * complexity;
      // Ensemble: robust across conditions
      scores["ensemble"] = 0.6 + complexity * 0.2 - noise * 0.1;
      // KNN: good for low-dim, small sample
      scores["knn"] = (1 - dimensionality * 0.7) * (1 - noise * 0.5) * 0.75;
      // SVM: good for moderate dimensions, moderate sample
      scores["svm"] = (1 - Math.abs(dimensionality - 0.5)) * (1 - noise * 0.3) * 0.85;

      const ranked = Object.entries(scores)
        .map(([strategy, score]) => ({ strategy, score: Math.round(Math.max(0, score) * 10000) / 10000 }))
        .sort((a, b) => b.score - a.score);

      return {
        ok: true,
        result: {
          method: "heuristic",
          taskFeatures,
          recommended: ranked[0].strategy,
          rankings: ranked,
          note: "No landmark tasks provided; using built-in heuristic rules.",
        },
      };
    }

    // --- Feature-based k-NN meta-learning ---
    const featureKeys = Object.keys(taskFeatures);
    if (featureKeys.length === 0) {
      return { ok: true, result: { message: "No task features provided." } };
    }

    // Compute feature statistics for normalization
    const featureStats = {};
    for (const key of featureKeys) {
      const values = landmarks.map(l => parseFloat(l.features?.[key]) || 0);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
      featureStats[key] = { mean, stdDev: stdDev || 1 };
    }

    // Normalize a feature vector
    function normalize(features) {
      const result = {};
      for (const key of featureKeys) {
        const raw = parseFloat(features[key]) || 0;
        result[key] = (raw - featureStats[key].mean) / featureStats[key].stdDev;
      }
      return result;
    }

    // Euclidean distance
    function distance(a, b) {
      let sum = 0;
      for (const key of featureKeys) {
        sum += Math.pow((a[key] || 0) - (b[key] || 0), 2);
      }
      return Math.sqrt(sum);
    }

    const normalizedTarget = normalize(taskFeatures);

    // Find k nearest neighbors
    const distances = landmarks.map((landmark, idx) => ({
      idx,
      distance: distance(normalizedTarget, normalize(landmark.features || {})),
      strategy: landmark.bestStrategy,
      performance: parseFloat(landmark.performance) || 0,
    })).sort((a, b) => a.distance - b.distance);

    const neighbors = distances.slice(0, k);

    // Weight by inverse distance (with epsilon to avoid division by zero)
    const epsilon = 1e-8;
    const totalWeight = neighbors.reduce((s, n) => s + 1 / (n.distance + epsilon), 0);

    // Aggregate strategy votes with distance weighting and performance weighting
    const strategyScores = {};
    for (const neighbor of neighbors) {
      const weight = (1 / (neighbor.distance + epsilon)) / totalWeight;
      const score = weight * neighbor.performance;
      strategyScores[neighbor.strategy] = (strategyScores[neighbor.strategy] || 0) + score;
    }

    const ranked = Object.entries(strategyScores)
      .map(([strategy, score]) => ({ strategy, score: Math.round(score * 10000) / 10000 }))
      .sort((a, b) => b.score - a.score);

    // Confidence based on neighbor agreement and distance
    const dominantStrategy = ranked[0];
    const neighborAgreement = neighbors.filter(n => n.strategy === dominantStrategy.strategy).length / k;
    const avgDistance = neighbors.reduce((s, n) => s + n.distance, 0) / k;
    const confidence = neighborAgreement * Math.exp(-avgDistance * 0.5);

    return {
      ok: true,
      result: {
        method: "knn_metalearning",
        k,
        taskFeatures,
        recommended: dominantStrategy.strategy,
        confidence: Math.round(confidence * 10000) / 10000,
        rankings: ranked,
        nearestNeighbors: neighbors.map(n => ({
          strategy: n.strategy,
          distance: Math.round(n.distance * 10000) / 10000,
          performance: n.performance,
        })),
        featureNormalization: featureStats,
      },
    };
  });

  /**
   * transferAnalysis
   * Analyze knowledge transfer potential between domains — compute domain
   * similarity, identify transferable components.
   * artifact.data.sourceDomain = { name, concepts: [string], skills: [string], vocabulary: [string], performanceBySkill: { skill: number } }
   * artifact.data.targetDomain = { name, concepts: [string], skills: [string], vocabulary: [string] }
   */
  registerLensAction("metalearning", "transferAnalysis", (ctx, artifact, params) => {
    const source = artifact.data?.sourceDomain || {};
    const target = artifact.data?.targetDomain || {};

    if (!source.name || !target.name) {
      return { ok: true, result: { message: "Both sourceDomain and targetDomain must have a name." } };
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    // --- Jaccard similarity between two sets ---
    function jaccard(setA, setB) {
      const a = new Set(setA.map(s => s.toLowerCase()));
      const b = new Set(setB.map(s => s.toLowerCase()));
      const intersection = [...a].filter(x => b.has(x));
      const union = new Set([...a, ...b]);
      return union.size > 0 ? intersection.length / union.size : 0;
    }

    // --- Concept overlap ---
    const sourceConcepts = source.concepts || [];
    const targetConcepts = target.concepts || [];
    const conceptSimilarity = jaccard(sourceConcepts, targetConcepts);
    const sharedConcepts = sourceConcepts.filter(c =>
      targetConcepts.some(tc => tc.toLowerCase() === c.toLowerCase())
    );

    // --- Skill overlap ---
    const sourceSkills = source.skills || [];
    const targetSkills = target.skills || [];
    const skillSimilarity = jaccard(sourceSkills, targetSkills);
    const sharedSkills = sourceSkills.filter(s =>
      targetSkills.some(ts => ts.toLowerCase() === s.toLowerCase())
    );

    // --- Vocabulary overlap (indicates representational similarity) ---
    const sourceVocab = source.vocabulary || [];
    const targetVocab = target.vocabulary || [];
    const vocabSimilarity = jaccard(sourceVocab, targetVocab);

    // --- Transferable components (shared skills with performance data) ---
    const perfBySkill = source.performanceBySkill || {};
    const transferableComponents = sharedSkills.map(skill => {
      const perf = parseFloat(perfBySkill[skill]) || parseFloat(perfBySkill[skill.toLowerCase()]) || 0;
      return {
        skill,
        sourcePerformance: r(perf),
        estimatedTransferValue: r(perf * skillSimilarity),
        readiness: perf >= 0.8 ? "high" : perf >= 0.5 ? "moderate" : "low",
      };
    }).sort((a, b) => b.estimatedTransferValue - a.estimatedTransferValue);

    // --- Novel components (in target but not source) ---
    const novelConcepts = targetConcepts.filter(c =>
      !sourceConcepts.some(sc => sc.toLowerCase() === c.toLowerCase())
    );
    const novelSkills = targetSkills.filter(s =>
      !sourceSkills.some(ss => ss.toLowerCase() === s.toLowerCase())
    );

    // --- Overall transfer score (weighted composite) ---
    const weights = { concepts: 0.35, skills: 0.4, vocabulary: 0.25 };
    const overallSimilarity = weights.concepts * conceptSimilarity
      + weights.skills * skillSimilarity
      + weights.vocabulary * vocabSimilarity;

    // Transfer distance estimate (1 - similarity, scaled)
    const transferDistance = 1 - overallSimilarity;

    // Estimated effort reduction based on transferable components
    const maxTransfer = transferableComponents.length > 0
      ? transferableComponents.reduce((s, c) => s + c.estimatedTransferValue, 0) / targetSkills.length
      : 0;
    const effortReduction = Math.min(0.8, maxTransfer); // Cap at 80%

    const transferability = overallSimilarity > 0.6 ? "high" : overallSimilarity > 0.3 ? "moderate" : "low";

    return {
      ok: true,
      result: {
        sourceDomain: source.name,
        targetDomain: target.name,
        similarity: {
          overall: r(overallSimilarity),
          concepts: r(conceptSimilarity),
          skills: r(skillSimilarity),
          vocabulary: r(vocabSimilarity),
        },
        transferDistance: r(transferDistance),
        transferability,
        sharedConcepts,
        sharedSkills,
        transferableComponents,
        novelToLearn: {
          concepts: novelConcepts,
          skills: novelSkills,
          totalNovel: novelConcepts.length + novelSkills.length,
        },
        estimatedEffortReduction: r(effortReduction),
        recommendation: transferability === "high"
          ? "Strong transfer potential. Leverage shared skills and focus learning on novel components."
          : transferability === "moderate"
            ? "Partial transfer possible. Some skills carry over but expect significant new learning."
            : "Limited transfer. Treat target domain as largely new learning.",
      },
    };
  });

  /**
   * performanceProfile
   * Build learner performance profile — strengths/weaknesses radar, learning
   * style classification, and optimal difficulty targeting.
   * artifact.data.assessments = [{ skill, difficulty: number(0-1), score: number(0-1), timeSpent?: number, attempts?: number, category? }]
   * params.targetSuccessRate — desired success rate for optimal difficulty (default 0.75)
   */
  registerLensAction("metalearning", "performanceProfile", (ctx, artifact, params) => {
    const assessments = artifact.data?.assessments || [];
    if (assessments.length === 0) {
      return { ok: true, result: { message: "No assessment data to profile." } };
    }

    const targetSuccessRate = params.targetSuccessRate || 0.75;
    const r = (v) => Math.round(v * 10000) / 10000;

    // --- Aggregate by skill ---
    const skillMap = {};
    for (const a of assessments) {
      const skill = a.skill || "unknown";
      if (!skillMap[skill]) skillMap[skill] = { scores: [], difficulties: [], times: [], attempts: [], category: a.category || null };
      skillMap[skill].scores.push(parseFloat(a.score) || 0);
      skillMap[skill].difficulties.push(parseFloat(a.difficulty) || 0.5);
      if (a.timeSpent) skillMap[skill].times.push(parseFloat(a.timeSpent));
      if (a.attempts) skillMap[skill].attempts.push(parseInt(a.attempts));
    }

    // --- Strengths/weaknesses radar ---
    const skillProfiles = Object.entries(skillMap).map(([skill, data]) => {
      const avgScore = data.scores.reduce((s, v) => s + v, 0) / data.scores.length;
      const avgDifficulty = data.difficulties.reduce((s, v) => s + v, 0) / data.difficulties.length;
      const avgTime = data.times.length > 0 ? data.times.reduce((s, v) => s + v, 0) / data.times.length : null;
      const avgAttempts = data.attempts.length > 0 ? data.attempts.reduce((s, v) => s + v, 0) / data.attempts.length : null;

      // Difficulty-adjusted score (normalizing for difficulty)
      const adjustedScore = avgDifficulty > 0 ? avgScore / avgDifficulty : avgScore;

      // Consistency (inverse of standard deviation)
      const scoreStdDev = data.scores.length > 1
        ? Math.sqrt(data.scores.reduce((s, v) => s + Math.pow(v - avgScore, 2), 0) / data.scores.length)
        : 0;
      const consistency = 1 - Math.min(1, scoreStdDev * 2);

      // Efficiency: score / time (if available)
      const efficiency = avgTime && avgTime > 0 ? avgScore / avgTime : null;

      return {
        skill,
        category: data.category,
        avgScore: r(avgScore),
        adjustedScore: r(Math.min(1, adjustedScore)),
        avgDifficulty: r(avgDifficulty),
        consistency: r(consistency),
        efficiency: efficiency !== null ? r(efficiency) : null,
        avgTime: avgTime !== null ? r(avgTime) : null,
        avgAttempts: avgAttempts !== null ? r(avgAttempts) : null,
        assessmentCount: data.scores.length,
      };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Classify strengths and weaknesses
    const overallAvg = skillProfiles.reduce((s, p) => s + p.adjustedScore, 0) / skillProfiles.length;
    const strengths = skillProfiles.filter(p => p.adjustedScore > overallAvg + 0.1);
    const weaknesses = skillProfiles.filter(p => p.adjustedScore < overallAvg - 0.1);

    // --- Learning style classification ---
    // Analyze patterns in time-to-mastery and attempt patterns
    const allTimes = assessments.filter(a => a.timeSpent).map(a => parseFloat(a.timeSpent));
    const allScores = assessments.map(a => parseFloat(a.score) || 0);
    const allAttempts = assessments.filter(a => a.attempts).map(a => parseInt(a.attempts));

    let learningStyle = "balanced";
    if (allTimes.length > 3) {
      const avgTime = allTimes.reduce((s, v) => s + v, 0) / allTimes.length;
      const avgScore = allScores.reduce((s, v) => s + v, 0) / allScores.length;

      // Speed-accuracy tradeoff: correlate time with score
      const meanT = avgTime;
      const meanS = avgScore;
      let ssTS = 0, ssTT = 0;
      const paired = assessments.filter(a => a.timeSpent);
      for (const a of paired) {
        const t = parseFloat(a.timeSpent) || 0;
        const s = parseFloat(a.score) || 0;
        ssTS += (t - meanT) * (s - meanS);
        ssTT += (t - meanT) * (t - meanT);
      }
      const timeScoreCorrelation = ssTT > 0 ? ssTS / Math.sqrt(ssTT * paired.reduce((s, a) => s + Math.pow((parseFloat(a.score) || 0) - meanS, 2), 0)) : 0;

      if (timeScoreCorrelation > 0.3) learningStyle = "reflective"; // More time = better score
      else if (timeScoreCorrelation < -0.3) learningStyle = "intuitive"; // Less time = better score
      else if (avgScore > 0.8 && avgTime < allTimes.sort((a, b) => a - b)[Math.floor(allTimes.length * 0.3)]) learningStyle = "rapid";
      else if (allAttempts.length > 0 && allAttempts.reduce((s, v) => s + v, 0) / allAttempts.length > 2) learningStyle = "persistent";
    }

    // --- Optimal difficulty targeting (zone of proximal development) ---
    // Fit logistic curve: P(success) = 1 / (1 + exp(-a*(difficulty - b)))
    // Find difficulty where P(success) = targetSuccessRate
    const difficultyBins = {};
    for (const a of assessments) {
      const diff = Math.round((parseFloat(a.difficulty) || 0.5) * 10) / 10;
      if (!difficultyBins[diff]) difficultyBins[diff] = { total: 0, successes: 0 };
      difficultyBins[diff].total++;
      if ((parseFloat(a.score) || 0) >= 0.7) difficultyBins[diff].successes++;
    }

    const difficultyPoints = Object.entries(difficultyBins)
      .map(([diff, data]) => ({ difficulty: parseFloat(diff), successRate: data.successes / data.total }))
      .sort((a, b) => a.difficulty - b.difficulty);

    // Simple interpolation to find optimal difficulty
    let optimalDifficulty = 0.5;
    if (difficultyPoints.length >= 2) {
      let bestDist = Infinity;
      for (let i = 0; i < difficultyPoints.length - 1; i++) {
        const p1 = difficultyPoints[i];
        const p2 = difficultyPoints[i + 1];
        if ((p1.successRate >= targetSuccessRate && p2.successRate <= targetSuccessRate) ||
            (p1.successRate <= targetSuccessRate && p2.successRate >= targetSuccessRate)) {
          // Linear interpolation
          const t = Math.abs(p2.successRate - p1.successRate) > 1e-10
            ? (targetSuccessRate - p1.successRate) / (p2.successRate - p1.successRate)
            : 0.5;
          const interp = p1.difficulty + t * (p2.difficulty - p1.difficulty);
          const dist = Math.abs(targetSuccessRate - (p1.successRate + t * (p2.successRate - p1.successRate)));
          if (dist < bestDist) {
            bestDist = dist;
            optimalDifficulty = interp;
          }
        }
      }
      // Fallback: if no crossing found, find closest point
      if (bestDist === Infinity) {
        const closest = difficultyPoints.reduce((best, p) =>
          Math.abs(p.successRate - targetSuccessRate) < Math.abs(best.successRate - targetSuccessRate) ? p : best
        );
        optimalDifficulty = closest.difficulty;
      }
    }

    // --- Category-level aggregation ---
    const categoryMap = {};
    for (const p of skillProfiles) {
      const cat = p.category || "uncategorized";
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(p.adjustedScore);
    }
    const categoryScores = Object.entries(categoryMap)
      .map(([category, scores]) => ({
        category,
        avgScore: r(scores.reduce((s, v) => s + v, 0) / scores.length),
        skillCount: scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return {
      ok: true,
      result: {
        totalAssessments: assessments.length,
        uniqueSkills: skillProfiles.length,
        overallScore: r(overallAvg),
        skillProfiles,
        strengths: strengths.map(s => ({ skill: s.skill, score: s.adjustedScore })),
        weaknesses: weaknesses.map(w => ({ skill: w.skill, score: w.adjustedScore })),
        learningStyle,
        optimalDifficulty: {
          targetSuccessRate,
          recommendedDifficulty: r(Math.max(0, Math.min(1, optimalDifficulty))),
          difficultySuccessCurve: difficultyPoints,
        },
        categoryScores,
      },
    };
  });
}
