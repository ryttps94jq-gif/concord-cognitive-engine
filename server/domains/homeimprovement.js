// server/domains/homeimprovement.js
export default function registerHomeImprovementActions(registerLensAction) {
  registerLensAction("home-improvement", "projectEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const sqft = parseFloat(data.squareFootage) || 0;
    const projectType = (data.projectType || "general").toLowerCase();
    const costPerSqFt = { kitchen: 150, bathroom: 125, flooring: 8, painting: 4, roofing: 7, deck: 25, basement: 40, addition: 200, general: 50 };
    const rate = costPerSqFt[projectType] || 50;
    const materialsCost = Math.round(sqft * rate * 0.6);
    const laborCost = Math.round(sqft * rate * 0.4);
    const permits = sqft > 200 || projectType === "addition" ? Math.round(sqft * 2) : 0;
    const total = materialsCost + laborCost + permits;
    return { ok: true, result: { projectType, squareFootage: sqft, materialsCost, laborCost, permits, total, diyEstimate: Math.round(total * 0.55), contractorEstimate: total, savings: Math.round(total * 0.45), timeline: sqft > 500 ? "4-8 weeks" : sqft > 200 ? "2-4 weeks" : "1-2 weeks" } };
  });
  registerLensAction("home-improvement", "roiCalculator", (ctx, artifact, _params) => {
    const projects = artifact.data?.projects || [];
    if (projects.length === 0) return { ok: true, result: { message: "Add improvement projects with cost and value-add to calculate ROI." } };
    const analyzed = projects.map(p => { const cost = parseFloat(p.cost) || 0; const valueAdd = parseFloat(p.valueAdded) || 0; const roi = cost > 0 ? Math.round(((valueAdd - cost) / cost) * 100) : 0; return { project: p.name, cost, valueAdded: valueAdd, roi, netGain: valueAdd - cost, worthIt: roi > 0 }; }).sort((a, b) => b.roi - a.roi);
    return { ok: true, result: { projects: analyzed, bestROI: analyzed[0]?.project, worstROI: analyzed[analyzed.length - 1]?.project, totalInvested: analyzed.reduce((s, p) => s + p.cost, 0), totalValueAdded: analyzed.reduce((s, p) => s + p.valueAdded, 0), avgROI: Math.round(analyzed.reduce((s, p) => s + p.roi, 0) / analyzed.length) } };
  });
  registerLensAction("home-improvement", "permitCheck", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const projectType = (data.projectType || "").toLowerCase();
    const requiresPermit = ["addition", "electrical", "plumbing", "structural", "roofing", "hvac", "deck", "fence-over-6ft", "demolition", "foundation"].some(t => projectType.includes(t));
    const noPermit = ["painting", "flooring", "cabinet", "countertop", "landscaping", "minor-repair"].some(t => projectType.includes(t));
    return { ok: true, result: { projectType, requiresPermit: requiresPermit && !noPermit, permitType: requiresPermit ? "building-permit" : "none", estimatedCost: requiresPermit ? "$100-$500" : "$0", processingTime: requiresPermit ? "2-6 weeks" : "N/A", inspectionsRequired: requiresPermit ? ["rough inspection", "final inspection"] : [], tip: requiresPermit ? "Apply for permit before starting work — unpermitted work can affect resale" : "No permit needed for this type of work" } };
  });
  registerLensAction("home-improvement", "colorPalette", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const room = (data.room || "living room").toLowerCase();
    const style = (data.style || "modern").toLowerCase();
    const palettes = { modern: { primary: "#FFFFFF", accent: "#2C2C2C", warm: "#E8D4B8", pop: "#4A90D9" }, farmhouse: { primary: "#F5F0EB", accent: "#8B7355", warm: "#D4A574", pop: "#6B8E5A" }, coastal: { primary: "#FFFFFF", accent: "#5B8FA8", warm: "#E8D6C4", pop: "#2F6682" }, traditional: { primary: "#F0EDE8", accent: "#5C3D2E", warm: "#C4956A", pop: "#8B4513" }, minimalist: { primary: "#FAFAFA", accent: "#333333", warm: "#E0DCD8", pop: "#B0B0B0" } };
    const palette = palettes[style] || palettes.modern;
    return { ok: true, result: { room, style, palette, wallColor: palette.primary, trim: "#FFFFFF", accent: palette.accent, furniture: palette.warm, decor: palette.pop, coverage: data.squareFootage ? `${Math.ceil(parseFloat(data.squareFootage) / 350)} gallons of paint needed` : "Measure walls to estimate paint" } };
  });
}
