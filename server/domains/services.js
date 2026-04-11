export default function registerServicesActions(registerLensAction) {
  registerLensAction("services", "scheduleOptimize", (ctx, artifact, _params) => {
    const appointments = artifact.data?.appointments || [artifact.data];
    const sorted = [...appointments].sort((a, b) => {
      const ta = a.time || a.date || '';
      const tb = b.time || b.date || '';
      return ta.localeCompare(tb);
    });
    let totalGap = 0;
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].endTime || sorted[i - 1].time || 0);
      const nextStart = new Date(sorted[i].time || sorted[i].date || 0);
      const gapMinutes = (nextStart - prevEnd) / (1000 * 60);
      if (gapMinutes > 0) { totalGap += gapMinutes; gaps.push({ after: sorted[i - 1].client || i - 1, before: sorted[i].client || i, gapMinutes }); }
    }
    return { ok: true, result: { optimizedOrder: sorted.map(a => ({ client: a.client, time: a.time, service: a.serviceType })), totalGapMinutes: totalGap, gaps } };
  });

  registerLensAction("services", "reminderGenerate", (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [artifact.data];
    const now = new Date();
    const hoursAhead = params.hoursAhead || 24;
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const upcoming = appointments.filter(a => {
      const apptDate = new Date(a.date || a.time || 0);
      return apptDate >= now && apptDate <= cutoff;
    });
    const reminders = upcoming.map(a => ({
      client: a.client || 'Unknown',
      service: a.serviceType || a.service || 'Appointment',
      date: a.date || a.time,
      provider: a.provider || '',
      message: `Reminder: Your ${a.serviceType || 'appointment'} is scheduled for ${a.date || a.time}`,
    }));
    return { ok: true, result: { reminders, count: reminders.length } };
  });

  registerLensAction("services", "revenueByProvider", (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [];
    const period = params.period || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const recent = appointments.filter(a => {
      const d = new Date(a.date || a.completedAt || 0);
      return d >= cutoff && (a.status === 'completed' || a.status === 'paid');
    });
    const byProvider = {};
    recent.forEach(a => {
      const provider = a.provider || 'Unknown';
      if (!byProvider[provider]) byProvider[provider] = { appointments: 0, revenue: 0 };
      byProvider[provider].appointments++;
      byProvider[provider].revenue += a.price || 0;
    });
    const summary = Object.entries(byProvider).map(([name, data]) => ({ provider: name, ...data })).sort((a, b) => b.revenue - a.revenue);
    return { ok: true, result: { period, summary, totalRevenue: summary.reduce((s, p) => s + p.revenue, 0) } };
  });

  registerLensAction("services", "clientRetentionReport", (ctx, artifact, _params) => {
    const clients = artifact.data?.clients || [];
    const now = new Date();
    let totalVisits = 0;
    let repeatCount = 0;
    let totalRevenue = 0;
    const atRisk = [];

    const analyzed = clients.map(c => {
      const visits = c.visits || c.appointmentCount || 0;
      const revenue = parseFloat(c.totalRevenue || c.lifetimeValue) || 0;
      const lastVisit = c.lastVisit ? new Date(c.lastVisit) : null;
      const daysSinceVisit = lastVisit ? Math.floor((now - lastVisit) / 86400000) : null;
      const isRepeat = visits > 1;
      const churnRisk = daysSinceVisit != null
        ? (daysSinceVisit > 180 ? 'high' : daysSinceVisit > 90 ? 'medium' : 'low')
        : 'unknown';

      totalVisits += visits;
      totalRevenue += revenue;
      if (isRepeat) repeatCount++;
      if (churnRisk === 'high' || churnRisk === 'medium') {
        atRisk.push({ name: c.name || c.clientId, daysSinceVisit, churnRisk, lifetimeValue: revenue });
      }

      return { name: c.name || c.clientId, visits, lifetimeValue: revenue, daysSinceVisit, churnRisk };
    });

    const repeatRate = clients.length > 0 ? Math.round((repeatCount / clients.length) * 10000) / 100 : 0;
    const avgLifetimeValue = clients.length > 0 ? Math.round((totalRevenue / clients.length) * 100) / 100 : 0;

    atRisk.sort((a, b) => b.lifetimeValue - a.lifetimeValue);

    return {
      ok: true,
      result: {
        generatedAt: new Date().toISOString(),
        totalClients: clients.length,
        repeatClients: repeatCount,
        repeatRate,
        averageLifetimeValue: avgLifetimeValue,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        atRiskCount: atRisk.length,
        atRiskClients: atRisk,
      },
    };
  });

  registerLensAction("services", "commissionCalc", (ctx, artifact, params) => {
    const sales = artifact.data?.sales || [];
    const tiers = params.tiers || [
      { min: 0, max: 5000, rate: 0.05 },
      { min: 5000, max: 15000, rate: 0.08 },
      { min: 15000, max: Infinity, rate: 0.12 },
    ];

    let totalSales = 0;
    let totalCommission = 0;
    const details = sales.map((sale, idx) => {
      const amount = parseFloat(sale.amount || sale.revenue) || 0;
      totalSales += amount;

      // Tiered commission calculation
      let commission = 0;
      let remaining = amount;
      for (const tier of tiers) {
        const tierMin = tier.min || 0;
        const tierMax = tier.max || Infinity;
        const tierRange = tierMax - tierMin;
        const applicable = Math.min(Math.max(remaining, 0), tierRange);
        commission += applicable * (tier.rate || 0);
        remaining -= applicable;
        if (remaining <= 0) break;
      }
      commission = Math.round(commission * 100) / 100;
      totalCommission += commission;

      return {
        line: idx + 1,
        salesperson: sale.salesperson || sale.provider || '',
        description: sale.description || sale.service || '',
        amount,
        commission,
        effectiveRate: amount > 0 ? Math.round((commission / amount) * 10000) / 100 : 0,
      };
    });

    // Per-salesperson summary
    const bySalesperson = {};
    for (const d of details) {
      if (!d.salesperson) continue;
      if (!bySalesperson[d.salesperson]) bySalesperson[d.salesperson] = { sales: 0, commission: 0 };
      bySalesperson[d.salesperson].sales += d.amount;
      bySalesperson[d.salesperson].commission += d.commission;
    }
    const salespersonSummary = Object.entries(bySalesperson).map(([name, data]) => ({
      salesperson: name,
      totalSales: Math.round(data.sales * 100) / 100,
      totalCommission: Math.round(data.commission * 100) / 100,
    })).sort((a, b) => b.totalCommission - a.totalCommission);

    return {
      ok: true,
      result: {
        generatedAt: new Date().toISOString(),
        totalSales: Math.round(totalSales * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        effectiveRate: totalSales > 0 ? Math.round((totalCommission / totalSales) * 10000) / 100 : 0,
        lineItems: details,
        bySalesperson: salespersonSummary,
        tiers,
      },
    };
  });

  registerLensAction("services", "dailyCloseReport", (ctx, artifact, params) => {
    const appointments = artifact.data?.appointments || [];
    const dateStr = params.date || new Date().toISOString().split('T')[0];

    const dayAppts = appointments.filter(a => {
      const d = (a.date || a.completedAt || '').substring(0, 10);
      return d === dateStr;
    });

    const completed = dayAppts.filter(a => a.status === 'completed' || a.status === 'paid');
    const noShows = dayAppts.filter(a => a.status === 'no_show' || a.status === 'no-show');
    const cancelled = dayAppts.filter(a => a.status === 'cancelled' || a.status === 'canceled');
    const totalRevenue = Math.round(completed.reduce((s, a) => s + (parseFloat(a.price || a.revenue) || 0), 0) * 100) / 100;

    const productsSold = artifact.data?.productsSold || [];
    const productRevenue = Math.round(productsSold.reduce((s, p) => s + (parseFloat(p.price || p.amount) || 0) * (parseInt(p.quantity, 10) || 1), 0) * 100) / 100;

    const byProvider = {};
    for (const a of completed) {
      const prov = a.provider || 'Unknown';
      if (!byProvider[prov]) byProvider[prov] = { appointments: 0, revenue: 0 };
      byProvider[prov].appointments++;
      byProvider[prov].revenue += parseFloat(a.price || a.revenue) || 0;
    }
    const providerSummary = Object.entries(byProvider).map(([name, data]) => ({
      provider: name,
      appointments: data.appointments,
      revenue: Math.round(data.revenue * 100) / 100,
    }));

    return {
      ok: true,
      result: {
        date: dateStr,
        totalAppointments: dayAppts.length,
        completedCount: completed.length,
        noShowCount: noShows.length,
        cancelledCount: cancelled.length,
        serviceRevenue: totalRevenue,
        productsSold: productsSold.length,
        productRevenue,
        totalRevenue: Math.round((totalRevenue + productRevenue) * 100) / 100,
        byProvider: providerSummary,
        generatedAt: new Date().toISOString(),
      },
    };
  });

  registerLensAction("services", "supplyCheck", (ctx, artifact, _params) => {
    const supplies = artifact.data?.materials || artifact.data?.supplies || [];
    const lowStock = supplies.filter(s => {
      const current = s.currentStock || s.quantity || 0;
      const reorder = s.reorderPoint || s.minStock || 5;
      return current <= reorder;
    }).map(s => ({
      name: s.name,
      currentStock: s.currentStock || s.quantity || 0,
      reorderPoint: s.reorderPoint || s.minStock || 5,
      supplier: s.supplier || '',
    }));
    return { ok: true, result: { lowStock, count: lowStock.length, totalItems: supplies.length, needsOrder: lowStock.length > 0 } };
  });
};
