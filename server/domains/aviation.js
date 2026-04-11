export default function registerAviationActions(registerLensAction) {
  registerLensAction("aviation", "currencyCheck", (ctx, artifact, _params) => {
    const certifications = artifact.data?.certifications || [];
    const medicalExpiry = artifact.data?.medicalExpiry ? new Date(artifact.data.medicalExpiry) : null;
    const now = new Date();
    const checks = [];
    if (medicalExpiry) {
      checks.push({ type: 'Medical Certificate', expiry: artifact.data.medicalExpiry, current: medicalExpiry > now, daysRemaining: Math.ceil((medicalExpiry - now) / (1000 * 60 * 60 * 24)) });
    }
    certifications.forEach(cert => {
      const expiry = cert.expiry ? new Date(cert.expiry) : null;
      checks.push({ type: cert.name, expiry: cert.expiry, current: expiry ? expiry > now : true, daysRemaining: expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null });
    });
    const landingsLast90 = artifact.data?.recentLandings || 0;
    checks.push({ type: 'Passenger Currency (3 landings/90 days)', current: landingsLast90 >= 3, value: landingsLast90 });
    const allCurrent = checks.every(c => c.current);
    return { ok: true, result: { crewMember: artifact.title, checks, allCurrent, expiringSoon: checks.filter(c => c.daysRemaining !== null && c.daysRemaining <= 30 && c.daysRemaining > 0) } };
  });

  registerLensAction("aviation", "maintenanceDue", (ctx, artifact, _params) => {
    const totalTime = artifact.data?.totalTime || 0;
    const lastAnnual = artifact.data?.lastAnnual ? new Date(artifact.data.lastAnnual) : null;
    const now = new Date();
    const items = [];
    if (lastAnnual) {
      const daysSinceAnnual = Math.ceil((now - lastAnnual) / (1000 * 60 * 60 * 24));
      items.push({ type: 'Annual Inspection', lastCompleted: artifact.data.lastAnnual, daysSince: daysSinceAnnual, overdue: daysSinceAnnual > 365, dueIn: Math.max(0, 365 - daysSinceAnnual) });
    }
    const oilChangeInterval = artifact.data?.oilChangeInterval || 50;
    const hoursSinceOil = artifact.data?.hoursSinceOilChange || 0;
    items.push({ type: 'Oil Change', hoursSinceLast: hoursSinceOil, interval: oilChangeInterval, overdue: hoursSinceOil >= oilChangeInterval, hoursRemaining: Math.max(0, oilChangeInterval - hoursSinceOil) });
    const adCompliance = artifact.data?.adCompliance || [];
    adCompliance.filter(ad => ad.status !== 'complied').forEach(ad => {
      items.push({ type: `AD: ${ad.number}`, description: ad.description, status: ad.status, overdue: true });
    });
    return { ok: true, result: { aircraft: artifact.title, registration: artifact.data?.registration, totalTime, items, overdueCount: items.filter(i => i.overdue).length } };
  });

  registerLensAction("aviation", "hobbsLog", (ctx, artifact, _params) => {
    const flights = artifact.data?.flights || [];
    let totalTime = 0, picTime = 0, nightTime = 0, instrumentTime = 0, crossCountry = 0;
    flights.forEach(f => {
      totalTime += f.hobbsTime || 0;
      if (f.isPIC) picTime += f.hobbsTime || 0;
      nightTime += f.nightTime || 0;
      instrumentTime += f.instrumentTime || 0;
      if (f.crossCountry) crossCountry += f.hobbsTime || 0;
    });
    return {
      ok: true,
      result: {
        pilot: artifact.title,
        totalTime: Math.round(totalTime * 10) / 10,
        picTime: Math.round(picTime * 10) / 10,
        nightTime: Math.round(nightTime * 10) / 10,
        instrumentTime: Math.round(instrumentTime * 10) / 10,
        crossCountry: Math.round(crossCountry * 10) / 10,
        totalFlights: flights.length,
      },
    };
  });

  registerLensAction("aviation", "dutyTimeCheck", (ctx, artifact, _params) => {
    const shifts = artifact.data?.shifts || [];
    const flights = artifact.data?.flights || [];
    const now = new Date();
    const msPerHour = 3600000;
    const msPerDay = 86400000;

    // Combine shifts and flights into duty periods
    const dutyPeriods = [...shifts, ...flights]
      .filter(s => s.startTime || s.date)
      .map(s => {
        const start = new Date(s.startTime || s.date);
        const hours = s.dutyHours || s.hobbsTime || s.hours || 0;
        const end = s.endTime ? new Date(s.endTime) : new Date(start.getTime() + hours * msPerHour);
        return { start, end, hours: hours || (end - start) / msPerHour };
      });

    // Current duty period (most recent)
    const sorted = dutyPeriods.slice().sort((a, b) => b.start - a.start);
    const currentDuty = sorted.length > 0 ? sorted[0] : null;
    const currentDutyHours = currentDuty ? Math.round(currentDuty.hours * 10) / 10 : 0;

    // 7-day window
    const sevenDaysAgo = new Date(now.getTime() - 7 * msPerDay);
    const last7 = dutyPeriods.filter(d => d.start >= sevenDaysAgo);
    const hours7days = Math.round(last7.reduce((s, d) => s + d.hours, 0) * 10) / 10;

    // 28-day window
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * msPerDay);
    const last28 = dutyPeriods.filter(d => d.start >= twentyEightDaysAgo);
    const hours28days = Math.round(last28.reduce((s, d) => s + d.hours, 0) * 10) / 10;

    // FAR 117 limits
    const limits = {
      flightDuty: { limit: 10, actual: currentDutyHours, exceeded: currentDutyHours > 10 },
      sevenDay: { limit: 60, actual: hours7days, exceeded: hours7days > 60 },
      twentyEightDay: { limit: 190, actual: hours28days, exceeded: hours28days > 190 },
    };
    const anyExceeded = Object.values(limits).some(l => l.exceeded);

    return {
      ok: true,
      result: {
        crewMember: artifact.title,
        checkedAt: now.toISOString(),
        limits,
        compliant: !anyExceeded,
        totalDutyPeriods: dutyPeriods.length,
        remainingFlightDuty: Math.max(0, Math.round((10 - currentDutyHours) * 10) / 10),
        remaining7day: Math.max(0, Math.round((60 - hours7days) * 10) / 10),
        remaining28day: Math.max(0, Math.round((190 - hours28days) * 10) / 10),
      },
    };
  });

  registerLensAction("aviation", "flightSummary", (ctx, artifact, _params) => {
    const flights = artifact.data?.flights || [];
    if (flights.length === 0) {
      return { ok: true, result: { totalFlights: 0, totalHours: 0, message: "No flight data available." } };
    }
    let totalHours = 0, totalFuel = 0;
    const durations = [];
    flights.forEach(f => {
      const hours = f.hobbsTime || f.duration || f.hours || 0;
      totalHours += hours;
      durations.push(hours);
      totalFuel += f.fuelUsed || f.fuelConsumed || 0;
    });
    const avgDuration = durations.length > 0 ? Math.round((totalHours / durations.length) * 10) / 10 : 0;
    const longestFlight = Math.max(...durations);
    const shortestFlight = Math.min(...durations);

    return {
      ok: true,
      result: {
        pilot: artifact.title,
        totalFlights: flights.length,
        totalLegs: flights.reduce((s, f) => s + (f.legs || 1), 0),
        totalHours: Math.round(totalHours * 10) / 10,
        averageDuration: avgDuration,
        longestFlight: Math.round(longestFlight * 10) / 10,
        shortestFlight: Math.round(shortestFlight * 10) / 10,
        totalFuelConsumed: Math.round(totalFuel * 10) / 10,
        avgFuelPerHour: totalHours > 0 ? Math.round((totalFuel / totalHours) * 10) / 10 : 0,
      },
    };
  });

  registerLensAction("aviation", "maintenanceAlert", (ctx, artifact, _params) => {
    const items = artifact.data?.maintenanceItems || [];
    const now = new Date();
    const currentHours = artifact.data?.totalTime || artifact.data?.currentHours || 0;
    const currentCycles = artifact.data?.totalCycles || artifact.data?.currentCycles || 0;
    const alerts = [];

    for (const item of items) {
      const reasons = [];

      // Check hours-based limit
      if (item.dueAtHours != null && currentHours >= item.dueAtHours) {
        reasons.push(`hours exceeded: ${currentHours}/${item.dueAtHours}`);
      }
      // Check cycles-based limit
      if (item.dueAtCycles != null && currentCycles >= item.dueAtCycles) {
        reasons.push(`cycles exceeded: ${currentCycles}/${item.dueAtCycles}`);
      }
      // Check date-based limit
      if (item.dueDate) {
        const due = new Date(item.dueDate);
        if (due <= now) {
          const daysOverdue = Math.ceil((now - due) / 86400000);
          reasons.push(`date overdue by ${daysOverdue} days`);
        }
      }

      if (reasons.length > 0) {
        alerts.push({
          name: item.name || item.description,
          category: item.category || "general",
          reasons,
          dueAtHours: item.dueAtHours || null,
          dueAtCycles: item.dueAtCycles || null,
          dueDate: item.dueDate || null,
          priority: item.priority || "normal",
          overdue: true,
        });
      }
    }

    alerts.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    return {
      ok: true,
      result: {
        aircraft: artifact.title,
        registration: artifact.data?.registration,
        currentHours,
        currentCycles,
        checkedAt: now.toISOString(),
        totalItems: items.length,
        overdueCount: alerts.length,
        alerts,
        allClear: alerts.length === 0,
      },
    };
  });

  registerLensAction("aviation", "weatherCheck", (ctx, artifact, _params) => {
    const wind = artifact.data?.wind || {};
    const visibility = artifact.data?.visibility != null ? artifact.data.visibility : null;
    const ceiling = artifact.data?.ceiling != null ? artifact.data.ceiling : null;
    const conditions = artifact.data?.conditions || artifact.data?.weather || "clear";
    const temperature = artifact.data?.temperature;
    const dewpoint = artifact.data?.dewpoint;
    const altimeter = artifact.data?.altimeter;

    // Determine flight category based on ceiling and visibility
    let flightCategory = "VFR";
    const visSM = visibility != null ? parseFloat(visibility) : 99;
    const ceil = ceiling != null ? parseInt(ceiling, 10) : 99999;

    if (visSM < 1 || ceil < 500) {
      flightCategory = "LIFR";
    } else if (visSM < 3 || ceil < 1000) {
      flightCategory = "IFR";
    } else if (visSM <= 5 || ceil <= 3000) {
      flightCategory = "MVFR";
    }

    // Format wind string (METAR-like)
    const windDir = wind.direction != null ? String(wind.direction).padStart(3, "0") : "000";
    const windSpeed = wind.speed != null ? String(wind.speed).padStart(2, "0") : "00";
    const windGust = wind.gust ? `G${String(wind.gust).padStart(2, "0")}` : "";
    const windString = `${windDir}${windSpeed}${windGust}KT`;

    // Format visibility
    const visString = visibility != null ? `${visibility}SM` : "---";

    // Format ceiling
    const ceilString = ceiling != null ? `${String(Math.round(ceiling / 100)).padStart(3, "0")}` : "CLR";

    return {
      ok: true,
      result: {
        station: artifact.title || artifact.data?.station,
        observedAt: artifact.data?.observedAt || new Date().toISOString(),
        wind: windString,
        windComponents: { direction: wind.direction || 0, speed: wind.speed || 0, gust: wind.gust || null },
        visibility: visString,
        visibilityValue: visSM,
        ceiling: ceiling != null ? `${ceilString} (${ceiling} ft AGL)` : "CLR",
        ceilingValue: ceil,
        conditions,
        temperature: temperature != null ? temperature : null,
        dewpoint: dewpoint != null ? dewpoint : null,
        altimeter: altimeter != null ? altimeter : null,
        flightCategory,
      },
    };
  });

  registerLensAction("aviation", "slipUtilization", (ctx, artifact, _params) => {
    const slips = artifact.data?.slips || [];
    if (slips.length === 0) return { ok: true, result: { utilization: 0, occupied: 0, vacant: 0, total: 0 } };
    const occupied = slips.filter(s => s.assignedVessel || s.status === 'occupied').length;
    const vacant = slips.length - occupied;
    const utilization = Math.round((occupied / slips.length) * 100);
    const revenue = slips.filter(s => s.assignedVessel).reduce((sum, s) => sum + (s.rate || 0), 0);
    return { ok: true, result: { marina: artifact.title, utilization, occupied, vacant, total: slips.length, monthlyRevenue: revenue } };
  });
};
