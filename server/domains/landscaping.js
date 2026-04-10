// server/domains/landscaping.js
export default function registerLandscapingActions(registerLensAction) {
  registerLensAction("landscaping", "plantSelection", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const zone = parseInt(data.hardnessZone) || 7;
    const sun = (data.sunExposure || "full").toLowerCase();
    const soil = (data.soilType || "loam").toLowerCase();
    const plants = [
      { name: "Lavender", zones: [5,9], sun: "full", soil: ["sandy","loam"], type: "perennial" },
      { name: "Hosta", zones: [3,9], sun: "shade", soil: ["loam","clay"], type: "perennial" },
      { name: "Black-Eyed Susan", zones: [3,9], sun: "full", soil: ["loam","clay","sandy"], type: "perennial" },
      { name: "Japanese Maple", zones: [5,8], sun: "partial", soil: ["loam"], type: "tree" },
      { name: "Boxwood", zones: [5,9], sun: "full", soil: ["loam","clay"], type: "shrub" },
      { name: "Daylily", zones: [3,10], sun: "full", soil: ["loam","clay","sandy"], type: "perennial" },
    ];
    const suitable = plants.filter(p => zone >= p.zones[0] && zone <= p.zones[1] && (p.sun === sun || p.sun === "partial") && p.soil.includes(soil));
    return { ok: true, result: { zone, sunExposure: sun, soilType: soil, recommendations: suitable.map(p => ({ name: p.name, type: p.type })), totalMatches: suitable.length } };
  });
  registerLensAction("landscaping", "irrigationCalc", (ctx, artifact, _params) => {
    const sqft = parseFloat(artifact.data?.squareFootage) || 1000;
    const plantType = (artifact.data?.plantType || "lawn").toLowerCase();
    const rates = { lawn: 1.0, garden: 0.8, shrubs: 0.6, trees: 0.4, xeriscape: 0.2 };
    const inchesPerWeek = rates[plantType] || 1.0;
    const gallonsPerWeek = Math.round(sqft * inchesPerWeek * 0.623);
    return { ok: true, result: { squareFootage: sqft, plantType, inchesPerWeek, gallonsPerWeek, gallonsPerMonth: gallonsPerWeek * 4, runtimeMinutes: Math.round(gallonsPerWeek / 5), frequency: inchesPerWeek > 0.8 ? "3x per week" : "2x per week", monthlyCost: Math.round(gallonsPerWeek * 4 * 0.004 * 100) / 100 } };
  });
  registerLensAction("landscaping", "seasonalPlan", (ctx, artifact, _params) => {
    const zone = parseInt(artifact.data?.hardnessZone) || 7;
    const seasons = { spring: ["Fertilize lawn", "Prune winter damage", "Plant annuals", "Mulch beds", "Edge beds"], summer: ["Deep water weekly", "Mow at 3-4 inches", "Deadhead flowers", "Watch for pests", "Prune after bloom"], fall: ["Aerate lawn", "Overseed thin spots", "Plant bulbs", "Final fertilizer", "Clean up leaves"], winter: ["Plan spring design", "Order seeds", "Maintain tools", "Protect tender plants", "Prune dormant trees"] };
    return { ok: true, result: { zone, plan: seasons, currentSeason: ["winter","winter","spring","spring","spring","summer","summer","summer","fall","fall","fall","winter"][new Date().getMonth()], immediateActions: seasons[["winter","winter","spring","spring","spring","summer","summer","summer","fall","fall","fall","winter"][new Date().getMonth()]] } };
  });
  registerLensAction("landscaping", "materialEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const sqft = parseFloat(data.squareFootage) || 100;
    const material = (data.material || "mulch").toLowerCase();
    const depths = { mulch: 3, gravel: 2, topsoil: 4, compost: 2, sand: 2, pavers: 0 };
    const depthInches = depths[material] || 3;
    const cubicYards = Math.round((sqft * depthInches / 12 / 27) * 10) / 10;
    const prices = { mulch: 35, gravel: 45, topsoil: 30, compost: 40, sand: 35, pavers: 0 };
    const costPerYard = prices[material] || 35;
    return { ok: true, result: { material, squareFootage: sqft, depthInches, cubicYards, bags: Math.ceil(cubicYards * 13.5), estimatedCost: Math.round(cubicYards * costPerYard), deliveryNote: cubicYards > 3 ? "Bulk delivery recommended" : "Bagged purchase sufficient" } };
  });
}
