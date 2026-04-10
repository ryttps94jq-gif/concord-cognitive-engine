// server/domains/cooking.js
export default function registerCookingActions(registerLensAction) {
  registerLensAction("cooking", "scaleRecipe", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const baseServings = parseFloat(data.servings || data.baseYield) || 4;
    const targetServings = parseFloat(data.targetServings || _params?.targetServings) || 8;
    const ingredients = data.ingredients || [];
    const factor = targetServings / baseServings;
    const scaled = ingredients.map(i => ({ name: i.name, original: `${i.quantity} ${i.unit || ""}`, scaled: `${Math.round(parseFloat(i.quantity || 0) * factor * 100) / 100} ${i.unit || ""}` }));
    return { ok: true, result: { recipe: data.name || artifact.title, baseServings, targetServings, scaleFactor: Math.round(factor * 100) / 100, ingredients: scaled } };
  });
  registerLensAction("cooking", "nutritionEstimate", (ctx, artifact, _params) => {
    const ingredients = artifact.data?.ingredients || [];
    // Rough per-100g estimates
    const db = { flour: { cal: 364, protein: 10, carbs: 76, fat: 1 }, sugar: { cal: 387, protein: 0, carbs: 100, fat: 0 }, butter: { cal: 717, protein: 1, carbs: 0, fat: 81 }, egg: { cal: 155, protein: 13, carbs: 1, fat: 11 }, milk: { cal: 42, protein: 3, carbs: 5, fat: 1 }, chicken: { cal: 239, protein: 27, carbs: 0, fat: 14 }, rice: { cal: 130, protein: 3, carbs: 28, fat: 0 }, oil: { cal: 884, protein: 0, carbs: 0, fat: 100 }, cheese: { cal: 402, protein: 25, carbs: 1, fat: 33 }, potato: { cal: 77, protein: 2, carbs: 17, fat: 0 } };
    let totalCal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    for (const ing of ingredients) {
      const name = (ing.name || "").toLowerCase();
      const match = Object.keys(db).find(k => name.includes(k));
      if (match) {
        const grams = parseFloat(ing.grams || ing.quantity) || 100;
        const factor = grams / 100;
        totalCal += db[match].cal * factor; totalProtein += db[match].protein * factor;
        totalCarbs += db[match].carbs * factor; totalFat += db[match].fat * factor;
      }
    }
    const servings = parseFloat(artifact.data?.servings) || 1;
    return { ok: true, result: { totalCalories: Math.round(totalCal), perServing: Math.round(totalCal / servings), macros: { protein: `${Math.round(totalProtein)}g`, carbs: `${Math.round(totalCarbs)}g`, fat: `${Math.round(totalFat)}g` }, servings, note: "Estimates based on common ingredient averages" } };
  });
  registerLensAction("cooking", "mealPlan", (ctx, artifact, _params) => {
    const days = parseInt(artifact.data?.days) || 7;
    const preferences = artifact.data?.preferences || {};
    const budget = parseFloat(artifact.data?.budgetPerDay) || 15;
    const meals = ["breakfast", "lunch", "dinner"];
    const plan = Array.from({ length: days }, (_, i) => ({ day: i + 1, dayName: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7], meals: meals.map(m => ({ meal: m, planned: false, estimatedCost: Math.round(budget / 3 * 100) / 100 })) }));
    return { ok: true, result: { days, weeklyBudget: Math.round(budget * days * 100) / 100, dailyBudget: budget, plan, dietaryNotes: preferences.dietary || "none specified", mealsToFill: days * 3 } };
  });
  registerLensAction("cooking", "substitution", (ctx, artifact, _params) => {
    const ingredient = (artifact.data?.ingredient || "").toLowerCase();
    const subs = { butter: [{ sub: "Coconut oil", ratio: "1:1" }, { sub: "Applesauce", ratio: "1:0.5", note: "For baking, reduces fat" }], egg: [{ sub: "Flax egg (1 tbsp ground flax + 3 tbsp water)", ratio: "1 egg" }, { sub: "Mashed banana", ratio: "1/4 cup per egg" }], milk: [{ sub: "Oat milk", ratio: "1:1" }, { sub: "Almond milk", ratio: "1:1" }], flour: [{ sub: "Almond flour", ratio: "1:1", note: "Gluten-free, denser" }, { sub: "Oat flour", ratio: "1:1" }], sugar: [{ sub: "Honey", ratio: "1:0.75", note: "Reduce liquid by 2 tbsp" }, { sub: "Maple syrup", ratio: "1:0.75" }], cream: [{ sub: "Coconut cream", ratio: "1:1" }, { sub: "Cashew cream", ratio: "1:1" }] };
    const match = Object.keys(subs).find(k => ingredient.includes(k));
    return { ok: true, result: { ingredient, substitutions: match ? subs[match] : [{ sub: "No common substitutions found", ratio: "N/A" }], found: !!match } };
  });
}
