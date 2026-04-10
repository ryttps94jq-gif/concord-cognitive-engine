// server/domains/welding.js
export default function registerWeldingActions(registerLensAction) {
  registerLensAction("welding", "jointStrength", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const thickness = parseFloat(data.thickness) || 6;
    const weldType = (data.weldType || "fillet").toLowerCase();
    const material = (data.material || "mild-steel").toLowerCase();
    const length = parseFloat(data.length) || 100;
    const tensileStrengths = { "mild-steel": 400, "stainless-steel": 520, "aluminum": 270, "high-strength": 690, "cast-iron": 200 };
    const tensile = tensileStrengths[material] || 400;
    const weldFactors = { fillet: 0.707, butt: 1.0, groove: 0.9, lap: 0.65, plug: 0.5 };
    const factor = weldFactors[weldType] || 0.707;
    const throatSize = thickness * factor;
    const shearStrength = tensile * 0.6;
    const loadCapacity = Math.round(throatSize * length * shearStrength / 1000);
    const safeLoad = Math.round(loadCapacity / 1.5);
    return { ok: true, result: { material, weldType, thickness: `${thickness}mm`, length: `${length}mm`, throatSize: `${Math.round(throatSize * 10) / 10}mm`, tensileStrength: `${tensile} MPa`, theoreticalCapacity: `${loadCapacity} kN`, safeWorkingLoad: `${safeLoad} kN`, safetyFactor: 1.5, rating: safeLoad > 100 ? "heavy-duty" : safeLoad > 50 ? "structural" : safeLoad > 20 ? "medium-duty" : "light-duty" } };
  });

  registerLensAction("welding", "rodSelection", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const baseMetal = (data.baseMetal || data.material || "mild-steel").toLowerCase();
    const position = (data.position || "flat").toLowerCase();
    const jointType = (data.jointType || "fillet").toLowerCase();
    const thickness = parseFloat(data.thickness) || 6;
    const rodDatabase = {
      "mild-steel": [
        { rod: "E6010", process: "SMAW", positions: ["all"], notes: "Deep penetration, all-position", amps: { min: 75, max: 130 } },
        { rod: "E6013", process: "SMAW", positions: ["flat", "horizontal", "vertical"], notes: "Easy arc, smooth finish", amps: { min: 80, max: 120 } },
        { rod: "E7018", process: "SMAW", positions: ["all"], notes: "Low hydrogen, strongest", amps: { min: 90, max: 140 } },
        { rod: "ER70S-6", process: "MIG", positions: ["all"], notes: "General purpose MIG wire", amps: { min: 100, max: 250 } },
      ],
      "stainless-steel": [
        { rod: "E308L", process: "SMAW", positions: ["all"], notes: "304 stainless", amps: { min: 70, max: 120 } },
        { rod: "E316L", process: "SMAW", positions: ["all"], notes: "316 stainless, corrosion resistant", amps: { min: 70, max: 120 } },
        { rod: "ER308LSi", process: "MIG/TIG", positions: ["all"], notes: "Most common stainless wire", amps: { min: 80, max: 200 } },
      ],
      "aluminum": [
        { rod: "ER4043", process: "MIG/TIG", positions: ["flat", "horizontal"], notes: "General aluminum, good flow", amps: { min: 90, max: 200 } },
        { rod: "ER5356", process: "MIG/TIG", positions: ["all"], notes: "Higher strength, marine grade", amps: { min: 100, max: 220 } },
      ],
    };
    const rods = rodDatabase[baseMetal] || rodDatabase["mild-steel"];
    const suitable = rods.filter(r => r.positions.includes("all") || r.positions.includes(position));
    const recommended = suitable[0] || rods[0];
    const diameter = thickness <= 3 ? 2.4 : thickness <= 6 ? 3.2 : thickness <= 12 ? 4.0 : 5.0;
    return { ok: true, result: { baseMetal, position, jointType, materialThickness: `${thickness}mm`, recommended: { rod: recommended.rod, process: recommended.process, diameter: `${diameter}mm`, amperageRange: `${recommended.amps.min}-${recommended.amps.max}A`, notes: recommended.notes }, alternatives: suitable.slice(1).map(r => ({ rod: r.rod, process: r.process, notes: r.notes })), tips: [`Preheat if thickness > 25mm`, `Clean base metal thoroughly before welding`, position === "overhead" ? "Use lower amperage for overhead position" : null].filter(Boolean) } };
  });

  registerLensAction("welding", "heatInput", (ctx, artifact, _params) => {
    const voltage = parseFloat(artifact.data?.voltage) || 25;
    const amperage = parseFloat(artifact.data?.amperage || artifact.data?.current) || 150;
    const travelSpeed = parseFloat(artifact.data?.travelSpeed) || 5;
    const efficiency = parseFloat(artifact.data?.efficiency) || 0.8;
    const maxInterpass = parseFloat(artifact.data?.maxInterpassTemp) || 250;
    const heatInputJmm = (voltage * amperage * efficiency) / travelSpeed;
    const heatInputKJmm = Math.round(heatInputJmm / 1000 * 100) / 100;
    const risk = heatInputKJmm > 3.0 ? "high" : heatInputKJmm > 1.5 ? "moderate" : "low";
    return { ok: true, result: { voltage: `${voltage}V`, amperage: `${amperage}A`, travelSpeed: `${travelSpeed} mm/s`, efficiency, heatInput: `${heatInputKJmm} kJ/mm`, heatInputJoules: Math.round(heatInputJmm), maxInterpassTemp: `${maxInterpass}°C`, distortionRisk: risk, recommendations: [heatInputKJmm > 2.5 ? "Reduce heat input — increase travel speed or reduce amperage" : null, heatInputKJmm < 0.5 ? "Low heat input — risk of incomplete fusion" : null, "Monitor interpass temperature between passes", risk === "high" ? "Use backstep welding technique to reduce distortion" : null].filter(Boolean) } };
  });

  registerLensAction("welding", "inspectionChecklist", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const weldType = (data.weldType || "fillet").toLowerCase();
    const code = (data.code || "AWS D1.1").toUpperCase();
    const inspections = data.inspections || [];
    const baseChecklist = [
      { item: "Visual inspection — surface cracks", category: "visual", required: true },
      { item: "Visual inspection — porosity", category: "visual", required: true },
      { item: "Visual inspection — undercut depth", category: "visual", required: true },
      { item: "Visual inspection — weld profile/contour", category: "visual", required: true },
      { item: "Dimensional — weld size meets spec", category: "dimensional", required: true },
      { item: "Dimensional — leg length (fillet)", category: "dimensional", required: weldType === "fillet" },
      { item: "Dimensional — reinforcement height", category: "dimensional", required: weldType === "butt" || weldType === "groove" },
      { item: "Dimensional — angular distortion within tolerance", category: "dimensional", required: true },
      { item: "NDT — dye penetrant test (PT)", category: "ndt", required: code.includes("AWS") || code.includes("ASME") },
      { item: "NDT — magnetic particle test (MT)", category: "ndt", required: code.includes("AWS") },
      { item: "NDT — ultrasonic test (UT)", category: "ndt", required: code.includes("ASME") },
      { item: "NDT — radiographic test (RT)", category: "ndt", required: weldType === "butt" },
      { item: "Documentation — WPS on file", category: "docs", required: true },
      { item: "Documentation — welder qualification current", category: "docs", required: true },
    ].filter(c => c.required);
    const checklist = baseChecklist.map(c => {
      const inspection = inspections.find(i => i.item === c.item || i.id === c.item);
      return { ...c, status: inspection ? (inspection.passed ? "pass" : "fail") : "pending" };
    });
    const passed = checklist.filter(c => c.status === "pass").length;
    const failed = checklist.filter(c => c.status === "fail").length;
    const pending = checklist.filter(c => c.status === "pending").length;
    return { ok: true, result: { weldType, code, totalItems: checklist.length, passed, failed, pending, passRate: checklist.length > 0 ? Math.round((passed / checklist.length) * 100) : 0, checklist, verdict: failed > 0 ? "FAIL — rework required" : pending > 0 ? "INCOMPLETE — inspections pending" : "PASS — all inspections cleared" } };
  });
}
