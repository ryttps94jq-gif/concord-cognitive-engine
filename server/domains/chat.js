// server/domains/chat.js
// Domain actions for chat/messaging analysis: thread summarization,
// participant engagement analysis, and topic shift detection.

export default function registerChatActions(registerLensAction) {
  /**
   * threadSummarize
   * Extract key points from chat messages using TF-IDF keyword extraction.
   * Identify decisions, action items, and questions.
   * artifact.data.messages = [{ author, text, timestamp? }]
   */
  registerLensAction("chat", "threadSummarize", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length === 0) {
      return { ok: true, result: { message: "No messages to summarize." } };
    }

    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "to", "of", "in", "for",
      "on", "with", "at", "by", "from", "as", "into", "through", "during",
      "before", "after", "above", "below", "between", "and", "but", "or",
      "nor", "not", "so", "yet", "both", "either", "neither", "each",
      "every", "all", "any", "few", "more", "most", "other", "some", "such",
      "no", "only", "own", "same", "than", "too", "very", "just", "because",
      "if", "when", "while", "that", "this", "these", "those", "it", "its",
      "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
      "she", "her", "they", "them", "their", "what", "which", "who", "whom",
      "how", "where", "why", "about", "up", "out", "then", "there", "here",
    ]);

    // Tokenize each message
    function tokenize(text) {
      return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    }

    // Build TF-IDF
    const docTokens = messages.map(m => tokenize(m.text || ""));
    const docCount = docTokens.length;

    // Document frequency for each term
    const df = {};
    for (const tokens of docTokens) {
      const unique = new Set(tokens);
      for (const t of unique) {
        df[t] = (df[t] || 0) + 1;
      }
    }

    // Compute TF-IDF scores across the entire corpus
    const globalScores = {};
    for (const tokens of docTokens) {
      const tf = {};
      for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
      const maxTf = Math.max(...Object.values(tf), 1);
      for (const [term, count] of Object.entries(tf)) {
        const tfidf = (count / maxTf) * Math.log(docCount / (df[term] || 1));
        globalScores[term] = (globalScores[term] || 0) + tfidf;
      }
    }

    const keywords = Object.entries(globalScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([term, score]) => ({ term, score: Math.round(score * 1000) / 1000 }));

    // Detect decisions (statements with decision-indicator words)
    const decisionPatterns = /\b(decided|agreed|approved|confirmed|will go with|let'?s go with|final decision|we'?ll|consensus|resolved)\b/i;
    const decisions = messages
      .filter(m => decisionPatterns.test(m.text || ""))
      .map(m => ({ author: m.author, text: m.text, timestamp: m.timestamp }));

    // Detect action items (assignments and to-dos)
    const actionPatterns = /\b(todo|action item|please|need to|should|must|assign|take care of|follow up|will do|i'?ll|can you|could you|make sure)\b/i;
    const actionItems = messages
      .filter(m => actionPatterns.test(m.text || ""))
      .map(m => {
        const text = m.text || "";
        // Try to extract the assignee and task
        const assigneeMatch = text.match(/@(\w+)/);
        return {
          author: m.author,
          text,
          timestamp: m.timestamp,
          possibleAssignee: assigneeMatch ? assigneeMatch[1] : m.author,
        };
      });

    // Detect questions (lines ending with ? or starting with question words)
    const questionPatterns = /(\?$|\b(what|how|why|when|where|who|which|can we|should we|do we|is there|are there|could we)\b)/i;
    const questions = messages
      .filter(m => questionPatterns.test(m.text || ""))
      .map(m => {
        // Check if any subsequent message looks like a response
        const idx = messages.indexOf(m);
        const answered = idx < messages.length - 1;
        return { author: m.author, text: m.text, timestamp: m.timestamp, answered };
      });

    // Compute message density over time if timestamps are present
    let activityTimeline = null;
    const withTime = messages.filter(m => m.timestamp);
    if (withTime.length >= 2) {
      const times = withTime.map(m => new Date(m.timestamp).getTime()).sort((a, b) => a - b);
      const duration = times[times.length - 1] - times[0];
      const bucketCount = Math.min(10, withTime.length);
      const bucketSize = duration / bucketCount;
      const buckets = new Array(bucketCount).fill(0);
      for (const t of times) {
        const idx = Math.min(Math.floor((t - times[0]) / bucketSize), bucketCount - 1);
        buckets[idx]++;
      }
      activityTimeline = { buckets, bucketDurationMs: Math.round(bucketSize), peakBucket: buckets.indexOf(Math.max(...buckets)) };
    }

    return {
      ok: true,
      result: {
        messageCount: messages.length,
        keywords,
        decisions: { count: decisions.length, items: decisions.slice(0, 10) },
        actionItems: { count: actionItems.length, items: actionItems.slice(0, 10) },
        questions: { count: questions.length, unanswered: questions.filter(q => !q.answered).length, items: questions.slice(0, 10) },
        activityTimeline,
      },
    };
  });

  /**
   * participantAnalysis
   * Analyze participant engagement: message frequency, response times,
   * thread initiation ratio, and sentiment per participant.
   * artifact.data.messages = [{ author, text, timestamp?, threadId? }]
   */
  registerLensAction("chat", "participantAnalysis", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length === 0) {
      return { ok: true, result: { message: "No messages to analyze." } };
    }

    const participants = {};

    // Simple sentiment scoring via lexicon
    const posWords = new Set(["good", "great", "excellent", "awesome", "nice", "love", "agree", "thanks", "thank", "perfect", "wonderful", "happy", "yes", "sure", "absolutely", "amazing", "well", "fantastic", "helpful", "brilliant"]);
    const negWords = new Set(["bad", "wrong", "terrible", "hate", "disagree", "unfortunately", "issue", "problem", "fail", "failed", "broken", "bug", "error", "concern", "worried", "no", "never", "awful", "poor", "worse", "worst"]);

    function sentimentScore(text) {
      const words = (text || "").toLowerCase().split(/\s+/);
      let score = 0;
      for (const w of words) {
        if (posWords.has(w)) score += 1;
        if (negWords.has(w)) score -= 1;
      }
      return score;
    }

    // Build per-participant stats
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const author = m.author || "unknown";
      if (!participants[author]) {
        participants[author] = {
          messageCount: 0,
          totalWords: 0,
          sentimentSum: 0,
          threadInitiations: 0,
          responseTimes: [],
          firstMessageIdx: i,
          lastMessageIdx: i,
        };
      }
      const p = participants[author];
      p.messageCount++;
      p.totalWords += (m.text || "").split(/\s+/).filter(Boolean).length;
      p.sentimentSum += sentimentScore(m.text);
      p.lastMessageIdx = i;

      // Thread initiation: first message in a thread
      if (m.threadId) {
        const isFirst = !messages.slice(0, i).some(prev => prev.threadId === m.threadId);
        if (isFirst) p.threadInitiations++;
      }

      // Response time: time gap from previous message by a different author
      if (m.timestamp && i > 0) {
        // Find the most recent message from a different author
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].author !== author && messages[j].timestamp) {
            const gap = new Date(m.timestamp).getTime() - new Date(messages[j].timestamp).getTime();
            if (gap > 0 && gap < 86400000) { // within 24 hours
              p.responseTimes.push(gap);
            }
            break;
          }
        }
      }
    }

    // Compile participant summaries
    const totalMessages = messages.length;
    const summaries = Object.entries(participants).map(([name, p]) => {
      const avgResponseTime = p.responseTimes.length > 0
        ? Math.round(p.responseTimes.reduce((s, t) => s + t, 0) / p.responseTimes.length)
        : null;
      const medianResponseTime = p.responseTimes.length > 0
        ? (() => { const sorted = [...p.responseTimes].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]; })()
        : null;

      const avgSentiment = p.messageCount > 0
        ? Math.round((p.sentimentSum / p.messageCount) * 1000) / 1000
        : 0;

      const threadInitiationRatio = p.messageCount > 0
        ? Math.round((p.threadInitiations / p.messageCount) * 1000) / 1000
        : 0;

      return {
        name,
        messageCount: p.messageCount,
        shareOfConversation: Math.round((p.messageCount / totalMessages) * 10000) / 100,
        avgWordsPerMessage: Math.round(p.totalWords / p.messageCount * 10) / 10,
        threadInitiations: p.threadInitiations,
        threadInitiationRatio,
        avgResponseTimeMs: avgResponseTime,
        medianResponseTimeMs: medianResponseTime,
        sentiment: {
          score: avgSentiment,
          label: avgSentiment > 0.3 ? "positive" : avgSentiment < -0.3 ? "negative" : "neutral",
        },
      };
    });

    summaries.sort((a, b) => b.messageCount - a.messageCount);

    // Identify the most active and the most responsive
    const mostActive = summaries[0]?.name || null;
    const mostResponsive = summaries
      .filter(s => s.avgResponseTimeMs !== null)
      .sort((a, b) => a.avgResponseTimeMs - b.avgResponseTimeMs)[0]?.name || null;

    // Engagement balance: Gini coefficient of message counts
    const counts = summaries.map(s => s.messageCount).sort((a, b) => a - b);
    const n = counts.length;
    let giniNumerator = 0;
    for (let i = 0; i < n; i++) {
      giniNumerator += (2 * (i + 1) - n - 1) * counts[i];
    }
    const gini = n > 1 ? Math.round((giniNumerator / (n * counts.reduce((s, v) => s + v, 0))) * 1000) / 1000 : 0;

    return {
      ok: true,
      result: {
        totalMessages,
        participantCount: summaries.length,
        participants: summaries,
        highlights: { mostActive, mostResponsive },
        engagementBalance: {
          giniCoefficient: gini,
          interpretation: gini < 0.2 ? "very balanced" : gini < 0.4 ? "balanced" : gini < 0.6 ? "moderately unbalanced" : "highly unbalanced",
        },
      },
    };
  });

  /**
   * topicDetection
   * Detect topic shifts in conversation using cosine similarity between
   * sliding windows of messages. Identify topic boundaries and label clusters.
   * artifact.data.messages = [{ author, text, timestamp? }]
   * params.windowSize (default 3), params.threshold (default 0.3)
   */
  registerLensAction("chat", "topicDetection", (ctx, artifact, params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length < 2) {
      return { ok: true, result: { message: "Need at least 2 messages for topic detection." } };
    }

    const windowSize = params.windowSize || 3;
    const threshold = params.threshold || 0.3;

    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "have",
      "has", "had", "do", "does", "did", "will", "would", "could", "should",
      "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
      "and", "but", "or", "not", "so", "if", "that", "this", "it", "its",
      "i", "me", "my", "we", "our", "you", "your", "he", "she", "they",
      "them", "their", "what", "which", "who", "how", "where", "why",
    ]);

    function tokenize(text) {
      return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    }

    // Build term-frequency vector for a window of messages
    function buildVector(msgs) {
      const tf = {};
      for (const m of msgs) {
        for (const t of tokenize(m.text)) {
          tf[t] = (tf[t] || 0) + 1;
        }
      }
      return tf;
    }

    // Cosine similarity between two term-frequency vectors
    function cosineSim(v1, v2) {
      const allTerms = new Set([...Object.keys(v1), ...Object.keys(v2)]);
      let dot = 0, mag1 = 0, mag2 = 0;
      for (const t of allTerms) {
        const a = v1[t] || 0;
        const b = v2[t] || 0;
        dot += a * b;
        mag1 += a * a;
        mag2 += b * b;
      }
      const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
      return denom > 0 ? dot / denom : 0;
    }

    // Compute similarities between adjacent windows
    const similarities = [];
    const boundaries = [0]; // First message always starts a segment

    for (let i = 0; i <= messages.length - windowSize * 2; i++) {
      const window1 = messages.slice(i, i + windowSize);
      const window2 = messages.slice(i + windowSize, i + windowSize * 2);
      const v1 = buildVector(window1);
      const v2 = buildVector(window2);
      const sim = cosineSim(v1, v2);
      similarities.push({
        position: i + windowSize,
        similarity: Math.round(sim * 1000) / 1000,
      });

      if (sim < threshold) {
        // Topic shift detected
        const boundaryIdx = i + windowSize;
        // Avoid boundaries too close together
        if (boundaryIdx - boundaries[boundaries.length - 1] >= windowSize) {
          boundaries.push(boundaryIdx);
        }
      }
    }

    // Extract topic segments and label them by top keywords
    const segments = [];
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i];
      const end = i < boundaries.length - 1 ? boundaries[i + 1] : messages.length;
      const segmentMsgs = messages.slice(start, end);
      const tf = buildVector(segmentMsgs);

      // Top keywords for this segment
      const topTerms = Object.entries(tf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term]) => term);

      segments.push({
        segmentIndex: i,
        startMessage: start,
        endMessage: end - 1,
        messageCount: segmentMsgs.length,
        topKeywords: topTerms,
        label: topTerms.slice(0, 3).join(", "),
        participants: [...new Set(segmentMsgs.map(m => m.author))],
        startTimestamp: segmentMsgs[0]?.timestamp || null,
        endTimestamp: segmentMsgs[segmentMsgs.length - 1]?.timestamp || null,
      });
    }

    // Compute average similarity (topic coherence)
    const avgSimilarity = similarities.length > 0
      ? Math.round((similarities.reduce((s, x) => s + x.similarity, 0) / similarities.length) * 1000) / 1000
      : 1;

    return {
      ok: true,
      result: {
        totalMessages: messages.length,
        topicSegments: segments,
        topicShiftCount: boundaries.length - 1,
        similarities,
        averageCoherence: avgSimilarity,
        coherenceLabel: avgSimilarity > 0.7 ? "highly focused" : avgSimilarity > 0.4 ? "moderately focused" : "highly diverse",
        parameters: { windowSize, threshold },
      },
    };
  });
}
