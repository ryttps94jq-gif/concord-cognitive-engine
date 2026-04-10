// server/domains/forestry.js
export default function registerForestryActions(registerLensAction) {
  registerLensAction("forestry", "timberVolume", (ctx, artifact, _params) => {
    const trees = artifact.data?.trees || [];
    if (trees.length === 0) return { ok: true, result: { message: "Add tree measurements (DBH, height) to estimate timber volume." } };
    const estimated = trees.map(t => { const dbh = parseFloat(t.dbhInches || t.diameter) || 12; const height = parseFloat(t.heightFeet || t.height) || 60; const species = t.species || "mixed"; const bf = 0.00545415 * Math.pow(dbh, 2) * height * 0.5; return { species, dbhInches: dbh, heightFeet: height, boardFeet: Math.round(bf), logs: Math.floor(height / 16) }; });
    const totalBF = estimated.reduce((s, t) => s + t.boardFeet, 0);
    const pricePerMBF = parseFloat(artifact.data?.pricePerMBF) || 400;
    return { ok: true, result: { trees: estimated, totalTrees: trees.length, totalBoardFeet: totalBF, totalMBF: Math.round(totalBF / 1000 * 10) / 10, estimatedValue: Math.round(totalBF / 1000 * pricePerMBF), avgBFPerTree: Math.round(totalBF / trees.length), pricePerMBF } };
  });
  registerLensAction("forestry", "fireRisk", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const temp = parseFloat(data.temperatureF) || 80;
    const humidity = parseFloat(data.humidityPercent) || 30;
    const wind = parseFloat(data.windSpeedMph) || 10;
    const drought = parseInt(data.droughtIndex) || 3;
    const fuelMoisture = parseFloat(data.fuelMoisturePercent) || 15;
    let risk = 0;
    risk += temp > 95 ? 25 : temp > 85 ? 15 : temp > 75 ? 8 : 3;
    risk += humidity < 15 ? 25 : humidity < 25 ? 18 : humidity < 40 ? 10 : 3;
    risk += wind > 25 ? 20 : wind > 15 ? 12 : wind > 8 ? 6 : 2;
    risk += drought * 5;
    risk += fuelMoisture < 10 ? 15 : fuelMoisture < 20 ? 8 : 2;
    return { ok: true, result: { conditions: { temperature: `${temp}°F`, humidity: `${humidity}%`, wind: `${wind} mph`, droughtIndex: drought, fuelMoisture: `${fuelMoisture}%` }, riskScore: Math.min(100, risk), riskLevel: risk >= 75 ? "extreme" : risk >= 50 ? "high" : risk >= 30 ? "moderate" : "low", actions: risk >= 75 ? ["Red flag warning", "Close forest to public", "Pre-position fire crews"] : risk >= 50 ? ["Fire watch", "Restrict campfires", "Alert fire crews"] : ["Normal operations"] } };
  });
  registerLensAction("forestry", "harvestPlan", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const acreage = parseFloat(data.acreage) || 100;
    const method = (data.method || "selective").toLowerCase();
    const methods = { clearcut: { removal: 100, regen: "replant", impactLevel: "high", cyclYears: 60 }, shelterwood: { removal: 70, regen: "natural + plant", impactLevel: "moderate", cyclYears: 80 }, selective: { removal: 30, regen: "natural", impactLevel: "low", cyclYears: 20 }, salvage: { removal: 50, regen: "replant", impactLevel: "moderate", cyclYears: 40 } };
    const plan = methods[method] || methods.selective;
    return { ok: true, result: { acreage, method, removalPercent: plan.removal, regeneration: plan.regen, impactLevel: plan.impactLevel, rotationYears: plan.cyclYears, estimatedHarvestAcres: Math.round(acreage * plan.removal / 100), roadRequired: acreage > 50 ? "Yes — logging road needed" : "Existing access may suffice", bestSeason: "Fall/Winter (dry, dormant season)", permits: ["Timber Harvest Plan (THP)", "Environmental review", "Watershed protection plan"] } };
  });
  registerLensAction("forestry", "carbonSequestration", (ctx, artifact, _params) => {
    const acreage = parseFloat(artifact.data?.acreage) || 100;
    const ageYears = parseInt(artifact.data?.standAge) || 30;
    const density = parseInt(artifact.data?.treesPerAcre) || 200;
    const tonsPerAcrePerYear = ageYears < 20 ? 2.5 : ageYears < 50 ? 1.8 : 1.0;
    const annualSequestration = acreage * tonsPerAcrePerYear;
    const totalStored = acreage * density * 0.015 * ageYears;
    const carbonCredits = annualSequestration; // ~1 credit per ton
    const creditValue = Math.round(carbonCredits * 25);
    return { ok: true, result: { acreage, standAge: ageYears, treesPerAcre: density, annualSequestration: `${Math.round(annualSequestration)} tons CO2/year`, totalCarbonStored: `${Math.round(totalStored)} tons CO2`, carbonCreditsPerYear: Math.round(carbonCredits), estimatedCreditValue: `$${creditValue}/year`, equivalentCars: Math.round(annualSequestration / 4.6) } };
  });
}
