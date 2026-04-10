// server/domains/construction.js
// Domain actions for construction: takeoff estimation, schedule critical path,
// safety compliance, change order tracking, progress reporting.

export default function registerConstructionActions(registerLensAction) {
  registerLensAction("construction", "takeoffEstimate", (ctx, artifact, _params) => {
    const items = artifact.data?.lineItems || [];
    if (items.length === 0) return { ok: true, result: { message: "Add line items with quantity, unit, and unit cost." } };
    const estimated = items.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unitCost) || 0;
      const wastePercent = parseFloat(item.wastePercent) || 10;
      const adjustedQty = qty * (1 + wastePercent / 100);
      return { description: item.description || item.name, quantity: qty, unit: item.unit || "each", unitCost, wastePercent, adjustedQuantity: Math.ceil(adjustedQty), lineCost: Math.round(adjustedQty * unitCost * 100) / 100 };
    });
    const subtotalMaterials = estimated.reduce((s, e) => s + e.lineCost, 0);
    const laborPercent = parseFloat(artifact.data?.laborPercent) || 40;
    const laborCost = Math.round(subtotalMaterials * (laborPercent / 100) * 100) / 100;
    const overhead = Math.round((subtotalMaterials + laborCost) * 0.15 * 100) / 100;
    const profit = Math.round((subtotalMaterials + laborCost + overhead) * 0.10 * 100) / 100;
    const total = Math.round((subtotalMaterials + laborCost + overhead + profit) * 100) / 100;
    return { ok: true, result: { lineItems: estimated, subtotalMaterials: Math.round(subtotalMaterials * 100) / 100, laborCost, overhead, profit, grandTotal: total, costPerSqFt: parseFloat(artifact.data?.squareFootage) > 0 ? Math.round(total / parseFloat(artifact.data.squareFootage) * 100) / 100 : null } };
  });

  registerLensAction("construction", "criticalPath", (ctx, artifact, _params) => {
    const tasks = artifact.data?.tasks || [];
    if (tasks.length === 0) return { ok: true, result: { message: "Add tasks with duration and dependencies." } };
    const taskMap = {};
    tasks.forEach(t => { taskMap[t.name || t.id] = { name: t.name || t.id, duration: parseInt(t.duration) || 1, deps: t.dependencies || [], earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, slack: 0 }; });
    // Forward pass
    const order = Object.values(taskMap);
    for (const t of order) {
      const maxPredFinish = t.deps.reduce((m, d) => Math.max(m, taskMap[d]?.earlyFinish || 0), 0);
      t.earlyStart = maxPredFinish;
      t.earlyFinish = t.earlyStart + t.duration;
    }
    const projectDuration = Math.max(...order.map(t => t.earlyFinish));
    // Backward pass
    for (const t of [...order].reverse()) {
      const successors = order.filter(s => s.deps.includes(t.name));
      t.lateFinish = successors.length > 0 ? Math.min(...successors.map(s => s.lateStart)) : projectDuration;
      t.lateStart = t.lateFinish - t.duration;
      t.slack = t.lateStart - t.earlyStart;
    }
    const criticalPath = order.filter(t => t.slack === 0).map(t => t.name);
    return { ok: true, result: { projectDuration, criticalPath, tasks: order.map(t => ({ name: t.name, duration: t.duration, earlyStart: t.earlyStart, earlyFinish: t.earlyFinish, slack: t.slack, onCriticalPath: t.slack === 0 })), totalTasks: tasks.length } };
  });

  registerLensAction("construction", "safetyCompliance", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const checklistItems = data.safetyChecklist || [];
    const incidents = data.incidents || [];
    const workers = parseInt(data.workerCount) || 1;
    const hoursWorked = parseInt(data.totalHoursWorked) || 0;
    const compliant = checklistItems.filter(c => c.passed || c.compliant).length;
    const total = checklistItems.length || 1;
    const complianceRate = Math.round((compliant / total) * 100);
    const incidentRate = hoursWorked > 0 ? Math.round((incidents.length / hoursWorked) * 200000 * 100) / 100 : 0; // OSHA incident rate formula
    return { ok: true, result: { complianceRate, checklistResults: { passed: compliant, failed: total - compliant, total }, incidentRate, incidentRateLabel: "per 200,000 hours worked", incidents: incidents.length, workers, hoursWorked, rating: complianceRate >= 95 ? "excellent" : complianceRate >= 80 ? "acceptable" : "needs-improvement", criticalFailures: checklistItems.filter(c => !c.passed && c.critical).map(c => c.item || c.name) } };
  });

  registerLensAction("construction", "progressReport", (ctx, artifact, _params) => {
    const phases = artifact.data?.phases || [];
    if (phases.length === 0) return { ok: true, result: { message: "Add project phases with planned vs actual progress." } };
    const analyzed = phases.map(p => {
      const planned = parseFloat(p.plannedPercent) || 0;
      const actual = parseFloat(p.actualPercent) || 0;
      const variance = actual - planned;
      return { phase: p.name, plannedPercent: planned, actualPercent: actual, variance, status: variance >= 0 ? "on-track" : variance >= -10 ? "slightly-behind" : "behind-schedule" };
    });
    const overallPlanned = analyzed.reduce((s, p) => s + p.plannedPercent, 0) / analyzed.length;
    const overallActual = analyzed.reduce((s, p) => s + p.actualPercent, 0) / analyzed.length;
    return { ok: true, result: { phases: analyzed, overallPlannedPercent: Math.round(overallPlanned), overallActualPercent: Math.round(overallActual), overallVariance: Math.round(overallActual - overallPlanned), projectStatus: overallActual >= overallPlanned ? "on-schedule" : overallActual >= overallPlanned - 10 ? "minor-delay" : "significant-delay", behindPhases: analyzed.filter(p => p.status === "behind-schedule").map(p => p.phase) } };
  });
}
