// server/domains/daily.js
export default function registerDailyActions(registerLensAction) {
  registerLensAction("daily", "dailySummary", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const entries = data.entries || [];
    const sessions = data.sessions || [];
    const tasks = data.tasks || [];
    const completedTasks = tasks.filter(t => t.completed || t.status === "completed").length;
    const totalMinutes = sessions.reduce((s, ses) => s + (parseInt(ses.duration) || 0), 0);
    const mood = data.mood !== undefined ? data.mood : null;
    return { ok: true, result: { date: data.date || new Date().toISOString().split("T")[0], entriesLogged: entries.length, sessionsCompleted: sessions.length, totalFocusMinutes: totalMinutes, tasksCompleted: completedTasks, totalTasks: tasks.length, completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0, mood: mood !== null ? mood : "not-recorded", productivityScore: Math.min(100, Math.round(completedTasks * 15 + totalMinutes / 5 + entries.length * 10)) } };
  });
  registerLensAction("daily", "habitStreak", (ctx, artifact, _params) => {
    const habits = artifact.data?.habits || [];
    const history = artifact.data?.history || [];
    const analyzed = habits.map(h => {
      const name = h.name || h;
      const completions = history.filter(d => (d.habits || []).includes(name));
      let currentStreak = 0; const now = new Date();
      for (let i = 0; i < 365; i++) { const date = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0]; if (completions.some(c => c.date === date)) currentStreak++; else break; }
      return { habit: name, currentStreak, longestStreak: Math.max(currentStreak, parseInt(h.longestStreak) || 0), totalCompletions: completions.length, status: currentStreak >= 7 ? "strong" : currentStreak >= 3 ? "building" : currentStreak >= 1 ? "starting" : "broken" };
    });
    return { ok: true, result: { habits: analyzed, activeHabits: analyzed.filter(h => h.currentStreak > 0).length, totalHabits: habits.length, bestStreak: analyzed.sort((a, b) => b.currentStreak - a.currentStreak)[0] } };
  });
  registerLensAction("daily", "focusTimer", (ctx, artifact, _params) => {
    const sessions = artifact.data?.sessions || [];
    const today = new Date().toISOString().split("T")[0];
    const todaySessions = sessions.filter(s => (s.date || s.startedAt || "").startsWith(today));
    const totalMinutes = todaySessions.reduce((s, ses) => s + (parseInt(ses.duration) || 25), 0);
    const categories = {};
    for (const s of todaySessions) { const cat = s.category || s.project || "General"; categories[cat] = (categories[cat] || 0) + (parseInt(s.duration) || 25); }
    return { ok: true, result: { date: today, sessionsToday: todaySessions.length, totalMinutes, totalHours: Math.round(totalMinutes / 60 * 10) / 10, byCategory: categories, pomodorosCompleted: Math.floor(totalMinutes / 25), targetMinutes: 240, progress: Math.round((totalMinutes / 240) * 100) } };
  });
  registerLensAction("daily", "weeklyReview", (ctx, artifact, _params) => {
    const days = artifact.data?.days || [];
    if (days.length === 0) return { ok: true, result: { message: "Log daily data to generate weekly review." } };
    const totalTasks = days.reduce((s, d) => s + (parseInt(d.tasksCompleted) || 0), 0);
    const totalFocus = days.reduce((s, d) => s + (parseInt(d.focusMinutes) || 0), 0);
    const avgMood = days.filter(d => d.mood !== undefined).length > 0 ? Math.round(days.filter(d => d.mood !== undefined).reduce((s, d) => s + d.mood, 0) / days.filter(d => d.mood !== undefined).length * 10) / 10 : null;
    const bestDay = days.sort((a, b) => (b.tasksCompleted || 0) - (a.tasksCompleted || 0))[0];
    return { ok: true, result: { daysTracked: days.length, totalTasksCompleted: totalTasks, totalFocusMinutes: totalFocus, totalFocusHours: Math.round(totalFocus / 60 * 10) / 10, avgMood, bestDay: bestDay?.date || "N/A", avgTasksPerDay: Math.round(totalTasks / Math.max(days.length, 1) * 10) / 10, avgFocusPerDay: Math.round(totalFocus / Math.max(days.length, 1)) } };
  });
}
