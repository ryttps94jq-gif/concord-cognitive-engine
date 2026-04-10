// server/domains/automotive.js
// Domain actions for automotive: diagnostic code lookup, maintenance scheduling,
// fuel efficiency analysis, tire wear prediction, repair cost estimation.

export default function registerAutomotiveActions(registerLensAction) {
  registerLensAction("automotive", "diagnosticLookup", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const code = (data.code || data.dtcCode || "").toUpperCase();
    if (!code) return { ok: true, result: { message: "Provide a DTC code (e.g., P0300) for diagnosis." } };
    const prefix = code[0];
    const systems = { P: "Powertrain", B: "Body", C: "Chassis", U: "Network" };
    const system = systems[prefix] || "Unknown";
    const codeNum = parseInt(code.slice(1)) || 0;
    const severity = codeNum < 100 ? "critical" : codeNum < 300 ? "moderate" : "informational";
    const commonCodes = {
      P0300: { desc: "Random/Multiple Cylinder Misfire", fix: "Check spark plugs, ignition coils, fuel injectors", costRange: "$100-$600" },
      P0171: { desc: "System Too Lean (Bank 1)", fix: "Check MAF sensor, vacuum leaks, fuel pressure", costRange: "$50-$400" },
      P0420: { desc: "Catalyst System Efficiency Below Threshold", fix: "Replace catalytic converter or O2 sensor", costRange: "$200-$2000" },
      P0442: { desc: "EVAP System Small Leak", fix: "Check gas cap, EVAP canister, purge valve", costRange: "$50-$300" },
      P0128: { desc: "Coolant Thermostat Below Regulating Temperature", fix: "Replace thermostat", costRange: "$80-$250" },
    };
    const known = commonCodes[code];
    return { ok: true, result: { code, system, severity, description: known?.desc || `${system} fault code ${code}`, suggestedFix: known?.fix || "Professional diagnostic scan recommended", estimatedCost: known?.costRange || "Varies by vehicle", urgency: severity === "critical" ? "Stop driving — repair immediately" : severity === "moderate" ? "Schedule repair within 1 week" : "Monitor — repair at next service" } };
  });

  registerLensAction("automotive", "maintenanceSchedule", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const mileage = parseInt(data.mileage || data.odometer) || 0;
    const lastService = data.lastService ? new Date(data.lastService) : null;
    const year = parseInt(data.year) || 2020;
    const schedule = [
      { service: "Oil Change", intervalMiles: 5000, intervalMonths: 6, priority: "high" },
      { service: "Tire Rotation", intervalMiles: 7500, intervalMonths: 6, priority: "medium" },
      { service: "Air Filter", intervalMiles: 15000, intervalMonths: 12, priority: "medium" },
      { service: "Brake Inspection", intervalMiles: 20000, intervalMonths: 12, priority: "high" },
      { service: "Transmission Fluid", intervalMiles: 30000, intervalMonths: 24, priority: "medium" },
      { service: "Coolant Flush", intervalMiles: 30000, intervalMonths: 24, priority: "medium" },
      { service: "Spark Plugs", intervalMiles: 60000, intervalMonths: 48, priority: "medium" },
      { service: "Timing Belt", intervalMiles: 60000, intervalMonths: 48, priority: "high" },
      { service: "Brake Fluid", intervalMiles: 30000, intervalMonths: 24, priority: "high" },
    ];
    const due = schedule.map(s => {
      const milesSinceDue = mileage % s.intervalMiles;
      const milesUntilDue = s.intervalMiles - milesSinceDue;
      const overdue = milesUntilDue < s.intervalMiles * 0.1;
      return { ...s, milesUntilDue, overdue, status: overdue ? "due-now" : milesUntilDue < 1000 ? "upcoming" : "ok" };
    }).sort((a, b) => a.milesUntilDue - b.milesUntilDue);
    return { ok: true, result: { mileage, vehicleYear: year, services: due, overdueCount: due.filter(d => d.overdue).length, nextService: due[0]?.service, urgentServices: due.filter(d => d.status === "due-now").map(d => d.service) } };
  });

  registerLensAction("automotive", "fuelEfficiency", (ctx, artifact, _params) => {
    const fillups = artifact.data?.fillups || [];
    if (fillups.length < 2) return { ok: true, result: { message: "Log at least 2 fill-ups with mileage and gallons." } };
    const sorted = [...fillups].sort((a, b) => (parseInt(a.mileage) || 0) - (parseInt(b.mileage) || 0));
    const mpgReadings = [];
    for (let i = 1; i < sorted.length; i++) {
      const miles = (parseInt(sorted[i].mileage) || 0) - (parseInt(sorted[i - 1].mileage) || 0);
      const gallons = parseFloat(sorted[i].gallons) || 1;
      if (miles > 0) mpgReadings.push({ date: sorted[i].date, mpg: Math.round((miles / gallons) * 10) / 10, miles, gallons, costPerGallon: parseFloat(sorted[i].pricePerGallon) || 0 });
    }
    const avgMPG = mpgReadings.length > 0 ? Math.round(mpgReadings.reduce((s, r) => s + r.mpg, 0) / mpgReadings.length * 10) / 10 : 0;
    const totalGallons = sorted.reduce((s, f) => s + (parseFloat(f.gallons) || 0), 0);
    const totalCost = sorted.reduce((s, f) => s + (parseFloat(f.gallons) || 0) * (parseFloat(f.pricePerGallon) || 0), 0);
    const costPerMile = totalGallons > 0 && avgMPG > 0 ? Math.round((totalCost / (totalGallons * avgMPG)) * 100) / 100 : 0;
    return { ok: true, result: { avgMPG, bestMPG: Math.max(...mpgReadings.map(r => r.mpg)), worstMPG: Math.min(...mpgReadings.map(r => r.mpg)), totalGallons: Math.round(totalGallons * 10) / 10, totalFuelCost: Math.round(totalCost * 100) / 100, costPerMile, readings: mpgReadings, tip: avgMPG < 20 ? "Check tire pressure and air filter — easy MPG gains" : "Fuel efficiency is reasonable" } };
  });

  registerLensAction("automotive", "repairEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const repairs = data.repairs || [];
    if (repairs.length === 0) return { ok: true, result: { message: "Add repair items with parts and labor estimates." } };
    const estimated = repairs.map(r => {
      const partsCost = parseFloat(r.partsCost) || 0;
      const laborHours = parseFloat(r.laborHours) || 1;
      const laborRate = parseFloat(r.laborRate || data.shopRate) || 120;
      const laborCost = laborHours * laborRate;
      return { repair: r.name || "Unnamed repair", partsCost, laborHours, laborRate, laborCost, total: Math.round((partsCost + laborCost) * 100) / 100, priority: r.priority || "medium" };
    });
    const grandTotal = estimated.reduce((s, e) => s + e.total, 0);
    return { ok: true, result: { repairs: estimated, subtotalParts: Math.round(estimated.reduce((s, e) => s + e.partsCost, 0) * 100) / 100, subtotalLabor: Math.round(estimated.reduce((s, e) => s + e.laborCost, 0) * 100) / 100, grandTotal: Math.round(grandTotal * 100) / 100, tax: Math.round(grandTotal * 0.08 * 100) / 100, totalWithTax: Math.round(grandTotal * 1.08 * 100) / 100, recommendation: grandTotal > 3000 ? "Get a second opinion for major repairs" : "Estimate seems reasonable" } };
  });
}
