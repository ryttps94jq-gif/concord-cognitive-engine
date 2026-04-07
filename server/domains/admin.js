// server/domains/admin.js
// Domain actions for system administration: audit log analysis, permission matrix, system health scoring.

export default function registerAdminActions(registerLensAction) {
  /**
   * auditLog
   * Analyze audit log entries for anomalies — detect unusual access patterns
   * using time-gap analysis and frequency deviation.
   * artifact.data.entries: [{ timestamp, userId, action, resource, ip, success }]
   * params.windowMinutes — time window for frequency analysis (default 60)
   * params.stdDevThreshold — standard deviation threshold for anomaly flagging (default 2)
   */
  registerLensAction("admin", "auditLog", (ctx, artifact, params) => {
    const entries = artifact.data.entries || [];
    if (entries.length === 0) {
      return { ok: true, result: { message: "No audit log entries to analyze." } };
    }

    const windowMinutes = params.windowMinutes || 60;
    const stdDevThreshold = params.stdDevThreshold || 2;

    // Sort entries by timestamp
    const sorted = [...entries]
      .map(e => ({ ...e, ts: new Date(e.timestamp).getTime() }))
      .filter(e => !isNaN(e.ts))
      .sort((a, b) => a.ts - b.ts);

    // Time-gap analysis: detect unusually short or long gaps between actions per user
    const userActions = {};
    for (const entry of sorted) {
      if (!userActions[entry.userId]) userActions[entry.userId] = [];
      userActions[entry.userId].push(entry);
    }

    const anomalies = [];

    for (const [userId, actions] of Object.entries(userActions)) {
      if (actions.length < 2) continue;

      // Compute inter-action time gaps
      const gaps = [];
      for (let i = 1; i < actions.length; i++) {
        gaps.push(actions[i].ts - actions[i - 1].ts);
      }

      const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const variance = gaps.reduce((s, g) => s + Math.pow(g - meanGap, 2), 0) / gaps.length;
      const stdDev = Math.sqrt(variance);

      // Flag rapid-fire bursts (gaps significantly below mean)
      for (let i = 0; i < gaps.length; i++) {
        if (stdDev > 0 && (meanGap - gaps[i]) / stdDev > stdDevThreshold) {
          anomalies.push({
            type: "rapid-fire",
            userId,
            timestamp: new Date(actions[i + 1].ts).toISOString(),
            gapMs: gaps[i],
            meanGapMs: Math.round(meanGap),
            zScore: Math.round(((meanGap - gaps[i]) / stdDev) * 100) / 100,
            action: actions[i + 1].action,
            resource: actions[i + 1].resource,
          });
        }
        // Flag unusually long gaps (potential account takeover after dormancy)
        if (stdDev > 0 && (gaps[i] - meanGap) / stdDev > stdDevThreshold * 1.5) {
          anomalies.push({
            type: "long-dormancy-then-active",
            userId,
            timestamp: new Date(actions[i + 1].ts).toISOString(),
            gapMs: gaps[i],
            meanGapMs: Math.round(meanGap),
            zScore: Math.round(((gaps[i] - meanGap) / stdDev) * 100) / 100,
            action: actions[i + 1].action,
            resource: actions[i + 1].resource,
          });
        }
      }
    }

    // Frequency deviation per time window
    const windowMs = windowMinutes * 60 * 1000;
    const windowCounts = {};
    for (const entry of sorted) {
      const windowKey = Math.floor(entry.ts / windowMs);
      const userWindow = `${entry.userId}:${windowKey}`;
      windowCounts[userWindow] = (windowCounts[userWindow] || 0) + 1;
    }

    // Per-user frequency statistics
    const userFreqs = {};
    for (const [key, count] of Object.entries(windowCounts)) {
      const userId = key.split(":")[0];
      if (!userFreqs[userId]) userFreqs[userId] = [];
      userFreqs[userId].push(count);
    }

    for (const [userId, freqs] of Object.entries(userFreqs)) {
      const mean = freqs.reduce((s, f) => s + f, 0) / freqs.length;
      const stdDev = Math.sqrt(freqs.reduce((s, f) => s + Math.pow(f - mean, 2), 0) / freqs.length);

      for (const freq of freqs) {
        if (stdDev > 0 && (freq - mean) / stdDev > stdDevThreshold) {
          anomalies.push({
            type: "frequency-spike",
            userId,
            actionsInWindow: freq,
            meanPerWindow: Math.round(mean * 100) / 100,
            zScore: Math.round(((freq - mean) / stdDev) * 100) / 100,
            windowMinutes,
          });
        }
      }
    }

    // Failed access pattern detection
    const failedByUser = {};
    for (const entry of sorted) {
      if (entry.success === false) {
        if (!failedByUser[entry.userId]) failedByUser[entry.userId] = [];
        failedByUser[entry.userId].push(entry);
      }
    }

    const failedAccessAlerts = [];
    for (const [userId, failures] of Object.entries(failedByUser)) {
      const totalForUser = (userActions[userId] || []).length;
      const failureRate = totalForUser > 0 ? failures.length / totalForUser : 0;
      if (failures.length >= 3 && failureRate > 0.3) {
        failedAccessAlerts.push({
          userId,
          failedAttempts: failures.length,
          totalAttempts: totalForUser,
          failureRate: Math.round(failureRate * 10000) / 100,
          resources: [...new Set(failures.map(f => f.resource))],
        });
      }
    }

    // IP diversity check per user
    const userIps = {};
    for (const entry of sorted) {
      if (entry.ip) {
        if (!userIps[entry.userId]) userIps[entry.userId] = new Set();
        userIps[entry.userId].add(entry.ip);
      }
    }

    const ipAlerts = [];
    for (const [userId, ips] of Object.entries(userIps)) {
      if (ips.size > 5) {
        ipAlerts.push({ userId, uniqueIps: ips.size, ips: [...ips] });
      }
    }

    const result = {
      analyzedAt: new Date().toISOString(),
      totalEntries: entries.length,
      uniqueUsers: Object.keys(userActions).length,
      timeSpan: sorted.length > 1
        ? { from: new Date(sorted[0].ts).toISOString(), to: new Date(sorted[sorted.length - 1].ts).toISOString() }
        : null,
      anomalies,
      failedAccessAlerts,
      ipAlerts,
      summary: {
        totalAnomalies: anomalies.length,
        rapidFireCount: anomalies.filter(a => a.type === "rapid-fire").length,
        frequencySpikeCount: anomalies.filter(a => a.type === "frequency-spike").length,
        dormancyAlertCount: anomalies.filter(a => a.type === "long-dormancy-then-active").length,
        failedAccessAlertCount: failedAccessAlerts.length,
        suspiciousIpCount: ipAlerts.length,
      },
    };

    artifact.data.auditLogAnalysis = result;
    return { ok: true, result };
  });

  /**
   * permissionMatrix
   * Build and analyze a role-permission matrix — find over-privileged roles,
   * orphan permissions, separation-of-duty violations.
   * artifact.data.roles: [{ name, permissions: [string] }]
   * artifact.data.users: [{ userId, roles: [string] }]
   * artifact.data.sodRules: [{ name, conflicting: [perm1, perm2] }] — optional separation-of-duty rules
   */
  registerLensAction("admin", "permissionMatrix", (ctx, artifact, params) => {
    const roles = artifact.data.roles || [];
    const users = artifact.data.users || [];
    const sodRules = artifact.data.sodRules || [];

    // Build permission universe
    const allPermissions = new Set();
    const rolePermMap = {};
    for (const role of roles) {
      rolePermMap[role.name] = new Set(role.permissions || []);
      for (const perm of (role.permissions || [])) allPermissions.add(perm);
    }

    // Build role-permission matrix
    const permList = [...allPermissions].sort();
    const matrix = {};
    for (const role of roles) {
      matrix[role.name] = {};
      for (const perm of permList) {
        matrix[role.name][perm] = rolePermMap[role.name].has(perm);
      }
    }

    // Over-privileged roles: roles with more than 70% of all permissions
    const totalPerms = permList.length;
    const overPrivileged = roles
      .map(role => ({
        role: role.name,
        permCount: rolePermMap[role.name].size,
        ratio: totalPerms > 0 ? rolePermMap[role.name].size / totalPerms : 0,
      }))
      .filter(r => r.ratio > 0.7)
      .sort((a, b) => b.ratio - a.ratio)
      .map(r => ({ ...r, ratio: Math.round(r.ratio * 10000) / 100 }));

    // Orphan permissions: permissions not assigned to any role
    const assignedPerms = new Set();
    for (const role of roles) {
      for (const perm of (role.permissions || [])) assignedPerms.add(perm);
    }

    // Check if there are referenced permissions in users that don't exist
    const roleNames = new Set(roles.map(r => r.name));
    const unknownRoles = [];
    for (const user of users) {
      for (const role of (user.roles || [])) {
        if (!roleNames.has(role)) {
          unknownRoles.push({ userId: user.userId, role });
        }
      }
    }

    // Role redundancy: find roles that are subsets of other roles
    const redundantRoles = [];
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j < roles.length; j++) {
        if (i === j) continue;
        const permsI = rolePermMap[roles[i].name];
        const permsJ = rolePermMap[roles[j].name];
        if (permsI.size > 0 && permsI.size < permsJ.size) {
          let isSubset = true;
          for (const perm of permsI) {
            if (!permsJ.has(perm)) { isSubset = false; break; }
          }
          if (isSubset) {
            redundantRoles.push({
              subset: roles[i].name,
              superset: roles[j].name,
              subsetSize: permsI.size,
              supersetSize: permsJ.size,
            });
          }
        }
      }
    }

    // Separation of duty violations per user
    const sodViolations = [];
    for (const user of users) {
      const userPerms = new Set();
      for (const roleName of (user.roles || [])) {
        if (rolePermMap[roleName]) {
          for (const perm of rolePermMap[roleName]) userPerms.add(perm);
        }
      }

      for (const rule of sodRules) {
        const conflicting = rule.conflicting || [];
        const held = conflicting.filter(p => userPerms.has(p));
        if (held.length >= 2) {
          sodViolations.push({
            userId: user.userId,
            rule: rule.name,
            conflictingPermissions: held,
            roles: user.roles,
          });
        }
      }
    }

    // Users with no roles
    const usersNoRoles = users.filter(u => !u.roles || u.roles.length === 0)
      .map(u => u.userId);

    const result = {
      analyzedAt: new Date().toISOString(),
      totalRoles: roles.length,
      totalPermissions: totalPerms,
      totalUsers: users.length,
      matrix,
      overPrivilegedRoles: overPrivileged,
      redundantRoles,
      unknownRoles,
      usersWithNoRoles: usersNoRoles,
      sodViolations,
      summary: {
        overPrivilegedCount: overPrivileged.length,
        redundantPairCount: redundantRoles.length,
        unknownRoleRefs: unknownRoles.length,
        sodViolationCount: sodViolations.length,
        usersWithNoRoles: usersNoRoles.length,
      },
    };

    artifact.data.permissionMatrix = result;
    return { ok: true, result };
  });

  /**
   * systemHealth
   * Compute system health score from metrics — CPU/memory/disk/latency/error-rate
   * weighted scoring with trend analysis.
   * artifact.data.metrics: [{ timestamp, cpu, memory, disk, latencyMs, errorRate }]
   * params.weights — optional { cpu, memory, disk, latency, errorRate } weight overrides
   * params.thresholds — optional { cpu, memory, disk, latency, errorRate } critical thresholds
   */
  registerLensAction("admin", "systemHealth", (ctx, artifact, params) => {
    const metrics = artifact.data.metrics || [];
    if (metrics.length === 0) {
      return { ok: true, result: { message: "No metrics data provided." } };
    }

    const weights = {
      cpu: 0.25,
      memory: 0.2,
      disk: 0.15,
      latency: 0.25,
      errorRate: 0.15,
      ...(params.weights || {}),
    };

    const thresholds = {
      cpu: 90,         // percentage
      memory: 90,      // percentage
      disk: 90,        // percentage
      latency: 1000,   // ms
      errorRate: 5,    // percentage
      ...(params.thresholds || {}),
    };

    const sorted = [...metrics]
      .map(m => ({ ...m, ts: new Date(m.timestamp).getTime() }))
      .filter(m => !isNaN(m.ts))
      .sort((a, b) => a.ts - b.ts);

    // Compute current values (average of last 10% or at least last entry)
    const recentCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const recent = sorted.slice(-recentCount);

    const avg = (arr, key) => {
      const vals = arr.map(m => parseFloat(m[key])).filter(v => !isNaN(v));
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };

    const current = {
      cpu: avg(recent, "cpu"),
      memory: avg(recent, "memory"),
      disk: avg(recent, "disk"),
      latency: avg(recent, "latencyMs"),
      errorRate: avg(recent, "errorRate"),
    };

    // Score each metric: 100 = perfect, 0 = at or beyond threshold
    const score = (value, threshold) => {
      if (value === null) return null;
      const ratio = value / threshold;
      if (ratio >= 1) return 0;
      // Exponential decay scoring — penalizes more as approaching threshold
      return Math.round(Math.max(0, (1 - Math.pow(ratio, 2)) * 100) * 100) / 100;
    };

    const scores = {
      cpu: score(current.cpu, thresholds.cpu),
      memory: score(current.memory, thresholds.memory),
      disk: score(current.disk, thresholds.disk),
      latency: score(current.latency, thresholds.latency),
      errorRate: score(current.errorRate, thresholds.errorRate),
    };

    // Weighted composite score
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [key, s] of Object.entries(scores)) {
      if (s !== null) {
        weightedSum += s * (weights[key] || 0);
        totalWeight += weights[key] || 0;
      }
    }
    const compositeScore = totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100) / 100
      : null;

    // Trend analysis using linear regression on each metric
    const computeTrend = (key) => {
      const points = sorted
        .map((m, i) => ({ x: i, y: parseFloat(m[key]) }))
        .filter(p => !isNaN(p.y));
      if (points.length < 2) return null;

      const n = points.length;
      const sumX = points.reduce((s, p) => s + p.x, 0);
      const sumY = points.reduce((s, p) => s + p.y, 0);
      const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
      const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
      const denom = n * sumX2 - sumX * sumX;
      if (Math.abs(denom) < 1e-12) return null;

      const slope = (n * sumXY - sumX * sumY) / denom;
      const direction = Math.abs(slope) < 0.01 ? "stable" : slope > 0 ? "increasing" : "decreasing";

      return {
        slope: Math.round(slope * 10000) / 10000,
        direction,
        concern: (key !== "latency" && key !== "errorRate")
          ? (direction === "increasing" ? "degrading" : "improving")
          : (direction === "increasing" ? "degrading" : "improving"),
      };
    };

    const trends = {
      cpu: computeTrend("cpu"),
      memory: computeTrend("memory"),
      disk: computeTrend("disk"),
      latency: computeTrend("latencyMs"),
      errorRate: computeTrend("errorRate"),
    };

    // Alerts for critical thresholds
    const alerts = [];
    if (current.cpu !== null && current.cpu >= thresholds.cpu) {
      alerts.push({ metric: "cpu", value: current.cpu, threshold: thresholds.cpu, severity: "critical" });
    }
    if (current.memory !== null && current.memory >= thresholds.memory) {
      alerts.push({ metric: "memory", value: current.memory, threshold: thresholds.memory, severity: "critical" });
    }
    if (current.disk !== null && current.disk >= thresholds.disk) {
      alerts.push({ metric: "disk", value: current.disk, threshold: thresholds.disk, severity: "critical" });
    }
    if (current.latency !== null && current.latency >= thresholds.latency) {
      alerts.push({ metric: "latency", value: current.latency, threshold: thresholds.latency, severity: "critical" });
    }
    if (current.errorRate !== null && current.errorRate >= thresholds.errorRate) {
      alerts.push({ metric: "errorRate", value: current.errorRate, threshold: thresholds.errorRate, severity: "critical" });
    }

    // Warning at 80% of threshold
    for (const [key, threshold] of Object.entries(thresholds)) {
      const val = key === "latency" ? current.latency : current[key];
      if (val !== null && val >= threshold * 0.8 && val < threshold) {
        alerts.push({ metric: key, value: val, threshold, severity: "warning" });
      }
    }

    const healthStatus = compositeScore >= 80 ? "healthy"
      : compositeScore >= 60 ? "degraded"
      : compositeScore >= 30 ? "unhealthy"
      : "critical";

    const result = {
      analyzedAt: new Date().toISOString(),
      dataPoints: sorted.length,
      compositeScore,
      healthStatus,
      currentValues: {
        cpu: current.cpu !== null ? Math.round(current.cpu * 100) / 100 : null,
        memory: current.memory !== null ? Math.round(current.memory * 100) / 100 : null,
        disk: current.disk !== null ? Math.round(current.disk * 100) / 100 : null,
        latencyMs: current.latency !== null ? Math.round(current.latency * 100) / 100 : null,
        errorRate: current.errorRate !== null ? Math.round(current.errorRate * 100) / 100 : null,
      },
      componentScores: scores,
      weights,
      trends,
      alerts,
    };

    artifact.data.systemHealth = result;
    return { ok: true, result };
  });
}
