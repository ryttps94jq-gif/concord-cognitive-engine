// server/domains/experience.js
export default function registerExperienceActions(registerLensAction) {
  registerLensAction("experience", "journeyMap", (ctx, artifact, _params) => {
    const stages = artifact.data?.stages || [];
    if (stages.length === 0) return { ok: true, result: { message: "Add journey stages with touchpoints and emotions." } };
    const mapped = stages.map((s, i) => ({ stage: s.name || `Stage ${i + 1}`, touchpoints: s.touchpoints || [], emotion: s.emotion || "neutral", painPoints: s.painPoints || [], opportunities: s.opportunities || [], satisfactionScore: parseInt(s.satisfaction) || 50 }));
    const avgSatisfaction = Math.round(mapped.reduce((sum, s) => sum + s.satisfactionScore, 0) / mapped.length);
    const lowestPoint = mapped.sort((a, b) => a.satisfactionScore - b.satisfactionScore)[0];
    return { ok: true, result: { stages: mapped, totalStages: mapped.length, avgSatisfaction, lowestPoint: lowestPoint?.stage, totalPainPoints: mapped.reduce((s, m) => s + m.painPoints.length, 0), totalOpportunities: mapped.reduce((s, m) => s + m.opportunities.length, 0) } };
  });
  registerLensAction("experience", "usabilityScore", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const taskSuccess = parseFloat(data.taskSuccessRate) || 0;
    const timeOnTask = parseFloat(data.avgTimeSeconds) || 0;
    const errors = parseInt(data.errorCount) || 0;
    const satisfaction = parseFloat(data.satisfactionScore) || 0;
    const sus = Math.round(taskSuccess * 25 + Math.max(0, 100 - timeOnTask / 2) * 0.25 + Math.max(0, 100 - errors * 10) * 0.25 + satisfaction * 0.25);
    return { ok: true, result: { taskSuccessRate: taskSuccess, avgTimeSeconds: timeOnTask, errorCount: errors, satisfactionScore: satisfaction, susScore: Math.min(100, sus), grade: sus >= 80 ? "A" : sus >= 68 ? "B" : sus >= 50 ? "C" : "D", benchmark: "Industry average SUS score is 68" } };
  });
  registerLensAction("experience", "heuristicEval", (ctx, artifact, _params) => {
    const heuristics = [ "Visibility of system status", "Match between system and real world", "User control and freedom", "Consistency and standards", "Error prevention", "Recognition rather than recall", "Flexibility and efficiency", "Aesthetic and minimalist design", "Help users recognize errors", "Help and documentation" ];
    const evaluations = artifact.data?.evaluations || [];
    const scored = heuristics.map((h, i) => { const ev = evaluations[i] || {}; return { heuristic: h, score: parseInt(ev.score) || 0, severity: parseInt(ev.severity) || 0, notes: ev.notes || "", finding: ev.finding || "" }; });
    const avgScore = scored.reduce((s, h) => s + h.score, 0) / scored.length;
    return { ok: true, result: { heuristics: scored, avgScore: Math.round(avgScore * 10) / 10, criticalIssues: scored.filter(h => h.severity >= 4).length, evaluated: evaluations.length, total: heuristics.length } };
  });
  registerLensAction("experience", "personaBuilder", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    return { ok: true, result: { persona: { name: data.name || artifact.title, age: data.age || "30-40", occupation: data.occupation || "Professional", goals: data.goals || [], frustrations: data.frustrations || [], behaviors: data.behaviors || [], techSavvy: data.techSavvy || "moderate", quote: data.quote || "" }, completeness: Math.round(([data.name, data.age, data.occupation, (data.goals || []).length, (data.frustrations || []).length].filter(Boolean).length / 5) * 100) } };
  });
}
