// server/domains/marketplace.js
export default function registerMarketplaceActions(registerLensAction) {
  registerLensAction("marketplace", "listingScore", (ctx, artifact, _params) => {
    const listing = artifact.data || {};
    const title = listing.title || "";
    const description = listing.description || "";
    const images = listing.images || listing.imageCount || 0;
    const imgCount = Array.isArray(images) ? images.length : parseInt(images) || 0;
    const price = parseFloat(listing.price) || 0;
    const titleScore = Math.min(30, Math.round((Math.min(title.length, 80) / 80) * 30));
    const descScore = Math.min(25, Math.round((Math.min(description.length, 500) / 500) * 25));
    const imgScore = Math.min(25, imgCount * 5);
    const priceScore = price > 0 ? 20 : 0;
    const total = titleScore + descScore + imgScore + priceScore;
    const tips = [];
    if (titleScore < 20) tips.push("Lengthen title to 40-80 characters with keywords");
    if (descScore < 15) tips.push("Add more detail to description (300+ chars recommended)");
    if (imgScore < 15) tips.push("Add more images (5+ recommended)");
    if (priceScore === 0) tips.push("Set a price to improve visibility");
    return { ok: true, result: { score: total, maxScore: 100, rating: total >= 80 ? "Excellent" : total >= 60 ? "Good" : total >= 40 ? "Fair" : "Poor", breakdown: { title: titleScore, description: descScore, images: imgScore, price: priceScore }, tips } };
  });

  registerLensAction("marketplace", "priceOptimize", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const currentPrice = parseFloat(data.price) || 0;
    const competitors = data.competitors || data.comparables || [];
    const cost = parseFloat(data.cost) || 0;
    if (competitors.length === 0) return { ok: true, result: { message: "Add competitor prices to optimize against.", currentPrice, margin: cost > 0 ? Math.round(((currentPrice - cost) / currentPrice) * 100) : null } };
    const prices = competitors.map(c => parseFloat(c.price || c) || 0).filter(p => p > 0);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
    const suggestedPrice = Math.round(median * 0.95 * 100) / 100;
    const margin = cost > 0 ? Math.round(((suggestedPrice - cost) / suggestedPrice) * 100) : null;
    return { ok: true, result: { currentPrice, suggestedPrice, competitorStats: { count: prices.length, avg: Math.round(avg * 100) / 100, min, max, median }, positioning: currentPrice > avg ? "above-market" : currentPrice < avg * 0.8 ? "budget" : "competitive", margin, priceRange: { aggressive: Math.round(min * 0.95 * 100) / 100, competitive: suggestedPrice, premium: Math.round(avg * 1.15 * 100) / 100 } } };
  });

  registerLensAction("marketplace", "sellerMetrics", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const orders = data.orders || data.sales || [];
    const reviews = data.reviews || [];
    if (orders.length === 0) return { ok: true, result: { message: "Add order/sales data to compute seller metrics." } };
    const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.amount || o.total || o.price) || 0), 0);
    const avgOrderValue = totalRevenue / orders.length;
    const returned = orders.filter(o => o.returned || o.refunded).length;
    const fulfilled = orders.filter(o => o.shipped || o.fulfilled || o.delivered).length;
    const avgRating = reviews.length > 0 ? Math.round((reviews.reduce((s, r) => s + (parseFloat(r.rating) || 0), 0) / reviews.length) * 10) / 10 : null;
    const responseTimes = orders.map(o => parseFloat(o.responseHours || o.responseTime) || 0).filter(t => t > 0);
    const avgResponse = responseTimes.length > 0 ? Math.round((responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) * 10) / 10 : null;
    return { ok: true, result: { totalOrders: orders.length, totalRevenue: Math.round(totalRevenue * 100) / 100, avgOrderValue: Math.round(avgOrderValue * 100) / 100, fulfillmentRate: Math.round((fulfilled / orders.length) * 100), returnRate: Math.round((returned / orders.length) * 100), avgRating, avgResponseHours: avgResponse, sellerLevel: avgRating >= 4.5 && (returned / orders.length) < 0.05 ? "Top Seller" : avgRating >= 4.0 ? "Trusted" : "Standard" } };
  });

  registerLensAction("marketplace", "marketTrend", (ctx, artifact, _params) => {
    const listings = artifact.data?.listings || artifact.data?.history || [];
    if (listings.length < 3) return { ok: true, result: { message: "Need 3+ listing records to analyze trends." } };
    const byCategory = {};
    listings.forEach(l => {
      const cat = l.category || "General";
      if (!byCategory[cat]) byCategory[cat] = { prices: [], count: 0, dates: [] };
      byCategory[cat].prices.push(parseFloat(l.price) || 0);
      byCategory[cat].count++;
      if (l.date) byCategory[cat].dates.push(new Date(l.date).getTime());
    });
    const trends = Object.entries(byCategory).map(([category, data]) => {
      const avgPrice = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
      const firstHalf = data.prices.slice(0, Math.floor(data.prices.length / 2));
      const secondHalf = data.prices.slice(Math.floor(data.prices.length / 2));
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, p) => s + p, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, p) => s + p, 0) / secondHalf.length : 0;
      const priceChange = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
      return { category, listingCount: data.count, avgPrice: Math.round(avgPrice * 100) / 100, priceChange, trend: priceChange > 5 ? "rising" : priceChange < -5 ? "falling" : "stable" };
    }).sort((a, b) => b.listingCount - a.listingCount);
    return { ok: true, result: { totalListings: listings.length, categories: trends.length, trends, hottest: trends.filter(t => t.trend === "rising").map(t => t.category), declining: trends.filter(t => t.trend === "falling").map(t => t.category) } };
  });
}
