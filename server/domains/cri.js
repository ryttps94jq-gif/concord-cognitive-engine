// server/domains/cri.js
// Domain actions for crisis management: severity assessment, response
// timeline generation, and stakeholder impact mapping.

export default function registerCriActions(registerLensAction) {
  /**
   * severityAssessment
   * Assess crisis severity using multi-factor scoring: scope, impact,
   * urgency, and controllability. Computes composite severity level.
   * artifact.data.crisis = { description?, scope: 1-5, impact: 1-5, urgency: 1-5, controllability: 1-5, affectedSystems?: [], casualties?: number, financialExposure?: number }
   */
  registerLensAction("cri", "severityAssessment", (ctx, artifact, params) => {
    const crisis = artifact.data?.crisis || {};

    // Factor scores (1-5 scale, default to 3 if missing)
    const scope = Math.max(1, Math.min(5, crisis.scope || 3));
    const impact = Math.max(1, Math.min(5, crisis.impact || 3));
    const urgency = Math.max(1, Math.min(5, crisis.urgency || 3));
    const controllability = Math.max(1, Math.min(5, crisis.controllability || 3));

    // Weights for composite score (urgency and impact weigh more)
    const weights = { scope: 0.2, impact: 0.3, urgency: 0.3, controllability: 0.2 };

    // Controllability is inverse — higher controllability reduces severity
    const invertedControllability = 6 - controllability;

    const weightedScore =
      scope * weights.scope +
      impact * weights.impact +
      urgency * weights.urgency +
      invertedControllability * weights.controllability;

    // Normalize to 0-100
    const normalizedScore = Math.round(((weightedScore - 1) / 4) * 100);

    // Escalation modifiers
    let escalationModifier = 0;
    if (crisis.casualties && crisis.casualties > 0) escalationModifier += 20;
    if (crisis.financialExposure && crisis.financialExposure > 1000000) escalationModifier += 10;
    if ((crisis.affectedSystems || []).length > 5) escalationModifier += 10;

    const finalScore = Math.min(100, normalizedScore + escalationModifier);

    // Severity level determination
    let severityLevel, color, responseProtocol;
    if (finalScore >= 80) {
      severityLevel = "critical";
      color = "red";
      responseProtocol = "Immediate executive escalation, all-hands response, external communications within 1 hour";
    } else if (finalScore >= 60) {
      severityLevel = "high";
      color = "orange";
      responseProtocol = "Senior leadership notification, dedicated response team, communications within 4 hours";
    } else if (finalScore >= 40) {
      severityLevel = "moderate";
      color = "yellow";
      responseProtocol = "Manager-level response, monitor escalation, communications within 24 hours";
    } else if (finalScore >= 20) {
      severityLevel = "low";
      color = "blue";
      responseProtocol = "Standard incident process, scheduled review";
    } else {
      severityLevel = "minimal";
      color = "green";
      responseProtocol = "Log and monitor, no immediate action required";
    }

    // Factor analysis: which factors drive severity most
    const factorContributions = [
      { factor: "scope", score: scope, weightedContribution: Math.round(scope * weights.scope * 100) / 100 },
      { factor: "impact", score: impact, weightedContribution: Math.round(impact * weights.impact * 100) / 100 },
      { factor: "urgency", score: urgency, weightedContribution: Math.round(urgency * weights.urgency * 100) / 100 },
      { factor: "controllability", score: controllability, invertedScore: invertedControllability, weightedContribution: Math.round(invertedControllability * weights.controllability * 100) / 100 },
    ].sort((a, b) => b.weightedContribution - a.weightedContribution);

    artifact.data.severityAssessment = { score: finalScore, level: severityLevel, timestamp: new Date().toISOString() };

    return {
      ok: true, result: {
        severityScore: finalScore,
        severityLevel,
        color,
        responseProtocol,
        factors: {
          scope: { score: scope, label: ["", "isolated", "local", "regional", "national", "global"][scope] },
          impact: { score: impact, label: ["", "negligible", "minor", "moderate", "major", "catastrophic"][impact] },
          urgency: { score: urgency, label: ["", "scheduled", "planned", "prompt", "immediate", "flash"][urgency] },
          controllability: { score: controllability, label: ["", "uncontrollable", "difficult", "manageable", "contained", "fully controlled"][controllability] },
        },
        factorContributions,
        escalationModifiers: {
          casualties: crisis.casualties || 0,
          financialExposure: crisis.financialExposure || 0,
          affectedSystemCount: (crisis.affectedSystems || []).length,
          totalModifier: escalationModifier,
        },
        rawWeightedScore: Math.round(weightedScore * 100) / 100,
      },
    };
  });

  /**
   * responseTimeline
   * Generate crisis response timeline: critical path through response steps,
   * resource allocation, and SLA tracking.
   * artifact.data.responseSteps = [{ name, durationMinutes, dependencies?: [stepName], resources?: [string], sla?: number }]
   * artifact.data.startTime = ISO timestamp (default now)
   */
  registerLensAction("cri", "responseTimeline", (ctx, artifact, params) => {
    const steps = artifact.data?.responseSteps || [];
    if (steps.length === 0) return { ok: true, result: { message: "No response steps defined." } };

    const startTime = new Date(artifact.data?.startTime || Date.now());

    // Build dependency graph and compute earliest start/finish (forward pass)
    const stepMap = {};
    for (const step of steps) {
      stepMap[step.name] = {
        ...step,
        duration: step.durationMinutes || 0,
        deps: step.dependencies || [],
        es: 0, // earliest start
        ef: 0, // earliest finish
        ls: Infinity, // latest start
        lf: Infinity, // latest finish
        slack: 0,
      };
    }

    // Topological sort via Kahn's algorithm
    const inDegree = {};
    const adjList = {};
    for (const name of Object.keys(stepMap)) {
      inDegree[name] = 0;
      adjList[name] = [];
    }
    for (const step of Object.values(stepMap)) {
      for (const dep of step.deps) {
        if (stepMap[dep]) {
          adjList[dep].push(step.name);
          inDegree[step.name]++;
        }
      }
    }

    const queue = Object.keys(inDegree).filter(n => inDegree[n] === 0);
    const topoOrder = [];
    while (queue.length > 0) {
      const current = queue.shift();
      topoOrder.push(current);
      for (const neighbor of adjList[current]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    // Detect cycles
    if (topoOrder.length !== Object.keys(stepMap).length) {
      return { ok: false, error: "Circular dependency detected in response steps." };
    }

    // Forward pass: earliest start and finish
    for (const name of topoOrder) {
      const step = stepMap[name];
      for (const dep of step.deps) {
        if (stepMap[dep]) {
          step.es = Math.max(step.es, stepMap[dep].ef);
        }
      }
      step.ef = step.es + step.duration;
    }

    // Project total duration
    const totalDuration = Math.max(...Object.values(stepMap).map(s => s.ef));

    // Backward pass: latest start and finish
    for (const name of Object.keys(stepMap)) {
      stepMap[name].lf = totalDuration;
    }
    for (const name of [...topoOrder].reverse()) {
      const step = stepMap[name];
      for (const successor of adjList[name]) {
        step.lf = Math.min(step.lf, stepMap[successor].ls);
      }
      step.ls = step.lf - step.duration;
      step.slack = step.ls - step.es;
    }

    // Critical path: steps with zero slack
    const criticalPath = topoOrder.filter(n => stepMap[n].slack === 0);

    // Build timeline with absolute timestamps
    const timeline = topoOrder.map(name => {
      const step = stepMap[name];
      const absoluteStart = new Date(startTime.getTime() + step.es * 60000);
      const absoluteEnd = new Date(startTime.getTime() + step.ef * 60000);
      const slaDeadline = step.sla ? new Date(startTime.getTime() + step.sla * 60000) : null;
      const slaStatus = slaDeadline
        ? (step.ef <= step.sla ? "within_sla" : "sla_breach")
        : "no_sla";

      return {
        name,
        startMinute: step.es,
        endMinute: step.ef,
        duration: step.duration,
        slack: step.slack,
        isCritical: step.slack === 0,
        absoluteStart: absoluteStart.toISOString(),
        absoluteEnd: absoluteEnd.toISOString(),
        resources: step.resources || [],
        slaStatus,
        slaDeadline: slaDeadline ? slaDeadline.toISOString() : null,
      };
    });

    // Resource allocation summary
    const resourceLoad = {};
    for (const step of timeline) {
      for (const resource of step.resources) {
        if (!resourceLoad[resource]) resourceLoad[resource] = { totalMinutes: 0, steps: [] };
        resourceLoad[resource].totalMinutes += step.duration;
        resourceLoad[resource].steps.push(step.name);
      }
    }

    // SLA summary
    const slaBreaches = timeline.filter(t => t.slaStatus === "sla_breach");

    artifact.data.timeline = timeline;

    return {
      ok: true, result: {
        timeline,
        criticalPath,
        totalDurationMinutes: totalDuration,
        estimatedCompletion: new Date(startTime.getTime() + totalDuration * 60000).toISOString(),
        startTime: startTime.toISOString(),
        resourceAllocation: resourceLoad,
        sla: {
          breaches: slaBreaches.length,
          breachedSteps: slaBreaches.map(s => s.name),
          allWithinSla: slaBreaches.length === 0,
        },
        stepCount: steps.length,
        criticalPathLength: criticalPath.length,
      },
    };
  });

  /**
   * stakeholderImpact
   * Map stakeholder impact: identify affected parties, score impact magnitude,
   * and prioritize communication order.
   * artifact.data.stakeholders = [{ name, type: "internal"|"external"|"regulatory", influence: 1-5, dependence: 1-5, proximity?: 1-5 }]
   * artifact.data.crisisType = string (optional context)
   */
  registerLensAction("cri", "stakeholderImpact", (ctx, artifact, params) => {
    const stakeholders = artifact.data?.stakeholders || [];
    if (stakeholders.length === 0) return { ok: true, result: { message: "No stakeholders defined." } };

    const crisisType = artifact.data?.crisisType || "general";

    // Type-based urgency multipliers
    const typeMultiplier = { regulatory: 1.5, external: 1.2, internal: 1.0 };

    const scored = stakeholders.map(sh => {
      const influence = Math.max(1, Math.min(5, sh.influence || 3));
      const dependence = Math.max(1, Math.min(5, sh.dependence || 3));
      const proximity = Math.max(1, Math.min(5, sh.proximity || 3));
      const multiplier = typeMultiplier[sh.type] || 1.0;

      // Impact magnitude: weighted combination
      const rawImpact = (influence * 0.35 + dependence * 0.35 + proximity * 0.3) * multiplier;
      const impactScore = Math.round(Math.min(10, rawImpact * 2) * 100) / 100;

      // Communication urgency: higher impact + regulatory = more urgent
      const urgencyScore = Math.round((impactScore * (sh.type === "regulatory" ? 1.3 : 1.0)) * 100) / 100;

      // Stakeholder quadrant (power/interest matrix)
      let quadrant;
      if (influence >= 3 && dependence >= 3) quadrant = "manage_closely";
      else if (influence >= 3 && dependence < 3) quadrant = "keep_satisfied";
      else if (influence < 3 && dependence >= 3) quadrant = "keep_informed";
      else quadrant = "monitor";

      return {
        name: sh.name,
        type: sh.type || "internal",
        influence,
        dependence,
        proximity,
        impactScore,
        urgencyScore,
        quadrant,
      };
    });

    // Sort by urgency for communication priority
    const communicationOrder = [...scored].sort((a, b) => b.urgencyScore - a.urgencyScore);

    // Assign communication tiers
    const tiered = communicationOrder.map((sh, idx) => {
      let tier, timeframe;
      const position = idx / communicationOrder.length;
      if (position < 0.25) { tier = 1; timeframe = "within 1 hour"; }
      else if (position < 0.5) { tier = 2; timeframe = "within 4 hours"; }
      else if (position < 0.75) { tier = 3; timeframe = "within 24 hours"; }
      else { tier = 4; timeframe = "within 72 hours"; }
      return { ...sh, communicationTier: tier, communicationTimeframe: timeframe };
    });

    // Quadrant summary
    const quadrantSummary = {};
    for (const sh of scored) {
      if (!quadrantSummary[sh.quadrant]) quadrantSummary[sh.quadrant] = { count: 0, stakeholders: [] };
      quadrantSummary[sh.quadrant].count++;
      quadrantSummary[sh.quadrant].stakeholders.push(sh.name);
    }

    // Type distribution
    const typeDistribution = {};
    for (const sh of scored) {
      typeDistribution[sh.type] = (typeDistribution[sh.type] || 0) + 1;
    }

    // Risk concentration: are most high-impact stakeholders in one type?
    const typeAvgImpact = {};
    for (const sh of scored) {
      if (!typeAvgImpact[sh.type]) typeAvgImpact[sh.type] = { sum: 0, count: 0 };
      typeAvgImpact[sh.type].sum += sh.impactScore;
      typeAvgImpact[sh.type].count++;
    }
    const typeImpactSummary = Object.entries(typeAvgImpact).map(([type, data]) => ({
      type,
      count: data.count,
      avgImpact: Math.round((data.sum / data.count) * 100) / 100,
    }));

    artifact.data.stakeholderMap = tiered;

    return {
      ok: true, result: {
        communicationPriority: tiered,
        quadrantAnalysis: quadrantSummary,
        typeDistribution,
        typeImpactSummary,
        metrics: {
          totalStakeholders: stakeholders.length,
          avgImpactScore: Math.round((scored.reduce((s, sh) => s + sh.impactScore, 0) / scored.length) * 100) / 100,
          maxImpactScore: Math.max(...scored.map(s => s.impactScore)),
          tier1Count: tiered.filter(s => s.communicationTier === 1).length,
          regulatoryCount: typeDistribution.regulatory || 0,
        },
        crisisType,
      },
    };
  });
}
