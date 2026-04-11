export default function registerLegalActions(registerLensAction) {
  registerLensAction("legal", "deadlineCheck", (ctx, artifact, params) => {
    const now = new Date();
    const items = artifact.data?.items || [];
    const upcoming = items.filter(i => {
      if (!i.deadline) return false;
      const dl = new Date(i.deadline);
      const daysUntil = (dl - now) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= (params.daysAhead || 30);
    }).map(i => ({
      ...i,
      daysUntil: Math.ceil((new Date(i.deadline) - now) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => a.daysUntil - b.daysUntil);
    return { ok: true, result: { upcoming, count: upcoming.length } };
  });

  registerLensAction("legal", "contractRenewal", (ctx, artifact, _params) => {
    const expiryDate = artifact.data?.expiryDate ? new Date(artifact.data.expiryDate) : null;
    if (!expiryDate) return { ok: true, result: { status: "no_expiry", message: "No expiry date set" } };
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    const autoRenewal = artifact.data?.renewalType === 'auto';
    return {
      ok: true,
      result: {
        contractId: artifact.id,
        title: artifact.title,
        expiryDate: artifact.data.expiryDate,
        daysUntilExpiry,
        autoRenewal,
        actionRequired: daysUntilExpiry <= 60,
        urgency: daysUntilExpiry <= 14 ? 'critical' : daysUntilExpiry <= 30 ? 'high' : daysUntilExpiry <= 60 ? 'medium' : 'low',
      },
    };
  });

  registerLensAction("legal", "conflictCheck", (ctx, artifact, params) => {
    const parties = artifact.data?.parties || [];
    const client = artifact.data?.client || '';
    const opposingParty = artifact.data?.opposingParty || '';
    const conflicts = [];
    if (params.checkAgainst) {
      for (const name of params.checkAgainst) {
        if (parties.includes(name) || client === name || opposingParty === name) {
          conflicts.push({ name, conflictType: 'direct_party', caseId: artifact.id });
        }
      }
    }
    return { ok: true, result: { conflicts, hasConflict: conflicts.length > 0, checkedAt: new Date().toISOString() } };
  });

  registerLensAction("legal", "caseSummary", (ctx, artifact, _params) => {
    const parties = artifact.data?.parties || [];
    const client = artifact.data?.client || '';
    const opposingParty = artifact.data?.opposingParty || '';
    const status = artifact.data?.status || 'unknown';
    const filingDate = artifact.data?.filingDate || null;
    const closingDate = artifact.data?.closingDate || null;
    const documents = artifact.data?.documents || [];
    const timeEntries = artifact.data?.timeEntries || [];
    const billingTotal = Math.round(timeEntries.reduce((sum, e) => {
      const hours = parseFloat(e.hours) || 0;
      const rate = parseFloat(e.rate) || 0;
      return sum + hours * rate;
    }, 0) * 100) / 100;
    const keyDates = [];
    if (filingDate) keyDates.push({ event: 'Filing', date: filingDate });
    if (closingDate) keyDates.push({ event: 'Closing', date: closingDate });
    if (artifact.data?.nextHearing) keyDates.push({ event: 'Next Hearing', date: artifact.data.nextHearing });
    if (artifact.data?.trialDate) keyDates.push({ event: 'Trial', date: artifact.data.trialDate });
    return {
      ok: true,
      result: {
        caseId: artifact.id,
        title: artifact.title,
        client,
        opposingParty,
        parties,
        status,
        keyDates,
        relatedDocumentsCount: documents.length,
        billingTotal,
        generatedAt: new Date().toISOString(),
      },
    };
  });

  registerLensAction("legal", "complianceAudit", (ctx, artifact, _params) => {
    const requirements = artifact.data?.requirements || [];
    const now = new Date();
    const findings = [];
    let passCount = 0;
    let failCount = 0;
    const checked = requirements.map(req => {
      const deadline = req.deadline ? new Date(req.deadline) : null;
      const isOverdue = deadline && deadline < now && req.status !== 'compliant';
      const passed = req.status === 'compliant' && !isOverdue;
      if (passed) passCount++; else failCount++;
      if (!passed) {
        findings.push({
          requirement: req.name || req.description || 'Unknown',
          reason: isOverdue ? 'overdue' : (req.status || 'non-compliant'),
          deadline: req.deadline || null,
          severity: isOverdue ? 'high' : 'medium',
        });
      }
      return {
        requirement: req.name || req.description || 'Unknown',
        status: passed ? 'pass' : 'fail',
        deadline: req.deadline || null,
      };
    });
    const score = requirements.length > 0 ? Math.round((passCount / requirements.length) * 100) : 100;
    return {
      ok: true,
      result: {
        auditedAt: new Date().toISOString(),
        totalRequirements: requirements.length,
        passed: passCount,
        failed: failCount,
        score,
        rating: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
        findings,
        checklist: checked,
      },
    };
  });

  registerLensAction("legal", "deadlineCalculator", (ctx, artifact, params) => {
    const filingDate = artifact.data?.filingDate || params.filingDate;
    if (!filingDate) return { ok: true, result: { error: 'No filing date provided' } };
    const base = new Date(filingDate);
    const jurisdiction = artifact.data?.jurisdiction || params.jurisdiction || 'default';
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };

    const rules = {
      federal: { responseDays: 21, discoveryDays: 180, motionDays: 14, trialDays: 365, extensionDays: 30 },
      state: { responseDays: 30, discoveryDays: 120, motionDays: 21, trialDays: 270, extensionDays: 14 },
      default: { responseDays: 30, discoveryDays: 150, motionDays: 21, trialDays: 300, extensionDays: 21 },
    };
    const r = rules[jurisdiction] || rules.default;

    const deadlines = [
      { event: 'Response Due', date: addDays(base, r.responseDays), daysFromFiling: r.responseDays },
      { event: 'Response Extension', date: addDays(base, r.responseDays + r.extensionDays), daysFromFiling: r.responseDays + r.extensionDays },
      { event: 'Discovery Cutoff', date: addDays(base, r.discoveryDays), daysFromFiling: r.discoveryDays },
      { event: 'Motion Deadline', date: addDays(base, r.discoveryDays + r.motionDays), daysFromFiling: r.discoveryDays + r.motionDays },
      { event: 'Estimated Trial', date: addDays(base, r.trialDays), daysFromFiling: r.trialDays },
    ];

    const now = new Date();
    for (const dl of deadlines) {
      const d = new Date(dl.date);
      dl.daysRemaining = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      dl.status = dl.daysRemaining < 0 ? 'past' : dl.daysRemaining <= 7 ? 'urgent' : dl.daysRemaining <= 30 ? 'upcoming' : 'future';
    }

    return { ok: true, result: { filingDate, jurisdiction, deadlines, generatedAt: new Date().toISOString() } };
  });

  registerLensAction("legal", "generateInvoice", (ctx, artifact, params) => {
    const timeEntries = artifact.data?.timeEntries || [];
    const expenses = artifact.data?.expenses || [];
    const taxRate = params.taxRate != null ? params.taxRate : 0;

    let totalHours = 0;
    const lineItems = timeEntries.map((entry, idx) => {
      const hours = parseFloat(entry.hours) || 0;
      const rate = parseFloat(entry.rate) || 0;
      const amount = Math.round(hours * rate * 100) / 100;
      totalHours += hours;
      return {
        line: idx + 1,
        date: entry.date || null,
        description: entry.description || entry.task || '',
        attorney: entry.attorney || entry.provider || '',
        hours,
        rate,
        amount,
      };
    });

    const laborSubtotal = Math.round(lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const expenseItems = expenses.map((e, idx) => ({
      line: idx + 1,
      description: e.description || e.name || '',
      amount: Math.round((parseFloat(e.amount) || 0) * 100) / 100,
    }));
    const expenseSubtotal = Math.round(expenseItems.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const subtotal = Math.round((laborSubtotal + expenseSubtotal) * 100) / 100;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
      ok: true,
      result: {
        invoiceDate: new Date().toISOString().split('T')[0],
        client: artifact.data?.client || '',
        matter: artifact.title || '',
        timeEntries: lineItems,
        totalHours: Math.round(totalHours * 100) / 100,
        laborSubtotal,
        expenseItems,
        expenseSubtotal,
        subtotal,
        taxRate,
        taxAmount,
        total,
      },
    };
  });

  registerLensAction("legal", "complianceScore", (ctx, artifact, _params) => {
    const items = artifact.data?.requirements || [];
    if (items.length === 0) return { ok: true, result: { score: 100, compliant: 0, overdue: 0, total: 0 } };
    const now = new Date();
    const compliant = items.filter(i => i.status === 'compliant').length;
    const overdue = items.filter(i => i.status === 'overdue' || (i.deadline && new Date(i.deadline) < now && i.status !== 'compliant')).length;
    const score = Math.round((compliant / items.length) * 100);
    return { ok: true, result: { score, compliant, overdue, total: items.length, rating: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor' } };
  });
};
