// server/domains/collab.js
// Domain actions for collaboration: participant scoring, session analytics,
// contribution tracking, consensus detection, workload balancing.

export default function registerCollabActions(registerLensAction) {
  registerLensAction("collab", "sessionAnalytics", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const participants = data.participants || [];
    const messages = data.messages || [];
    const duration = parseFloat(data.durationMinutes) || 0;
    const participantStats = participants.map(p => {
      const pName = p.name || p;
      const pMessages = messages.filter(m => m.author === pName || m.sender === pName);
      const wordCount = pMessages.reduce((s, m) => s + ((m.content || m.text || "").split(/\s+/).length), 0);
      return { name: pName, messages: pMessages.length, wordCount, avgWordsPerMessage: pMessages.length > 0 ? Math.round(wordCount / pMessages.length) : 0, sharePercent: messages.length > 0 ? Math.round((pMessages.length / messages.length) * 100) : 0 };
    });
    const giniCoeff = (() => {
      const shares = participantStats.map(p => p.messages).sort((a, b) => a - b);
      const n = shares.length; if (n < 2) return 0;
      const mean = shares.reduce((s, v) => s + v, 0) / n;
      if (mean === 0) return 0;
      let sum = 0; for (let i = 0; i < n; i++) sum += (2 * (i + 1) - n - 1) * shares[i];
      return Math.round((sum / (n * n * mean)) * 100) / 100;
    })();
    return { ok: true, result: { totalMessages: messages.length, totalParticipants: participants.length, durationMinutes: duration, messagesPerMinute: duration > 0 ? Math.round((messages.length / duration) * 10) / 10 : 0, participantStats, participationBalance: giniCoeff, balanceRating: giniCoeff < 0.2 ? "well-balanced" : giniCoeff < 0.4 ? "slightly-uneven" : "dominated-by-few" } };
  });

  registerLensAction("collab", "contributionScore", (ctx, artifact, _params) => {
    const contributions = artifact.data?.contributions || [];
    if (contributions.length === 0) return { ok: true, result: { message: "Track contributions to calculate scores." } };
    const weights = { code: 3, design: 2.5, document: 2, review: 1.5, discussion: 1, admin: 0.5 };
    const scored = contributions.map(c => {
      const type = (c.type || "discussion").toLowerCase();
      const quality = parseFloat(c.quality) || 0.7;
      const weight = weights[type] || 1;
      return { contributor: c.name || c.author, type, quality: Math.round(quality * 100), score: Math.round(weight * quality * 100), count: parseInt(c.count) || 1 };
    });
    const byPerson = {};
    for (const s of scored) {
      if (!byPerson[s.contributor]) byPerson[s.contributor] = { total: 0, contributions: 0 };
      byPerson[s.contributor].total += s.score * s.count;
      byPerson[s.contributor].contributions += s.count;
    }
    const rankings = Object.entries(byPerson).map(([name, data]) => ({ name, totalScore: data.total, contributions: data.contributions })).sort((a, b) => b.totalScore - a.totalScore);
    return { ok: true, result: { rankings, totalContributions: scored.reduce((s, c) => s + c.count, 0), topContributor: rankings[0]?.name } };
  });

  registerLensAction("collab", "detectConsensus", (ctx, artifact, _params) => {
    const votes = artifact.data?.votes || [];
    if (votes.length === 0) return { ok: true, result: { message: "Add votes or positions to detect consensus." } };
    const tally = {};
    for (const v of votes) { const pos = v.position || v.vote || "abstain"; tally[pos] = (tally[pos] || 0) + 1; }
    const total = votes.length;
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const topPosition = sorted[0]?.[0];
    const topCount = sorted[0]?.[1] || 0;
    const consensusPercent = total > 0 ? Math.round((topCount / total) * 100) : 0;
    const hasConsensus = consensusPercent >= 67;
    const hasSupermajority = consensusPercent >= 75;
    return { ok: true, result: { totalVotes: total, tally: Object.fromEntries(sorted), leadingPosition: topPosition, consensusPercent, hasConsensus, hasSupermajority, status: hasSupermajority ? "strong-consensus" : hasConsensus ? "consensus-reached" : consensusPercent >= 50 ? "simple-majority" : "no-consensus", dissenting: sorted.slice(1).map(([pos, count]) => ({ position: pos, count, percent: Math.round((count / total) * 100) })) } };
  });

  registerLensAction("collab", "balanceWorkload", (ctx, artifact, _params) => {
    const members = artifact.data?.members || [];
    const tasks = artifact.data?.tasks || [];
    if (members.length === 0) return { ok: true, result: { message: "Add team members and tasks to balance workload." } };
    const memberLoads = members.map(m => {
      const assigned = tasks.filter(t => t.assignee === m.name || t.assignee === m);
      const totalHours = assigned.reduce((s, t) => s + (parseFloat(t.hours || t.estimatedHours) || 2), 0);
      const capacity = parseFloat(m.capacityHours) || 40;
      return { name: typeof m === "string" ? m : m.name, assignedTasks: assigned.length, totalHours, capacity, utilization: Math.round((totalHours / capacity) * 100), status: totalHours > capacity ? "overloaded" : totalHours > capacity * 0.8 ? "near-capacity" : "available" };
    });
    const unassigned = tasks.filter(t => !t.assignee);
    const overloaded = memberLoads.filter(m => m.status === "overloaded");
    const available = memberLoads.filter(m => m.status === "available").sort((a, b) => a.utilization - b.utilization);
    return { ok: true, result: { members: memberLoads, unassignedTasks: unassigned.length, overloadedMembers: overloaded.length, suggestions: overloaded.length > 0 && available.length > 0 ? [`Move tasks from ${overloaded[0].name} to ${available[0].name}`] : [], avgUtilization: Math.round(memberLoads.reduce((s, m) => s + m.utilization, 0) / memberLoads.length) } };
  });
}
