export default function registerInsuranceActions(registerLensAction) {
  registerLensAction("insurance", "coverageGap", (ctx, artifact, _params) => {
    const policies = artifact.data?.policies || [artifact.data];
    const coverageTypes = ['health', 'auto', 'home', 'life', 'liability', 'umbrella'];
    const coveredTypes = new Set(policies.map(p => (p.type || '').toLowerCase()));
    const gaps = coverageTypes.filter(t => !coveredTypes.has(t));
    const expiringSoon = policies.filter(p => {
      if (!p.expiryDate) return false;
      const daysLeft = (new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30;
    });
    return { ok: true, result: { coveredTypes: [...coveredTypes], gaps, gapCount: gaps.length, expiringSoon, totalPolicies: policies.length } };
  });

  registerLensAction("insurance", "commissionSummary", (ctx, artifact, _params) => {
    const policies = artifact.data?.policies || [artifact.data];
    let totalPremium = 0;
    let totalCommission = 0;
    const byTier = {};

    for (const policy of policies) {
      const premium = parseFloat(policy.premium) || 0;
      const rate = parseFloat(policy.commissionRate || policy.rate) || 0;
      const tier = policy.tier || policy.type || "standard";
      const commission = Math.round(premium * (rate / 100) * 100) / 100;

      totalPremium += premium;
      totalCommission += commission;

      if (!byTier[tier]) byTier[tier] = { count: 0, premium: 0, commission: 0 };
      byTier[tier].count++;
      byTier[tier].premium += premium;
      byTier[tier].commission += commission;
    }

    const tiers = Object.entries(byTier).map(([name, data]) => ({
      tier: name,
      policyCount: data.count,
      totalPremium: Math.round(data.premium * 100) / 100,
      totalCommission: Math.round(data.commission * 100) / 100,
      avgRate: data.premium > 0 ? Math.round((data.commission / data.premium) * 10000) / 100 : 0,
    }));

    return {
      ok: true,
      result: {
        agent: artifact.title,
        totalPolicies: policies.length,
        totalPremium: Math.round(totalPremium * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        effectiveRate: totalPremium > 0 ? Math.round((totalCommission / totalPremium) * 10000) / 100 : 0,
        byTier: tiers,
      },
    };
  });

  registerLensAction("insurance", "lossRatioReport", (ctx, artifact, _params) => {
    const policies = artifact.data?.policies || [];
    const claims = artifact.data?.claims || [];

    const premiumsCollected = policies.reduce((s, p) => s + (parseFloat(p.premium) || 0), 0);
    const claimsPaid = claims
      .filter(c => c.status === "paid" || c.status === "closed")
      .reduce((s, c) => s + (parseFloat(c.amount) || parseFloat(c.paidAmount) || 0), 0);
    const totalClaims = claims.length;

    const lossRatio = premiumsCollected > 0 ? Math.round((claimsPaid / premiumsCollected) * 10000) / 100 : 0;
    const frequency = policies.length > 0 ? Math.round((totalClaims / policies.length) * 1000) / 1000 : 0;
    const severity = totalClaims > 0 ? Math.round((claimsPaid / totalClaims) * 100) / 100 : 0;

    let assessment = "profitable";
    if (lossRatio > 100) assessment = "unprofitable";
    else if (lossRatio > 75) assessment = "marginal";
    else if (lossRatio > 60) assessment = "acceptable";

    return {
      ok: true,
      result: {
        generatedAt: new Date().toISOString(),
        premiumsCollected: Math.round(premiumsCollected * 100) / 100,
        claimsPaid: Math.round(claimsPaid * 100) / 100,
        lossRatio,
        claimFrequency: frequency,
        averageSeverity: severity,
        totalPolicies: policies.length,
        totalClaims,
        assessment,
      },
    };
  });

  registerLensAction("insurance", "renewalAlert", (ctx, artifact, _params) => {
    const policies = artifact.data?.policies || [artifact.data];
    const now = new Date();
    const msPerDay = 86400000;
    const buckets = { within30: [], within60: [], within90: [], current: [] };

    for (const policy of policies) {
      const expiry = policy.expiryDate || policy.renewalDate || policy.endDate;
      if (!expiry) continue;
      const expiryDate = new Date(expiry);
      const daysUntil = Math.ceil((expiryDate - now) / msPerDay);
      if (daysUntil < 0) continue; // already expired

      const entry = {
        policyNumber: policy.policyNumber || policy.id,
        holder: policy.holder || policy.insuredName || "",
        type: policy.type || "general",
        expiryDate: expiryDate.toISOString().split("T")[0],
        daysUntilRenewal: daysUntil,
        premium: parseFloat(policy.premium) || 0,
      };

      if (daysUntil <= 30) buckets.within30.push(entry);
      else if (daysUntil <= 60) buckets.within60.push(entry);
      else if (daysUntil <= 90) buckets.within90.push(entry);
      else buckets.current.push(entry);
    }

    // Sort each bucket by soonest first
    for (const key of Object.keys(buckets)) buckets[key].sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

    const urgent = buckets.within30;
    const totalUpcoming = buckets.within30.length + buckets.within60.length + buckets.within90.length;
    const premiumAtRisk = [...buckets.within30, ...buckets.within60, ...buckets.within90]
      .reduce((s, p) => s + p.premium, 0);

    return {
      ok: true,
      result: {
        checkedAt: now.toISOString(),
        totalPolicies: policies.length,
        totalUpcomingRenewals: totalUpcoming,
        premiumAtRisk: Math.round(premiumAtRisk * 100) / 100,
        within30Days: buckets.within30,
        within60Days: buckets.within60,
        within90Days: buckets.within90,
        urgentCount: urgent.length,
      },
    };
  });

  registerLensAction("insurance", "premiumHistory", (ctx, artifact, _params) => {
    const renewals = artifact.data?.renewalHistory || [];
    if (renewals.length < 2) return { ok: true, result: { history: renewals, trend: 'insufficient_data' } };
    const sorted = [...renewals].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let totalChange = 0;
    const changes = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].premium || 0;
      const curr = sorted[i].premium || 0;
      const change = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      totalChange += change;
      changes.push({ period: sorted[i].date, previousPremium: prev, currentPremium: curr, changePercent: Math.round(change * 10) / 10 });
    }
    const avgChange = changes.length > 0 ? Math.round((totalChange / changes.length) * 10) / 10 : 0;
    return { ok: true, result: { policyNumber: artifact.data?.policyNumber, history: changes, averageChangePercent: avgChange, trend: avgChange > 2 ? 'increasing' : avgChange < -2 ? 'decreasing' : 'stable' } };
  });

  registerLensAction("insurance", "claimStatus", (ctx, artifact, _params) => {
    const claims = artifact.data?.claims || [artifact.data];
    const now = new Date();
    const byStatus = {};
    const aging = { under30: 0, between30_60: 0, between60_90: 0, over90: 0 };
    claims.forEach(c => {
      const status = c.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (c.dateOfLoss) {
        const age = (now - new Date(c.dateOfLoss)) / (1000 * 60 * 60 * 24);
        if (age <= 30) aging.under30++;
        else if (age <= 60) aging.between30_60++;
        else if (age <= 90) aging.between60_90++;
        else aging.over90++;
      }
    });
    const totalAmount = claims.reduce((s, c) => s + (c.amount || 0), 0);
    return { ok: true, result: { byStatus, aging, totalClaims: claims.length, totalAmount, openClaims: claims.filter(c => !['closed', 'paid', 'denied'].includes(c.status)).length } };
  });

  registerLensAction("insurance", "riskScore", (ctx, artifact, params) => {
    const probability = artifact.data?.probability || params.probability || 3;
    const impact = artifact.data?.impact || params.impact || 3;
    const score = probability * impact;
    const maxScore = 25;
    const normalizedScore = Math.round((score / maxScore) * 100);
    const mitigations = artifact.data?.mitigations || [];
    const mitigatedScore = Math.max(1, score - mitigations.length);
    return {
      ok: true,
      result: {
        risk: artifact.title,
        probability,
        impact,
        rawScore: score,
        normalizedScore,
        mitigations: mitigations.length,
        mitigatedScore,
        level: score >= 15 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low',
      },
    };
  });
};
