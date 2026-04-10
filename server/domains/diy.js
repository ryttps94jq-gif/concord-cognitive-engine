// server/domains/diy.js
// Domain actions for DIY/maker: project cost estimation, material calculation,
// tool inventory management, build time estimation, safety assessment.

export default function registerDIYActions(registerLensAction) {
  /**
   * estimateProject
   * Calculate total project cost, time, and material needs.
   * artifact.data: { name, category, materials: [{ name, quantity, unit, unitPrice }], laborHours, hourlyRate }
   */
  registerLensAction("diy", "estimateProject", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const materials = data.materials || [];
    const laborHours = parseFloat(data.estimatedHours || data.laborHours) || 0;
    const hourlyRate = parseFloat(data.hourlyRate) || 25;

    const materialCosts = materials.map(m => {
      const qty = parseFloat(m.quantity) || 0;
      const price = parseFloat(m.unitPrice || m.price) || 0;
      const total = Math.round(qty * price * 100) / 100;
      return { name: m.name, quantity: qty, unit: m.unit || "pcs", unitPrice: price, total };
    });

    const totalMaterials = materialCosts.reduce((s, m) => s + m.total, 0);
    const laborCost = Math.round(laborHours * hourlyRate * 100) / 100;
    const wasteFactor = 1.1; // 10% waste allowance
    const adjustedMaterials = Math.round(totalMaterials * wasteFactor * 100) / 100;

    // Contingency: 15% for beginner, 10% intermediate, 5% advanced
    const difficulty = (data.difficulty || "intermediate").toLowerCase();
    const contingencyRates = { beginner: 0.15, intermediate: 0.10, advanced: 0.05, expert: 0.03 };
    const contingencyRate = contingencyRates[difficulty] || 0.10;
    const contingency = Math.round((adjustedMaterials + laborCost) * contingencyRate * 100) / 100;

    const totalEstimate = Math.round((adjustedMaterials + laborCost + contingency) * 100) / 100;

    return {
      ok: true,
      result: {
        projectName: data.name || artifact.title,
        category: data.category,
        difficulty,
        breakdown: {
          materialsCost: totalMaterials,
          wasteAllowance: Math.round((adjustedMaterials - totalMaterials) * 100) / 100,
          adjustedMaterials,
          laborCost,
          laborHours,
          hourlyRate,
          contingency,
          contingencyRate: `${Math.round(contingencyRate * 100)}%`,
        },
        totalEstimate,
        materialItems: materialCosts,
        perUnit: materials.length > 0 ? Math.round(totalEstimate / materials.length * 100) / 100 : 0,
        budgetTip: totalEstimate > 500 ? "Consider phasing the project — buy materials in stages" : "Project is within a reasonable single-purchase budget",
      },
    };
  });

  /**
   * cutList
   * Generate an optimized cut list to minimize material waste.
   * artifact.data: { stockLength, cuts: [{ length, quantity, label }] }
   */
  registerLensAction("diy", "cutList", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const stockLength = parseFloat(data.stockLength) || 96; // default 8ft board in inches
    const cuts = data.cuts || [];

    if (cuts.length === 0) {
      return { ok: true, result: { message: "Add cuts with length and quantity to generate an optimized cut list." } };
    }

    // Expand cuts by quantity
    const expandedCuts = [];
    for (const cut of cuts) {
      const qty = parseInt(cut.quantity) || 1;
      for (let i = 0; i < qty; i++) {
        expandedCuts.push({ length: parseFloat(cut.length) || 0, label: cut.label || `Cut ${expandedCuts.length + 1}` });
      }
    }

    // Sort cuts by length descending (first-fit decreasing bin packing)
    expandedCuts.sort((a, b) => b.length - a.length);

    const boards = [];
    const kerfWidth = 0.125; // 1/8" saw kerf

    for (const cut of expandedCuts) {
      let placed = false;
      for (const board of boards) {
        if (board.remaining >= cut.length + kerfWidth) {
          board.cuts.push(cut);
          board.remaining -= cut.length + kerfWidth;
          board.used += cut.length + kerfWidth;
          placed = true;
          break;
        }
      }
      if (!placed) {
        boards.push({
          id: boards.length + 1,
          stockLength,
          cuts: [cut],
          remaining: stockLength - cut.length - kerfWidth,
          used: cut.length + kerfWidth,
        });
      }
    }

    // Calculate efficiency
    const totalUsed = boards.reduce((s, b) => s + b.used, 0);
    const totalStock = boards.length * stockLength;
    const efficiency = Math.round((totalUsed / totalStock) * 100);
    const totalWaste = Math.round((totalStock - totalUsed) * 100) / 100;

    return {
      ok: true,
      result: {
        stockLength,
        kerfWidth,
        totalCuts: expandedCuts.length,
        boardsNeeded: boards.length,
        boards: boards.map(b => ({
          board: b.id,
          cuts: b.cuts.map(c => `${c.label}: ${c.length}"`),
          remaining: Math.round(b.remaining * 100) / 100,
          utilization: Math.round(((stockLength - b.remaining) / stockLength) * 100),
        })),
        efficiency,
        totalWaste,
        wasteTip: efficiency < 70 ? "Low efficiency — try adjusting cut sizes or using different stock lengths" : "Good material utilization",
      },
    };
  });

  /**
   * toolCheck
   * Analyze required tools for a project and flag what's missing.
   * artifact.data: { requiredTools: [string], ownedTools: [{ name, condition }] }
   */
  registerLensAction("diy", "toolCheck", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const required = data.requiredTools || [];
    const owned = data.ownedTools || [];

    if (required.length === 0) {
      return { ok: true, result: { message: "List required tools for the project to check availability." } };
    }

    const ownedNames = owned.map(t => (t.name || t).toLowerCase());
    const analysis = required.map(tool => {
      const toolLower = tool.toLowerCase();
      const match = owned.find(o => (o.name || o).toLowerCase().includes(toolLower) || toolLower.includes((o.name || o).toLowerCase()));
      return {
        tool,
        owned: !!match,
        condition: match ? (match.condition || "good") : null,
        needsRepair: match && (match.condition || "").toLowerCase() === "needs repair",
      };
    });

    const missing = analysis.filter(a => !a.owned);
    const needsRepair = analysis.filter(a => a.needsRepair);

    // Rough rental vs buy estimates
    const rentalEstimates = {
      "table saw": { buy: 400, rent: 50 },
      "drill press": { buy: 300, rent: 40 },
      "router": { buy: 150, rent: 30 },
      "sander": { buy: 80, rent: 25 },
      "jigsaw": { buy: 100, rent: 25 },
      "circular saw": { buy: 120, rent: 30 },
      "miter saw": { buy: 250, rent: 45 },
      "welder": { buy: 500, rent: 60 },
      "soldering iron": { buy: 30, rent: 10 },
    };

    const missingCosts = missing.map(m => {
      const estimate = Object.entries(rentalEstimates).find(([k]) => m.tool.toLowerCase().includes(k));
      return {
        tool: m.tool,
        buyEstimate: estimate ? estimate[1].buy : null,
        rentEstimate: estimate ? estimate[1].rent : null,
      };
    });

    return {
      ok: true,
      result: {
        totalRequired: required.length,
        owned: analysis.filter(a => a.owned && !a.needsRepair).length,
        missing: missing.length,
        needsRepair: needsRepair.length,
        readyToStart: missing.length === 0 && needsRepair.length === 0,
        tools: analysis,
        missingCosts,
        totalBuyCost: missingCosts.reduce((s, m) => s + (m.buyEstimate || 0), 0),
        totalRentCost: missingCosts.reduce((s, m) => s + (m.rentEstimate || 0), 0),
        recommendation: missing.length > 3 ? "Consider renting — multiple tools needed" : missing.length > 0 ? "Buy if you'll reuse, rent for one-time projects" : "All tools available — ready to build",
      },
    };
  });

  /**
   * safetyCheck
   * Assess safety requirements for a DIY project.
   * artifact.data: { category, tools: [string], materials: [string], experience }
   */
  registerLensAction("diy", "safetyCheck", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const category = (data.category || "general").toLowerCase();
    const tools = (data.tools || []).map(t => typeof t === "string" ? t.toLowerCase() : (t.name || "").toLowerCase());
    const materials = (data.materials || []).map(m => typeof m === "string" ? m.toLowerCase() : (m.name || "").toLowerCase());
    const experience = (data.difficulty || data.experience || "intermediate").toLowerCase();

    const ppe = new Set(["safety glasses"]);
    const hazards = [];
    const precautions = [];

    // Tool-based hazards
    const hazardousTools = {
      "saw": { ppe: ["safety glasses", "hearing protection"], hazard: "Kickback and blade contact", precaution: "Use push sticks, never reach over blade" },
      "router": { ppe: ["safety glasses", "hearing protection", "dust mask"], hazard: "Flying debris", precaution: "Secure workpiece with clamps" },
      "welder": { ppe: ["welding helmet", "leather gloves", "fire-resistant clothing"], hazard: "Burns, UV exposure, fumes", precaution: "Ensure ventilation, keep fire extinguisher nearby" },
      "drill": { ppe: ["safety glasses"], hazard: "Bit breakage, entanglement", precaution: "Secure loose clothing, clamp workpiece" },
      "solder": { ppe: ["safety glasses", "fume extractor"], hazard: "Burns, flux fumes", precaution: "Work in ventilated area, use solder stand" },
      "grinder": { ppe: ["safety glasses", "face shield", "hearing protection"], hazard: "Flying sparks and fragments", precaution: "Check wheel for cracks before use" },
    };

    for (const tool of tools) {
      for (const [keyword, info] of Object.entries(hazardousTools)) {
        if (tool.includes(keyword)) {
          info.ppe.forEach(p => ppe.add(p));
          hazards.push(`${tool}: ${info.hazard}`);
          precautions.push(info.precaution);
        }
      }
    }

    // Material-based hazards
    if (materials.some(m => m.includes("epoxy") || m.includes("resin"))) {
      ppe.add("nitrile gloves"); ppe.add("respirator");
      hazards.push("Chemical exposure from epoxy/resin");
    }
    if (materials.some(m => m.includes("wood") || m.includes("mdf"))) {
      ppe.add("dust mask");
      hazards.push("Wood dust inhalation");
    }
    if (materials.some(m => m.includes("paint") || m.includes("stain") || m.includes("varnish"))) {
      ppe.add("respirator"); ppe.add("nitrile gloves");
      hazards.push("VOC exposure from finishes");
      precautions.push("Work outdoors or with exhaust ventilation");
    }

    const riskLevel = hazards.length >= 4 ? "high" : hazards.length >= 2 ? "moderate" : "low";

    return {
      ok: true,
      result: {
        riskLevel,
        requiredPPE: [...ppe],
        hazards,
        precautions,
        experienceLevel: experience,
        firstAid: ["Keep first aid kit accessible", "Know location of nearest fire extinguisher", "Have phone nearby for emergencies"],
        safetyScore: Math.max(0, 100 - hazards.length * 15),
        clearToStart: riskLevel !== "high" || experience === "advanced" || experience === "expert",
      },
    };
  });

  /**
   * buildTimeEstimate
   * Estimate total build time based on project complexity and experience.
   * artifact.data: { steps: [{ name, estimatedMinutes }], difficulty, experience }
   */
  registerLensAction("diy", "buildTimeEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const steps = data.steps || [];
    const difficulty = (data.difficulty || "intermediate").toLowerCase();

    if (steps.length === 0) {
      const baseHours = parseFloat(data.estimatedHours) || 0;
      if (baseHours <= 0) return { ok: true, result: { message: "Add project steps or estimated hours to calculate build time." } };

      // Apply experience multiplier to flat estimate
      const multipliers = { beginner: 1.8, intermediate: 1.2, advanced: 1.0, expert: 0.85 };
      const mult = multipliers[difficulty] || 1.2;
      return {
        ok: true,
        result: {
          baseHours,
          adjustedHours: Math.round(baseHours * mult * 10) / 10,
          multiplier: mult,
          difficulty,
        },
      };
    }

    // Per-step estimation
    const experienceMultipliers = { beginner: 1.8, intermediate: 1.2, advanced: 1.0, expert: 0.85 };
    const mult = experienceMultipliers[difficulty] || 1.2;

    const stepEstimates = steps.map(step => {
      const baseMinutes = parseFloat(step.estimatedMinutes || step.duration) || 30;
      const adjusted = Math.round(baseMinutes * mult);
      return {
        step: step.name || step.instruction || "Unnamed step",
        baseMinutes,
        adjustedMinutes: adjusted,
      };
    });

    const totalBaseMinutes = stepEstimates.reduce((s, st) => s + st.baseMinutes, 0);
    const totalAdjustedMinutes = stepEstimates.reduce((s, st) => s + st.adjustedMinutes, 0);

    // Add setup/cleanup time (15% of total)
    const setupMinutes = Math.round(totalAdjustedMinutes * 0.15);
    const grandTotal = totalAdjustedMinutes + setupMinutes;

    return {
      ok: true,
      result: {
        steps: stepEstimates,
        totalBaseMinutes,
        totalAdjustedMinutes,
        setupCleanupMinutes: setupMinutes,
        grandTotalMinutes: grandTotal,
        grandTotalHours: Math.round(grandTotal / 60 * 10) / 10,
        difficulty,
        experienceMultiplier: mult,
        weekends: Math.ceil(grandTotal / (6 * 60)), // ~6 productive hours per weekend day
        tip: grandTotal > 480 ? "Multi-day project — plan stopping points between steps" : "Should be completable in a single session",
      },
    };
  });
}
