// server/domains/masonry.js
export default function registerMasonryActions(registerLensAction) {
  registerLensAction("masonry", "materialEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const sqft = parseFloat(data.squareFootage) || 0;
    const material = (data.material || "brick").toLowerCase();
    const rates = { brick: { unitsPerSqFt: 7, mortar: 0.02, costPerUnit: 0.75 }, block: { unitsPerSqFt: 1.125, mortar: 0.03, costPerUnit: 2.5 }, stone: { unitsPerSqFt: 5, mortar: 0.025, costPerUnit: 8 } };
    const r = rates[material] || rates.brick;
    const units = Math.ceil(sqft * r.unitsPerSqFt * 1.05);
    const mortarBags = Math.ceil(sqft * r.mortar);
    const materialCost = Math.round(units * r.costPerUnit);
    const mortarCost = Math.round(mortarBags * 12);
    return { ok: true, result: { material, squareFootage: sqft, unitsNeeded: units, mortarBags80lb: mortarBags, materialCost, mortarCost, totalMaterialCost: materialCost + mortarCost, laborEstimate: Math.round(sqft * 15), grandTotal: materialCost + mortarCost + Math.round(sqft * 15) } };
  });
  registerLensAction("masonry", "mortarMix", (ctx, artifact, _params) => {
    const application = (artifact.data?.application || "general").toLowerCase();
    const mixes = { general: { type: "Type N", ratio: "1:1:6 (cement:lime:sand)", strength: "750 psi", use: "Above-grade, general purpose" }, structural: { type: "Type S", ratio: "1:0.5:4.5", strength: "1800 psi", use: "Below-grade, retaining walls, high wind" }, "high-strength": { type: "Type M", ratio: "1:0.25:3.75", strength: "2500 psi", use: "Foundation, heavy load bearing" }, veneer: { type: "Type N", ratio: "1:1:6", strength: "750 psi", use: "Non-structural veneer, interior" }, repoint: { type: "Type O", ratio: "1:2:9", strength: "350 psi", use: "Repointing historic masonry" } };
    const mix = mixes[application] || mixes.general;
    return { ok: true, result: { application, ...mix, waterRatio: "Add water gradually until workable — should hold shape on trowel", cureTime: "24-48 hours initial, 28 days full strength", temperature: "Install between 40°F and 90°F, protect from freezing for 48 hours" } };
  });
  registerLensAction("masonry", "wallStrength", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const height = parseFloat(data.heightFeet) || 8;
    const thickness = parseFloat(data.thicknessInches) || 8;
    const reinforced = data.reinforced !== false;
    const loadBearing = data.loadBearing !== false;
    const slenderness = (height * 12) / thickness;
    const maxSlenderness = reinforced ? 25 : 20;
    return { ok: true, result: { heightFeet: height, thicknessInches: thickness, slendernessRatio: Math.round(slenderness * 10) / 10, maxAllowedRatio: maxSlenderness, passesSlenderness: slenderness <= maxSlenderness, reinforced, loadBearing, recommendation: slenderness > maxSlenderness ? "Wall too slender — increase thickness or add pilasters" : slenderness > maxSlenderness * 0.8 ? "Near limit — consider additional reinforcement" : "Wall dimensions are adequate" } };
  });
  registerLensAction("masonry", "jobCosting", (ctx, artifact, _params) => {
    const items = artifact.data?.items || [];
    if (items.length === 0) return { ok: true, result: { message: "Add job items with hours and costs." } };
    const costed = items.map(i => { const hours = parseFloat(i.hours || i.laborHours) || 0; const rate = parseFloat(i.rate || i.laborRate) || 55; const materials = parseFloat(i.materialCost) || 0; return { item: i.name || i.description, laborHours: hours, laborRate: rate, laborCost: Math.round(hours * rate), materialCost: materials, totalCost: Math.round(hours * rate + materials) }; });
    const totalLabor = costed.reduce((s, c) => s + c.laborCost, 0);
    const totalMaterials = costed.reduce((s, c) => s + c.materialCost, 0);
    const overhead = Math.round((totalLabor + totalMaterials) * 0.15);
    const profit = Math.round((totalLabor + totalMaterials + overhead) * 0.1);
    return { ok: true, result: { items: costed, subtotalLabor: totalLabor, subtotalMaterials: totalMaterials, overhead, profit, grandTotal: totalLabor + totalMaterials + overhead + profit } };
  });
}
