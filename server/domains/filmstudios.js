// server/domains/filmstudios.js
export default function registerFilmStudiosActions(registerLensAction) {
  registerLensAction("film-studios", "budgetBreakdown", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const totalBudget = parseFloat(data.totalBudget) || 0;
    const categories = { "above-the-line": 0.25, "below-the-line": 0.40, "post-production": 0.15, "marketing": 0.15, "contingency": 0.05 };
    const breakdown = Object.entries(categories).map(([cat, pct]) => ({ category: cat.replace(/-/g, " "), percentage: pct * 100, amount: Math.round(totalBudget * pct * 100) / 100 }));
    return { ok: true, result: { totalBudget, breakdown, aboveTheLine: { talent: Math.round(totalBudget * 0.12), director: Math.round(totalBudget * 0.08), producer: Math.round(totalBudget * 0.05) }, tip: totalBudget > 1000000 ? "Consider completion bond insurance" : "Indie budget — maximize crew flexibility" } };
  });
  registerLensAction("film-studios", "scheduleShoot", (ctx, artifact, _params) => {
    const scenes = artifact.data?.scenes || [];
    if (scenes.length === 0) return { ok: true, result: { message: "Add scenes with location and cast to schedule." } };
    const byLocation = {};
    for (const s of scenes) { const loc = s.location || "Studio"; if (!byLocation[loc]) byLocation[loc] = []; byLocation[loc].push(s); }
    const schedule = Object.entries(byLocation).map(([loc, locationScenes]) => ({ location: loc, scenes: locationScenes.length, estimatedDays: Math.ceil(locationScenes.length / 3), cast: [...new Set(locationScenes.flatMap(s => s.cast || []))] }));
    const totalDays = schedule.reduce((s, loc) => s + loc.estimatedDays, 0);
    return { ok: true, result: { locations: schedule, totalScenes: scenes.length, totalShootDays: totalDays, totalWeeks: Math.ceil(totalDays / 5), avgScenesPerDay: Math.round(scenes.length / totalDays * 10) / 10 } };
  });
  registerLensAction("film-studios", "castAnalysis", (ctx, artifact, _params) => {
    const cast = artifact.data?.cast || [];
    if (cast.length === 0) return { ok: true, result: { message: "Add cast members to analyze." } };
    const analyzed = cast.map(c => ({ name: c.name, role: c.role || "supporting", scenes: parseInt(c.sceneCount) || 0, dailyRate: parseFloat(c.dailyRate) || 0, totalCost: (parseInt(c.sceneCount) || 0) * (parseFloat(c.dailyRate) || 0) / 3 }));
    const totalCastBudget = analyzed.reduce((s, c) => s + c.totalCost, 0);
    return { ok: true, result: { cast: analyzed, totalCast: cast.length, leads: cast.filter(c => (c.role || "").toLowerCase().includes("lead")).length, totalCastBudget: Math.round(totalCastBudget), topCost: analyzed.sort((a, b) => b.totalCost - a.totalCost)[0]?.name } };
  });
  registerLensAction("film-studios", "postProductionTimeline", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const runtime = parseInt(data.runtimeMinutes) || 90;
    const vfxShots = parseInt(data.vfxShots) || 0;
    const baseWeeks = Math.ceil(runtime / 15);
    const editWeeks = baseWeeks;
    const soundWeeks = Math.ceil(baseWeeks * 0.6);
    const vfxWeeks = vfxShots > 0 ? Math.ceil(vfxShots / 10) : 0;
    const colorWeeks = Math.ceil(baseWeeks * 0.3);
    const totalWeeks = editWeeks + Math.max(soundWeeks, vfxWeeks) + colorWeeks;
    return { ok: true, result: { runtime, vfxShots, phases: [{ phase: "Edit", weeks: editWeeks }, { phase: "Sound Design & Mix", weeks: soundWeeks }, { phase: "VFX", weeks: vfxWeeks }, { phase: "Color Grading", weeks: colorWeeks }], totalWeeks, parallelizable: "Sound and VFX can run in parallel", estimatedCompletion: `${totalWeeks} weeks from wrap` } };
  });
}
