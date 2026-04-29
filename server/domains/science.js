import { callVision, callVisionUrl, visionPromptForDomain } from "../lib/vision-inference.js";

export default function registerScienceActions(registerLensAction) {
  registerLensAction("science", "vision", async (ctx, artifact, _params) => {
    const { imageB64, imageUrl } = artifact.data || {};
    if (!imageB64 && !imageUrl) return { ok: false, error: "imageB64 or imageUrl required" };
    const prompt = visionPromptForDomain("science");
    return imageUrl ? callVisionUrl(imageUrl, prompt) : callVision(imageB64, prompt);
  });
  registerLensAction("science", "chainOfCustody", (ctx, artifact, _params) => {
    const custodyLog = artifact.data?.chainOfCustody || [];
    let intact = true;
    const gaps = [];
    for (let i = 1; i < custodyLog.length; i++) {
      const prev = custodyLog[i - 1];
      const curr = custodyLog[i];
      if (prev.transferredTo !== curr.receivedBy) {
        intact = false;
        gaps.push({ position: i, expected: prev.transferredTo, actual: curr.receivedBy, date: curr.date });
      }
    }
    return { ok: true, result: { sampleId: artifact.id, sample: artifact.title, intact, transfers: custodyLog.length, gaps, verifiedAt: new Date().toISOString() } };
  });

  registerLensAction("science", "calibrationCheck", (ctx, artifact, _params) => {
    const _calibrationDate = artifact.data?.calibrationDate ? new Date(artifact.data.calibrationDate) : null;
    const nextCalibration = artifact.data?.nextCalibration ? new Date(artifact.data.nextCalibration) : null;
    const now = new Date();
    let status = 'unknown';
    let daysUntilDue = null;
    if (nextCalibration) {
      daysUntilDue = Math.ceil((nextCalibration - now) / (1000 * 60 * 60 * 24));
      status = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 14 ? 'due_soon' : 'current';
    }
    return { ok: true, result: { equipment: artifact.title, serial: artifact.data?.serial, lastCalibration: artifact.data?.calibrationDate, nextCalibration: artifact.data?.nextCalibration, status, daysUntilDue } };
  });

  registerLensAction("science", "dataQualityReport", (ctx, artifact, _params) => {
    const dataset = artifact.data?.dataset || artifact.data?.observations || artifact.data?.records || [];
    if (dataset.length === 0) return { ok: true, result: { error: 'No dataset found', totalRecords: 0 } };

    const fields = Object.keys(dataset[0] || {});
    const fieldStats = {};

    for (const field of fields) {
      const values = dataset.map(r => r[field]);
      const nonNull = values.filter(v => v != null && v !== '' && v !== undefined);
      const missing = values.length - nonNull.length;
      const completeness = Math.round((nonNull.length / values.length) * 10000) / 100;

      const stat = { field, total: values.length, present: nonNull.length, missing, completeness };

      // Numeric stats
      const nums = nonNull.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        nums.sort((a, b) => a - b);
        const sum = nums.reduce((s, n) => s + n, 0);
        const mean = sum / nums.length;
        const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
        const stdDev = Math.sqrt(variance);
        const q1 = nums[Math.floor(nums.length * 0.25)];
        const median = nums[Math.floor(nums.length * 0.5)];
        const q3 = nums[Math.floor(nums.length * 0.75)];
        const iqr = q3 - q1;
        const outliers = nums.filter(n => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr);
        stat.numeric = {
          min: nums[0],
          max: nums[nums.length - 1],
          mean: Math.round(mean * 1000) / 1000,
          median,
          stdDev: Math.round(stdDev * 1000) / 1000,
          q1, q3,
          outlierCount: outliers.length,
        };
      }

      fieldStats[field] = stat;
    }

    const overallCompleteness = fields.length > 0
      ? Math.round(Object.values(fieldStats).reduce((s, f) => s + f.completeness, 0) / fields.length * 100) / 100
      : 100;

    return {
      ok: true,
      result: {
        analyzedAt: new Date().toISOString(),
        totalRecords: dataset.length,
        totalFields: fields.length,
        overallCompleteness,
        fieldStats,
        qualityRating: overallCompleteness >= 95 ? 'excellent' : overallCompleteness >= 80 ? 'good' : overallCompleteness >= 60 ? 'fair' : 'poor',
      },
    };
  });

  registerLensAction("science", "sampleAudit", (ctx, artifact, _params) => {
    const samples = artifact.data?.samples || [artifact.data];
    const now = new Date();
    const results = [];

    for (const sample of samples) {
      const issues = [];

      // Chain of custody
      const custody = sample.chainOfCustody || [];
      let custodyIntact = true;
      for (let i = 1; i < custody.length; i++) {
        if (custody[i - 1].transferredTo !== custody[i].receivedBy) {
          custodyIntact = false;
          issues.push({ type: 'custody_gap', position: i, expected: custody[i - 1].transferredTo, actual: custody[i].receivedBy });
        }
      }

      // Storage conditions
      const storage = sample.storage || sample.storageConditions || {};
      const requiredTemp = storage.requiredTemp || storage.requiredTemperature || null;
      const actualTemp = storage.actualTemp || storage.currentTemperature || null;
      if (requiredTemp != null && actualTemp != null) {
        const tolerance = storage.tolerance || 2;
        if (Math.abs(actualTemp - requiredTemp) > tolerance) {
          issues.push({ type: 'temperature_deviation', required: requiredTemp, actual: actualTemp, tolerance });
        }
      }

      // Expiry
      const expiryDate = sample.expiryDate ? new Date(sample.expiryDate) : null;
      if (expiryDate && expiryDate < now) {
        issues.push({ type: 'expired', expiryDate: sample.expiryDate, daysExpired: Math.floor((now - expiryDate) / 86400000) });
      }

      // Handling compliance
      const handling = sample.handling || {};
      if (handling.requiresGloves && !handling.glovesUsed) issues.push({ type: 'handling', detail: 'Gloves required but not documented' });
      if (handling.requiresSterile && !handling.sterileConfirmed) issues.push({ type: 'handling', detail: 'Sterile handling required but not confirmed' });

      results.push({
        sampleId: sample.sampleId || sample.id,
        name: sample.name || sample.label || '',
        custodyIntact,
        custodyTransfers: custody.length,
        storageCompliant: !issues.some(i => i.type === 'temperature_deviation'),
        expired: !!issues.find(i => i.type === 'expired'),
        issueCount: issues.length,
        issues,
        status: issues.length === 0 ? 'compliant' : 'non-compliant',
      });
    }

    return {
      ok: true,
      result: {
        auditedAt: new Date().toISOString(),
        totalSamples: results.length,
        compliant: results.filter(r => r.status === 'compliant').length,
        nonCompliant: results.filter(r => r.status !== 'compliant').length,
        samples: results,
      },
    };
  });

  registerLensAction("science", "validateProtocol", (ctx, artifact, _params) => {
    const protocol = artifact.data?.protocol || artifact.data || {};
    const steps = protocol.steps || [];
    const issues = [];

    // Required steps check
    const requiredSteps = ['preparation', 'execution', 'data_collection', 'cleanup'];
    const stepNames = steps.map(s => (s.name || s.step || '').toLowerCase().replace(/\s+/g, '_'));
    for (const req of requiredSteps) {
      if (!stepNames.some(n => n.includes(req))) {
        issues.push({ type: 'missing_step', step: req, severity: 'high' });
      }
    }

    // Safety checks
    const safetyChecks = protocol.safetyChecks || protocol.safety || [];
    if (safetyChecks.length === 0 && steps.length > 0) {
      issues.push({ type: 'safety', detail: 'No safety checks defined', severity: 'high' });
    }
    const incompleteSafety = safetyChecks.filter(sc => !sc.verified && !sc.completed);
    if (incompleteSafety.length > 0) {
      issues.push({ type: 'safety', detail: `${incompleteSafety.length} safety check(s) not verified`, severity: 'medium' });
    }

    // Equipment calibration
    const equipment = protocol.equipment || [];
    const now = new Date();
    const calibrationIssues = [];
    for (const eq of equipment) {
      const nextCal = eq.nextCalibration ? new Date(eq.nextCalibration) : null;
      if (nextCal && nextCal < now) {
        calibrationIssues.push({ equipment: eq.name || eq.id, nextCalibration: eq.nextCalibration, status: 'overdue' });
        issues.push({ type: 'calibration', detail: `${eq.name || eq.id} calibration overdue`, severity: 'high' });
      } else if (nextCal) {
        const daysUntil = Math.ceil((nextCal - now) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7) {
          calibrationIssues.push({ equipment: eq.name || eq.id, nextCalibration: eq.nextCalibration, status: 'due_soon', daysUntil });
        }
      }
    }

    const valid = issues.filter(i => i.severity === 'high').length === 0;

    return {
      ok: true,
      result: {
        validatedAt: new Date().toISOString(),
        protocolName: protocol.name || artifact.title || '',
        totalSteps: steps.length,
        valid,
        status: valid ? 'approved' : 'needs_revision',
        issueCount: issues.length,
        highSeverityCount: issues.filter(i => i.severity === 'high').length,
        issues,
        safetyChecksTotal: safetyChecks.length,
        safetyChecksVerified: safetyChecks.length - incompleteSafety.length,
        equipmentCount: equipment.length,
        calibrationIssues,
      },
    };
  });

  registerLensAction("science", "dataExport", (ctx, artifact, params) => {
    const observations = artifact.data?.observations || [];
    const format = params.format || 'csv';
    let exportData;
    if (format === 'geojson') {
      exportData = {
        type: 'FeatureCollection',
        features: observations.filter(o => o.gps).map(o => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [o.gps.lon || o.gps.lng, o.gps.lat] },
          properties: { date: o.date, observer: o.observer, type: o.type, notes: o.notes },
        })),
      };
    } else {
      exportData = observations;
    }
    return { ok: true, result: { format, records: observations.length, data: exportData, exportedAt: new Date().toISOString() } };
  });

  registerLensAction("science", "spatialCluster", (ctx, artifact, params) => {
    const observations = artifact.data?.observations || [];
    const radius = params.radiusKm || 1;
    const geoObs = observations.filter(o => o.gps);
    const clusters = [];
    const assigned = new Set();
    for (let i = 0; i < geoObs.length; i++) {
      if (assigned.has(i)) continue;
      const cluster = [i];
      assigned.add(i);
      for (let j = i + 1; j < geoObs.length; j++) {
        if (assigned.has(j)) continue;
        const dLat = (geoObs[j].gps.lat - geoObs[i].gps.lat) * 111;
        const dLon = (geoObs[j].gps.lon - geoObs[i].gps.lon) * 111 * Math.cos(geoObs[i].gps.lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist <= radius) { cluster.push(j); assigned.add(j); }
      }
      clusters.push({ id: clusters.length + 1, observations: cluster.length, center: geoObs[i].gps });
    }
    return { ok: true, result: { clusters, totalObservations: geoObs.length, radiusKm: radius } };
  });
};
