// server/domains/gamedesign.js
export default function registerGameDesignActions(registerLensAction) {
  registerLensAction("game-design", "mechanicsAnalysis", (ctx, artifact, _params) => {
    const mechanics = artifact.data?.mechanics || [];
    if (mechanics.length === 0) return { ok: true, result: { message: "Add game mechanics to analyze design." } };
    const categories = { core: [], progression: [], social: [], economy: [], combat: [] };
    for (const m of mechanics) { const cat = (m.category || "core").toLowerCase(); if (categories[cat]) categories[cat].push(m); else categories.core.push(m); }
    const depth = Math.min(100, mechanics.length * 8 + Object.values(categories).filter(c => c.length > 0).length * 15);
    return { ok: true, result: { totalMechanics: mechanics.length, categories: Object.entries(categories).map(([k, v]) => ({ category: k, count: v.length })), depthScore: depth, loopCount: mechanics.filter(m => m.loop || m.isLoop).length, emergentPotential: mechanics.length > 5 && Object.values(categories).filter(c => c.length > 0).length >= 3 ? "high" : "moderate", pillars: Object.entries(categories).filter(([, v]) => v.length > 0).map(([k]) => k) } };
  });
  registerLensAction("game-design", "playerFlow", (ctx, artifact, _params) => {
    const states = artifact.data?.states || [];
    if (states.length === 0) return { ok: true, result: { message: "Define player states to analyze flow." } };
    const analyzed = states.map(s => ({ state: s.name, challenge: parseFloat(s.challenge) || 50, skill: parseFloat(s.skillRequired) || 50, duration: parseFloat(s.durationMinutes) || 10, flowZone: Math.abs((parseFloat(s.challenge) || 50) - (parseFloat(s.skillRequired) || 50)) < 15 }));
    const inFlow = analyzed.filter(s => s.flowZone).length;
    return { ok: true, result: { states: analyzed, totalStates: states.length, inFlowZone: inFlow, flowPercent: Math.round((inFlow / states.length) * 100), totalDuration: analyzed.reduce((s, a) => s + a.duration, 0), pacing: inFlow / states.length > 0.6 ? "well-paced" : "needs-tension-relief-balance" } };
  });
  registerLensAction("game-design", "narrativeBranch", (ctx, artifact, _params) => {
    const nodes = artifact.data?.nodes || [];
    if (nodes.length === 0) return { ok: true, result: { message: "Add narrative nodes with choices to map branching." } };
    const totalChoices = nodes.reduce((s, n) => s + ((n.choices || []).length), 0);
    const endings = nodes.filter(n => n.isEnding || (n.choices || []).length === 0);
    const avgChoices = nodes.length > 0 ? Math.round(totalChoices / nodes.length * 10) / 10 : 0;
    const maxDepth = Math.ceil(Math.log2(nodes.length + 1));
    return { ok: true, result: { totalNodes: nodes.length, totalChoices, avgChoicesPerNode: avgChoices, endings: endings.length, maxBranchDepth: maxDepth, complexity: nodes.length > 20 ? "highly-branching" : nodes.length > 8 ? "moderate-branching" : "linear-with-choices", replayValue: endings.length >= 3 ? "high" : endings.length >= 2 ? "moderate" : "low" } };
  });
  registerLensAction("game-design", "monetizationModel", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const model = (data.model || "premium").toLowerCase();
    const models = {
      premium: { revenue: "one-time", avgLTV: 30, retention: "lower", fairness: "high", development: "standard" },
      "free-to-play": { revenue: "ongoing", avgLTV: 5, retention: "higher", fairness: "variable", development: "live-service" },
      subscription: { revenue: "recurring", avgLTV: 60, retention: "medium", fairness: "high", development: "content-pipeline" },
      "battle-pass": { revenue: "seasonal", avgLTV: 40, retention: "higher", fairness: "moderate", development: "seasonal-content" },
    };
    const chosen = models[model] || models.premium;
    const dau = parseInt(data.expectedDAU) || 10000;
    const conversionRate = model === "premium" ? 1 : parseFloat(data.conversionRate) || 0.05;
    const projectedMonthly = Math.round(dau * conversionRate * chosen.avgLTV / 12);
    return { ok: true, result: { model, ...chosen, expectedDAU: dau, conversionRate: `${(conversionRate * 100).toFixed(1)}%`, projectedMonthlyRevenue: projectedMonthly, projectedAnnualRevenue: projectedMonthly * 12, ethicalConsiderations: model === "free-to-play" ? ["Avoid pay-to-win mechanics", "Don't target vulnerable players", "Transparent odds for loot boxes"] : ["Fair pricing for content"] } };
  });
}
