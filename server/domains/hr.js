// server/domains/hr.js
export default function registerHRActions(registerLensAction) {
  registerLensAction("hr", "compensationBenchmark", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const salary = parseFloat(data.salary) || 0;
    const role = data.role || data.title || "";
    const experience = parseInt(data.yearsExperience) || 0;
    const location = data.location || "national";
    const baseMultiplier = experience < 2 ? 0.85 : experience < 5 ? 1.0 : experience < 10 ? 1.15 : 1.3;
    const locationMultiplier = (location.toLowerCase().includes("sf") || location.toLowerCase().includes("nyc")) ? 1.3 : location.toLowerCase().includes("remote") ? 0.9 : 1.0;
    const benchmarkSalary = Math.round(salary * baseMultiplier * locationMultiplier);
    const percentile = salary >= benchmarkSalary * 1.1 ? 75 : salary >= benchmarkSalary * 0.9 ? 50 : 25;
    return { ok: true, result: { role, salary, yearsExperience: experience, location, benchmarkSalary, percentile, competitive: percentile >= 50 ? "competitive" : "below-market", recommendation: percentile < 50 ? `Consider adjusting to $${benchmarkSalary} to remain competitive` : "Compensation is market-rate" } };
  });
  registerLensAction("hr", "turnoverAnalysis", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const employees = parseInt(data.totalEmployees) || 100;
    const departures = parseInt(data.departuresThisYear) || 0;
    const avgTenure = parseFloat(data.avgTenureYears) || 3;
    const rate = employees > 0 ? Math.round((departures / employees) * 100) : 0;
    const costPerTurnover = parseFloat(data.avgSalary || 70000) * 0.5;
    return { ok: true, result: { totalEmployees: employees, departures, turnoverRate: rate, avgTenure, industryAvg: 15, aboveIndustry: rate > 15, annualCost: Math.round(departures * costPerTurnover), costPerDeparture: Math.round(costPerTurnover), riskLevel: rate > 25 ? "critical" : rate > 15 ? "elevated" : "healthy", recommendations: rate > 15 ? ["Exit interview analysis", "Compensation review", "Manager training", "Career development programs"] : ["Continue current retention strategies"] } };
  });
  registerLensAction("hr", "interviewScorecard", (ctx, artifact, _params) => {
    const candidates = artifact.data?.candidates || [];
    if (candidates.length === 0) return { ok: true, result: { message: "Add candidates with interview scores." } };
    const scored = candidates.map(c => { const technical = parseFloat(c.technical) || 0; const cultural = parseFloat(c.cultural) || 0; const communication = parseFloat(c.communication) || 0; const experience = parseFloat(c.experience) || 0; const overall = Math.round((technical * 0.35 + cultural * 0.25 + communication * 0.2 + experience * 0.2) * 10) / 10; return { name: c.name, technical, cultural, communication, experience, overall, recommendation: overall >= 4 ? "strong-hire" : overall >= 3 ? "hire" : overall >= 2.5 ? "maybe" : "no-hire" }; }).sort((a, b) => b.overall - a.overall);
    return { ok: true, result: { candidates: scored, topCandidate: scored[0]?.name, strongHires: scored.filter(c => c.recommendation === "strong-hire").length, avgScore: Math.round(scored.reduce((s, c) => s + c.overall, 0) / scored.length * 10) / 10 } };
  });
  registerLensAction("hr", "ptoBalance", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const totalDays = parseInt(data.totalPTO) || 20;
    const used = parseInt(data.usedPTO) || 0;
    const pending = parseInt(data.pendingRequests) || 0;
    const remaining = totalDays - used - pending;
    const monthsLeft = 12 - new Date().getMonth();
    return { ok: true, result: { totalPTO: totalDays, used, pending, remaining, monthsRemaining: monthsLeft, burnRate: used > 0 ? Math.round(used / (12 - monthsLeft) * 10) / 10 : 0, projectedYearEnd: Math.round(remaining - (used / Math.max(12 - monthsLeft, 1)) * monthsLeft), recommendation: remaining > totalDays * 0.6 && monthsLeft < 4 ? "Use PTO — significant balance remaining before year-end" : "PTO usage is on track" } };
  });
}
