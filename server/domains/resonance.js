// server/domains/resonance.js
// Domain actions for content resonance/impact: engagement scoring,
// audience-content alignment, and impact prediction.

export default function registerResonanceActions(registerLensAction) {
  /**
   * engagementScore
   * Compute content engagement score — view-to-interaction ratio, time-on-content,
   * return rate, and viral coefficient (k-factor).
   * artifact.data.content = { views, likes?, comments?, shares?, saves?, avgTimeOnContent?, totalVisitors?, returningVisitors?, referrals? }
   * artifact.data.contentHistory (optional) = [{ date, views, interactions }] for trend
   */
  registerLensAction("resonance", "engagementScore", (ctx, artifact, params) => {
    const content = artifact.data?.content || {};
    const history = artifact.data?.contentHistory || [];

    const views = parseInt(content.views) || 0;
    if (views === 0) {
      return { ok: true, result: { message: "No view data available.", engagementScore: 0 } };
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    const likes = parseInt(content.likes) || 0;
    const comments = parseInt(content.comments) || 0;
    const shares = parseInt(content.shares) || 0;
    const saves = parseInt(content.saves) || 0;
    const avgTimeOnContent = parseFloat(content.avgTimeOnContent) || 0;
    const totalVisitors = parseInt(content.totalVisitors) || views;
    const returningVisitors = parseInt(content.returningVisitors) || 0;
    const referrals = parseInt(content.referrals) || 0;

    // --- Interaction metrics ---
    const totalInteractions = likes + comments + shares + saves;
    const interactionRate = views > 0 ? totalInteractions / views : 0;

    // Weighted interaction score (shares and saves weighted higher)
    const weightedInteractions = likes * 1 + comments * 2 + shares * 3 + saves * 2.5;
    const weightedInteractionRate = views > 0 ? weightedInteractions / views : 0;

    // --- Time-on-content score (normalize: assume target is 3 minutes = 180s) ---
    const timeScore = avgTimeOnContent > 0
      ? Math.min(1, avgTimeOnContent / 180)
      : 0;

    // --- Return rate ---
    const returnRate = totalVisitors > 0 ? returningVisitors / totalVisitors : 0;

    // --- Viral coefficient (k-factor) ---
    // k = shares * conversion_rate
    // Approximate conversion rate from referrals/shares
    const conversionRate = shares > 0 ? Math.min(1, referrals / shares) : 0;
    const kFactor = shares > 0 ? (shares / views) * conversionRate * views / totalVisitors : 0;
    // Simplified: k = invitations * conversion = (shares/views) * (referrals/shares)
    const kFactorSimple = views > 0 ? referrals / views : 0;

    const isViral = kFactorSimple > 1;

    // --- Composite engagement score (0-100) ---
    const weights = {
      interactionRate: 0.30,
      timeScore: 0.25,
      returnRate: 0.20,
      viralCoeff: 0.15,
      volumeBonus: 0.10,
    };

    // Volume bonus: logarithmic scaling of view count
    const volumeBonus = Math.min(1, Math.log10(Math.max(1, views)) / 6); // normalizes to 1M views = 1.0

    const engagementScore = (
      Math.min(1, weightedInteractionRate * 10) * weights.interactionRate +
      timeScore * weights.timeScore +
      returnRate * weights.returnRate +
      Math.min(1, kFactorSimple) * weights.viralCoeff +
      volumeBonus * weights.volumeBonus
    ) * 100;

    // --- Engagement trend (if history available) ---
    let trend = null;
    if (history.length >= 3) {
      const rates = history.map(h => {
        const v = parseInt(h.views) || 1;
        const inter = parseInt(h.interactions) || 0;
        return inter / v;
      });
      const meanRate = rates.reduce((s, v) => s + v, 0) / rates.length;
      const xs = rates.map((_, i) => i);
      const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
      let ssXY = 0, ssXX = 0;
      for (let i = 0; i < xs.length; i++) {
        ssXY += (xs[i] - meanX) * (rates[i] - meanRate);
        ssXX += (xs[i] - meanX) * (xs[i] - meanX);
      }
      const slope = ssXX > 0 ? ssXY / ssXX : 0;
      trend = {
        direction: slope > 0.001 ? "growing" : slope < -0.001 ? "declining" : "stable",
        slope: r(slope),
        dataPoints: history.length,
      };
    }

    // --- Engagement breakdown by type ---
    const breakdown = {
      likes: { count: likes, rate: r(views > 0 ? likes / views : 0) },
      comments: { count: comments, rate: r(views > 0 ? comments / views : 0) },
      shares: { count: shares, rate: r(views > 0 ? shares / views : 0) },
      saves: { count: saves, rate: r(views > 0 ? saves / views : 0) },
    };

    // Engagement quality tier
    const tier = engagementScore >= 80 ? "exceptional" : engagementScore >= 60 ? "strong"
      : engagementScore >= 40 ? "moderate" : engagementScore >= 20 ? "low" : "minimal";

    return {
      ok: true,
      result: {
        engagementScore: r(engagementScore),
        tier,
        views,
        totalInteractions,
        interactionRate: r(interactionRate),
        weightedInteractionRate: r(weightedInteractionRate),
        timeOnContent: { avgSeconds: avgTimeOnContent, score: r(timeScore) },
        returnRate: r(returnRate),
        virality: {
          kFactor: r(kFactorSimple),
          isViral,
          shares,
          referrals,
          conversionRate: r(conversionRate),
        },
        breakdown,
        trend,
      },
    };
  });

  /**
   * audienceMatch
   * Score content-audience alignment — topic relevance, reading level match,
   * format preference, and timing optimization.
   * artifact.data.content = { topics: [string], readingLevel?: number(1-20), format?: string, publishTime?: string, wordCount?: number }
   * artifact.data.audience = { interests: [string], avgReadingLevel?: number, preferredFormats?: [string], activeHours?: [number], demographics?: { ageGroup?, education? } }
   */
  registerLensAction("resonance", "audienceMatch", (ctx, artifact, params) => {
    const content = artifact.data?.content || {};
    const audience = artifact.data?.audience || {};

    const r = (v) => Math.round(v * 10000) / 10000;

    // --- Topic relevance (Jaccard + weighted overlap) ---
    const contentTopics = (content.topics || []).map(t => t.toLowerCase());
    const audienceInterests = (audience.interests || []).map(t => t.toLowerCase());

    let topicRelevance = 0;
    if (contentTopics.length > 0 && audienceInterests.length > 0) {
      const contentSet = new Set(contentTopics);
      const audienceSet = new Set(audienceInterests);
      const intersection = [...contentSet].filter(t => audienceSet.has(t));
      const union = new Set([...contentSet, ...audienceSet]);
      const jaccard = union.size > 0 ? intersection.length / union.size : 0;

      // Also compute overlap from audience perspective (what % of their interests are covered)
      const coverageScore = audienceSet.size > 0 ? intersection.length / audienceSet.size : 0;

      // Partial matching: check for substring overlaps
      let partialMatches = 0;
      for (const ct of contentTopics) {
        for (const ai of audienceInterests) {
          if (ct !== ai && (ct.includes(ai) || ai.includes(ct))) {
            partialMatches++;
          }
        }
      }
      const partialBonus = Math.min(0.2, partialMatches * 0.05);

      topicRelevance = Math.min(1, jaccard * 0.4 + coverageScore * 0.4 + partialBonus + 0.2 * (intersection.length > 0 ? 1 : 0));
    }

    // --- Reading level match ---
    const contentLevel = parseFloat(content.readingLevel) || 10;
    const audienceLevel = parseFloat(audience.avgReadingLevel) || 10;
    const levelDiff = Math.abs(contentLevel - audienceLevel);
    // Perfect match at 0, decays with distance
    const readingLevelMatch = Math.exp(-levelDiff * 0.3);

    // --- Format preference match ---
    const contentFormat = (content.format || "article").toLowerCase();
    const preferredFormats = (audience.preferredFormats || []).map(f => f.toLowerCase());
    let formatMatch = 0.5; // default neutral
    if (preferredFormats.length > 0) {
      if (preferredFormats.includes(contentFormat)) {
        const rank = preferredFormats.indexOf(contentFormat);
        formatMatch = 1 - (rank * 0.1); // slight penalty for lower preference rank
      } else {
        formatMatch = 0.2; // low match if format not in preferences
      }
    }

    // --- Timing optimization ---
    const activeHours = audience.activeHours || [];
    let timingMatch = 0.5; // default
    if (content.publishTime && activeHours.length > 0) {
      const pubDate = new Date(content.publishTime);
      if (!isNaN(pubDate.getTime())) {
        const pubHour = pubDate.getHours();
        if (activeHours.includes(pubHour)) {
          timingMatch = 1.0;
        } else {
          // Find distance to nearest active hour
          const minDist = Math.min(...activeHours.map(h => {
            const diff = Math.abs(h - pubHour);
            return Math.min(diff, 24 - diff);
          }));
          timingMatch = Math.max(0.1, 1 - minDist * 0.15);
        }
      }
    }
    const optimalPublishHour = activeHours.length > 0 ? activeHours[0] : null;

    // --- Word count appropriateness ---
    const wordCount = parseInt(content.wordCount) || 0;
    let lengthScore = 0.5;
    if (wordCount > 0) {
      // Optimal ranges by format
      const optimalRanges = {
        article: [800, 2000],
        blog: [600, 1500],
        report: [2000, 5000],
        tweet: [20, 280],
        video_script: [300, 1000],
        newsletter: [400, 1200],
      };
      const range = optimalRanges[contentFormat] || [500, 2000];
      if (wordCount >= range[0] && wordCount <= range[1]) {
        lengthScore = 1.0;
      } else if (wordCount < range[0]) {
        lengthScore = Math.max(0.2, wordCount / range[0]);
      } else {
        lengthScore = Math.max(0.3, 1 - (wordCount - range[1]) / range[1] * 0.5);
      }
    }

    // --- Composite alignment score ---
    const weights = {
      topicRelevance: 0.35,
      readingLevel: 0.20,
      format: 0.15,
      timing: 0.15,
      length: 0.15,
    };

    const alignmentScore = (
      topicRelevance * weights.topicRelevance +
      readingLevelMatch * weights.readingLevel +
      formatMatch * weights.format +
      timingMatch * weights.timing +
      lengthScore * weights.length
    ) * 100;

    // --- Recommendations ---
    const recommendations = [];
    if (topicRelevance < 0.5) recommendations.push("Content topics have low overlap with audience interests. Consider adjusting topic focus.");
    if (readingLevelMatch < 0.5) recommendations.push(`Reading level mismatch: content is level ${contentLevel}, audience is level ${audienceLevel}. ${contentLevel > audienceLevel ? "Simplify language." : "Content may be too simple."}`);
    if (formatMatch < 0.5) recommendations.push(`Audience prefers ${preferredFormats.join(", ")}. Current format (${contentFormat}) may not resonate.`);
    if (timingMatch < 0.5 && optimalPublishHour !== null) recommendations.push(`Consider publishing at ${optimalPublishHour}:00 when audience is most active.`);
    if (lengthScore < 0.5) recommendations.push(`Word count (${wordCount}) is outside optimal range for ${contentFormat} format.`);

    return {
      ok: true,
      result: {
        alignmentScore: r(alignmentScore),
        quality: alignmentScore >= 80 ? "excellent" : alignmentScore >= 60 ? "good" : alignmentScore >= 40 ? "fair" : "poor",
        components: {
          topicRelevance: { score: r(topicRelevance * 100), weight: weights.topicRelevance, matchedTopics: contentTopics.filter(t => audienceInterests.includes(t)) },
          readingLevel: { score: r(readingLevelMatch * 100), weight: weights.readingLevel, contentLevel, audienceLevel, gap: r(levelDiff) },
          formatMatch: { score: r(formatMatch * 100), weight: weights.format, contentFormat, preferredFormats },
          timing: { score: r(timingMatch * 100), weight: weights.timing, optimalPublishHour },
          contentLength: { score: r(lengthScore * 100), weight: weights.length, wordCount },
        },
        recommendations,
      },
    };
  });

  /**
   * impactPrediction
   * Predict content impact using historical patterns — feature extraction,
   * weighted similarity to past high-performers.
   * artifact.data.newContent = { topics: [string], wordCount?: number, format?: string, readingLevel?: number, hasMedia?: boolean, publishDayOfWeek?: number }
   * artifact.data.historicalContent = [{ topics: [string], wordCount?: number, format?: string, readingLevel?: number, hasMedia?: boolean, publishDayOfWeek?: number, engagementScore: number }]
   * params.k — number of nearest neighbors (default 5)
   */
  registerLensAction("resonance", "impactPrediction", (ctx, artifact, params) => {
    const newContent = artifact.data?.newContent || {};
    const historical = artifact.data?.historicalContent || [];
    const k = Math.min(params.k || 5, historical.length);

    if (historical.length < 2) {
      return { ok: true, result: { message: "Need at least 2 historical content items for prediction." } };
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    // --- Feature extraction ---
    function extractFeatures(item) {
      return {
        wordCount: parseInt(item.wordCount) || 0,
        readingLevel: parseFloat(item.readingLevel) || 10,
        hasMedia: item.hasMedia ? 1 : 0,
        publishDayOfWeek: parseInt(item.publishDayOfWeek) || 0,
        topicCount: (item.topics || []).length,
        format: (item.format || "article").toLowerCase(),
        topics: (item.topics || []).map(t => t.toLowerCase()),
      };
    }

    const newFeatures = extractFeatures(newContent);
    const historicalFeatures = historical.map(h => ({
      features: extractFeatures(h),
      engagementScore: parseFloat(h.engagementScore) || 0,
    }));

    // --- Compute feature statistics for normalization ---
    const numericKeys = ["wordCount", "readingLevel", "topicCount"];
    const stats = {};
    for (const key of numericKeys) {
      const values = historicalFeatures.map(h => h.features[key]);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length) || 1;
      stats[key] = { mean, stdDev };
    }

    // --- Similarity computation (hybrid: numeric + categorical + topic) ---
    function similarity(a, b) {
      // Numeric similarity (normalized Euclidean)
      let numDist = 0;
      for (const key of numericKeys) {
        const na = (a[key] - stats[key].mean) / stats[key].stdDev;
        const nb = (b[key] - stats[key].mean) / stats[key].stdDev;
        numDist += Math.pow(na - nb, 2);
      }
      const numSim = Math.exp(-numDist / (2 * numericKeys.length));

      // Categorical similarity
      const formatSim = a.format === b.format ? 1 : 0;
      const mediaSim = a.hasMedia === b.hasMedia ? 1 : 0;
      const dowDiff = Math.abs(a.publishDayOfWeek - b.publishDayOfWeek);
      const dowSim = 1 - Math.min(dowDiff, 7 - dowDiff) / 3.5;

      // Topic similarity (Jaccard)
      const setA = new Set(a.topics);
      const setB = new Set(b.topics);
      const intersection = [...setA].filter(t => setB.has(t)).length;
      const union = new Set([...setA, ...setB]).size;
      const topicSim = union > 0 ? intersection / union : 0;

      // Weighted combination
      return numSim * 0.25 + formatSim * 0.15 + mediaSim * 0.05 + dowSim * 0.10 + topicSim * 0.45;
    }

    // --- Find k nearest neighbors ---
    const distances = historicalFeatures.map((h, idx) => ({
      idx,
      similarity: similarity(newFeatures, h.features),
      engagementScore: h.engagementScore,
      features: h.features,
    })).sort((a, b) => b.similarity - a.similarity);

    const neighbors = distances.slice(0, k);

    // --- Weighted prediction ---
    const totalWeight = neighbors.reduce((s, n) => s + n.similarity, 0);
    const predictedScore = totalWeight > 0
      ? neighbors.reduce((s, n) => s + n.similarity * n.engagementScore, 0) / totalWeight
      : neighbors.reduce((s, n) => s + n.engagementScore, 0) / k;

    // --- Confidence interval ---
    const neighborScores = neighbors.map(n => n.engagementScore);
    const stdDev = Math.sqrt(
      neighborScores.reduce((s, v) => s + Math.pow(v - predictedScore, 2), 0) / neighborScores.length
    );
    const confidence = {
      predicted: r(predictedScore),
      lower: r(Math.max(0, predictedScore - 1.96 * stdDev)),
      upper: r(Math.min(100, predictedScore + 1.96 * stdDev)),
      stdDev: r(stdDev),
    };

    // --- Feature importance (which features most differentiate high vs low performers) ---
    const medianEngagement = [...historicalFeatures]
      .sort((a, b) => a.engagementScore - b.engagementScore)[Math.floor(historicalFeatures.length / 2)]
      .engagementScore;

    const highPerformers = historicalFeatures.filter(h => h.engagementScore > medianEngagement);
    const lowPerformers = historicalFeatures.filter(h => h.engagementScore <= medianEngagement);

    const featureImportance = {};
    for (const key of numericKeys) {
      const highAvg = highPerformers.length > 0
        ? highPerformers.reduce((s, h) => s + h.features[key], 0) / highPerformers.length : 0;
      const lowAvg = lowPerformers.length > 0
        ? lowPerformers.reduce((s, h) => s + h.features[key], 0) / lowPerformers.length : 0;
      const diff = stats[key].stdDev > 0 ? Math.abs(highAvg - lowAvg) / stats[key].stdDev : 0;
      featureImportance[key] = {
        importance: r(diff),
        highPerformerAvg: r(highAvg),
        lowPerformerAvg: r(lowAvg),
        newContentValue: newFeatures[key],
      };
    }

    // Format importance
    const highFormats = {};
    for (const h of highPerformers) highFormats[h.features.format] = (highFormats[h.features.format] || 0) + 1;
    const bestFormat = Object.entries(highFormats).sort((a, b) => b[1] - a[1])[0];

    // --- Recommendations ---
    const recommendations = [];
    if (bestFormat && bestFormat[0] !== newFeatures.format) {
      recommendations.push(`High-performing content tends to use "${bestFormat[0]}" format.`);
    }
    for (const [key, data] of Object.entries(featureImportance)) {
      if (data.importance > 0.5) {
        const direction = data.highPerformerAvg > data.lowPerformerAvg ? "higher" : "lower";
        if ((direction === "higher" && data.newContentValue < data.highPerformerAvg) ||
            (direction === "lower" && data.newContentValue > data.highPerformerAvg)) {
          recommendations.push(`Consider adjusting ${key}: high performers average ${data.highPerformerAvg}, yours is ${data.newContentValue}.`);
        }
      }
    }

    // Performance tier prediction
    const tier = predictedScore >= 80 ? "exceptional" : predictedScore >= 60 ? "strong"
      : predictedScore >= 40 ? "moderate" : predictedScore >= 20 ? "low" : "minimal";

    return {
      ok: true,
      result: {
        prediction: confidence,
        predictedTier: tier,
        neighbors: neighbors.map(n => ({
          similarity: r(n.similarity),
          engagementScore: n.engagementScore,
          topics: n.features.topics,
          format: n.features.format,
        })),
        featureImportance,
        bestPerformingFormat: bestFormat ? bestFormat[0] : null,
        historicalBaseline: {
          mean: r(historicalFeatures.reduce((s, h) => s + h.engagementScore, 0) / historicalFeatures.length),
          median: r(medianEngagement),
          max: r(Math.max(...historicalFeatures.map(h => h.engagementScore))),
        },
        recommendations,
        dataQuality: {
          historicalItems: historical.length,
          neighborsUsed: k,
          avgNeighborSimilarity: r(neighbors.reduce((s, n) => s + n.similarity, 0) / k),
        },
      },
    };
  });
}
