// server/domains/food.js
// Domain actions for food service: recipe scaling, plate costing, spoilage, pour cost.

export default function registerFoodActions(registerLensAction) {
  /**
   * scaleRecipe
   * Recalculate ingredients for a different yield.
   * artifact.data.recipe: { name, baseYield, yieldUnit, ingredients: [{ name, quantity, unit }] }
   * params.targetYield — the desired new yield
   */
  registerLensAction("food", "scaleRecipe", (ctx, artifact, params) => {
    const recipe = artifact.data.recipe || artifact.data;
    const baseYield = parseFloat(recipe.baseYield || recipe.yield) || 1;
    const targetYield = parseFloat(params.targetYield);

    if (!targetYield || targetYield <= 0) {
      return { ok: true, result: { error: "targetYield must be a positive number." } };
    }

    const scaleFactor = targetYield / baseYield;
    const ingredients = recipe.ingredients || [];

    const scaled = ingredients.map((ing) => {
      const origQty = parseFloat(ing.quantity) || 0;
      let newQty = origQty * scaleFactor;

      // Friendly rounding: round to nearest 0.25 for quantities > 1, nearest 0.125 for smaller
      if (newQty >= 1) {
        newQty = Math.round(newQty * 4) / 4;
      } else {
        newQty = Math.round(newQty * 8) / 8;
      }

      return {
        name: ing.name,
        originalQuantity: origQty,
        scaledQuantity: newQty,
        unit: ing.unit || "",
      };
    });

    const result = {
      recipeName: recipe.name || artifact.title,
      baseYield,
      targetYield,
      yieldUnit: recipe.yieldUnit || "servings",
      scaleFactor: Math.round(scaleFactor * 1000) / 1000,
      ingredients: scaled,
    };

    artifact.data.lastScaled = result;

    return { ok: true, result };
  });

  /**
   * costPlate
   * Calculate food cost percentage for a menu item.
   * artifact.data.menuItems: [{ name, ingredients: [{ name, quantity, unit, costPerUnit }], menuPrice }]
   * params.itemName — which menu item to cost (or cost all if omitted)
   */
  registerLensAction("food", "costPlate", (ctx, artifact, params) => {
    const menuItems = artifact.data.menuItems || [];
    const targetName = params.itemName || null;

    const items = targetName
      ? menuItems.filter((m) => m.name.toLowerCase() === targetName.toLowerCase())
      : menuItems;

    if (items.length === 0) {
      return { ok: true, result: { error: "No matching menu items found." } };
    }

    const targetPct = params.targetFoodCostPct || 30;

    const costed = items.map((item) => {
      let totalIngredientCost = 0;
      const ingredientCosts = (item.ingredients || []).map((ing) => {
        const qty = parseFloat(ing.quantity) || 0;
        const cpu = parseFloat(ing.costPerUnit) || 0;
        const cost = Math.round(qty * cpu * 100) / 100;
        totalIngredientCost += cost;
        return { name: ing.name, quantity: qty, unit: ing.unit, costPerUnit: cpu, totalCost: cost };
      });

      totalIngredientCost = Math.round(totalIngredientCost * 100) / 100;
      const menuPrice = parseFloat(item.menuPrice) || 0;
      const foodCostPct = menuPrice > 0 ? Math.round((totalIngredientCost / menuPrice) * 10000) / 100 : 0;
      const suggestedPrice = totalIngredientCost > 0
        ? Math.round((totalIngredientCost / (targetPct / 100)) * 100) / 100
        : 0;

      return {
        name: item.name,
        menuPrice,
        ingredientCost: totalIngredientCost,
        foodCostPct,
        targetFoodCostPct: targetPct,
        suggestedPriceAtTarget: suggestedPrice,
        margin: Math.round((menuPrice - totalIngredientCost) * 100) / 100,
        ingredients: ingredientCosts,
        status: foodCostPct <= targetPct ? "on-target" : "over-target",
      };
    });

    const avgFoodCost =
      costed.length > 0
        ? Math.round((costed.reduce((s, c) => s + c.foodCostPct, 0) / costed.length) * 100) / 100
        : 0;

    artifact.data.plateCostReport = { generatedAt: new Date().toISOString(), items: costed, avgFoodCostPct: avgFoodCost };

    return { ok: true, result: { items: costed, avgFoodCostPct: avgFoodCost } };
  });

  /**
   * generatePo
   * Generate a purchase order from inventory items at or below reorder point.
   * artifact.data.inventory: [{ item, quantity, unit, reorderPoint, preferredVendor, unitCost }]
   * params.vendorFilter — optional vendor name to limit PO
   */
  registerLensAction("food", "generatePo", (ctx, artifact, params) => {
    const inventory = artifact.data.inventory || [];
    const vendorFilter = params.vendorFilter || null;

    const needsReorder = inventory.filter(item => {
      const qty = parseFloat(item.quantity) || 0;
      const reorder = parseFloat(item.reorderPoint) || 0;
      if (qty > reorder) return false;
      if (vendorFilter && item.preferredVendor !== vendorFilter) return false;
      return true;
    });

    const lineItems = needsReorder.map(item => {
      const currentQty = parseFloat(item.quantity) || 0;
      const reorderPoint = parseFloat(item.reorderPoint) || 0;
      const orderUpTo = parseFloat(item.parLevel || item.maxLevel) || reorderPoint * 2;
      const orderQty = Math.max(0, Math.ceil(orderUpTo - currentQty));
      const unitCost = parseFloat(item.unitCost) || 0;
      return {
        item: item.item || item.name,
        currentQuantity: currentQty,
        reorderPoint,
        orderQuantity: orderQty,
        unit: item.unit || "ea",
        unitCost,
        lineTotal: Math.round(orderQty * unitCost * 100) / 100,
        vendor: item.preferredVendor || "unspecified",
      };
    });

    const totalCost = Math.round(lineItems.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

    const result = {
      generatedAt: new Date().toISOString(),
      poNumber: `PO-${Date.now()}`,
      vendor: vendorFilter || "multiple",
      lineItemCount: lineItems.length,
      lineItems,
      totalEstimatedCost: totalCost,
    };

    artifact.data.lastPurchaseOrder = result;

    return { ok: true, result };
  });

  /**
   * generatePrepList
   * Create a prep list from menu items with quantities and timing.
   * artifact.data.menuItems: [{ name, prepItems: [{ task, quantity, unit, prepTime, station }] }]
   * params.date — optional date label
   */
  registerLensAction("food", "generatePrepList", (ctx, artifact, params) => {
    const menuItems = artifact.data.menuItems || [];
    const date = params.date || new Date().toISOString().split("T")[0];

    const allTasks = [];
    for (const item of menuItems) {
      const servings = parseFloat(item.expectedServings || item.quantity) || 1;
      for (const prep of (item.prepItems || item.prep || [])) {
        const baseQty = parseFloat(prep.quantity) || 1;
        allTasks.push({
          menuItem: item.name,
          task: prep.task || prep.name,
          quantity: Math.ceil(baseQty * servings),
          unit: prep.unit || "ea",
          prepTimeMinutes: parseFloat(prep.prepTime) || 0,
          station: prep.station || "general",
        });
      }
    }

    // Group by station
    const byStation = {};
    for (const task of allTasks) {
      if (!byStation[task.station]) byStation[task.station] = [];
      byStation[task.station].push(task);
    }

    const totalPrepTime = allTasks.reduce((s, t) => s + t.prepTimeMinutes, 0);

    const result = {
      generatedAt: new Date().toISOString(),
      date,
      totalTasks: allTasks.length,
      totalPrepTimeMinutes: totalPrepTime,
      totalPrepTimeHours: Math.round((totalPrepTime / 60) * 10) / 10,
      byStation,
      tasks: allTasks,
    };

    artifact.data.prepList = result;

    return { ok: true, result };
  });

  /**
   * menuAnalysis
   * Analyze menu: item count, avg price, category distribution, margin analysis.
   * artifact.data.menuItems: [{ name, category, menuPrice, ingredients: [{ costPerUnit, quantity }] }]
   */
  registerLensAction("food", "menuAnalysis", (ctx, artifact, _params) => {
    const menuItems = artifact.data.menuItems || [];
    if (menuItems.length === 0) {
      return { ok: true, result: { itemCount: 0, message: "No menu items to analyze." } };
    }

    const categoryMap = {};
    let totalPrice = 0;
    let totalCost = 0;
    const margins = [];

    for (const item of menuItems) {
      const price = parseFloat(item.menuPrice) || 0;
      totalPrice += price;
      const cat = item.category || "uncategorized";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalPrice: 0 };
      categoryMap[cat].count++;
      categoryMap[cat].totalPrice += price;

      const cost = (item.ingredients || []).reduce((s, ing) => {
        return s + (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
      }, 0);
      totalCost += cost;
      const margin = price - cost;
      const marginPct = price > 0 ? Math.round((margin / price) * 10000) / 100 : 0;
      margins.push({ name: item.name, category: cat, price, cost: Math.round(cost * 100) / 100, margin: Math.round(margin * 100) / 100, marginPct });
    }

    const avgPrice = Math.round((totalPrice / menuItems.length) * 100) / 100;
    const avgMargin = margins.length > 0 ? Math.round((margins.reduce((s, m) => s + m.marginPct, 0) / margins.length) * 100) / 100 : 0;
    const categories = Object.entries(categoryMap).map(([name, data]) => ({
      category: name,
      count: data.count,
      percentage: Math.round((data.count / menuItems.length) * 10000) / 100,
      avgPrice: Math.round((data.totalPrice / data.count) * 100) / 100,
    }));

    margins.sort((a, b) => b.marginPct - a.marginPct);

    const result = {
      itemCount: menuItems.length,
      averagePrice: avgPrice,
      totalRevenuePotential: Math.round(totalPrice * 100) / 100,
      averageMarginPct: avgMargin,
      categories,
      topMarginItems: margins.slice(0, 5),
      lowMarginItems: margins.slice(-5).reverse(),
    };

    return { ok: true, result };
  });

  /**
   * suggestMeals
   * Suggest meals based on inventory, preferences, and dietary restrictions.
   * artifact.data.inventory: [{ item, quantity, unit }]
   * artifact.data.recipes: [{ name, ingredients: [{ name }], tags: [] }]
   * artifact.data.preferences: [string] — preferred cuisines/styles
   * artifact.data.dietaryRestrictions: [string] — e.g. "vegetarian", "gluten-free"
   */
  registerLensAction("food", "suggestMeals", (ctx, artifact, _params) => {
    const inventory = artifact.data.inventory || [];
    const recipes = artifact.data.recipes || [];
    const preferences = (artifact.data.preferences || []).map(p => p.toLowerCase());
    const restrictions = (artifact.data.dietaryRestrictions || []).map(r => r.toLowerCase());

    const availableItems = new Set(inventory.map(i => (i.item || i.name || "").toLowerCase()));

    const scored = [];
    for (const recipe of recipes) {
      const tags = (recipe.tags || []).map(t => t.toLowerCase());

      // Skip recipes that violate dietary restrictions
      const violates = restrictions.some(r => {
        if (r === "vegetarian" && tags.includes("meat")) return true;
        if (r === "vegan" && (tags.includes("meat") || tags.includes("dairy"))) return true;
        if (r === "gluten-free" && tags.includes("gluten")) return true;
        return recipe.restrictions && recipe.restrictions.includes(r);
      });
      if (violates) continue;

      // Score by ingredient availability
      const recipeIngredients = (recipe.ingredients || []).map(i => (typeof i === "string" ? i : i.name || "").toLowerCase());
      const matchedCount = recipeIngredients.filter(i => availableItems.has(i)).length;
      const ingredientScore = recipeIngredients.length > 0 ? matchedCount / recipeIngredients.length : 0;

      // Bonus for matching preferences
      const prefBonus = preferences.some(p => tags.includes(p)) ? 0.2 : 0;

      scored.push({
        name: recipe.name,
        score: Math.round((ingredientScore + prefBonus) * 100) / 100,
        ingredientsAvailable: matchedCount,
        ingredientsTotal: recipeIngredients.length,
        missingIngredients: recipeIngredients.filter(i => !availableItems.has(i)),
        tags: recipe.tags || [],
      });
    }

    scored.sort((a, b) => b.score - a.score);

    return {
      ok: true,
      result: {
        suggestedAt: new Date().toISOString(),
        totalRecipesEvaluated: recipes.length,
        suggestionsCount: Math.min(scored.length, 10),
        suggestions: scored.slice(0, 10),
        inventoryItemCount: inventory.length,
        dietaryRestrictions: restrictions,
      },
    };
  });

  /**
   * wasteReport
   * Calculate food waste metrics from waste log.
   * artifact.data.wasteLog: [{ item, quantity, unit, cost, reason, category, date }]
   */
  registerLensAction("food", "wasteReport", (ctx, artifact, _params) => {
    const wasteLog = artifact.data.wasteLog || [];
    if (wasteLog.length === 0) {
      return { ok: true, result: { totalEntries: 0, totalWasteCost: 0, message: "No waste data recorded." } };
    }

    let totalCost = 0;
    let totalQuantity = 0;
    const byCategory = {};
    const byReason = {};

    for (const entry of wasteLog) {
      const cost = parseFloat(entry.cost) || 0;
      const qty = parseFloat(entry.quantity) || 0;
      totalCost += cost;
      totalQuantity += qty;

      const cat = entry.category || "uncategorized";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, cost: 0, quantity: 0 };
      byCategory[cat].count++;
      byCategory[cat].cost += cost;
      byCategory[cat].quantity += qty;

      const reason = entry.reason || "unspecified";
      if (!byReason[reason]) byReason[reason] = { count: 0, cost: 0 };
      byReason[reason].count++;
      byReason[reason].cost += cost;
    }

    // Round values
    totalCost = Math.round(totalCost * 100) / 100;
    const categories = Object.entries(byCategory).map(([name, data]) => ({
      category: name,
      entries: data.count,
      cost: Math.round(data.cost * 100) / 100,
      quantity: Math.round(data.quantity * 100) / 100,
      pctOfTotalCost: totalCost > 0 ? Math.round((data.cost / totalCost) * 10000) / 100 : 0,
    }));
    categories.sort((a, b) => b.cost - a.cost);

    const reasons = Object.entries(byReason).map(([name, data]) => ({
      reason: name,
      entries: data.count,
      cost: Math.round(data.cost * 100) / 100,
    }));
    reasons.sort((a, b) => b.cost - a.cost);

    const suggestions = [];
    if (reasons.find(r => r.reason === "overproduction")) suggestions.push("Review production forecasting to reduce overproduction waste");
    if (reasons.find(r => r.reason === "spoilage")) suggestions.push("Implement FIFO rotation and improve storage conditions");
    if (reasons.find(r => r.reason === "trim")) suggestions.push("Evaluate trim utilization — stocks, purees, or staff meals");
    if (categories.length > 0) suggestions.push(`Focus on ${categories[0].category} — highest waste cost category`);

    const result = {
      generatedAt: new Date().toISOString(),
      totalEntries: wasteLog.length,
      totalWasteCost: totalCost,
      totalWasteQuantity: Math.round(totalQuantity * 100) / 100,
      byCategory: categories,
      byReason: reasons,
      reductionSuggestions: suggestions,
    };

    artifact.data.wasteReport = result;

    return { ok: true, result };
  });

  /**
   * spoilageCheck
   * Flag inventory items approaching their expiry date.
   * artifact.data.inventory: [{ item, quantity, unit, expiryDate, location }]
   * params.warningDays (default 3) — days before expiry to flag
   */
  registerLensAction("food", "spoilageCheck", (ctx, artifact, params) => {
    const inventory = artifact.data.inventory || [];
    const warningDays = params.warningDays != null ? params.warningDays : 3;
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + warningDays * 86400000);

    const expired = [];
    const expiringSoon = [];
    const ok = [];

    for (const item of inventory) {
      if (!item.expiryDate) {
        ok.push({ ...item, status: "no-expiry-date" });
        continue;
      }

      const expiry = new Date(item.expiryDate);
      const daysUntil = Math.ceil((expiry - now) / 86400000);

      if (expiry < now) {
        expired.push({ ...item, daysUntilExpiry: daysUntil, status: "expired" });
      } else if (expiry <= warningCutoff) {
        expiringSoon.push({ ...item, daysUntilExpiry: daysUntil, status: "expiring-soon" });
      } else {
        ok.push({ ...item, daysUntilExpiry: daysUntil, status: "ok" });
      }
    }

    // Estimate spoilage cost
    let estimatedLoss = 0;
    for (const item of expired) {
      estimatedLoss += (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
    }
    estimatedLoss = Math.round(estimatedLoss * 100) / 100;

    const report = {
      checkedAt: new Date().toISOString(),
      warningDays,
      totalItems: inventory.length,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      okCount: ok.length,
      estimatedSpoilageLoss: estimatedLoss,
      expired: expired.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      expiringSoon: expiringSoon.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    };

    artifact.data.spoilageReport = report;

    return { ok: true, result: report };
  });

  /**
   * pourCost
   * Calculate beverage cost percentage.
   * artifact.data.beverages: [{ name, costPerOz, pourOz, menuPrice }]
   * params.itemName — optional filter
   */
  registerLensAction("food", "pourCost", (ctx, artifact, params) => {
    const beverages = artifact.data.beverages || [];
    const targetName = params.itemName || null;

    const items = targetName
      ? beverages.filter((b) => b.name.toLowerCase() === targetName.toLowerCase())
      : beverages;

    if (items.length === 0) {
      return { ok: true, result: { error: "No matching beverages found." } };
    }

    const targetPourCost = params.targetPourCostPct || 20;

    const costed = items.map((bev) => {
      const costPerOz = parseFloat(bev.costPerOz) || 0;
      const pourOz = parseFloat(bev.pourOz) || 0;
      const menuPrice = parseFloat(bev.menuPrice) || 0;
      const drinkCost = Math.round(costPerOz * pourOz * 100) / 100;
      const pourCostPct = menuPrice > 0 ? Math.round((drinkCost / menuPrice) * 10000) / 100 : 0;
      const suggestedPrice =
        drinkCost > 0 ? Math.round((drinkCost / (targetPourCost / 100)) * 100) / 100 : 0;

      return {
        name: bev.name,
        costPerOz,
        pourOz,
        drinkCost,
        menuPrice,
        pourCostPct,
        targetPourCostPct: targetPourCost,
        suggestedPriceAtTarget: suggestedPrice,
        profit: Math.round((menuPrice - drinkCost) * 100) / 100,
        status: pourCostPct <= targetPourCost ? "on-target" : "over-target",
      };
    });

    const avgPourCost =
      costed.length > 0
        ? Math.round((costed.reduce((s, c) => s + c.pourCostPct, 0) / costed.length) * 100) / 100
        : 0;

    artifact.data.pourCostReport = { generatedAt: new Date().toISOString(), items: costed, avgPourCostPct: avgPourCost };

    return { ok: true, result: { items: costed, avgPourCostPct: avgPourCost } };
  });
};
