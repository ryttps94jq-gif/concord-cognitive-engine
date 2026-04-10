// server/domains/engineering.js
export default function registerEngineeringActions(registerLensAction) {
  registerLensAction("engineering", "toleranceAnalysis", (ctx, artifact, _params) => {
    const parts = artifact.data?.parts || [];
    if (parts.length === 0) return { ok: true, result: { message: "Add parts with nominal dimensions and tolerances." } };
    const analyzed = parts.map(p => {
      const nominal = parseFloat(p.nominal) || 0;
      const tolerance = parseFloat(p.tolerance) || 0.01;
      return { part: p.name, nominal, tolerance, min: Math.round((nominal - tolerance) * 10000) / 10000, max: Math.round((nominal + tolerance) * 10000) / 10000, toleranceClass: tolerance <= 0.001 ? "precision" : tolerance <= 0.01 ? "standard" : "loose" };
    });
    // Worst-case stack-up
    const stackNominal = analyzed.reduce((s, p) => s + p.nominal, 0);
    const stackTolerance = analyzed.reduce((s, p) => s + p.tolerance, 0);
    // RSS (Root Sum Square) statistical
    const rssTolerancce = Math.sqrt(analyzed.reduce((s, p) => s + Math.pow(p.tolerance, 2), 0));
    return { ok: true, result: { parts: analyzed, stackUp: { nominal: Math.round(stackNominal * 10000) / 10000, worstCaseTolerance: Math.round(stackTolerance * 10000) / 10000, rssTolerance: Math.round(rssTolerancce * 10000) / 10000, worstCaseMin: Math.round((stackNominal - stackTolerance) * 10000) / 10000, worstCaseMax: Math.round((stackNominal + stackTolerance) * 10000) / 10000 }, method: "Worst-case + RSS statistical" } };
  });
  registerLensAction("engineering", "stressAnalysis", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const force = parseFloat(data.forceNewtons) || 0;
    const area = parseFloat(data.crossSectionMm2) || 1;
    const yieldStrength = parseFloat(data.yieldStrengthMPa) || 250;
    const stress = force / area; // MPa
    const safetyFactor = stress > 0 ? yieldStrength / stress : Infinity;
    return { ok: true, result: { appliedForce: `${force} N`, crossSection: `${area} mm²`, appliedStress: `${Math.round(stress * 100) / 100} MPa`, yieldStrength: `${yieldStrength} MPa`, safetyFactor: Math.round(safetyFactor * 100) / 100, status: safetyFactor >= 3 ? "safe" : safetyFactor >= 1.5 ? "acceptable" : safetyFactor >= 1 ? "marginal" : "FAILURE — stress exceeds yield", recommendation: safetyFactor < 2 ? "Increase cross-section or use stronger material" : "Design is within safe limits" } };
  });
  registerLensAction("engineering", "bom", (ctx, artifact, _params) => {
    const items = artifact.data?.bomItems || artifact.data?.items || [];
    if (items.length === 0) return { ok: true, result: { message: "Add BOM items with part number, quantity, and cost." } };
    const bom = items.map(i => {
      const qty = parseInt(i.quantity) || 1;
      const cost = parseFloat(i.unitCost) || 0;
      return { partNumber: i.partNumber || i.name, description: i.description || "", quantity: qty, unitCost: cost, extendedCost: Math.round(qty * cost * 100) / 100, leadTime: i.leadTime || "stock", supplier: i.supplier || "TBD" };
    });
    const totalCost = bom.reduce((s, b) => s + b.extendedCost, 0);
    const totalParts = bom.reduce((s, b) => s + b.quantity, 0);
    const longestLead = bom.filter(b => b.leadTime !== "stock").sort((a, b) => (parseInt(b.leadTime) || 0) - (parseInt(a.leadTime) || 0))[0];
    return { ok: true, result: { bom, totalLineItems: bom.length, totalParts, totalCost: Math.round(totalCost * 100) / 100, criticalPath: longestLead?.partNumber || "All in stock", uniqueSuppliers: [...new Set(bom.map(b => b.supplier))].length } };
  });
  registerLensAction("engineering", "unitConvert", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const value = parseFloat(data.value) || 0;
    const from = (data.from || "mm").toLowerCase();
    const to = (data.to || "in").toLowerCase();
    const conversions = {
      "mm-in": v => v / 25.4, "in-mm": v => v * 25.4, "m-ft": v => v * 3.28084, "ft-m": v => v / 3.28084,
      "kg-lb": v => v * 2.20462, "lb-kg": v => v / 2.20462, "n-lbf": v => v * 0.22481, "lbf-n": v => v / 0.22481,
      "mpa-psi": v => v * 145.038, "psi-mpa": v => v / 145.038, "c-f": v => v * 9/5 + 32, "f-c": v => (v - 32) * 5/9,
      "nm-ftlb": v => v * 0.7376, "ftlb-nm": v => v / 0.7376, "l-gal": v => v * 0.264172, "gal-l": v => v / 0.264172,
    };
    const key = `${from}-${to}`;
    const converter = conversions[key];
    if (!converter) return { ok: true, result: { error: `Conversion ${from} → ${to} not supported`, supported: Object.keys(conversions).map(k => k.replace("-", " → ")) } };
    const result = converter(value);
    return { ok: true, result: { input: `${value} ${from}`, output: `${Math.round(result * 10000) / 10000} ${to}`, conversion: `${from} → ${to}` } };
  });
}
