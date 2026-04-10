// server/domains/marketing.js
export default function registerMarketingActions(registerLensAction) {
  registerLensAction("marketing", "campaignROI", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const spend = parseFloat(data.spend) || 0;
    const revenue = parseFloat(data.revenue) || 0;
    const leads = parseInt(data.leads) || 0;
    const conversions = parseInt(data.conversions) || 0;
    const roi = spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : 0;
    const cpl = leads > 0 ? Math.round(spend / leads * 100) / 100 : 0;
    const cpa = conversions > 0 ? Math.round(spend / conversions * 100) / 100 : 0;
    const convRate = leads > 0 ? Math.round((conversions / leads) * 100) : 0;
    return { ok: true, result: { campaign: data.name || artifact.title, spend, revenue, roi, leads, conversions, costPerLead: cpl, costPerAcquisition: cpa, conversionRate: convRate, profitable: roi > 0, grade: roi > 200 ? "exceptional" : roi > 100 ? "strong" : roi > 0 ? "positive" : "negative" } };
  });
  registerLensAction("marketing", "abTestAnalysis", (ctx, artifact, _params) => {
    const variants = artifact.data?.variants || [];
    if (variants.length < 2) return { ok: true, result: { message: "Add at least 2 variants with visitors and conversions." } };
    const analyzed = variants.map(v => { const visitors = parseInt(v.visitors) || 1; const conversions = parseInt(v.conversions) || 0; return { name: v.name, visitors, conversions, conversionRate: Math.round((conversions / visitors) * 10000) / 100 }; });
    const winner = analyzed.sort((a, b) => b.conversionRate - a.conversionRate)[0];
    const loser = analyzed[analyzed.length - 1];
    const lift = loser.conversionRate > 0 ? Math.round(((winner.conversionRate - loser.conversionRate) / loser.conversionRate) * 100) : 0;
    const totalVisitors = analyzed.reduce((s, v) => s + v.visitors, 0);
    const significant = totalVisitors > 1000 && Math.abs(lift) > 5;
    return { ok: true, result: { variants: analyzed, winner: winner.name, lift, statisticallySignificant: significant, totalVisitors, recommendation: significant ? `Deploy ${winner.name} — ${lift}% improvement` : "Continue testing — need more data" } };
  });
  registerLensAction("marketing", "funnelOptimize", (ctx, artifact, _params) => {
    const stages = artifact.data?.stages || [];
    if (stages.length < 2) return { ok: true, result: { message: "Add funnel stages with visitor counts." } };
    const analyzed = stages.map((s, i) => { const count = parseInt(s.count) || 0; const prev = i > 0 ? (parseInt(stages[i-1].count) || 1) : count; return { stage: s.name, visitors: count, dropoff: i > 0 ? Math.round((1 - count / prev) * 100) : 0, convFromTop: parseInt(stages[0].count) > 0 ? Math.round((count / parseInt(stages[0].count)) * 100) : 0 }; });
    const worstDropoff = analyzed.slice(1).sort((a, b) => b.dropoff - a.dropoff)[0];
    return { ok: true, result: { stages: analyzed, overallConversion: analyzed[analyzed.length - 1]?.convFromTop || 0, biggestLeakage: worstDropoff?.stage, leakageRate: worstDropoff?.dropoff, quickWin: worstDropoff ? `Improving ${worstDropoff.stage} could recover ${worstDropoff.dropoff}% of visitors` : "Funnel is healthy" } };
  });
  registerLensAction("marketing", "audienceSegment", (ctx, artifact, _params) => {
    const users = artifact.data?.users || [];
    if (users.length === 0) return { ok: true, result: { message: "Add user data to segment audience." } };
    const segments = {};
    for (const u of users) { const seg = u.segment || u.tier || "general"; if (!segments[seg]) segments[seg] = { count: 0, totalSpend: 0 }; segments[seg].count++; segments[seg].totalSpend += parseFloat(u.spend || u.ltv) || 0; }
    const ranked = Object.entries(segments).map(([name, data]) => ({ segment: name, users: data.count, totalSpend: Math.round(data.totalSpend), avgSpend: Math.round(data.totalSpend / data.count * 100) / 100, share: Math.round((data.count / users.length) * 100) })).sort((a, b) => b.avgSpend - a.avgSpend);
    return { ok: true, result: { totalUsers: users.length, segments: ranked, highValue: ranked[0]?.segment, pareto: ranked[0] && ranked[0].totalSpend / ranked.reduce((s, r) => s + r.totalSpend, 0) > 0.5 ? "Top segment drives >50% of revenue" : "Revenue is distributed across segments" } };
  });
}
