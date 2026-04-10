// server/domains/history.js
export default function registerHistoryActions(registerLensAction) {
  registerLensAction("history", "timelineBuild", (ctx, artifact, _params) => {
    const events = artifact.data?.events || [];
    if (events.length === 0) return { ok: true, result: { message: "Add historical events with dates to build timeline." } };
    const sorted = events.map(e => ({ event: e.name || e.title, date: e.date || e.year, era: e.era || "", significance: e.significance || "medium", category: e.category || "political" })).sort((a, b) => { const ya = parseInt(String(a.date).replace(/[^\d-]/g, "")) || 0; const yb = parseInt(String(b.date).replace(/[^\d-]/g, "")) || 0; return ya - yb; });
    const span = sorted.length >= 2 ? `${sorted[0].date} to ${sorted[sorted.length - 1].date}` : "single event";
    return { ok: true, result: { timeline: sorted, totalEvents: sorted.length, timeSpan: span, categories: [...new Set(sorted.map(e => e.category))], eras: [...new Set(sorted.map(e => e.era).filter(Boolean))], pivotalEvents: sorted.filter(e => e.significance === "high" || e.significance === "critical") } };
  });
  registerLensAction("history", "sourceEvaluate", (ctx, artifact, _params) => {
    const source = artifact.data || {};
    const type = (source.type || "secondary").toLowerCase();
    const date = source.date || "";
    const author = source.author || "";
    const bias = (source.bias || "unknown").toLowerCase();
    const typeScore = type === "primary" ? 90 : type === "secondary" ? 60 : 30;
    const biasScore = bias === "none" || bias === "low" ? 90 : bias === "moderate" ? 50 : 20;
    const reliability = Math.round((typeScore * 0.4 + biasScore * 0.3 + (author ? 20 : 0) + (date ? 10 : 0)));
    return { ok: true, result: { title: source.title || artifact.title, type, author, date, bias, reliabilityScore: reliability, classification: reliability >= 70 ? "highly-reliable" : reliability >= 40 ? "use-with-caution" : "questionable", corroborationNeeded: reliability < 60, evaluation: { sourceType: typeScore, biasAssessment: biasScore, authorAttribution: author ? "yes" : "missing", dateProvenance: date ? "yes" : "missing" } } };
  });
  registerLensAction("history", "comparePeriods", (ctx, artifact, _params) => {
    const periods = artifact.data?.periods || [];
    if (periods.length < 2) return { ok: true, result: { message: "Add at least 2 historical periods to compare." } };
    const compared = periods.map(p => ({ name: p.name, startYear: p.startYear, endYear: p.endYear, duration: (parseInt(p.endYear) || 0) - (parseInt(p.startYear) || 0), keyFeatures: p.features || [], population: p.population || "unknown", technology: p.technology || "unknown", governance: p.governance || "unknown" }));
    return { ok: true, result: { periods: compared, longestPeriod: compared.sort((a, b) => b.duration - a.duration)[0]?.name, shortestPeriod: compared.sort((a, b) => a.duration - b.duration)[0]?.name, sharedFeatures: compared.reduce((shared, p) => { if (shared === null) return new Set(p.keyFeatures); return new Set([...shared].filter(f => p.keyFeatures.includes(f))); }, null) || [] } };
  });
  registerLensAction("history", "causeEffect", (ctx, artifact, _params) => {
    const chains = artifact.data?.chains || [];
    if (chains.length === 0) return { ok: true, result: { message: "Map cause-effect chains to analyze historical causation." } };
    const analyzed = chains.map(c => ({ cause: c.cause, effect: c.effect, type: c.type || "direct", strength: c.strength || "moderate", timelag: c.timelag || "unknown", evidence: c.evidence || [] }));
    return { ok: true, result: { chains: analyzed, totalLinks: analyzed.length, directCauses: analyzed.filter(c => c.type === "direct").length, indirectCauses: analyzed.filter(c => c.type === "indirect").length, strongLinks: analyzed.filter(c => c.strength === "strong").length, rootCauses: analyzed.filter(c => !chains.some(other => other.effect === c.cause)).map(c => c.cause) } };
  });
}
