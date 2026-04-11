export default function registerRealEstateActions(registerLensAction) {
  registerLensAction("realestate", "capRate", (ctx, artifact, params) => {
    const noi = artifact.data?.netOperatingIncome || params.noi || 0;
    const purchasePrice = artifact.data?.purchasePrice || params.purchasePrice || 0;
    if (purchasePrice === 0) return { ok: true, result: { capRate: 0, error: "Purchase price cannot be zero" } };
    const capRate = (noi / purchasePrice) * 100;
    return { ok: true, result: { capRate: Math.round(capRate * 100) / 100, noi, purchasePrice, rating: capRate >= 8 ? 'excellent' : capRate >= 6 ? 'good' : capRate >= 4 ? 'fair' : 'low' } };
  });

  registerLensAction("realestate", "cashFlow", (ctx, artifact, params) => {
    const rent = artifact.data?.rentAmount || params.monthlyRent || 0;
    const expenses = artifact.data?.monthlyExpenses || params.expenses || 0;
    const mortgage = artifact.data?.mortgagePayment || params.mortgage || 0;
    const vacancy = artifact.data?.vacancyRate || params.vacancyRate || 5;
    const effectiveRent = rent * (1 - vacancy / 100);
    const monthlyCashFlow = effectiveRent - expenses - mortgage;
    const annualCashFlow = monthlyCashFlow * 12;
    return {
      ok: true,
      result: {
        monthly: { grossRent: rent, effectiveRent: Math.round(effectiveRent), expenses, mortgage, cashFlow: Math.round(monthlyCashFlow) },
        annual: { cashFlow: Math.round(annualCashFlow) },
        positive: monthlyCashFlow > 0,
      },
    };
  });

  registerLensAction("realestate", "closingTimeline", (ctx, artifact, params) => {
    const contractDate = artifact.data?.contractDate || params.contractDate || new Date().toISOString().split('T')[0];
    const base = new Date(contractDate);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };
    const timeline = [
      { milestone: 'Contract Executed', date: contractDate, status: 'completed' },
      { milestone: 'Earnest Money Due', date: addDays(base, 3), status: 'pending' },
      { milestone: 'Home Inspection', date: addDays(base, 10), status: 'pending' },
      { milestone: 'Inspection Response', date: addDays(base, 14), status: 'pending' },
      { milestone: 'Appraisal Ordered', date: addDays(base, 7), status: 'pending' },
      { milestone: 'Appraisal Received', date: addDays(base, 21), status: 'pending' },
      { milestone: 'Loan Approval', date: addDays(base, 25), status: 'pending' },
      { milestone: 'Clear to Close', date: addDays(base, 28), status: 'pending' },
      { milestone: 'Final Walkthrough', date: addDays(base, 29), status: 'pending' },
      { milestone: 'Closing', date: addDays(base, 30), status: 'pending' },
    ];
    return { ok: true, result: { timeline, totalDays: 30 } };
  });

  registerLensAction("realestate", "vacancyReport", (ctx, artifact, params) => {
    const units = artifact.data?.units || [];
    const avgRent = params.avgMarketRent || artifact.data?.avgMarketRent || 0;
    const now = new Date();
    const unitDetails = units.map(u => {
      const isVacant = u.status === 'vacant' || !u.tenant;
      const vacantSince = u.vacantSince ? new Date(u.vacantSince) : null;
      const daysVacant = isVacant && vacantSince ? Math.floor((now - vacantSince) / 86400000) : isVacant ? null : 0;
      const unitRent = u.rentAmount || avgRent || 0;
      const lostRevenue = isVacant && daysVacant != null ? Math.round((unitRent / 30) * daysVacant * 100) / 100 : 0;
      return {
        unit: u.unit || u.unitId || u.name,
        status: isVacant ? 'vacant' : 'occupied',
        tenant: isVacant ? null : (u.tenant || 'Unknown'),
        rentAmount: unitRent,
        vacantSince: isVacant ? (u.vacantSince || null) : null,
        daysVacant,
        lostRevenue,
      };
    });

    const vacantUnits = unitDetails.filter(u => u.status === 'vacant');
    const totalLostRevenue = Math.round(vacantUnits.reduce((s, u) => s + u.lostRevenue, 0) * 100) / 100;
    const vacancyRate = units.length > 0 ? Math.round((vacantUnits.length / units.length) * 100) : 0;

    const recommendations = [];
    if (vacancyRate > 20) recommendations.push('High vacancy rate — consider rent reduction or incentives');
    if (vacancyRate > 10) recommendations.push('Review marketing strategy and listing platforms');
    const longVacant = vacantUnits.filter(u => u.daysVacant != null && u.daysVacant > 60);
    if (longVacant.length > 0) recommendations.push(`${longVacant.length} unit(s) vacant over 60 days — consider property improvements or staging`);
    if (vacantUnits.length > 0) recommendations.push('Ensure all vacant units are listed on major rental platforms');

    return {
      ok: true,
      result: {
        generatedAt: new Date().toISOString(),
        totalUnits: units.length,
        occupiedCount: units.length - vacantUnits.length,
        vacantCount: vacantUnits.length,
        vacancyRate,
        totalLostRevenue,
        units: unitDetails,
        recommendations,
      },
    };
  });

  registerLensAction("realestate", "vacancyRate", (ctx, artifact, _params) => {
    const units = artifact.data?.units || [];
    if (units.length === 0) return { ok: true, result: { vacancyRate: 0, occupied: 0, vacant: 0, total: 0 } };
    const vacant = units.filter(u => u.status === 'vacant' || !u.tenant).length;
    const occupied = units.length - vacant;
    const rate = Math.round((vacant / units.length) * 100);
    const totalRent = units.filter(u => u.tenant).reduce((sum, u) => sum + (u.rentAmount || 0), 0);
    return { ok: true, result: { vacancyRate: rate, occupied, vacant, total: units.length, monthlyRentCollected: totalRent } };
  });
};
