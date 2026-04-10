// server/domains/defense.js
export default function registerDefenseActions(registerLensAction) {
  registerLensAction("defense", "threatAssessment", (ctx, artifact, _params) => {
    const threats = artifact.data?.threats || [];
    if (threats.length === 0) return { ok: true, result: { message: "Add threats with likelihood and impact to assess." } };
    const assessed = threats.map(t => {
      const likelihood = parseFloat(t.likelihood) || 0.5;
      const impact = parseFloat(t.impact) || 0.5;
      const riskScore = Math.round(likelihood * impact * 100);
      return { threat: t.name || t.description, category: t.category || "general", likelihood: Math.round(likelihood * 100), impact: Math.round(impact * 100), riskScore, severity: riskScore >= 60 ? "critical" : riskScore >= 40 ? "high" : riskScore >= 20 ? "medium" : "low", mitigation: t.mitigation || "Develop response plan" };
    }).sort((a, b) => b.riskScore - a.riskScore);
    return { ok: true, result: { threats: assessed, critical: assessed.filter(t => t.severity === "critical").length, total: assessed.length, overallThreatLevel: assessed[0]?.severity || "low", topThreat: assessed[0]?.threat } };
  });
  registerLensAction("defense", "readinessScore", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const personnel = parseInt(data.personnelReady) || 0;
    const personnelTotal = parseInt(data.personnelTotal) || 1;
    const equipment = parseInt(data.equipmentOperational) || 0;
    const equipmentTotal = parseInt(data.equipmentTotal) || 1;
    const training = parseFloat(data.trainingCompletionPercent) || 0;
    const supplies = parseFloat(data.suppliesPercent) || 0;
    const personnelReady = Math.round((personnel / personnelTotal) * 100);
    const equipmentReady = Math.round((equipment / equipmentTotal) * 100);
    const overall = Math.round(personnelReady * 0.3 + equipmentReady * 0.3 + training * 0.2 + supplies * 0.2);
    return { ok: true, result: { personnelReadiness: personnelReady, equipmentReadiness: equipmentReady, trainingCompletion: training, supplyLevel: supplies, overallReadiness: overall, status: overall >= 80 ? "combat-ready" : overall >= 60 ? "operationally-ready" : overall >= 40 ? "limited-readiness" : "not-ready", gaps: [personnelReady < 80 ? "Personnel" : null, equipmentReady < 80 ? "Equipment" : null, training < 80 ? "Training" : null, supplies < 80 ? "Supplies" : null].filter(Boolean) } };
  });
  registerLensAction("defense", "incidentResponse", (ctx, artifact, _params) => {
    const incident = artifact.data || {};
    const severity = (incident.severity || "medium").toLowerCase();
    const protocols = { critical: { responseTime: "Immediate (< 5 min)", escalation: "Command level", actions: ["Activate emergency response team", "Secure perimeter", "Notify chain of command", "Begin situation assessment", "Deploy response assets"] }, high: { responseTime: "< 15 min", escalation: "Senior officer", actions: ["Alert response team", "Assess situation", "Implement containment", "Report to command"] }, medium: { responseTime: "< 1 hour", escalation: "Watch officer", actions: ["Log incident", "Assess and monitor", "Determine response level", "Update status"] }, low: { responseTime: "< 4 hours", escalation: "Duty officer", actions: ["Document incident", "Monitor for escalation", "Schedule review"] } };
    const protocol = protocols[severity] || protocols.medium;
    return { ok: true, result: { incidentType: incident.type || "unspecified", severity, responseTime: protocol.responseTime, escalationLevel: protocol.escalation, immediateActions: protocol.actions, logEntry: { time: new Date().toISOString(), type: incident.type, severity, location: incident.location || "unspecified", reporter: incident.reporter || ctx?.userId || "system" } } };
  });
  registerLensAction("defense", "resourceAllocation", (ctx, artifact, _params) => {
    const resources = artifact.data?.resources || [];
    const missions = artifact.data?.missions || [];
    if (resources.length === 0) return { ok: true, result: { message: "Add resources and missions to optimize allocation." } };
    const allocated = missions.map(m => {
      const required = m.resourcesNeeded || 1;
      const priority = m.priority || "medium";
      return { mission: m.name, priority, resourcesNeeded: required, resourcesAssigned: 0, status: "unallocated" };
    }).sort((a, b) => { const p = { critical: 0, high: 1, medium: 2, low: 3 }; return (p[a.priority] || 2) - (p[b.priority] || 2); });
    let available = resources.length;
    for (const m of allocated) { const assign = Math.min(m.resourcesNeeded, available); m.resourcesAssigned = assign; m.status = assign >= m.resourcesNeeded ? "fully-allocated" : assign > 0 ? "partially-allocated" : "unallocated"; available -= assign; }
    return { ok: true, result: { totalResources: resources.length, totalMissions: missions.length, availableAfter: available, allocations: allocated, fullyStaffed: allocated.filter(a => a.status === "fully-allocated").length, understaffed: allocated.filter(a => a.status !== "fully-allocated").length } };
  });
}
