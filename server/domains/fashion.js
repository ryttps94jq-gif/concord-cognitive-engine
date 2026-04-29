// server/domains/fashion.js
import { callVision, callVisionUrl, visionPromptForDomain } from "../lib/vision-inference.js";

export default function registerFashionActions(registerLensAction) {
  registerLensAction("fashion", "vision", async (ctx, artifact, _params) => {
    const { imageB64, imageUrl } = artifact.data || {};
    if (!imageB64 && !imageUrl) return { ok: false, error: "imageB64 or imageUrl required" };
    const prompt = visionPromptForDomain("fashion");
    return imageUrl ? callVisionUrl(imageUrl, prompt) : callVision(imageB64, prompt);
  });
  registerLensAction("fashion", "styleProfile", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const preferences = data.preferences || {};
    const wardrobe = data.wardrobe || [];
    const colors = wardrobe.map(i => i.color).filter(Boolean);
    const colorFreq = {};
    for (const c of colors) colorFreq[c.toLowerCase()] = (colorFreq[c.toLowerCase()] || 0) + 1;
    const topColors = Object.entries(colorFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const categories = {};
    for (const i of wardrobe) { const c = i.category || "other"; categories[c] = (categories[c] || 0) + 1; }
    return { ok: true, result: { wardrobeSize: wardrobe.length, dominantColors: topColors.map(([c, n]) => ({ color: c, count: n })), categoryBreakdown: categories, style: preferences.style || "casual", bodyType: preferences.bodyType || "unspecified", budget: preferences.budget || "moderate", season: preferences.season || "all-season" } };
  });
  registerLensAction("fashion", "outfitSuggest", (ctx, artifact, _params) => {
    const wardrobe = artifact.data?.wardrobe || [];
    const occasion = (artifact.data?.occasion || "casual").toLowerCase();
    const season = (artifact.data?.season || "spring").toLowerCase();
    const tops = wardrobe.filter(i => (i.category || "").toLowerCase().includes("top") || (i.category || "").toLowerCase().includes("shirt") || (i.category || "").toLowerCase().includes("blouse"));
    const bottoms = wardrobe.filter(i => (i.category || "").toLowerCase().includes("bottom") || (i.category || "").toLowerCase().includes("pant") || (i.category || "").toLowerCase().includes("skirt"));
    const outerwear = wardrobe.filter(i => (i.category || "").toLowerCase().includes("jacket") || (i.category || "").toLowerCase().includes("coat"));
    const suggestions = [];
    for (let i = 0; i < Math.min(3, tops.length); i++) {
      const outfit = { top: tops[i]?.name, bottom: bottoms[i % bottoms.length]?.name || "Any bottom" };
      if (season === "winter" || season === "fall") outfit.outerwear = outerwear[0]?.name || "Add a jacket";
      suggestions.push(outfit);
    }
    return { ok: true, result: { occasion, season, suggestions: suggestions.length > 0 ? suggestions : [{ note: "Add wardrobe items to get outfit suggestions" }], wardrobeSize: wardrobe.length, missingPieces: tops.length === 0 ? ["tops"] : bottoms.length === 0 ? ["bottoms"] : [] } };
  });
  registerLensAction("fashion", "trendAnalysis", (ctx, artifact, _params) => {
    const trends = artifact.data?.trends || [];
    if (trends.length === 0) return { ok: true, result: { message: "Add trend data to analyze fashion direction." } };
    const byCategory = {};
    for (const t of trends) { const c = t.category || "general"; if (!byCategory[c]) byCategory[c] = []; byCategory[c].push(t); }
    return { ok: true, result: { totalTrends: trends.length, categories: Object.keys(byCategory).length, byCategory: Object.entries(byCategory).map(([cat, items]) => ({ category: cat, count: items.length, trending: items.filter(i => i.trending !== false).length })), hottest: trends.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0]?.name || "N/A" } };
  });
  registerLensAction("fashion", "costPerWear", (ctx, artifact, _params) => {
    const items = artifact.data?.items || artifact.data?.wardrobe || [];
    if (items.length === 0) return { ok: true, result: { message: "Add wardrobe items with cost and wear count." } };
    const analyzed = items.map(i => { const cost = parseFloat(i.cost || i.price) || 0; const wears = parseInt(i.wears || i.timesWorn) || 1; return { name: i.name, cost, wears, costPerWear: Math.round((cost / wears) * 100) / 100, value: cost / wears < 5 ? "excellent" : cost / wears < 15 ? "good" : cost / wears < 30 ? "moderate" : "poor" }; }).sort((a, b) => a.costPerWear - b.costPerWear);
    return { ok: true, result: { items: analyzed, bestValue: analyzed[0]?.name, worstValue: analyzed[analyzed.length - 1]?.name, avgCostPerWear: Math.round(analyzed.reduce((s, i) => s + i.costPerWear, 0) / analyzed.length * 100) / 100, tip: "Items worn 30+ times typically achieve excellent cost-per-wear" } };
  });
}
