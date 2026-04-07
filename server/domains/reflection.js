// server/domains/reflection.js
// Domain actions for self-reflection and journaling: insight extraction,
// growth metrics tracking, and habit pattern analysis.

export default function registerReflectionActions(registerLensAction) {
  /**
   * insightExtraction
   * Extract insights from journal entries — pattern recognition across entries,
   * identify recurring themes with TF-IDF.
   * artifact.data.entries = [{ text, date?, tags?: [string], mood?: string }]
   * params.topN — number of top themes to return (default 10)
   */
  registerLensAction("reflection", "insightExtraction", (ctx, artifact, params) => {
    const entries = artifact.data?.entries || [];
    if (entries.length === 0) {
      return { ok: true, result: { message: "No journal entries to analyze." } };
    }

    const topN = params.topN || 10;
    const r = (v) => Math.round(v * 10000) / 10000;

    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "can", "to", "of", "in", "for", "on",
      "with", "at", "by", "from", "as", "into", "through", "during",
      "and", "but", "or", "not", "so", "yet", "that", "this", "these",
      "those", "it", "its", "he", "she", "they", "them", "his", "her",
      "their", "we", "our", "you", "your", "my", "me", "i", "just",
      "really", "very", "also", "about", "been", "more", "some", "than",
      "then", "what", "when", "where", "how", "who", "which", "all",
      "each", "every", "both", "few", "most", "other", "such", "only",
      "same", "too", "own", "going", "went", "got", "get", "like",
      "know", "think", "feel", "want", "need", "make", "made", "day",
      "today", "much", "still", "even", "back", "after", "before",
    ]);

    function tokenize(text) {
      return (text || "").toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
    }

    // --- TF-IDF computation ---
    const docTokens = entries.map(e => tokenize(e.text));

    // Term frequency per document
    const docTFs = docTokens.map(tokens => {
      const tf = {};
      for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
      return tf;
    });

    // Document frequency
    const df = {};
    for (const tf of docTFs) {
      for (const term of Object.keys(tf)) {
        df[term] = (df[term] || 0) + 1;
      }
    }

    // IDF
    const numDocs = entries.length;
    const idf = {};
    for (const term of Object.keys(df)) {
      idf[term] = Math.log((numDocs + 1) / (df[term] + 1)) + 1;
    }

    // Aggregate TF-IDF scores across all documents
    const globalScores = {};
    for (const tf of docTFs) {
      for (const [term, freq] of Object.entries(tf)) {
        const tfidf = freq * (idf[term] || 1);
        globalScores[term] = (globalScores[term] || 0) + tfidf;
      }
    }

    // --- Top themes ---
    const themes = Object.entries(globalScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([term, score]) => ({
        theme: term,
        tfidfScore: r(score),
        documentFrequency: df[term],
        prevalence: r(df[term] / numDocs),
      }));

    // --- Recurring patterns: bigram analysis ---
    const bigramCounts = {};
    for (const tokens of docTokens) {
      for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
      }
    }
    const topBigrams = Object.entries(bigramCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([bigram, count]) => ({ phrase: bigram, occurrences: count }));

    // --- Cross-entry pattern detection: which themes co-occur ---
    const themeSet = new Set(themes.map(t => t.theme));
    const coOccurrence = {};
    for (const tf of docTFs) {
      const present = Object.keys(tf).filter(t => themeSet.has(t));
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          const pair = [present[i], present[j]].sort().join(" + ");
          coOccurrence[pair] = (coOccurrence[pair] || 0) + 1;
        }
      }
    }
    const topCoOccurrences = Object.entries(coOccurrence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pair, count]) => ({ themes: pair, count }));

    // --- Mood correlation with themes (if mood data available) ---
    const moodThemeCorrelation = [];
    const moodEntries = entries.filter(e => e.mood);
    if (moodEntries.length >= 3) {
      const moodGroups = {};
      for (let i = 0; i < entries.length; i++) {
        const mood = entries[i].mood;
        if (!mood) continue;
        if (!moodGroups[mood]) moodGroups[mood] = [];
        moodGroups[mood].push(docTFs[i]);
      }

      for (const [mood, tfs] of Object.entries(moodGroups)) {
        const moodTermScores = {};
        for (const tf of tfs) {
          for (const [term, freq] of Object.entries(tf)) {
            if (themeSet.has(term)) {
              moodTermScores[term] = (moodTermScores[term] || 0) + freq;
            }
          }
        }
        const topMoodThemes = Object.entries(moodTermScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([term, score]) => term);

        if (topMoodThemes.length > 0) {
          moodThemeCorrelation.push({ mood, entryCount: tfs.length, associatedThemes: topMoodThemes });
        }
      }
    }

    // --- Tag analysis ---
    const tagCounts = {};
    for (const entry of entries) {
      for (const tag of (entry.tags || [])) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count, prevalence: r(count / numDocs) }));

    return {
      ok: true,
      result: {
        entriesAnalyzed: numDocs,
        themes,
        recurringPhrases: topBigrams,
        themeCoOccurrences: topCoOccurrences,
        moodThemeCorrelation: moodThemeCorrelation.length > 0 ? moodThemeCorrelation : null,
        topTags: topTags.length > 0 ? topTags : null,
      },
    };
  });

  /**
   * growthMetrics
   * Compute personal growth metrics — sentiment trend, vocabulary diversity
   * (type-token ratio), and topic expansion over time.
   * artifact.data.entries = [{ text, date }]
   * params.windowSize — entries per window for trend analysis (default 5)
   */
  registerLensAction("reflection", "growthMetrics", (ctx, artifact, params) => {
    const entries = artifact.data?.entries || [];
    if (entries.length < 2) {
      return { ok: true, result: { message: "Need at least 2 entries for growth analysis." } };
    }

    const windowSize = params.windowSize || 5;
    const r = (v) => Math.round(v * 10000) / 10000;

    // Sort by date
    const sorted = [...entries].map((e, i) => ({
      ...e,
      originalIndex: i,
      ts: new Date(e.date).getTime(),
    })).sort((a, b) => (isNaN(a.ts) ? 0 : a.ts) - (isNaN(b.ts) ? 0 : b.ts));

    // --- Simple sentiment scoring ---
    const positiveWords = new Set([
      "happy", "grateful", "excited", "proud", "accomplished", "peaceful",
      "hopeful", "inspired", "motivated", "confident", "content", "joyful",
      "loved", "amazing", "wonderful", "great", "good", "better", "best",
      "growth", "progress", "success", "learn", "improve", "achieve",
      "thankful", "blessed", "strong", "calm", "clarity", "focused",
    ]);
    const negativeWords = new Set([
      "sad", "angry", "frustrated", "anxious", "worried", "stressed",
      "overwhelmed", "disappointed", "lonely", "afraid", "confused",
      "exhausted", "stuck", "lost", "failed", "struggling", "difficult",
      "painful", "regret", "doubt", "fear", "terrible", "worse", "worst",
      "hopeless", "helpless", "depressed", "tired", "drained", "upset",
    ]);

    function sentimentScore(text) {
      const words = (text || "").toLowerCase().split(/\s+/);
      let pos = 0, neg = 0;
      for (const w of words) {
        const clean = w.replace(/[^a-z]/g, "");
        if (positiveWords.has(clean)) pos++;
        if (negativeWords.has(clean)) neg++;
      }
      const total = pos + neg;
      return total > 0 ? (pos - neg) / total : 0;
    }

    // Sentiment per entry
    const sentiments = sorted.map(e => ({
      date: e.date,
      sentiment: r(sentimentScore(e.text)),
    }));

    // Sentiment trend via linear regression
    const sentValues = sentiments.map(s => s.sentiment);
    const meanSent = sentValues.reduce((s, v) => s + v, 0) / sentValues.length;
    const xs = sentValues.map((_, i) => i);
    const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
    let ssXY = 0, ssXX = 0;
    for (let i = 0; i < xs.length; i++) {
      ssXY += (xs[i] - meanX) * (sentValues[i] - meanSent);
      ssXX += (xs[i] - meanX) * (xs[i] - meanX);
    }
    const sentimentSlope = ssXX > 0 ? ssXY / ssXX : 0;
    const sentimentTrend = sentimentSlope > 0.005 ? "improving" : sentimentSlope < -0.005 ? "declining" : "stable";

    // --- Vocabulary diversity (Type-Token Ratio per entry and over time) ---
    const ttrValues = sorted.map(e => {
      const words = (e.text || "").toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const types = new Set(words).size;
      return {
        date: e.date,
        wordCount: words.length,
        uniqueWords: types,
        ttr: words.length > 0 ? r(types / words.length) : 0,
      };
    });

    // TTR trend
    const ttrVals = ttrValues.map(t => t.ttr);
    const meanTTR = ttrVals.reduce((s, v) => s + v, 0) / ttrVals.length;
    let ttrSSXY = 0, ttrSSXX = 0;
    const ttrXs = ttrVals.map((_, i) => i);
    const ttrMeanX = ttrXs.reduce((s, v) => s + v, 0) / ttrXs.length;
    for (let i = 0; i < ttrXs.length; i++) {
      ttrSSXY += (ttrXs[i] - ttrMeanX) * (ttrVals[i] - meanTTR);
      ttrSSXX += (ttrXs[i] - ttrMeanX) * (ttrXs[i] - ttrMeanX);
    }
    const ttrSlope = ttrSSXX > 0 ? ttrSSXY / ttrSSXX : 0;
    const vocabTrend = ttrSlope > 0.002 ? "expanding" : ttrSlope < -0.002 ? "contracting" : "stable";

    // --- Topic expansion over time (cumulative unique terms) ---
    const cumulativeVocab = [];
    const seenTerms = new Set();
    for (const entry of sorted) {
      const words = (entry.text || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const w of words) seenTerms.add(w);
      cumulativeVocab.push({
        date: entry.date,
        cumulativeUniqueTerms: seenTerms.size,
      });
    }

    // Topic expansion rate (new unique terms per entry in recent vs early entries)
    const earlyRate = sorted.length >= 4
      ? (cumulativeVocab[Math.floor(sorted.length / 4)].cumulativeUniqueTerms) / Math.floor(sorted.length / 4)
      : 0;
    const recentRate = sorted.length >= 4
      ? (cumulativeVocab[sorted.length - 1].cumulativeUniqueTerms - cumulativeVocab[sorted.length - Math.floor(sorted.length / 4) - 1].cumulativeUniqueTerms) / Math.floor(sorted.length / 4)
      : 0;

    // --- Windowed growth analysis ---
    const windows = [];
    for (let i = 0; i <= sorted.length - windowSize; i++) {
      const win = sorted.slice(i, i + windowSize);
      const avgSentiment = win.reduce((s, e) => s + sentimentScore(e.text), 0) / windowSize;
      const avgWordCount = win.reduce((s, e) => s + (e.text || "").split(/\s+/).length, 0) / windowSize;
      windows.push({
        windowStart: i,
        dateRange: { from: win[0].date, to: win[windowSize - 1].date },
        avgSentiment: r(avgSentiment),
        avgWordCount: Math.round(avgWordCount),
      });
    }

    // --- Entry length trend (are entries getting longer/deeper?) ---
    const lengths = sorted.map(e => (e.text || "").split(/\s+/).length);
    const avgLength = lengths.reduce((s, v) => s + v, 0) / lengths.length;
    const meanLenX = lengths.map((_, i) => i).reduce((s, v) => s + v, 0) / lengths.length;
    let lenSSXY = 0, lenSSXX = 0;
    for (let i = 0; i < lengths.length; i++) {
      lenSSXY += (i - meanLenX) * (lengths[i] - avgLength);
      lenSSXX += (i - meanLenX) * (i - meanLenX);
    }
    const lengthSlope = lenSSXX > 0 ? lenSSXY / lenSSXX : 0;
    const depthTrend = lengthSlope > 1 ? "deepening" : lengthSlope < -1 ? "shallowing" : "consistent";

    return {
      ok: true,
      result: {
        entriesAnalyzed: sorted.length,
        sentiment: {
          overall: r(meanSent),
          trend: sentimentTrend,
          slope: r(sentimentSlope),
          timeline: sentiments.length <= 30 ? sentiments : sentiments.filter((_, i) => i % Math.ceil(sentiments.length / 30) === 0),
        },
        vocabularyDiversity: {
          avgTTR: r(meanTTR),
          trend: vocabTrend,
          slope: r(ttrSlope),
          totalUniqueTerms: seenTerms.size,
        },
        topicExpansion: {
          earlyNewTermsPerEntry: r(earlyRate),
          recentNewTermsPerEntry: r(recentRate),
          expansionRatio: earlyRate > 0 ? r(recentRate / earlyRate) : null,
          cumulativeCurve: cumulativeVocab.length <= 20 ? cumulativeVocab : cumulativeVocab.filter((_, i) => i % Math.ceil(cumulativeVocab.length / 20) === 0),
        },
        entryDepth: {
          avgWordCount: Math.round(avgLength),
          trend: depthTrend,
          slope: r(lengthSlope),
        },
        growthWindows: windows.length <= 15 ? windows : windows.filter((_, i) => i % Math.ceil(windows.length / 15) === 0),
      },
    };
  });

  /**
   * habitTracking
   * Analyze habit patterns — streak counting, consistency scoring, optimal
   * time detection, and habit stacking recommendations.
   * artifact.data.habits = [{ name, completions: [{ date, time?, duration?, quality? }] }]
   */
  registerLensAction("reflection", "habitTracking", (ctx, artifact, params) => {
    const habits = artifact.data?.habits || [];
    if (habits.length === 0) {
      return { ok: true, result: { message: "No habit data to analyze." } };
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    const habitProfiles = habits.map(habit => {
      const completions = (habit.completions || [])
        .map(c => ({
          ...c,
          dateObj: new Date(c.date),
          ts: new Date(c.date).getTime(),
        }))
        .filter(c => !isNaN(c.ts))
        .sort((a, b) => a.ts - b.ts);

      if (completions.length === 0) {
        return { name: habit.name, completions: 0, streak: 0, consistency: 0 };
      }

      // --- Streak counting ---
      // Normalize to day strings
      const daySet = new Set();
      const days = [];
      for (const c of completions) {
        const dayStr = c.dateObj.toISOString().split("T")[0];
        if (!daySet.has(dayStr)) {
          daySet.add(dayStr);
          days.push(dayStr);
        }
      }
      days.sort();

      // Current streak (consecutive days ending at most recent)
      let currentStreak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000;
        if (diff === 1) currentStreak++;
        else break;
      }

      // Longest streak
      let longestStreak = 1;
      let tempStreak = 1;
      for (let i = 1; i < days.length; i++) {
        const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000;
        if (diff === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }

      // --- Consistency score ---
      // Based on regularity over the date range
      const rangeMs = completions[completions.length - 1].ts - completions[0].ts;
      const rangeDays = Math.max(1, rangeMs / 86400000);
      const expectedCompletions = rangeDays; // assuming daily habit
      const consistency = Math.min(1, days.length / expectedCompletions);

      // Weekly consistency (fraction of weeks with at least one completion)
      const weekSet = new Set();
      for (const c of completions) {
        const weekStart = new Date(c.dateObj);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekSet.add(weekStart.toISOString().split("T")[0]);
      }
      const totalWeeks = Math.max(1, Math.ceil(rangeDays / 7));
      const weeklyConsistency = weekSet.size / totalWeeks;

      // --- Optimal time detection ---
      const hourCounts = new Array(24).fill(0);
      for (const c of completions) {
        if (c.time) {
          const parts = c.time.split(":");
          const hour = parseInt(parts[0]);
          if (!isNaN(hour) && hour >= 0 && hour < 24) hourCounts[hour]++;
        } else if (c.dateObj) {
          const hour = c.dateObj.getHours();
          hourCounts[hour]++;
        }
      }
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
      const hasTimeData = hourCounts.some(c => c > 0);

      // Day-of-week distribution
      const dowCounts = new Array(7).fill(0);
      const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (const c of completions) {
        dowCounts[c.dateObj.getDay()]++;
      }
      const peakDay = dowNames[dowCounts.indexOf(Math.max(...dowCounts))];

      // --- Quality trend (if available) ---
      let qualityTrend = null;
      const qualityValues = completions.map(c => parseFloat(c.quality)).filter(v => !isNaN(v));
      if (qualityValues.length >= 3) {
        const meanQ = qualityValues.reduce((s, v) => s + v, 0) / qualityValues.length;
        const qXs = qualityValues.map((_, i) => i);
        const meanQX = qXs.reduce((s, v) => s + v, 0) / qXs.length;
        let qSSXY = 0, qSSXX = 0;
        for (let i = 0; i < qXs.length; i++) {
          qSSXY += (qXs[i] - meanQX) * (qualityValues[i] - meanQ);
          qSSXX += (qXs[i] - meanQX) * (qXs[i] - meanQX);
        }
        const qSlope = qSSXX > 0 ? qSSXY / qSSXX : 0;
        qualityTrend = {
          avgQuality: r(meanQ),
          trend: qSlope > 0.01 ? "improving" : qSlope < -0.01 ? "declining" : "stable",
          slope: r(qSlope),
        };
      }

      // --- Duration stats (if available) ---
      let durationStats = null;
      const durations = completions.map(c => parseFloat(c.duration)).filter(v => !isNaN(v) && v > 0);
      if (durations.length > 0) {
        const avgDuration = durations.reduce((s, v) => s + v, 0) / durations.length;
        durationStats = {
          avg: r(avgDuration),
          min: r(Math.min(...durations)),
          max: r(Math.max(...durations)),
          total: r(durations.reduce((s, v) => s + v, 0)),
        };
      }

      return {
        name: habit.name,
        totalCompletions: completions.length,
        uniqueDays: days.length,
        currentStreak,
        longestStreak,
        consistency: r(consistency),
        weeklyConsistency: r(weeklyConsistency),
        optimalTime: hasTimeData ? { hour: peakHour, label: `${peakHour}:00` } : null,
        peakDay,
        dayOfWeekDistribution: Object.fromEntries(dowNames.map((name, i) => [name, dowCounts[i]])),
        qualityTrend,
        durationStats,
        dateRange: { from: days[0], to: days[days.length - 1] },
      };
    });

    // --- Habit stacking recommendations ---
    // Find habits that tend to co-occur on the same days
    const stackingRecommendations = [];
    for (let i = 0; i < habitProfiles.length; i++) {
      for (let j = i + 1; j < habitProfiles.length; j++) {
        const h1 = habits[i];
        const h2 = habits[j];
        const days1 = new Set((h1.completions || []).map(c => new Date(c.date).toISOString().split("T")[0]));
        const days2 = new Set((h2.completions || []).map(c => new Date(c.date).toISOString().split("T")[0]));
        const overlap = [...days1].filter(d => days2.has(d)).length;
        const union = new Set([...days1, ...days2]).size;
        const coOccurrence = union > 0 ? overlap / union : 0;

        if (coOccurrence > 0.3) {
          stackingRecommendations.push({
            habits: [h1.name, h2.name],
            coOccurrenceRate: r(coOccurrence),
            sharedDays: overlap,
            recommendation: coOccurrence > 0.6
              ? "Already strongly linked. Formalize as a stack."
              : "Moderate co-occurrence. Could benefit from intentional stacking.",
          });
        }
      }
    }
    stackingRecommendations.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

    // Overall consistency
    const avgConsistency = habitProfiles.reduce((s, h) => s + (h.consistency || 0), 0) / habitProfiles.length;

    return {
      ok: true,
      result: {
        totalHabits: habits.length,
        overallConsistency: r(avgConsistency),
        habitProfiles,
        stackingRecommendations: stackingRecommendations.slice(0, 10),
        strongest: habitProfiles.reduce((best, h) => (h.consistency || 0) > (best.consistency || 0) ? h : best, habitProfiles[0])?.name,
        needsAttention: habitProfiles.filter(h => (h.consistency || 0) < 0.3).map(h => h.name),
      },
    };
  });
}
