// server/domains/thread.js
export default function registerThreadActions(registerLensAction) {
  registerLensAction("thread", "threadAnalyze", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || artifact.data?.posts || [];
    if (messages.length === 0) return { ok: true, result: { message: "Provide messages to analyze the thread." } };
    const totalChars = messages.reduce((s, m) => s + (m.text || m.content || "").length, 0);
    const avgLength = Math.round(totalChars / messages.length);
    const participants = [...new Set(messages.map(m => m.author || m.user || m.sender || "anonymous"))];
    const responseTimes = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = new Date(messages[i - 1].timestamp || messages[i - 1].date || 0);
      const curr = new Date(messages[i].timestamp || messages[i].date || 0);
      if (prev.getTime() && curr.getTime()) responseTimes.push((curr.getTime() - prev.getTime()) / 60000);
    }
    const avgResponseMin = responseTimes.length > 0 ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) : null;
    const byHour = {};
    messages.forEach(m => {
      const h = new Date(m.timestamp || m.date || 0).getHours();
      if (!isNaN(h)) byHour[h] = (byHour[h] || 0) + 1;
    });
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    return { ok: true, result: { messageCount: messages.length, participants: participants.length, participantList: participants, avgMessageLength: avgLength, totalCharacters: totalChars, avgResponseMinutes: avgResponseMin, peakActivityHour: peakHour ? parseInt(peakHour[0]) : null, threadDuration: messages.length >= 2 ? `${Math.round((new Date(messages[messages.length - 1].timestamp || messages[messages.length - 1].date || 0).getTime() - new Date(messages[0].timestamp || messages[0].date || 0).getTime()) / 3600000)} hours` : null } };
  });

  registerLensAction("thread", "sentimentMap", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length === 0) return { ok: true, result: { message: "Provide messages to map sentiment." } };
    const positive = ["good", "great", "love", "excellent", "amazing", "awesome", "fantastic", "wonderful", "happy", "perfect", "beautiful", "brilliant", "outstanding", "superb", "agree", "thanks", "thank", "helpful", "nice", "best"];
    const negative = ["bad", "terrible", "hate", "awful", "horrible", "disgusting", "annoyed", "angry", "frustrated", "disappointed", "wrong", "worst", "fail", "broken", "useless", "stupid", "disagree", "never", "problem", "issue"];
    const scored = messages.map((m, i) => {
      const text = (m.text || m.content || "").toLowerCase();
      const words = text.split(/\s+/);
      const posCount = words.filter(w => positive.includes(w.replace(/[^a-z]/g, ""))).length;
      const negCount = words.filter(w => negative.includes(w.replace(/[^a-z]/g, ""))).length;
      const score = words.length > 0 ? Math.round(((posCount - negCount) / Math.max(1, words.length)) * 100) : 0;
      return { index: i, author: m.author || m.user || "anonymous", sentiment: score > 2 ? "positive" : score < -2 ? "negative" : "neutral", score, positiveWords: posCount, negativeWords: negCount };
    });
    const avgSentiment = Math.round(scored.reduce((s, m) => s + m.score, 0) / scored.length * 10) / 10;
    return { ok: true, result: { messages: scored.length, avgSentiment, overallTone: avgSentiment > 1 ? "positive" : avgSentiment < -1 ? "negative" : "neutral", positiveMessages: scored.filter(s => s.sentiment === "positive").length, negativeMessages: scored.filter(s => s.sentiment === "negative").length, neutralMessages: scored.filter(s => s.sentiment === "neutral").length, sentimentFlow: scored.map(s => ({ index: s.index, sentiment: s.sentiment, score: s.score })), mostPositive: scored.sort((a, b) => b.score - a.score)[0], mostNegative: scored.sort((a, b) => a.score - b.score)[0] } };
  });

  registerLensAction("thread", "participantStats", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length === 0) return { ok: true, result: { message: "Provide messages to compute participant stats." } };
    const stats = {};
    messages.forEach((m, i) => {
      const author = m.author || m.user || m.sender || "anonymous";
      if (!stats[author]) stats[author] = { messages: 0, totalChars: 0, responseTimes: [], hours: [] };
      stats[author].messages++;
      stats[author].totalChars += (m.text || m.content || "").length;
      const hour = new Date(m.timestamp || m.date || 0).getHours();
      if (!isNaN(hour)) stats[author].hours.push(hour);
      if (i > 0) {
        const prev = new Date(messages[i - 1].timestamp || messages[i - 1].date || 0);
        const curr = new Date(m.timestamp || m.date || 0);
        if (prev.getTime() && curr.getTime()) stats[author].responseTimes.push((curr.getTime() - prev.getTime()) / 60000);
      }
    });
    const participants = Object.entries(stats).map(([name, data]) => ({
      name,
      messageCount: data.messages,
      sharePercent: Math.round((data.messages / messages.length) * 100),
      avgMessageLength: Math.round(data.totalChars / data.messages),
      avgResponseMinutes: data.responseTimes.length > 0 ? Math.round(data.responseTimes.reduce((s, t) => s + t, 0) / data.responseTimes.length) : null,
      peakHour: data.hours.length > 0 ? data.hours.sort((a, b) => data.hours.filter(h => h === b).length - data.hours.filter(h => h === a).length)[0] : null,
    })).sort((a, b) => b.messageCount - a.messageCount);
    return { ok: true, result: { totalParticipants: participants.length, totalMessages: messages.length, participants, mostActive: participants[0]?.name, leastActive: participants[participants.length - 1]?.name } };
  });

  registerLensAction("thread", "topicExtract", (ctx, artifact, _params) => {
    const messages = artifact.data?.messages || [];
    if (messages.length === 0) return { ok: true, result: { message: "Provide messages to extract topics." } };
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "and", "but", "or", "not", "so", "yet", "if", "when", "which", "who", "this", "that", "these", "those", "it", "its", "we", "our", "they", "their", "he", "she", "his", "her", "i", "me", "my", "you", "your", "just", "also", "very", "really", "too", "about", "up", "out", "all", "one", "two", "been", "some", "than", "them", "then", "what", "how", "more", "into", "only", "no", "yes"]);
    const wordFreq = {};
    messages.forEach(m => {
      const text = (m.text || m.content || "").toLowerCase();
      text.split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-z0-9-]/g, "");
        if (clean.length > 2 && !stopWords.has(clean)) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      });
    });
    const topics = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ topic: word, mentions: count, frequency: Math.round((count / messages.length) * 100) }));
    // Bigram extraction
    const bigrams = {};
    messages.forEach(m => {
      const words = (m.text || m.content || "").toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9-]/g, "")).filter(w => w.length > 2 && !stopWords.has(w));
      for (let i = 0; i < words.length - 1; i++) {
        const bg = `${words[i]} ${words[i + 1]}`;
        bigrams[bg] = (bigrams[bg] || 0) + 1;
      }
    });
    const topBigrams = Object.entries(bigrams).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([phrase, count]) => ({ phrase, count }));
    return { ok: true, result: { messagesAnalyzed: messages.length, topics, topBigrams, dominantTopic: topics[0]?.topic, topicDiversity: Math.round((Object.keys(wordFreq).length / messages.length) * 10) / 10 } };
  });
}
