// server/domains/trades.js
// Domain actions for trades/contracting: estimates, inspections, materials costs.

export default function registerTradesActions(registerLensAction) {
  /**
   * calculateEstimate
   * Sum line items with markup and tax to produce a customer-facing estimate.
   * artifact.data.lineItems: [{ description, quantity, unitCost, category }]
   * params.markupPct (default 20), params.taxRate (default 0.08)
   */
  registerLensAction("trades", "calculateEstimate", (ctx, artifact, params) => {
    const lineItems = artifact.data.lineItems || [];
    const markupPct = params.markupPct != null ? params.markupPct : 20;
    const taxRate = params.taxRate != null ? params.taxRate : 0.08;
    const discountPct = params.discountPct || 0;

    if (lineItems.length === 0) {
      return { ok: true, result: { error: "No line items provided." } };
    }

    let subtotal = 0;
    const detailed = lineItems.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 0;
      const unit = parseFloat(item.unitCost) || 0;
      const lineTotal = Math.round(qty * unit * 100) / 100;
      subtotal += lineTotal;
      return {
        line: idx + 1,
        description: item.description || "",
        category: item.category || "general",
        quantity: qty,
        unitCost: unit,
        lineTotal,
      };
    });

    const markupAmount = Math.round(subtotal * (markupPct / 100) * 100) / 100;
    const afterMarkup = Math.round((subtotal + markupAmount) * 100) / 100;
    const discountAmount = Math.round(afterMarkup * (discountPct / 100) * 100) / 100;
    const afterDiscount = Math.round((afterMarkup - discountAmount) * 100) / 100;
    const taxAmount = Math.round(afterDiscount * taxRate * 100) / 100;
    const grandTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;

    // Category breakdown
    const byCategory = {};
    for (const item of detailed) {
      if (!byCategory[item.category]) byCategory[item.category] = 0;
      byCategory[item.category] = Math.round((byCategory[item.category] + item.lineTotal) * 100) / 100;
    }

    const estimate = {
      generatedAt: new Date().toISOString(),
      lineItems: detailed,
      subtotal,
      markupPct,
      markupAmount,
      discountPct,
      discountAmount,
      taxRate,
      taxAmount,
      grandTotal,
      byCategory,
    };

    artifact.data.currentEstimate = estimate;

    return { ok: true, result: estimate };
  });

  /**
   * calculatePL
   * Calculate profit/loss: revenue vs costs, material costs, labor, overhead, margin.
   * artifact.data.revenue, artifact.data.costs: { materials, labor, overhead, ... }
   */
  registerLensAction("trades", "calculatePL", (ctx, artifact, params) => {
    const revenue = parseFloat(artifact.data?.revenue || params.revenue) || 0;
    const costs = artifact.data?.costs || {};
    const materialCost = parseFloat(costs.materials || costs.materialCost) || 0;
    const laborCost = parseFloat(costs.labor || costs.laborCost) || 0;
    const overhead = parseFloat(costs.overhead || costs.overheadCost) || 0;
    const otherCosts = parseFloat(costs.other || costs.miscellaneous) || 0;
    const totalCosts = Math.round((materialCost + laborCost + overhead + otherCosts) * 100) / 100;
    const grossProfit = Math.round((revenue - totalCosts) * 100) / 100;
    const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

    return {
      ok: true,
      result: {
        generatedAt: new Date().toISOString(),
        revenue,
        costs: { materials: materialCost, labor: laborCost, overhead, other: otherCosts },
        totalCosts,
        grossProfit,
        margin,
        status: grossProfit > 0 ? 'profitable' : grossProfit === 0 ? 'break-even' : 'loss',
        costBreakdown: {
          materialsPercent: totalCosts > 0 ? Math.round((materialCost / totalCosts) * 10000) / 100 : 0,
          laborPercent: totalCosts > 0 ? Math.round((laborCost / totalCosts) * 10000) / 100 : 0,
          overheadPercent: totalCosts > 0 ? Math.round((overhead / totalCosts) * 10000) / 100 : 0,
          otherPercent: totalCosts > 0 ? Math.round((otherCosts / totalCosts) * 10000) / 100 : 0,
        },
      },
    };
  });

  /**
   * checkPermits
   * Check required permits for job: type needed, status, expiry, jurisdiction.
   * artifact.data.permits: [{ permitId, type, status, expiryDate, jurisdiction }]
   * artifact.data.jobType or params.jobType
   */
  registerLensAction("trades", "checkPermits", (ctx, artifact, params) => {
    const permits = artifact.data?.permits || [];
    const jobType = (artifact.data?.jobType || params.jobType || '').toLowerCase();
    const now = new Date();

    const permitRequirements = {
      electrical: ['electrical_permit', 'building_permit'],
      plumbing: ['plumbing_permit', 'building_permit'],
      structural: ['building_permit', 'engineering_approval'],
      hvac: ['mechanical_permit', 'building_permit'],
      roofing: ['building_permit'],
      demolition: ['demolition_permit', 'building_permit', 'environmental_clearance'],
      general: ['building_permit'],
    };
    const required = permitRequirements[jobType] || permitRequirements.general;

    const permitStatus = permits.map(p => {
      const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
      const isExpired = expiry && expiry < now;
      const daysUntilExpiry = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
      return {
        permitId: p.permitId || p.id,
        type: p.type,
        status: isExpired ? 'expired' : (p.status || 'unknown'),
        jurisdiction: p.jurisdiction || '',
        expiryDate: p.expiryDate || null,
        daysUntilExpiry,
        isExpired: !!isExpired,
      };
    });

    const existingTypes = permits.map(p => (p.type || '').toLowerCase().replace(/\s+/g, '_'));
    const missing = required.filter(r => !existingTypes.some(t => t.includes(r.replace('_', '')) || r.includes(t.replace('_', ''))));
    const expired = permitStatus.filter(p => p.isExpired);
    const expiringSoon = permitStatus.filter(p => p.daysUntilExpiry != null && p.daysUntilExpiry > 0 && p.daysUntilExpiry <= 30);

    const allClear = missing.length === 0 && expired.length === 0;

    return {
      ok: true,
      result: {
        checkedAt: new Date().toISOString(),
        jobType: jobType || 'general',
        requiredPermits: required,
        existingPermits: permitStatus,
        missingPermits: missing,
        expiredPermits: expired,
        expiringSoon,
        allClear,
        status: allClear ? 'approved' : 'action_required',
      },
    };
  });

  /**
   * generateInvoice
   * Generate trade invoice from work orders: labor hours, materials, markup, tax.
   * artifact.data.workOrders: [{ description, laborHours, laborRate, materials: [{ item, quantity, unitCost }] }]
   * params.markupPct (default 15), params.taxRate (default 0.08)
   */
  registerLensAction("trades", "generateInvoice", (ctx, artifact, params) => {
    const workOrders = artifact.data?.workOrders || [];
    const markupPct = params.markupPct != null ? params.markupPct : 15;
    const taxRate = params.taxRate != null ? params.taxRate : 0.08;

    let totalLabor = 0;
    let totalMaterials = 0;
    let totalHours = 0;

    const lineItems = workOrders.map((wo, idx) => {
      const hours = parseFloat(wo.laborHours) || 0;
      const rate = parseFloat(wo.laborRate) || 0;
      const laborCost = Math.round(hours * rate * 100) / 100;
      totalHours += hours;
      totalLabor += laborCost;

      const materials = (wo.materials || []).map(m => {
        const qty = parseFloat(m.quantity) || 0;
        const uc = parseFloat(m.unitCost) || 0;
        const cost = Math.round(qty * uc * 100) / 100;
        totalMaterials += cost;
        return { item: m.item || m.name, quantity: qty, unitCost: uc, cost };
      });

      return {
        line: idx + 1,
        description: wo.description || '',
        laborHours: hours,
        laborRate: rate,
        laborCost,
        materials,
        materialsCost: Math.round(materials.reduce((s, m) => s + m.cost, 0) * 100) / 100,
      };
    });

    totalLabor = Math.round(totalLabor * 100) / 100;
    totalMaterials = Math.round(totalMaterials * 100) / 100;
    const subtotal = Math.round((totalLabor + totalMaterials) * 100) / 100;
    const markupAmount = Math.round(subtotal * (markupPct / 100) * 100) / 100;
    const afterMarkup = Math.round((subtotal + markupAmount) * 100) / 100;
    const taxAmount = Math.round(afterMarkup * taxRate * 100) / 100;
    const total = Math.round((afterMarkup + taxAmount) * 100) / 100;

    return {
      ok: true,
      result: {
        invoiceDate: new Date().toISOString().split('T')[0],
        lineItems,
        totalHours: Math.round(totalHours * 100) / 100,
        totalLabor,
        totalMaterials,
        subtotal,
        markupPct,
        markupAmount,
        taxRate,
        taxAmount,
        total,
      },
    };
  });

  /**
   * generatePO
   * Generate purchase order from material requirements: vendor, items, quantities, pricing.
   * artifact.data.materials: [{ item, vendor, quantity, unitCost, category }]
   * params.poNumber (optional)
   */
  registerLensAction("trades", "generatePO", (ctx, artifact, params) => {
    const materials = artifact.data?.materials || [];
    const poNumber = params.poNumber || `PO-${Date.now().toString(36).toUpperCase()}`;

    let grandTotal = 0;
    const byVendor = {};

    const lineItems = materials.map((m, idx) => {
      const qty = parseFloat(m.quantity) || 0;
      const uc = parseFloat(m.unitCost) || 0;
      const lineTotal = Math.round(qty * uc * 100) / 100;
      grandTotal += lineTotal;

      const vendor = m.vendor || m.supplier || 'Unassigned';
      if (!byVendor[vendor]) byVendor[vendor] = { items: 0, total: 0 };
      byVendor[vendor].items++;
      byVendor[vendor].total += lineTotal;

      return {
        line: idx + 1,
        item: m.item || m.name,
        category: m.category || 'general',
        vendor,
        quantity: qty,
        unitCost: uc,
        lineTotal,
      };
    });

    grandTotal = Math.round(grandTotal * 100) / 100;

    const vendorSummary = Object.entries(byVendor).map(([name, data]) => ({
      vendor: name,
      itemCount: data.items,
      total: Math.round(data.total * 100) / 100,
    })).sort((a, b) => b.total - a.total);

    return {
      ok: true,
      result: {
        poNumber,
        generatedAt: new Date().toISOString(),
        lineItems,
        totalItems: lineItems.length,
        grandTotal,
        vendorSummary,
        vendorCount: vendorSummary.length,
      },
    };
  });

  /**
   * scheduleInspection
   * Create an inspection checkpoint linked to a permit.
   * artifact.data.permits: [{ permitId, type, stages: [{ name, inspectionRequired }] }]
   * params.permitId — which permit to schedule for
   * params.stageName — the stage to schedule
   * params.requestedDate — preferred date (ISO)
   */
  registerLensAction("trades", "scheduleInspection", (ctx, artifact, params) => {
    const permits = artifact.data.permits || [];
    const permitId = params.permitId;
    const stageName = params.stageName;
    const requestedDate = params.requestedDate || null;

    const permit = permits.find((p) => p.permitId === permitId);
    if (!permit) {
      return { ok: true, result: { error: `Permit ${permitId} not found.` } };
    }

    const stage = (permit.stages || []).find(
      (s) => s.name.toLowerCase() === (stageName || "").toLowerCase()
    );
    if (!stage) {
      return { ok: true, result: { error: `Stage '${stageName}' not found on permit ${permitId}.` } };
    }

    if (!stage.inspectionRequired) {
      return { ok: true, result: { error: `Stage '${stageName}' does not require inspection.` } };
    }

    // Determine inspection date: requested date or 3 business days from now
    let inspectionDate;
    if (requestedDate) {
      inspectionDate = new Date(requestedDate);
    } else {
      inspectionDate = new Date();
      let businessDays = 0;
      while (businessDays < 3) {
        inspectionDate.setDate(inspectionDate.getDate() + 1);
        const dow = inspectionDate.getDay();
        if (dow !== 0 && dow !== 6) businessDays++;
      }
    }

    const inspection = {
      inspectionId: `INS-${permitId}-${Date.now().toString(36).toUpperCase()}`,
      permitId,
      permitType: permit.type,
      stageName: stage.name,
      requestedDate: inspectionDate.toISOString().split("T")[0],
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    if (!artifact.data.inspections) artifact.data.inspections = [];
    artifact.data.inspections.push(inspection);

    // Mark the stage as having a scheduled inspection
    stage.inspectionStatus = "scheduled";
    stage.inspectionId = inspection.inspectionId;

    return { ok: true, result: inspection };
  });

  /**
   * materialsCost
   * Aggregate materials costs across active jobs.
   * artifact.data.jobs: [{ jobId, name, status, materials: [{ item, quantity, unitCost }] }]
   * params.statusFilter (default "active") — which job statuses to include
   */
  registerLensAction("trades", "materialsCost", (ctx, artifact, params) => {
    const jobs = artifact.data.jobs || [];
    const statusFilter = params.statusFilter || "active";

    const activeJobs = jobs.filter(
      (j) => j.status && j.status.toLowerCase() === statusFilter.toLowerCase()
    );

    let grandTotal = 0;
    const perJob = [];
    const materialTotals = {};

    for (const job of activeJobs) {
      let jobTotal = 0;
      const materials = job.materials || [];

      for (const mat of materials) {
        const qty = parseFloat(mat.quantity) || 0;
        const cost = parseFloat(mat.unitCost) || 0;
        const lineCost = Math.round(qty * cost * 100) / 100;
        jobTotal += lineCost;

        const key = (mat.item || "unknown").toLowerCase();
        if (!materialTotals[key]) {
          materialTotals[key] = { item: mat.item, totalQuantity: 0, totalCost: 0 };
        }
        materialTotals[key].totalQuantity += qty;
        materialTotals[key].totalCost = Math.round((materialTotals[key].totalCost + lineCost) * 100) / 100;
      }

      jobTotal = Math.round(jobTotal * 100) / 100;
      grandTotal += jobTotal;

      perJob.push({
        jobId: job.jobId,
        name: job.name,
        materialLineCount: materials.length,
        jobMaterialCost: jobTotal,
      });
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    // Sort materials by total cost descending
    const sortedMaterials = Object.values(materialTotals).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    const report = {
      generatedAt: new Date().toISOString(),
      statusFilter,
      jobsIncluded: activeJobs.length,
      grandTotal,
      perJob,
      materialBreakdown: sortedMaterials,
      topMaterial: sortedMaterials[0] || null,
    };

    artifact.data.materialsCostReport = report;

    return { ok: true, result: report };
  });
};
