// server/domains/hvac.js
export default function registerHVACActions(registerLensAction) {
  registerLensAction("hvac", "loadCalculation", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const sqft = parseFloat(data.squareFootage) || 1000;
    const stories = parseInt(data.stories) || 1;
    const insulation = (data.insulation || "average").toLowerCase();
    const climate = (data.climate || "temperate").toLowerCase();
    const baseBTU = sqft * 25;
    const insMultiplier = insulation === "excellent" ? 0.8 : insulation === "good" ? 0.9 : insulation === "average" ? 1.0 : 1.2;
    const climateMultiplier = climate === "hot" ? 1.3 : climate === "cold" ? 1.2 : climate === "humid" ? 1.25 : 1.0;
    const storyMultiplier = stories > 1 ? 1 + (stories - 1) * 0.1 : 1;
    const totalBTU = Math.round(baseBTU * insMultiplier * climateMultiplier * storyMultiplier);
    const tons = Math.round(totalBTU / 12000 * 10) / 10;
    return { ok: true, result: { squareFootage: sqft, requiredBTU: totalBTU, tonnage: tons, unitSize: `${Math.ceil(tons * 2) / 2} ton system`, insulation, climate, estimatedCost: Math.round(tons * 3500), energyEstimate: `${Math.round(totalBTU / 3412 * 8)} kWh/day at peak`, seerRecommendation: climate === "hot" ? "SEER 16+" : "SEER 14+" } };
  });
  registerLensAction("hvac", "energyAudit", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const monthlyBill = parseFloat(data.monthlyBill) || 0;
    const sqft = parseFloat(data.squareFootage) || 1000;
    const systemAge = parseInt(data.systemAge) || 0;
    const costPerSqFt = sqft > 0 ? Math.round((monthlyBill * 12 / sqft) * 100) / 100 : 0;
    const efficiencyLoss = Math.min(50, systemAge * 2);
    const potentialSavings = Math.round(monthlyBill * efficiencyLoss / 100);
    const issues = [];
    if (systemAge > 15) issues.push("System past expected lifespan — consider replacement");
    if (costPerSqFt > 3) issues.push("Energy cost per sqft is above average");
    if (systemAge > 10) issues.push("Refrigerant may need checking");
    return { ok: true, result: { monthlyBill, annualCost: monthlyBill * 12, costPerSqFt, systemAge, efficiencyLoss: `${efficiencyLoss}%`, potentialMonthlySavings: potentialSavings, potentialAnnualSavings: potentialSavings * 12, issues, grade: costPerSqFt < 1.5 ? "A" : costPerSqFt < 2.5 ? "B" : costPerSqFt < 3.5 ? "C" : "D" } };
  });
  registerLensAction("hvac", "maintenanceSchedule", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const systemType = (data.systemType || "central-ac").toLowerCase();
    const lastService = data.lastServiceDate ? new Date(data.lastServiceDate) : null;
    const tasks = [
      { task: "Replace air filter", frequency: "Every 1-3 months", priority: "high", diy: true },
      { task: "Clean outdoor condenser coils", frequency: "Annually (spring)", priority: "medium", diy: true },
      { task: "Check refrigerant levels", frequency: "Annually", priority: "high", diy: false },
      { task: "Inspect ductwork for leaks", frequency: "Every 2 years", priority: "medium", diy: false },
      { task: "Lubricate motor bearings", frequency: "Annually", priority: "medium", diy: false },
      { task: "Test thermostat calibration", frequency: "Annually", priority: "low", diy: true },
      { task: "Flush drain line", frequency: "Every 6 months", priority: "medium", diy: true },
      { task: "Check electrical connections", frequency: "Annually", priority: "high", diy: false },
    ];
    const daysSinceService = lastService ? Math.round((Date.now() - lastService.getTime()) / 86400000) : 999;
    return { ok: true, result: { systemType, lastService: lastService?.toISOString().split("T")[0] || "unknown", daysSinceService, overdue: daysSinceService > 365, tasks, diyTasks: tasks.filter(t => t.diy).length, proTasks: tasks.filter(t => !t.diy).length, nextServiceDue: daysSinceService > 180 ? "Schedule service soon" : "On track" } };
  });
  registerLensAction("hvac", "zoneBalance", (ctx, artifact, _params) => {
    const zones = artifact.data?.zones || [];
    if (zones.length === 0) return { ok: true, result: { message: "Add zones with temperatures to check balance." } };
    const temps = zones.map(z => ({ zone: z.name || z.room, current: parseFloat(z.currentTemp) || 72, target: parseFloat(z.targetTemp) || 72, deviation: Math.abs((parseFloat(z.currentTemp) || 72) - (parseFloat(z.targetTemp) || 72)) }));
    const maxDeviation = Math.max(...temps.map(t => t.deviation));
    const avgDeviation = Math.round(temps.reduce((s, t) => s + t.deviation, 0) / temps.length * 10) / 10;
    return { ok: true, result: { zones: temps, maxDeviation, avgDeviation, balanced: maxDeviation < 3, worstZone: temps.sort((a, b) => b.deviation - a.deviation)[0]?.zone, recommendations: maxDeviation > 5 ? ["Check damper settings", "Inspect ductwork for blockages", "Consider zone control system"] : maxDeviation > 2 ? ["Adjust dampers", "Check vents are open"] : ["System is well-balanced"] } };
  });
}
