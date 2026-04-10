// server/domains/wallet.js
// Domain actions for wallet: portfolio balancing, transaction categorization,
// budget checking, and spending trend analysis.

export default function registerWalletActions(registerLensAction) {
  registerLensAction("wallet", "portfolioBalance", (ctx, artifact, _params) => {
    const assets = artifact.data?.assets || artifact.data?.holdings || [];
    if (assets.length === 0) {
      return { ok: true, result: { message: "Provide an assets array with {name, quantity, currentPrice, costBasis} per asset." } };
    }
    let totalValue = 0;
    let totalCost = 0;
    const analyzed = assets.map(a => {
      const qty = parseFloat(a.quantity || a.shares) || 0;
      const price = parseFloat(a.currentPrice || a.price) || 0;
      const costBasis = parseFloat(a.costBasis || a.avgCost || 0) * qty;
      const marketValue = qty * price;
      const gainLoss = costBasis > 0 ? marketValue - costBasis : 0;
      const gainLossPercent = costBasis > 0 ? Math.round((gainLoss / costBasis) * 10000) / 100 : 0;
      totalValue += marketValue;
      totalCost += costBasis;
      return {
        name: a.name || a.symbol || "Unknown",
        type: a.type || "equity",
        quantity: qty,
        currentPrice: price,
        marketValue: Math.round(marketValue * 100) / 100,
        costBasis: Math.round(costBasis * 100) / 100,
        gainLoss: Math.round(gainLoss * 100) / 100,
        gainLossPercent,
      };
    });
    const withAllocation = analyzed.map(a => ({
      ...a,
      allocationPercent: totalValue > 0 ? Math.round((a.marketValue / totalValue) * 10000) / 100 : 0,
    })).sort((a, b) => b.marketValue - a.marketValue);
    const byType = {};
    for (const a of withAllocation) {
      byType[a.type] = (byType[a.type] || 0) + a.allocationPercent;
    }
    for (const t of Object.keys(byType)) {
      byType[t] = Math.round(byType[t] * 100) / 100;
    }
    const totalGainLoss = totalValue - totalCost;
    const topGainer = [...withAllocation].sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0];
    const topLoser = [...withAllocation].sort((a, b) => a.gainLossPercent - b.gainLossPercent)[0];
    const largest = withAllocation[0];
    const concentrationRisk = largest && largest.allocationPercent > 40 ? "high" : largest && largest.allocationPercent > 25 ? "moderate" : "low";
    return {
      ok: true,
      result: {
        totalValue: Math.round(totalValue * 100) / 100,
        totalCostBasis: Math.round(totalCost * 100) / 100,
        totalGainLoss: Math.round(totalGainLoss * 100) / 100,
        totalReturnPercent: totalCost > 0 ? Math.round((totalGainLoss / totalCost) * 10000) / 100 : 0,
        assetCount: withAllocation.length,
        allocationByType: byType,
        concentrationRisk,
        largestHolding: largest ? { name: largest.name, percent: largest.allocationPercent } : null,
        topGainer: topGainer ? { name: topGainer.name, percent: topGainer.gainLossPercent } : null,
        topLoser: topLoser ? { name: topLoser.name, percent: topLoser.gainLossPercent } : null,
        assets: withAllocation,
      },
    };
  });

  registerLensAction("wallet", "transactionCategorize", (ctx, artifact, _params) => {
    const transactions = artifact.data?.transactions || [];
    if (transactions.length === 0) {
      return { ok: true, result: { message: "Provide a transactions array with {merchant, amount, date} per transaction." } };
    }
    const categoryPatterns = {
      "Groceries": /walmart|costco|trader\s*joe|whole\s*foods|kroger|safeway|aldi|publix|grocery|market|food\s*lion|wegmans|heb|meijer|sprouts/i,
      "Dining": /mcdonald|starbucks|chipotle|subway|domino|pizza|burger|taco|wendy|dunkin|panera|chick-fil|restaurant|cafe|diner|grill|sushi|thai|chinese|indian|mexican|bar\s*&|pub|bistro|eatery|doordash|grubhub|uber\s*eats/i,
      "Transportation": /uber|lyft|taxi|gas|shell|chevron|exxon|bp\b|mobil|sunoco|parking|toll|transit|metro|bus\b|amtrak|fuel|petrol|speedway/i,
      "Shopping": /amazon|target|best\s*buy|ebay|etsy|apple\s*store|nike|nordstrom|macy|kohls|tj\s*maxx|marshalls|ross|home\s*depot|lowes|ikea|wayfair|zara|h&m|gap|old\s*navy/i,
      "Entertainment": /netflix|spotify|hulu|disney|hbo|youtube|twitch|steam|playstation|xbox|cinema|movie|theater|concert|ticket|amc|regal|audible/i,
      "Utilities": /electric|water\s*bill|gas\s*bill|internet|comcast|verizon|at&t|t-mobile|sprint|utility|sewage|waste|power\s*company|xfinity|spectrum/i,
      "Healthcare": /pharmacy|cvs|walgreens|doctor|hospital|clinic|dental|medical|health|urgent\s*care|lab|optom|therap|prescription|copay/i,
      "Subscriptions": /subscription|membership|premium|annual\s*fee|monthly\s*fee|patreon|substack/i,
      "Travel": /airline|hotel|airbnb|booking|expedia|marriott|hilton|hyatt|flight|rental\s*car|hertz|avis|enterprise/i,
      "Finance": /transfer|payment|interest|fee|bank|atm|invest|trade|brokerage|insurance|premium|loan|mortgage/i,
    };
    let categorized = 0;
    let uncategorized = 0;
    const results = transactions.map(tx => {
      const merchant = tx.merchant || tx.description || tx.name || "";
      const amount = parseFloat(tx.amount) || 0;
      let category = "Uncategorized";
      for (const [cat, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(merchant)) {
          category = cat;
          break;
        }
      }
      if (category === "Uncategorized") uncategorized++;
      else categorized++;
      return {
        merchant: merchant || "Unknown",
        amount: Math.round(amount * 100) / 100,
        date: tx.date || null,
        category,
      };
    });
    const categoryTotals = {};
    const categoryCounts = {};
    for (const r of results) {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + Math.abs(r.amount);
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    }
    const totalSpent = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
    const summary = Object.entries(categoryTotals)
      .map(([cat, total]) => ({
        category: cat,
        total: Math.round(total * 100) / 100,
        count: categoryCounts[cat],
        percentOfTotal: totalSpent > 0 ? Math.round((total / totalSpent) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    return {
      ok: true,
      result: {
        totalTransactions: transactions.length,
        categorized,
        uncategorized,
        categorizationRate: `${Math.round((categorized / transactions.length) * 100)}%`,
        totalSpent: Math.round(totalSpent * 100) / 100,
        categorySummary: summary,
        transactions: results,
      },
    };
  });

  registerLensAction("wallet", "budgetCheck", (ctx, artifact, _params) => {
    const budgets = artifact.data?.budgets || artifact.data?.categories || [];
    const transactions = artifact.data?.transactions || [];
    if (budgets.length === 0) {
      return { ok: true, result: { message: "Provide a budgets array with {category, limit} and optionally transactions to auto-sum spending." } };
    }
    const spendingByCategory = {};
    for (const tx of transactions) {
      const cat = tx.category || "Uncategorized";
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + amount;
    }
    let totalBudget = 0;
    let totalSpent = 0;
    let overageCount = 0;
    let nearLimitCount = 0;
    const checked = budgets.map(b => {
      const category = b.category || b.name || "Unknown";
      const limit = parseFloat(b.limit || b.budget) || 0;
      const spent = parseFloat(b.spent) || spendingByCategory[category] || 0;
      const remaining = limit - spent;
      const percentUsed = limit > 0 ? Math.round((spent / limit) * 10000) / 100 : 0;
      let status;
      if (spent > limit) {
        status = "over-budget";
        overageCount++;
      } else if (percentUsed >= 90) {
        status = "near-limit";
        nearLimitCount++;
      } else if (percentUsed >= 70) {
        status = "caution";
      } else {
        status = "on-track";
      }
      totalBudget += limit;
      totalSpent += spent;
      return {
        category,
        limit: Math.round(limit * 100) / 100,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentUsed,
        status,
        overage: remaining < 0 ? Math.round(Math.abs(remaining) * 100) / 100 : 0,
      };
    }).sort((a, b) => b.percentUsed - a.percentUsed);
    const overBudgetItems = checked.filter(c => c.status === "over-budget");
    const totalRemaining = totalBudget - totalSpent;
    const overallStatus = overageCount > 0 ? "over-budget" : nearLimitCount > 0 ? "at-risk" : "healthy";
    return {
      ok: true,
      result: {
        overallStatus,
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalRemaining: Math.round(totalRemaining * 100) / 100,
        overallPercentUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0,
        categoriesOverBudget: overageCount,
        categoriesNearLimit: nearLimitCount,
        overages: overBudgetItems.map(c => ({ category: c.category, overage: c.overage, percentUsed: c.percentUsed })),
        categories: checked,
      },
    };
  });

  registerLensAction("wallet", "spendingTrend", (ctx, artifact, _params) => {
    const transactions = artifact.data?.transactions || [];
    if (transactions.length === 0) {
      return { ok: true, result: { message: "Provide a transactions array with {amount, date, category} to analyze spending trends." } };
    }
    const monthlyTotals = {};
    const monthlyByCategory = {};
    for (const tx of transactions) {
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      const date = tx.date || "";
      const category = tx.category || "Uncategorized";
      const monthMatch = date.match(/^(\d{4})-(\d{2})/);
      const monthKey = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : "unknown";
      if (monthKey === "unknown") continue;
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
      if (!monthlyByCategory[monthKey]) monthlyByCategory[monthKey] = {};
      monthlyByCategory[monthKey][category] = (monthlyByCategory[monthKey][category] || 0) + amount;
    }
    const sortedMonths = Object.keys(monthlyTotals).sort();
    if (sortedMonths.length === 0) {
      return { ok: true, result: { message: "No valid dates found in transactions. Use YYYY-MM-DD format." } };
    }
    const monthOverMonth = [];
    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = monthlyTotals[sortedMonths[i - 1]];
      const curr = monthlyTotals[sortedMonths[i]];
      const change = curr - prev;
      const changePercent = prev > 0 ? Math.round((change / prev) * 10000) / 100 : 0;
      monthOverMonth.push({
        month: sortedMonths[i],
        total: Math.round(curr * 100) / 100,
        previousTotal: Math.round(prev * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent,
        direction: change > 0 ? "increase" : change < 0 ? "decrease" : "flat",
      });
    }
    const allCategories = new Set();
    for (const m of Object.values(monthlyByCategory)) {
      for (const c of Object.keys(m)) allCategories.add(c);
    }
    const categoryGrowth = [];
    for (const cat of allCategories) {
      const firstMonth = sortedMonths[0];
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      const firstVal = (monthlyByCategory[firstMonth] || {})[cat] || 0;
      const lastVal = (monthlyByCategory[lastMonth] || {})[cat] || 0;
      const totalForCat = sortedMonths.reduce((s, m) => s + ((monthlyByCategory[m] || {})[cat] || 0), 0);
      const growthPercent = firstVal > 0 ? Math.round(((lastVal - firstVal) / firstVal) * 10000) / 100 : (lastVal > 0 ? 100 : 0);
      categoryGrowth.push({
        category: cat,
        totalSpent: Math.round(totalForCat * 100) / 100,
        firstPeriod: Math.round(firstVal * 100) / 100,
        lastPeriod: Math.round(lastVal * 100) / 100,
        growthPercent,
      });
    }
    categoryGrowth.sort((a, b) => b.growthPercent - a.growthPercent);
    const totalAllTime = Object.values(monthlyTotals).reduce((s, v) => s + v, 0);
    const avgMonthly = sortedMonths.length > 0 ? Math.round((totalAllTime / sortedMonths.length) * 100) / 100 : 0;
    const highestMonth = sortedMonths.reduce((best, m) => monthlyTotals[m] > (monthlyTotals[best] || 0) ? m : best, sortedMonths[0]);
    const lowestMonth = sortedMonths.reduce((best, m) => monthlyTotals[m] < (monthlyTotals[best] || Infinity) ? m : best, sortedMonths[0]);
    const overallTrend = sortedMonths.length >= 2
      ? (monthlyTotals[sortedMonths[sortedMonths.length - 1]] > monthlyTotals[sortedMonths[0]] ? "increasing" : monthlyTotals[sortedMonths[sortedMonths.length - 1]] < monthlyTotals[sortedMonths[0]] ? "decreasing" : "stable")
      : "insufficient-data";
    return {
      ok: true,
      result: {
        periodsAnalyzed: sortedMonths.length,
        dateRange: { from: sortedMonths[0], to: sortedMonths[sortedMonths.length - 1] },
        totalSpent: Math.round(totalAllTime * 100) / 100,
        averageMonthly: avgMonthly,
        highestMonth: { month: highestMonth, amount: Math.round(monthlyTotals[highestMonth] * 100) / 100 },
        lowestMonth: { month: lowestMonth, amount: Math.round(monthlyTotals[lowestMonth] * 100) / 100 },
        overallTrend,
        monthOverMonth,
        highestGrowthCategories: categoryGrowth.slice(0, 5),
        categoryTrends: categoryGrowth,
      },
    };
  });
}
