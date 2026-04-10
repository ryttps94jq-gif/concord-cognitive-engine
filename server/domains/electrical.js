// server/domains/electrical.js
export default function registerElectricalActions(registerLensAction) {
  registerLensAction("electrical", "loadCalculation", (ctx, artifact, _params) => {
    const circuits = artifact.data?.circuits || [];
    if (circuits.length === 0) return { ok: true, result: { message: "Add circuits with wattage to calculate electrical load." } };
    const analyzed = circuits.map(c => { const watts = parseFloat(c.watts) || 0; const voltage = parseFloat(c.voltage) || 120; const amps = watts / voltage; return { name: c.name, watts, voltage, amps: Math.round(amps * 100) / 100, breakerSize: amps <= 15 ? 15 : amps <= 20 ? 20 : amps <= 30 ? 30 : amps <= 40 ? 40 : 50, wireGauge: amps <= 15 ? "14 AWG" : amps <= 20 ? "12 AWG" : amps <= 30 ? "10 AWG" : amps <= 40 ? "8 AWG" : "6 AWG" }; });
    const totalWatts = analyzed.reduce((s, c) => s + c.watts, 0);
    const totalAmps = analyzed.reduce((s, c) => s + c.amps, 0);
    const panelSize = totalAmps <= 100 ? 100 : totalAmps <= 150 ? 150 : 200;
    return { ok: true, result: { circuits: analyzed, totalWatts, totalAmps: Math.round(totalAmps * 10) / 10, panelSizeRecommended: `${panelSize}A`, utilization: Math.round((totalAmps / panelSize) * 100), safetyMargin: Math.round((1 - totalAmps / (panelSize * 0.8)) * 100), nec80PercentRule: totalAmps <= panelSize * 0.8 ? "PASS" : "FAIL — exceeds 80% continuous load rating" } };
  });
  registerLensAction("electrical", "voltageDropCalc", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const amps = parseFloat(data.amps) || 15;
    const distanceFeet = parseFloat(data.distanceFeet) || 100;
    const wireGauge = parseInt(data.wireGauge) || 12;
    const voltage = parseFloat(data.voltage) || 120;
    const resistancePerFt = { 14: 0.00252, 12: 0.00159, 10: 0.001, 8: 0.000628, 6: 0.000395, 4: 0.000249, 2: 0.000156 };
    const resistance = (resistancePerFt[wireGauge] || 0.00159) * distanceFeet * 2;
    const drop = amps * resistance;
    const dropPercent = (drop / voltage) * 100;
    return { ok: true, result: { wireGauge: `${wireGauge} AWG`, distance: `${distanceFeet} ft`, current: `${amps}A`, voltage: `${voltage}V`, voltageDrop: `${Math.round(drop * 100) / 100}V`, dropPercent: `${Math.round(dropPercent * 100) / 100}%`, acceptable: dropPercent <= 3, necLimit: "3% for branch circuits, 5% total", recommendation: dropPercent > 3 ? `Upgrade to ${wireGauge - 2} AWG to reduce drop` : "Within acceptable limits" } };
  });
  registerLensAction("electrical", "circuitTrace", (ctx, artifact, _params) => {
    const panels = artifact.data?.panels || [];
    const circuits = artifact.data?.circuits || [];
    const mapped = circuits.map(c => ({ circuit: c.name || c.number, panel: c.panel || "Main", breaker: c.breaker || "20A", room: c.room || c.location, devices: c.devices || [], wireRun: c.wireRunFeet || 0 }));
    return { ok: true, result: { panels: panels.length || 1, totalCircuits: mapped.length, circuitMap: mapped, unassigned: mapped.filter(c => !c.room).length, avgDevicesPerCircuit: mapped.length > 0 ? Math.round(mapped.reduce((s, c) => s + (c.devices.length || 0), 0) / mapped.length * 10) / 10 : 0 } };
  });
  registerLensAction("electrical", "safetyInspection", (ctx, artifact, _params) => {
    const items = artifact.data?.inspectionItems || [];
    if (items.length === 0) return { ok: true, result: { message: "Add inspection items to check." } };
    const results = items.map(i => ({ item: i.name || i.description, code: i.necCode || "NEC", passed: i.passed !== false, severity: i.passed === false ? (i.critical ? "critical" : "minor") : "ok", notes: i.notes || "" }));
    const passed = results.filter(r => r.passed).length;
    const critical = results.filter(r => r.severity === "critical").length;
    return { ok: true, result: { results, total: results.length, passed, failed: results.length - passed, criticalFailures: critical, passRate: Math.round((passed / results.length) * 100), overallResult: critical > 0 ? "FAIL — critical safety issues" : passed === results.length ? "PASS" : "CONDITIONAL — minor issues to address" } };
  });
}
