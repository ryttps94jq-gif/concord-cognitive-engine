// server/domains/queue.js
// Domain actions for queue/job management: queueing theory analytics,
// priority scheduling, and backpressure computation.

export default function registerQueueActions(registerLensAction) {
  /**
   * queueAnalytics
   * Analyze queue performance using queueing theory: arrival rate (λ),
   * service rate (μ), utilization (ρ), M/M/1 and M/M/c models, wait time predictions.
   * artifact.data.queue = { arrivals: [timestamp], completions: [{ arrived, completed }], servers?: number }
   */
  registerLensAction("queue", "queueAnalytics", (ctx, artifact, params) => {
    const queue = artifact.data?.queue || {};
    const arrivals = (queue.arrivals || []).map(t => new Date(t).getTime()).filter(t => !isNaN(t)).sort((a, b) => a - b);
    const completions = (queue.completions || []).map(c => ({
      arrived: new Date(c.arrived).getTime(),
      completed: new Date(c.completed).getTime(),
    })).filter(c => !isNaN(c.arrived) && !isNaN(c.completed));
    const servers = queue.servers || 1;

    if (arrivals.length < 2 && completions.length < 2) {
      return { ok: true, result: { message: "Insufficient data for queue analysis." } };
    }

    // Compute arrival rate λ (arrivals per second)
    let lambda = 0;
    if (arrivals.length >= 2) {
      const spanSeconds = (arrivals[arrivals.length - 1] - arrivals[0]) / 1000;
      lambda = spanSeconds > 0 ? (arrivals.length - 1) / spanSeconds : 0;
    }

    // Compute service rate μ (completions per second per server)
    let mu = 0;
    let avgServiceTime = 0;
    if (completions.length > 0) {
      const serviceTimes = completions.map(c => (c.completed - c.arrived) / 1000).filter(t => t > 0);
      if (serviceTimes.length > 0) {
        avgServiceTime = serviceTimes.reduce((s, t) => s + t, 0) / serviceTimes.length;
        mu = avgServiceTime > 0 ? 1 / avgServiceTime : 0;
      }
    }

    // Utilization ρ = λ / (c * μ)
    const rho = (servers * mu) > 0 ? lambda / (servers * mu) : 0;
    const stable = rho < 1;

    // M/M/1 model (single server)
    const mm1 = {};
    if (mu > 0 && lambda < mu) {
      mm1.avgQueueLength = (lambda * lambda) / (mu * (mu - lambda)); // Lq
      mm1.avgSystemLength = lambda / (mu - lambda); // L
      mm1.avgWaitTime = lambda / (mu * (mu - lambda)); // Wq (seconds)
      mm1.avgSystemTime = 1 / (mu - lambda); // W (seconds)
      mm1.idleProbability = 1 - (lambda / mu); // P0
      mm1.utilization = lambda / mu;
    }

    // M/M/c model (multiple servers)
    const mmc = {};
    if (servers > 1 && mu > 0) {
      const a = lambda / mu; // traffic intensity

      // Erlang C formula: probability all servers busy
      // P0 = [sum(k=0 to c-1, a^k/k!) + a^c/(c! * (1 - a/c))]^-1
      function factorial(n) {
        let f = 1;
        for (let i = 2; i <= n; i++) f *= i;
        return f;
      }

      if (a < servers) { // system must be stable
        let sum = 0;
        for (let k = 0; k < servers; k++) {
          sum += Math.pow(a, k) / factorial(k);
        }
        const lastTerm = Math.pow(a, servers) / (factorial(servers) * (1 - a / servers));
        const p0 = 1 / (sum + lastTerm);

        // Erlang C: probability of queuing
        const erlangC = (Math.pow(a, servers) / factorial(servers)) * (1 / (1 - a / servers)) * p0;

        mmc.erlangC = Math.round(erlangC * 10000) / 10000;
        mmc.avgQueueLength = erlangC * (a / servers) / (1 - a / servers); // Lq
        mmc.avgWaitTime = mmc.avgQueueLength / lambda; // Wq
        mmc.avgSystemTime = mmc.avgWaitTime + 1 / mu; // W
        mmc.avgSystemLength = lambda * mmc.avgSystemTime; // L
        mmc.utilization = a / servers;
        mmc.idleProbability = Math.round(p0 * 10000) / 10000;
      }
    }

    // Service time distribution analysis
    let serviceTimeStats = null;
    if (completions.length > 0) {
      const serviceTimes = completions.map(c => (c.completed - c.arrived) / 1000).filter(t => t > 0).sort((a, b) => a - b);
      if (serviceTimes.length > 0) {
        const n = serviceTimes.length;
        const mean = serviceTimes.reduce((s, t) => s + t, 0) / n;
        const variance = serviceTimes.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : 0; // coefficient of variation

        serviceTimeStats = {
          mean: Math.round(mean * 1000) / 1000,
          median: Math.round(serviceTimes[Math.floor(n / 2)] * 1000) / 1000,
          stdDev: Math.round(stdDev * 1000) / 1000,
          p95: Math.round(serviceTimes[Math.floor(n * 0.95)] * 1000) / 1000,
          p99: Math.round(serviceTimes[Math.floor(n * 0.99)] * 1000) / 1000,
          coefficientOfVariation: Math.round(cv * 10000) / 10000,
          distribution: cv < 0.5 ? "low_variance" : cv < 1.2 ? "moderate_variance" : "high_variance",
        };
      }
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    return {
      ok: true, result: {
        rates: {
          arrivalRate: r(lambda),
          serviceRate: r(mu),
          avgServiceTimeSeconds: r(avgServiceTime),
          servers,
        },
        utilization: {
          rho: r(rho),
          stable,
          status: rho >= 1 ? "overloaded" : rho >= 0.8 ? "heavy" : rho >= 0.5 ? "moderate" : "light",
        },
        mm1Model: Object.keys(mm1).length > 0 ? {
          avgQueueLength: r(mm1.avgQueueLength),
          avgSystemLength: r(mm1.avgSystemLength),
          avgWaitTimeSeconds: r(mm1.avgWaitTime),
          avgSystemTimeSeconds: r(mm1.avgSystemTime),
          idleProbability: r(mm1.idleProbability),
          utilization: r(mm1.utilization),
        } : { note: "M/M/1 not applicable (system unstable or insufficient data)" },
        mmcModel: Object.keys(mmc).length > 0 ? {
          servers,
          erlangC: mmc.erlangC,
          avgQueueLength: r(mmc.avgQueueLength),
          avgWaitTimeSeconds: r(mmc.avgWaitTime),
          avgSystemTimeSeconds: r(mmc.avgSystemTime),
          avgSystemLength: r(mmc.avgSystemLength),
          utilization: r(mmc.utilization),
          idleProbability: mmc.idleProbability,
        } : { note: servers > 1 ? "M/M/c not applicable (system unstable)" : "Single server — see M/M/1" },
        serviceTimeDistribution: serviceTimeStats,
        dataPoints: { arrivals: arrivals.length, completions: completions.length },
      },
    };
  });

  /**
   * prioritySchedule
   * Priority scheduling: weighted fair queuing, deadline-monotonic scheduling,
   * and starvation detection.
   * artifact.data.jobs = [{ id, priority: 1-10, arrivalTime, deadline?, estimatedDuration, weight?: number, waitingSince?: timestamp }]
   * params.algorithm = "weighted_fair" | "deadline_monotonic" | "priority_preemptive" (default "weighted_fair")
   */
  registerLensAction("queue", "prioritySchedule", (ctx, artifact, params) => {
    const jobs = artifact.data?.jobs || [];
    if (jobs.length === 0) return { ok: true, result: { message: "No jobs to schedule." } };

    const algorithm = params.algorithm || "weighted_fair";
    const now = Date.now();

    // Normalize job data
    const normalized = jobs.map(job => ({
      id: job.id,
      priority: Math.max(1, Math.min(10, job.priority || 5)),
      arrival: new Date(job.arrivalTime || now).getTime(),
      deadline: job.deadline ? new Date(job.deadline).getTime() : null,
      duration: job.estimatedDuration || 1,
      weight: job.weight || job.priority || 5,
      waitingSince: job.waitingSince ? new Date(job.waitingSince).getTime() : now,
    }));

    let schedule, scheduleName;

    if (algorithm === "weighted_fair") {
      // Weighted Fair Queuing: virtual time = actual_time / weight
      // Higher weight = more service share
      const totalWeight = normalized.reduce((s, j) => s + j.weight, 0);

      const scheduled = normalized.map(job => {
        const share = job.weight / totalWeight;
        const virtualFinishTime = job.arrival + (job.duration / share);
        return { ...job, share: Math.round(share * 10000) / 100, virtualFinishTime };
      });

      // Sort by virtual finish time (earlier virtual finish = scheduled first)
      scheduled.sort((a, b) => a.virtualFinishTime - b.virtualFinishTime);

      let currentTime = Math.min(...scheduled.map(j => j.arrival));
      schedule = scheduled.map((job, idx) => {
        const startTime = Math.max(currentTime, job.arrival);
        const endTime = startTime + job.duration;
        currentTime = endTime;
        return {
          order: idx + 1,
          id: job.id,
          priority: job.priority,
          weight: job.weight,
          sharePercent: job.share,
          startTime,
          endTime,
          waitTime: startTime - job.arrival,
          meetsDeadline: job.deadline ? endTime <= job.deadline : null,
        };
      });
      scheduleName = "Weighted Fair Queuing";

    } else if (algorithm === "deadline_monotonic") {
      // Deadline-Monotonic: sort by deadline (earliest deadline first)
      const withDeadlines = normalized.filter(j => j.deadline);
      const withoutDeadlines = normalized.filter(j => !j.deadline);

      // EDF (Earliest Deadline First) ordering
      withDeadlines.sort((a, b) => a.deadline - b.deadline);
      const ordered = [...withDeadlines, ...withoutDeadlines];

      let currentTime = Math.min(...ordered.map(j => j.arrival));
      schedule = ordered.map((job, idx) => {
        const startTime = Math.max(currentTime, job.arrival);
        const endTime = startTime + job.duration;
        currentTime = endTime;
        const slackTime = job.deadline ? job.deadline - endTime : null;
        return {
          order: idx + 1,
          id: job.id,
          priority: job.priority,
          deadline: job.deadline ? new Date(job.deadline).toISOString() : null,
          startTime,
          endTime,
          waitTime: startTime - job.arrival,
          meetsDeadline: job.deadline ? endTime <= job.deadline : null,
          slackMs: slackTime,
        };
      });
      scheduleName = "Deadline-Monotonic (EDF)";

    } else {
      // Priority preemptive: highest priority first
      const sorted = [...normalized].sort((a, b) => b.priority - a.priority || a.arrival - b.arrival);

      let currentTime = Math.min(...sorted.map(j => j.arrival));
      schedule = sorted.map((job, idx) => {
        const startTime = Math.max(currentTime, job.arrival);
        const endTime = startTime + job.duration;
        currentTime = endTime;
        return {
          order: idx + 1,
          id: job.id,
          priority: job.priority,
          startTime,
          endTime,
          waitTime: startTime - job.arrival,
          meetsDeadline: job.deadline ? endTime <= job.deadline : null,
        };
      });
      scheduleName = "Priority Preemptive";
    }

    // Starvation detection: jobs waiting too long relative to their fair share
    const avgWait = schedule.reduce((s, j) => s + j.waitTime, 0) / schedule.length;
    const starvationThreshold = avgWait * 3;
    const starvedJobs = schedule.filter(j => j.waitTime > starvationThreshold);

    // Fairness analysis
    const waitTimes = schedule.map(j => j.waitTime);
    const waitMean = waitTimes.reduce((s, w) => s + w, 0) / waitTimes.length;
    const waitVariance = waitTimes.reduce((s, w) => s + Math.pow(w - waitMean, 2), 0) / waitTimes.length;

    // Jain's fairness index on normalized wait times
    const sumWait = waitTimes.reduce((s, w) => s + w, 0);
    const sumWaitSq = waitTimes.reduce((s, w) => s + w * w, 0);
    const jainsFairness = sumWaitSq > 0
      ? Math.round(((sumWait * sumWait) / (waitTimes.length * sumWaitSq)) * 10000) / 10000
      : 1;

    // Deadline analysis
    const deadlineJobs = schedule.filter(j => j.meetsDeadline !== null);
    const missedDeadlines = deadlineJobs.filter(j => j.meetsDeadline === false);

    return {
      ok: true, result: {
        algorithm: scheduleName,
        schedule,
        starvation: {
          detected: starvedJobs.length > 0,
          starvedJobs: starvedJobs.map(j => ({ id: j.id, waitTime: j.waitTime, threshold: Math.round(starvationThreshold) })),
          threshold: Math.round(starvationThreshold),
        },
        fairness: {
          jainsIndex: jainsFairness,
          level: jainsFairness > 0.9 ? "fair" : jainsFairness > 0.7 ? "moderate" : "unfair",
          avgWaitTime: Math.round(waitMean),
          waitTimeStdDev: Math.round(Math.sqrt(waitVariance)),
        },
        deadlines: {
          total: deadlineJobs.length,
          met: deadlineJobs.length - missedDeadlines.length,
          missed: missedDeadlines.length,
          missedJobs: missedDeadlines.map(j => j.id),
        },
        metrics: {
          totalJobs: jobs.length,
          makespan: schedule.length > 0 ? Math.max(...schedule.map(j => j.endTime)) - Math.min(...schedule.map(j => j.startTime)) : 0,
        },
      },
    };
  });

  /**
   * backpressure
   * Compute backpressure signals: queue depth monitoring, rate limiting
   * calculations, and adaptive throttling thresholds.
   * artifact.data.metrics = { queueDepth: number, maxCapacity: number, ingressRate: number, egressRate: number, history?: [{ timestamp, depth, ingressRate, egressRate }] }
   */
  registerLensAction("queue", "backpressure", (ctx, artifact, params) => {
    const metrics = artifact.data?.metrics || {};
    const depth = metrics.queueDepth || 0;
    const capacity = metrics.maxCapacity || 1000;
    const ingressRate = metrics.ingressRate || 0;
    const egressRate = metrics.egressRate || 0;
    const history = metrics.history || [];

    // Current fill ratio
    const fillRatio = capacity > 0 ? depth / capacity : 0;

    // Time to overflow (if ingress > egress)
    const netRate = ingressRate - egressRate;
    const timeToOverflow = netRate > 0 && capacity > depth
      ? Math.round(((capacity - depth) / netRate) * 100) / 100
      : null;

    // Time to drain (if egress > ingress)
    const timeToDrain = netRate < 0 && depth > 0
      ? Math.round((depth / Math.abs(netRate)) * 100) / 100
      : null;

    // Backpressure signal: 0 = no pressure, 1 = full pressure
    // Using exponential curve for sensitivity at high fill ratios
    const backpressureSignal = Math.min(1, Math.pow(fillRatio, 2));

    // Rate limit calculation: target ingress rate to maintain fill ratio below threshold
    const targetFillRatio = params.targetFillRatio || 0.7;
    const targetDepth = capacity * targetFillRatio;
    let recommendedIngressRate;
    if (depth > targetDepth) {
      // Need to reduce ingress to drain
      recommendedIngressRate = Math.max(0, egressRate * 0.8);
    } else {
      // Can accept at egress rate plus margin
      const headroom = (targetDepth - depth) / Math.max(1, capacity);
      recommendedIngressRate = egressRate * (1 + headroom);
    }

    // Adaptive throttling thresholds (3 tiers)
    const throttlingTiers = [
      { tier: "none", fillThreshold: 0.5, ingressMultiplier: 1.0, description: "No throttling" },
      { tier: "light", fillThreshold: 0.7, ingressMultiplier: 0.75, description: "Reduce ingress to 75%" },
      { tier: "moderate", fillThreshold: 0.85, ingressMultiplier: 0.5, description: "Reduce ingress to 50%" },
      { tier: "heavy", fillThreshold: 0.95, ingressMultiplier: 0.1, description: "Near-complete throttle (10%)" },
    ];

    const activeTier = throttlingTiers.reduce((active, tier) => {
      return fillRatio >= tier.fillThreshold ? tier : active;
    }, throttlingTiers[0]);

    const throttledRate = Math.round(ingressRate * activeTier.ingressMultiplier * 100) / 100;

    // Trend analysis from history
    let trend = "stable";
    let depthTrend = null;
    if (history.length >= 3) {
      const recentDepths = history.slice(-10).map(h => h.depth);
      const firstHalf = recentDepths.slice(0, Math.floor(recentDepths.length / 2));
      const secondHalf = recentDepths.slice(Math.floor(recentDepths.length / 2));
      const firstAvg = firstHalf.reduce((s, d) => s + d, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, d) => s + d, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.2) trend = "increasing";
      else if (secondAvg < firstAvg * 0.8) trend = "decreasing";

      // Rate of change (depth units per history point)
      const slope = (secondAvg - firstAvg) / Math.max(1, recentDepths.length / 2);
      depthTrend = {
        direction: trend,
        slope: Math.round(slope * 100) / 100,
        recentAvgDepth: Math.round(secondAvg * 100) / 100,
        previousAvgDepth: Math.round(firstAvg * 100) / 100,
      };
    }

    // Health assessment
    let health;
    if (fillRatio >= 0.95) health = "critical";
    else if (fillRatio >= 0.8) health = "warning";
    else if (fillRatio >= 0.5) health = "caution";
    else health = "healthy";

    return {
      ok: true, result: {
        currentState: {
          queueDepth: depth,
          maxCapacity: capacity,
          fillRatio: Math.round(fillRatio * 10000) / 100,
          ingressRate,
          egressRate,
          netRate: Math.round(netRate * 100) / 100,
          health,
        },
        backpressure: {
          signal: Math.round(backpressureSignal * 10000) / 10000,
          level: backpressureSignal > 0.8 ? "critical" : backpressureSignal > 0.5 ? "high" : backpressureSignal > 0.2 ? "moderate" : "low",
          timeToOverflow: timeToOverflow ? `${timeToOverflow}s` : "N/A (draining or stable)",
          timeToDrain: timeToDrain ? `${timeToDrain}s` : "N/A (filling or stable)",
        },
        throttling: {
          activeTier: activeTier.tier,
          description: activeTier.description,
          currentIngressRate: ingressRate,
          throttledIngressRate: throttledRate,
          recommendedIngressRate: Math.round(recommendedIngressRate * 100) / 100,
          tiers: throttlingTiers,
        },
        trend: depthTrend || { direction: "insufficient_data" },
        recommendations: [
          ...(fillRatio > 0.9 ? ["Queue critically full — apply heavy backpressure immediately"] : []),
          ...(netRate > 0 && timeToOverflow && timeToOverflow < 60 ? [`Queue will overflow in ~${timeToOverflow}s — scale consumers or throttle producers`] : []),
          ...(trend === "increasing" ? ["Queue depth trending upward — consider adding consumers"] : []),
          ...(egressRate > 0 && ingressRate / egressRate > 2 ? ["Ingress rate is 2x+ egress rate — significant imbalance"] : []),
        ],
      },
    };
  });
}
