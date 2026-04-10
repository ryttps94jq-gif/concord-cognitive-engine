// server/domains/emergencyservices.js
export default function registerEmergencyServicesActions(registerLensAction) {
  registerLensAction("emergency-services", "triageAssess", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const severity = parseInt(data.severity) || 3; // 1-5, 1 = most severe
    const vitals = data.vitals || {};
    const breathing = vitals.breathing !== false;
    const conscious = vitals.conscious !== false;
    const pulse = parseInt(vitals.pulse) || 80;
    const triageLevel = !breathing ? 1 : !conscious ? 1 : severity <= 2 ? 2 : pulse > 120 || pulse < 50 ? 2 : severity <= 3 ? 3 : 4;
    const colors = { 1: "RED — Immediate", 2: "YELLOW — Delayed", 3: "GREEN — Minor", 4: "GREEN — Walking wounded", 5: "BLACK — Expectant" };
    return { ok: true, result: { triageLevel, triageColor: colors[triageLevel] || colors[3], breathing, conscious, pulse, reportedSeverity: severity, responseTime: triageLevel === 1 ? "Immediate" : triageLevel === 2 ? "< 15 minutes" : "< 60 minutes", actions: triageLevel === 1 ? ["Secure airway", "Control bleeding", "Initiate CPR if needed", "Rapid transport"] : triageLevel === 2 ? ["Assess injuries", "Apply first aid", "Monitor vitals", "Transport when available"] : ["Basic first aid", "Self-care instructions", "Follow-up appointment"] } };
  });
  registerLensAction("emergency-services", "dispatchOptimize", (ctx, artifact, _params) => {
    const units = artifact.data?.units || [];
    const incidents = artifact.data?.incidents || [];
    if (units.length === 0) return { ok: true, result: { message: "Add available units to optimize dispatch." } };
    const available = units.filter(u => u.status === "available" || !u.status);
    const assigned = incidents.map(inc => {
      const priority = parseInt(inc.priority) || 3;
      const nearest = available.sort((a, b) => (parseFloat(a.distanceKm) || 99) - (parseFloat(b.distanceKm) || 99))[0];
      return { incident: inc.description || inc.type, priority, assignedUnit: nearest?.name || "NONE AVAILABLE", eta: nearest ? `${Math.round((parseFloat(nearest.distanceKm) || 5) / 50 * 60)} minutes` : "N/A" };
    });
    return { ok: true, result: { totalUnits: units.length, available: available.length, activeIncidents: incidents.length, assignments: assigned, coverageGap: available.length < incidents.length } };
  });
  registerLensAction("emergency-services", "incidentLog", (ctx, artifact, _params) => {
    const incidents = artifact.data?.incidents || [];
    const now = new Date();
    const last24h = incidents.filter(i => (now.getTime() - new Date(i.timestamp || i.date || 0).getTime()) < 86400000);
    const byType = {};
    for (const i of last24h) { const t = i.type || "other"; byType[t] = (byType[t] || 0) + 1; }
    return { ok: true, result: { total24h: last24h.length, totalAllTime: incidents.length, byType, mostCommon: Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || "none", avgResponseMinutes: last24h.length > 0 ? Math.round(last24h.reduce((s, i) => s + (parseFloat(i.responseMinutes) || 10), 0) / last24h.length) : 0, trend: last24h.length > incidents.length / 7 ? "above-average" : "normal" } };
  });
  registerLensAction("emergency-services", "resourceReadiness", (ctx, artifact, _params) => {
    const resources = artifact.data?.resources || {};
    const vehicles = parseInt(resources.vehicles) || 0;
    const vehiclesReady = parseInt(resources.vehiclesReady) || 0;
    const personnel = parseInt(resources.personnel) || 0;
    const personnelOnDuty = parseInt(resources.personnelOnDuty) || 0;
    const suppliesPercent = parseFloat(resources.suppliesPercent) || 100;
    const vehicleReady = vehicles > 0 ? Math.round((vehiclesReady / vehicles) * 100) : 0;
    const personnelReady = personnel > 0 ? Math.round((personnelOnDuty / personnel) * 100) : 0;
    const overall = Math.round((vehicleReady * 0.35 + personnelReady * 0.35 + suppliesPercent * 0.3));
    return { ok: true, result: { vehicleReadiness: vehicleReady, personnelReadiness: personnelReady, suppliesLevel: suppliesPercent, overallReadiness: overall, status: overall >= 80 ? "fully-operational" : overall >= 60 ? "operational" : overall >= 40 ? "limited" : "critical", shortages: [vehicleReady < 70 ? "Vehicles" : null, personnelReady < 70 ? "Personnel" : null, suppliesPercent < 50 ? "Supplies" : null].filter(Boolean) } };
  });
}
