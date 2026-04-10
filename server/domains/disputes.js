// server/domains/disputes.js
export default function registerDisputesActions(registerLensAction) {
  registerLensAction("disputes", "assessDispute", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const parties = data.parties || [];
    const amount = parseFloat(data.disputeAmount) || 0;
    const category = (data.category || "general").toLowerCase();
    const complexity = parties.length > 2 ? "multi-party" : "bilateral";
    const tier = amount > 100000 ? "high-value" : amount > 10000 ? "medium-value" : "low-value";
    const methods = [{ method: "Negotiation", cost: "Low", timeWeeks: 2, bindng: false, suitable: true }, { method: "Mediation", cost: "Medium", timeWeeks: 6, binding: false, suitable: amount < 100000 }, { method: "Arbitration", cost: "High", timeWeeks: 12, binding: true, suitable: true }, { method: "Litigation", cost: "Very High", timeWeeks: 52, binding: true, suitable: amount > 50000 }];
    return { ok: true, result: { parties: parties.length, complexity, valueTier: tier, disputeAmount: amount, category, recommendedMethods: methods.filter(m => m.suitable), preferredMethod: amount < 10000 ? "Negotiation" : amount < 50000 ? "Mediation" : "Arbitration" } };
  });
  registerLensAction("disputes", "timelineTrack", (ctx, artifact, _params) => {
    const events = artifact.data?.events || [];
    const sorted = events.map(e => ({ ...e, date: new Date(e.date) })).sort((a, b) => a.date.getTime() - b.date.getTime());
    const daysElapsed = sorted.length >= 2 ? Math.ceil((sorted[sorted.length - 1].date.getTime() - sorted[0].date.getTime()) / 86400000) : 0;
    return { ok: true, result: { events: sorted.map(e => ({ date: e.date.toISOString().split("T")[0], event: e.description || e.event, party: e.party || "both" })), totalEvents: events.length, daysElapsed, status: daysElapsed > 180 ? "protracted" : daysElapsed > 90 ? "extended" : "active", deadlines: events.filter(e => e.deadline).map(e => ({ event: e.description, deadline: e.deadline })) } };
  });
  registerLensAction("disputes", "settlementCalc", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const claimed = parseFloat(data.claimedAmount) || 0;
    const offered = parseFloat(data.offerAmount) || 0;
    const legalCosts = parseFloat(data.legalCosts) || 0;
    const winProbability = parseFloat(data.winProbability) || 0.5;
    const expectedValue = claimed * winProbability;
    const netAfterCosts = expectedValue - legalCosts;
    const settlementZone = { min: Math.round(expectedValue * 0.6), max: Math.round(expectedValue * 1.1), midpoint: Math.round(expectedValue * 0.85) };
    return { ok: true, result: { claimed, offered, legalCosts, winProbability: Math.round(winProbability * 100), expectedValue: Math.round(expectedValue), netAfterCosts: Math.round(netAfterCosts), settlementZone, recommendation: offered >= settlementZone.min ? "Offer is within settlement zone — consider accepting" : "Offer is below expected value — negotiate higher" } };
  });
  registerLensAction("disputes", "evidenceStrength", (ctx, artifact, _params) => {
    const evidence = artifact.data?.evidence || [];
    if (evidence.length === 0) return { ok: true, result: { message: "Add evidence items to assess strength." } };
    const weights = { document: 3, witness: 2, photo: 2.5, video: 3, expert: 3.5, digital: 2, physical: 2.5, correspondence: 2 };
    const scored = evidence.map(e => {
      const type = (e.type || "document").toLowerCase();
      const weight = weights[type] || 2;
      const reliability = parseFloat(e.reliability) || 0.7;
      return { item: e.name || e.description, type, weight, reliability: Math.round(reliability * 100), score: Math.round(weight * reliability * 100) / 100 };
    }).sort((a, b) => b.score - a.score);
    const avgScore = scored.reduce((s, e) => s + e.score, 0) / scored.length;
    return { ok: true, result: { evidence: scored, totalPieces: scored.length, avgStrength: Math.round(avgScore * 100) / 100, strongestEvidence: scored[0]?.item, caseStrength: avgScore > 2 ? "strong" : avgScore > 1.5 ? "moderate" : "weak" } };
  });
}
