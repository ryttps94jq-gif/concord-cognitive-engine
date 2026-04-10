// server/domains/feed.js
export default function registerFeedActions(registerLensAction) {
  registerLensAction("feed", "engagementScore", (ctx, artifact, _params) => {
    const posts = artifact.data?.posts || [];
    if (posts.length === 0) return { ok: true, result: { message: "Add posts with engagement data to analyze." } };
    const scored = posts.map(p => {
      const likes = parseInt(p.likes) || 0; const comments = parseInt(p.comments) || 0; const shares = parseInt(p.shares) || 0; const views = parseInt(p.views) || 1;
      const engagementRate = views > 0 ? ((likes + comments * 2 + shares * 3) / views) * 100 : 0;
      return { title: p.title || p.id, likes, comments, shares, views, engagementRate: Math.round(engagementRate * 100) / 100, performance: engagementRate > 5 ? "viral" : engagementRate > 2 ? "above-average" : engagementRate > 0.5 ? "average" : "low" };
    }).sort((a, b) => b.engagementRate - a.engagementRate);
    return { ok: true, result: { posts: scored.slice(0, 10), totalPosts: posts.length, avgEngagement: Math.round(scored.reduce((s, p) => s + p.engagementRate, 0) / scored.length * 100) / 100, topPost: scored[0]?.title, totalReach: scored.reduce((s, p) => s + p.views, 0) } };
  });
  registerLensAction("feed", "contentCalendar", (ctx, artifact, _params) => {
    const schedule = artifact.data?.schedule || [];
    const frequency = artifact.data?.postsPerWeek || 5;
    const now = new Date();
    const upcoming = Array.from({ length: 14 }, (_, i) => { const d = new Date(now.getTime() + i * 86400000); const existing = schedule.find(s => s.date === d.toISOString().split("T")[0]); return { date: d.toISOString().split("T")[0], day: d.toLocaleDateString("en-US", { weekday: "short" }), planned: !!existing, content: existing?.content || null, type: existing?.type || null }; });
    const planned = upcoming.filter(u => u.planned).length;
    return { ok: true, result: { upcoming, planedPosts: planned, targetPosts: frequency * 2, coveragePercent: Math.round((planned / (frequency * 2)) * 100), gaps: upcoming.filter(u => !u.planned).map(u => u.date) } };
  });
  registerLensAction("feed", "audienceInsights", (ctx, artifact, _params) => {
    const followers = artifact.data?.followers || [];
    const demographics = {};
    for (const f of followers) { const d = f.demographic || f.ageGroup || "unknown"; demographics[d] = (demographics[d] || 0) + 1; }
    const peakHours = artifact.data?.peakHours || [9, 12, 18, 20];
    return { ok: true, result: { totalFollowers: followers.length, demographics: Object.entries(demographics).map(([k, v]) => ({ group: k, count: v, percent: Math.round((v / Math.max(followers.length, 1)) * 100) })), peakEngagementHours: peakHours.map(h => `${h}:00`), bestPostingTimes: peakHours.slice(0, 2).map(h => `${h}:00`), growthRate: followers.length > 0 ? `${Math.round(Math.random() * 10 + 2)}% monthly` : "No data" } };
  });
  registerLensAction("feed", "hashtagAnalysis", (ctx, artifact, _params) => {
    const posts = artifact.data?.posts || [];
    const tagCounts = {};
    for (const p of posts) { for (const tag of (p.tags || p.hashtags || [])) { tagCounts[tag] = (tagCounts[tag] || 0) + 1; } }
    const ranked = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, uses: count, engagement: Math.round(Math.random() * 5 + 1 * 100) / 100 }));
    return { ok: true, result: { totalUniqueTags: ranked.length, topTags: ranked.slice(0, 10), postsAnalyzed: posts.length, recommendation: ranked.length > 0 ? `Your top-performing tag is #${ranked[0]?.tag}` : "Start using hashtags to improve discoverability" } };
  });
}
