/**
 * Marketplace Lens Template
 *
 * Generates a domain handler for marketplace/commerce lenses:
 * listing creation, search/browse, purchase flow, seller analytics,
 * and review management.
 */

export const id = "marketplace";
export const name = "Marketplace";
export const description = "Listing, search, purchase, seller analytics, and reviews for marketplace/commerce lenses.";
export const category = "commerce";
export const tags = ["marketplace", "ecommerce", "listing", "purchase", "review", "seller", "commerce"];

/**
 * Generate domain handler code for a marketplace lens.
 *
 * @param {object} config
 * @param {string} config.domain - Domain/lens ID (e.g. "plugin-store")
 * @param {string} [config.entityName] - Listing entity name (e.g. "Plugin")
 * @param {string[]} [config.categories] - Available listing categories
 * @param {boolean} [config.reviews] - Include review system (default true)
 * @param {boolean} [config.analytics] - Include seller analytics (default true)
 * @returns {{ handler: string, page: string }}
 */
export function generate(config) {
  const domain = config.domain || "my-marketplace";
  const entity = config.entityName || "Listing";
  const entityLower = entity.toLowerCase();
  const categories = config.categories || ["general", "tools", "services", "digital", "physical"];
  const reviews = config.reviews !== false;
  const analytics = config.analytics !== false;

  const handler = `// server/domains/${domain}.js
// Domain actions for ${domain}: marketplace operations for ${entity} listings.

export default function register${pascal(domain)}Actions(registerLensAction) {
  /**
   * createListing
   * Create a new ${entityLower} listing.
   * artifact.data = { title, description, price, category, sellerId }
   */
  registerLensAction("${domain}", "createListing", (ctx, artifact, params) => {
    const data = artifact.data || {};
    const required = ["title", "price"];
    const missing = required.filter(f => !data[f] && data[f] !== 0);
    if (missing.length > 0) {
      return { ok: false, error: \`Missing required fields: \${missing.join(", ")}\` };
    }

    const price = parseFloat(data.price);
    if (isNaN(price) || price < 0) {
      return { ok: false, error: "Price must be a non-negative number." };
    }

    const categories = ${JSON.stringify(categories)};
    const category = data.category || "general";
    if (!categories.includes(category)) {
      return { ok: false, error: \`Invalid category "\${category}". Use one of: \${categories.join(", ")}\` };
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const listing = {
      id,
      title: data.title,
      description: data.description || "",
      price,
      currency: data.currency || "CC",
      category,
      sellerId: data.sellerId || ctx.userId || "anonymous",
      status: "active",
      views: 0,
      purchases: 0,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!artifact.data._listings) artifact.data._listings = [];
    artifact.data._listings.push(listing);

    return { ok: true, result: { created: listing, total: artifact.data._listings.length } };
  });

  /**
   * browseListings
   * Browse and filter ${entityLower} listings.
   * params.category, params.minPrice, params.maxPrice, params.sortBy, params.limit, params.offset
   */
  registerLensAction("${domain}", "browseListings", (ctx, artifact, params) => {
    let listings = (artifact.data?._listings || []).filter(l => l.status === "active");

    // Filter by category
    if (params.category) {
      listings = listings.filter(l => l.category === params.category);
    }

    // Filter by price range
    const minPrice = parseFloat(params.minPrice);
    const maxPrice = parseFloat(params.maxPrice);
    if (!isNaN(minPrice)) listings = listings.filter(l => l.price >= minPrice);
    if (!isNaN(maxPrice)) listings = listings.filter(l => l.price <= maxPrice);

    // Sort
    const sortBy = params.sortBy || "newest";
    switch (sortBy) {
      case "price-asc":  listings.sort((a, b) => a.price - b.price); break;
      case "price-desc": listings.sort((a, b) => b.price - a.price); break;
      case "popular":    listings.sort((a, b) => b.purchases - a.purchases); break;
      case "rating":     listings.sort((a, b) => b.rating - a.rating); break;
      case "newest":
      default:           listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }

    const total = listings.length;
    const limit = Math.min(parseInt(params.limit) || 25, 100);
    const offset = parseInt(params.offset) || 0;
    const page = listings.slice(offset, offset + limit);

    return {
      ok: true,
      result: {
        listings: page,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        categories: ${JSON.stringify(categories)},
        sortBy,
      },
    };
  });

  /**
   * searchListings
   * Full-text search across ${entityLower} listings.
   * params.query = search string
   */
  registerLensAction("${domain}", "searchListings", (ctx, artifact, params) => {
    const query = (params.query || "").toLowerCase();
    if (!query) return { ok: true, result: { matches: [], message: "Provide a search query." } };

    const listings = (artifact.data?._listings || []).filter(l => l.status === "active");
    const matches = listings
      .map(l => {
        let score = 0;
        if (l.title.toLowerCase().includes(query)) score += 3;
        if (l.description.toLowerCase().includes(query)) score += 1;
        if (l.category.toLowerCase().includes(query)) score += 2;
        return { ...l, relevanceScore: score };
      })
      .filter(l => l.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return { ok: true, result: { matches, count: matches.length, query } };
  });

  /**
   * purchaseListing
   * Execute a purchase of a ${entityLower}.
   * params.listingId, params.buyerId
   */
  registerLensAction("${domain}", "purchaseListing", (ctx, artifact, params) => {
    const listings = artifact.data?._listings || [];
    const listingId = params.listingId || params.id;
    if (!listingId) return { ok: false, error: "Provide params.listingId." };

    const listing = listings.find(l => l.id === listingId && l.status === "active");
    if (!listing) return { ok: false, error: "${entity} listing not found or no longer active." };

    const buyerId = params.buyerId || ctx.userId || "anonymous";
    if (buyerId === listing.sellerId) {
      return { ok: false, error: "Cannot purchase your own listing." };
    }

    // Record purchase
    listing.purchases++;
    listing.updatedAt = new Date().toISOString();

    if (!artifact.data._purchases) artifact.data._purchases = [];
    const purchase = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      listingId,
      listingTitle: listing.title,
      price: listing.price,
      currency: listing.currency,
      buyerId,
      sellerId: listing.sellerId,
      purchasedAt: new Date().toISOString(),
    };
    artifact.data._purchases.push(purchase);

    return { ok: true, result: { purchase, listing: { id: listing.id, title: listing.title, purchases: listing.purchases } } };
  });${reviews ? `

  /**
   * addReview
   * Add a review and rating to a ${entityLower}.
   * params.listingId, params.rating (1-5), params.comment, params.reviewerId
   */
  registerLensAction("${domain}", "addReview", (ctx, artifact, params) => {
    const listings = artifact.data?._listings || [];
    const listingId = params.listingId || params.id;
    if (!listingId) return { ok: false, error: "Provide params.listingId." };

    const listing = listings.find(l => l.id === listingId);
    if (!listing) return { ok: false, error: "${entity} listing not found." };

    const rating = parseInt(params.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: "Rating must be between 1 and 5." };
    }

    if (!artifact.data._reviews) artifact.data._reviews = [];
    const review = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      listingId,
      reviewerId: params.reviewerId || ctx.userId || "anonymous",
      rating,
      comment: params.comment || "",
      createdAt: new Date().toISOString(),
    };
    artifact.data._reviews.push(review);

    // Update listing rating (rolling average)
    const listingReviews = artifact.data._reviews.filter(r => r.listingId === listingId);
    listing.rating = Math.round(listingReviews.reduce((s, r) => s + r.rating, 0) / listingReviews.length * 100) / 100;
    listing.reviewCount = listingReviews.length;

    return { ok: true, result: { review, updatedRating: listing.rating, totalReviews: listing.reviewCount } };
  });

  /**
   * getReviews
   * Get reviews for a ${entityLower}.
   * params.listingId, params.limit, params.offset
   */
  registerLensAction("${domain}", "getReviews", (ctx, artifact, params) => {
    const listingId = params.listingId || params.id;
    if (!listingId) return { ok: false, error: "Provide params.listingId." };

    const allReviews = (artifact.data?._reviews || []).filter(r => r.listingId === listingId);
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = allReviews.length;
    const limit = Math.min(parseInt(params.limit) || 25, 100);
    const offset = parseInt(params.offset) || 0;
    const page = allReviews.slice(offset, offset + limit);

    const avgRating = total > 0 ? Math.round(allReviews.reduce((s, r) => s + r.rating, 0) / total * 100) / 100 : 0;
    const distribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: allReviews.filter(r => r.rating === star).length,
    }));

    return {
      ok: true,
      result: {
        reviews: page,
        total,
        avgRating,
        distribution,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  });` : ""}${analytics ? `

  /**
   * sellerAnalytics
   * Revenue, conversion, and performance analytics for a seller.
   * params.sellerId
   */
  registerLensAction("${domain}", "sellerAnalytics", (ctx, artifact, params) => {
    const sellerId = params.sellerId || ctx.userId || "anonymous";
    const listings = (artifact.data?._listings || []).filter(l => l.sellerId === sellerId);
    const purchases = (artifact.data?._purchases || []).filter(p => p.sellerId === sellerId);

    const totalRevenue = purchases.reduce((s, p) => s + p.price, 0);
    const activeListings = listings.filter(l => l.status === "active").length;
    const totalViews = listings.reduce((s, l) => s + l.views, 0);
    const totalPurchases = purchases.length;
    const conversionRate = totalViews > 0 ? Math.round((totalPurchases / totalViews) * 10000) / 100 : 0;

    const avgRating = listings.length > 0
      ? Math.round(listings.reduce((s, l) => s + l.rating, 0) / listings.length * 100) / 100
      : 0;

    // Top performing listings
    const topListings = [...listings]
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 5)
      .map(l => ({ id: l.id, title: l.title, purchases: l.purchases, revenue: l.purchases * l.price, rating: l.rating }));

    // Revenue by category
    const revByCategory = {};
    for (const p of purchases) {
      const listing = listings.find(l => l.id === p.listingId);
      const cat = listing?.category || "unknown";
      revByCategory[cat] = (revByCategory[cat] || 0) + p.price;
    }

    return {
      ok: true,
      result: {
        sellerId,
        summary: {
          totalListings: listings.length,
          activeListings,
          totalPurchases,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgRating,
          conversionRate,
        },
        topListings,
        revenueByCategory: revByCategory,
      },
    };
  });` : ""}
}
`;

  const actions = [
    "createListing", "browseListings", "searchListings", "purchaseListing",
    ...(reviews ? ["addReview", "getReviews"] : []),
    ...(analytics ? ["sellerAnalytics"] : []),
  ];

  const page = generatePageTemplate(domain, entity, actions);
  return { handler, page };
}

/** Convert kebab-case to PascalCase */
function pascal(str) {
  return str.replace(/(^|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}

/** Generate a Next.js page template for the marketplace lens */
function generatePageTemplate(domain, entity, actions) {
  return `"use client";
import { useState } from "react";

export default function ${pascal(domain)}Lens() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runAction(action, data = {}) {
    setLoading(true);
    try {
      const res = await fetch(\`/api/lens/${domain}/action\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">${entity} Marketplace</h1>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {${JSON.stringify(actions)}.map(action => (
          <button
            key={action}
            onClick={() => runAction(action)}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {action}
          </button>
        ))}
      </div>
      {result && (
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
`;
}

export default { id, name, description, category, tags, generate };
