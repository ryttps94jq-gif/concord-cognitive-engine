// server/domains/finance.js
export default function registerFinanceActions(registerLensAction) {
  registerLensAction("finance", "portfolioAnalysis", (ctx, artifact, _params) => {
    const holdings = artifact.data?.holdings || [];
    if (holdings.length === 0) return { ok: true, result: { message: "Add portfolio holdings to analyze." } };
    const totalValue = holdings.reduce((s, h) => s + (parseFloat(h.value || h.marketValue) || 0), 0);
    const analyzed = holdings.map(h => { const val = parseFloat(h.value || h.marketValue) || 0; return { symbol: h.symbol || h.name, shares: parseFloat(h.shares) || 0, value: val, allocation: totalValue > 0 ? Math.round((val / totalValue) * 10000) / 100 : 0, gainLoss: parseFloat(h.gainLoss) || 0, type: h.type || "equity" }; });
    const byType = {};
    for (const h of analyzed) { byType[h.type] = (byType[h.type] || 0) + h.allocation; }
    const totalGainLoss = analyzed.reduce((s, h) => s + h.gainLoss, 0);
    return { ok: true, result: { holdings: analyzed, totalValue: Math.round(totalValue * 100) / 100, totalGainLoss: Math.round(totalGainLoss * 100) / 100, returnPercent: totalValue > 0 ? Math.round((totalGainLoss / (totalValue - totalGainLoss)) * 10000) / 100 : 0, allocationByType: byType, diversificationScore: Object.keys(byType).length >= 4 ? "well-diversified" : Object.keys(byType).length >= 2 ? "moderate" : "concentrated" } };
  });
  registerLensAction("finance", "budgetTracker", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const income = parseFloat(data.monthlyIncome) || 0;
    const categories = data.categories || [];
    const spent = categories.reduce((s, c) => s + (parseFloat(c.spent) || 0), 0);
    const budgeted = categories.reduce((s, c) => s + (parseFloat(c.budget) || 0), 0);
    const tracked = categories.map(c => { const b = parseFloat(c.budget) || 0; const s = parseFloat(c.spent) || 0; return { category: c.name, budget: b, spent: s, remaining: Math.round((b - s) * 100) / 100, percentUsed: b > 0 ? Math.round((s / b) * 100) : 0, status: s > b ? "over-budget" : s > b * 0.9 ? "near-limit" : "on-track" }; });
    return { ok: true, result: { monthlyIncome: income, totalBudgeted: budgeted, totalSpent: Math.round(spent * 100) / 100, remaining: Math.round((income - spent) * 100) / 100, savingsRate: income > 0 ? Math.round(((income - spent) / income) * 100) : 0, categories: tracked, overBudget: tracked.filter(c => c.status === "over-budget").map(c => c.category) } };
  });
  registerLensAction("finance", "compoundInterest", (ctx, artifact, _params) => {
    const principal = parseFloat(artifact.data?.principal) || 0;
    const rate = parseFloat(artifact.data?.annualRate) || 0.07;
    const years = parseInt(artifact.data?.years) || 10;
    const monthly = parseFloat(artifact.data?.monthlyContribution) || 0;
    const periods = years * 12;
    const monthlyRate = rate / 12;
    let balance = principal;
    const timeline = [];
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) { balance = balance * (1 + monthlyRate) + monthly; }
      timeline.push({ year: y, balance: Math.round(balance * 100) / 100 });
    }
    const totalContributed = principal + monthly * periods;
    const totalInterest = balance - totalContributed;
    return { ok: true, result: { principal, monthlyContribution: monthly, annualRate: `${(rate * 100).toFixed(1)}%`, years, finalBalance: Math.round(balance * 100) / 100, totalContributed: Math.round(totalContributed * 100) / 100, totalInterest: Math.round(totalInterest * 100) / 100, interestPercent: Math.round((totalInterest / balance) * 100), timeline } };
  });
  registerLensAction("finance", "debtPayoff", (ctx, artifact, _params) => {
    const debts = artifact.data?.debts || [];
    if (debts.length === 0) return { ok: true, result: { message: "Add debts with balance, rate, and minimum payment." } };
    const analyzed = debts.map(d => { const bal = parseFloat(d.balance) || 0; const rate = parseFloat(d.rate) || 0.18; const minPay = parseFloat(d.minimumPayment) || bal * 0.02; const monthsToPayoff = minPay > 0 ? Math.ceil(Math.log(1 / (1 - bal * (rate / 12) / minPay)) / Math.log(1 + rate / 12)) : Infinity; const totalInterest = (monthsToPayoff * minPay) - bal; return { name: d.name, balance: bal, rate: `${(rate * 100).toFixed(1)}%`, minimumPayment: minPay, monthsToPayoff: isFinite(monthsToPayoff) ? monthsToPayoff : 999, totalInterest: Math.round(totalInterest * 100) / 100 }; }).sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
    const totalDebt = analyzed.reduce((s, d) => s + d.balance, 0);
    const totalInterest = analyzed.reduce((s, d) => s + d.totalInterest, 0);
    return { ok: true, result: { debts: analyzed, totalDebt: Math.round(totalDebt * 100) / 100, totalInterest: Math.round(totalInterest * 100) / 100, strategy: "Avalanche method — pay highest rate first", firstTarget: analyzed[0]?.name, monthsToDebtFree: Math.max(...analyzed.map(d => d.monthsToPayoff)) } };
  });
}
