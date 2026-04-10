// server/domains/forum.js
export default function registerForumActions(registerLensAction) {
  registerLensAction("forum", "threadAnalysis", (ctx, artifact, _params) => {
    const posts = artifact.data?.posts || [];
    if (posts.length === 0) return { ok: true, result: { message: "Add thread posts to analyze discussion." } };
    const authors = {};
    for (const p of posts) { const a = p.author || "anonymous"; authors[a] = (authors[a] || 0) + 1; }
    const avgLength = Math.round(posts.reduce((s, p) => s + ((p.content || "").length), 0) / posts.length);
    const topContributors = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { ok: true, result: { totalPosts: posts.length, uniqueAuthors: Object.keys(authors).length, avgPostLength: avgLength, topContributors: topContributors.map(([name, count]) => ({ name, posts: count })), health: posts.length > 5 && Object.keys(authors).length > 2 ? "active-discussion" : posts.length > 0 ? "needs-engagement" : "empty" } };
  });
  registerLensAction("forum", "moderationQueue", (ctx, artifact, _params) => {
    const reports = artifact.data?.reports || [];
    const pending = reports.filter(r => r.status === "pending" || !r.status);
    const byReason = {};
    for (const r of pending) { const reason = r.reason || "other"; byReason[reason] = (byReason[reason] || 0) + 1; }
    return { ok: true, result: { totalReports: reports.length, pending: pending.length, resolved: reports.filter(r => r.status === "resolved").length, byReason, oldestPending: pending.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())[0]?.date || null, urgency: pending.length > 10 ? "high" : pending.length > 3 ? "medium" : "low" } };
  });
  registerLensAction("forum", "communityHealth", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const activeUsers = parseInt(data.activeUsers) || 0;
    const totalUsers = parseInt(data.totalUsers) || 1;
    const postsThisWeek = parseInt(data.postsThisWeek) || 0;
    const postsLastWeek = parseInt(data.postsLastWeek) || 1;
    const growth = ((postsThisWeek - postsLastWeek) / postsLastWeek) * 100;
    const activityRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
    return { ok: true, result: { activeUsers, totalUsers, activityRate, postsThisWeek, growthRate: Math.round(growth), health: activityRate > 30 ? "thriving" : activityRate > 10 ? "healthy" : activityRate > 3 ? "declining" : "dormant", recommendations: activityRate < 10 ? ["Post conversation starters", "Highlight top contributors", "Send weekly digest"] : ["Maintain engagement momentum"] } };
  });
  registerLensAction("forum", "topicClustering", (ctx, artifact, _params) => {
    const threads = artifact.data?.threads || [];
    if (threads.length === 0) return { ok: true, result: { message: "Add threads to cluster by topic." } };
    const tagCounts = {};
    for (const t of threads) { for (const tag of (t.tags || [])) { tagCounts[tag] = (tagCounts[tag] || 0) + 1; } }
    const clusters = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ topic: tag, threads: count, share: Math.round((count / threads.length) * 100) }));
    return { ok: true, result: { totalThreads: threads.length, clusters: clusters.slice(0, 10), topTopic: clusters[0]?.topic || "general", uncategorized: threads.filter(t => !t.tags || t.tags.length === 0).length } };
  });
}
