// server/domains/carpentry.js
// Domain actions for carpentry: board foot calculation, joint strength analysis,
// wood species selection, project material list, finish recommendation.

export default function registerCarpentryActions(registerLensAction) {
  registerLensAction("carpentry", "boardFootCalc", (ctx, artifact, _params) => {
    const pieces = artifact.data?.pieces || [];
    if (pieces.length === 0) return { ok: true, result: { message: "Add lumber pieces with thickness, width, and length." } };
    const calculated = pieces.map(p => {
      const t = parseFloat(p.thickness) || 1; // inches
      const w = parseFloat(p.width) || 6;
      const l = parseFloat(p.length) || 96;
      const qty = parseInt(p.quantity) || 1;
      const bf = (t * w * l) / 144;
      const pricePerBF = parseFloat(p.pricePerBF) || 0;
      return { species: p.species || p.name, dimensions: `${t}" x ${w}" x ${l}"`, quantity: qty, boardFeetEach: Math.round(bf * 100) / 100, totalBoardFeet: Math.round(bf * qty * 100) / 100, cost: pricePerBF > 0 ? Math.round(bf * qty * pricePerBF * 100) / 100 : null };
    });
    const totalBF = calculated.reduce((s, c) => s + c.totalBoardFeet, 0);
    const totalCost = calculated.reduce((s, c) => s + (c.cost || 0), 0);
    return { ok: true, result: { pieces: calculated, totalBoardFeet: Math.round(totalBF * 100) / 100, wasteAllowance: Math.round(totalBF * 0.15 * 100) / 100, totalWithWaste: Math.round(totalBF * 1.15 * 100) / 100, totalCost: totalCost > 0 ? Math.round(totalCost * 100) / 100 : "Price per BF not specified" } };
  });

  registerLensAction("carpentry", "jointStrength", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const jointType = (data.jointType || "butt").toLowerCase();
    const species = (data.species || data.wood || "pine").toLowerCase();
    const strengths = { "butt": 15, "pocket-hole": 35, "dowel": 50, "biscuit": 40, "mortise-tenon": 90, "dovetail": 95, "box-joint": 80, "dado": 60, "rabbet": 45, "half-lap": 55, "bridle": 70, "tongue-groove": 50 };
    const speciesMultiplier = { pine: 0.7, oak: 1.2, maple: 1.1, walnut: 1.0, cherry: 0.95, cedar: 0.6, mahogany: 1.0, birch: 1.05, ash: 1.15, poplar: 0.75 };
    const baseStrength = strengths[jointType] || 30;
    const mult = speciesMultiplier[species] || 0.85;
    const effectiveStrength = Math.round(baseStrength * mult);
    const useGlue = data.glued !== false;
    const glueBonus = useGlue ? 20 : 0;
    return { ok: true, result: { jointType, species, baseStrength, speciesMultiplier: mult, glueBonus: useGlue ? "+20" : "none", effectiveStrength: effectiveStrength + glueBonus, rating: effectiveStrength + glueBonus >= 80 ? "excellent" : effectiveStrength + glueBonus >= 50 ? "good" : effectiveStrength + glueBonus >= 30 ? "moderate" : "weak", recommendation: effectiveStrength < 40 ? "Consider upgrading to a stronger joint type" : "Joint is appropriate for the application" } };
  });

  registerLensAction("carpentry", "woodSelection", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const use = (data.application || data.use || "furniture").toLowerCase();
    const budget = (data.budget || "medium").toLowerCase();
    const indoor = data.indoor !== false;
    const woods = [
      { name: "Pine", hardness: 380, cost: "low", indoor: true, outdoor: false, workability: "excellent", best: ["shelving", "framing", "painted-furniture"] },
      { name: "Oak", hardness: 1290, cost: "medium", indoor: true, outdoor: true, workability: "good", best: ["furniture", "flooring", "cabinetry"] },
      { name: "Maple", hardness: 1450, cost: "medium", indoor: true, outdoor: false, workability: "moderate", best: ["cutting-boards", "furniture", "flooring"] },
      { name: "Walnut", hardness: 1010, cost: "high", indoor: true, outdoor: false, workability: "excellent", best: ["fine-furniture", "decorative", "turnings"] },
      { name: "Cherry", hardness: 950, cost: "high", indoor: true, outdoor: false, workability: "excellent", best: ["fine-furniture", "cabinetry"] },
      { name: "Cedar", hardness: 350, cost: "medium", indoor: true, outdoor: true, workability: "excellent", best: ["decking", "fencing", "outdoor-furniture"] },
      { name: "Teak", hardness: 1155, cost: "high", indoor: true, outdoor: true, workability: "moderate", best: ["outdoor-furniture", "boat-building"] },
      { name: "Poplar", hardness: 540, cost: "low", indoor: true, outdoor: false, workability: "excellent", best: ["painted-furniture", "trim", "drawers"] },
    ];
    const suitable = woods.filter(w => {
      if (!indoor && !w.outdoor) return false;
      if (budget === "low" && w.cost === "high") return false;
      return true;
    }).sort((a, b) => {
      const useMatch = (w) => w.best.some(b => use.includes(b) || b.includes(use)) ? 1 : 0;
      return useMatch(b) - useMatch(a);
    });
    return { ok: true, result: { application: use, environment: indoor ? "indoor" : "outdoor", budget, recommendations: suitable.slice(0, 4).map(w => ({ name: w.name, hardness: `${w.hardness} (Janka)`, cost: w.cost, workability: w.workability, bestFor: w.best.join(", ") })), topPick: suitable[0]?.name || "Oak" } };
  });

  registerLensAction("carpentry", "finishRecommendation", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const species = (data.species || data.wood || "oak").toLowerCase();
    const use = (data.application || "furniture").toLowerCase();
    const indoor = data.indoor !== false;
    const finishes = [
      { name: "Danish Oil", durability: 3, ease: 5, appearance: "natural", indoor: true, outdoor: false, toxicity: "low", dryHours: 8, coats: 2 },
      { name: "Polyurethane (Oil)", durability: 5, ease: 3, appearance: "glossy", indoor: true, outdoor: true, toxicity: "medium", dryHours: 24, coats: 3 },
      { name: "Polyurethane (Water)", durability: 4, ease: 4, appearance: "clear", indoor: true, outdoor: false, toxicity: "low", dryHours: 4, coats: 3 },
      { name: "Lacquer", durability: 4, ease: 2, appearance: "mirror", indoor: true, outdoor: false, toxicity: "high", dryHours: 1, coats: 4 },
      { name: "Tung Oil", durability: 3, ease: 5, appearance: "warm", indoor: true, outdoor: true, toxicity: "very-low", dryHours: 24, coats: 3 },
      { name: "Spar Varnish", durability: 5, ease: 3, appearance: "amber", indoor: true, outdoor: true, toxicity: "medium", dryHours: 24, coats: 3 },
      { name: "Shellac", durability: 2, ease: 4, appearance: "warm-amber", indoor: true, outdoor: false, toxicity: "very-low", dryHours: 2, coats: 3 },
      { name: "Wax", durability: 1, ease: 5, appearance: "satin", indoor: true, outdoor: false, toxicity: "none", dryHours: 1, coats: 2 },
    ];
    const suitable = finishes.filter(f => indoor || f.outdoor).sort((a, b) => b.durability + b.ease - (a.durability + a.ease));
    return { ok: true, result: { wood: species, application: use, environment: indoor ? "indoor" : "outdoor", topRecommendation: suitable[0]?.name, options: suitable.slice(0, 4).map(f => ({ name: f.name, durability: `${f.durability}/5`, easeOfApplication: `${f.ease}/5`, appearance: f.appearance, toxicity: f.toxicity, dryTime: `${f.dryHours}h`, coatsNeeded: f.coats })) } };
  });
}
