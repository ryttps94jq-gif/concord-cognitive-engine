// server/domains/goals.js
// Domain actions for goal tracking and OKR management: OKR scoring,
// goal decomposition, and progress forecasting.

export default function registerGoalsActions(registerLensAction) {
  /**
   * okrScoring
   * Score OKR progress with weighted key result completion, confidence-adjusted
   * projections, and red/yellow/green status determination.
   * artifact.data.objectives = [{
   *   id, title, weight?,
   *   keyResults: [{ id, title, target, current, unit?, weight?, confidence?, startValue? }]
   * }]
   * params.periodEndDate (optional), params.periodStartDate (optional)
   */
  registerLensAction("goals", "okrScoring", (ctx, artifact, params) => {
    const objectives = artifact.data?.objectives || [];
    if (objectives.length === 0) {
      return { ok: true, result: { message: "No objectives provided." } };
    }

    const periodStart = params.periodStartDate ? new Date(params.periodStartDate).getTime() : null;
    const periodEnd = params.periodEndDate ? new Date(params.periodEndDate).getTime() : null;
    const now = Date.now();
    const periodProgress = periodStart && periodEnd && periodEnd > periodStart
      ? Math.min(1, Math.max(0, (now - periodStart) / (periodEnd - periodStart)))
      : null;

    const objectiveResults = [];
    let overallWeightedScore = 0;
    let overallWeightTotal = 0;

    for (const obj of objectives) {
      const keyResults = obj.keyResults || [];
      const objWeight = obj.weight || 1;

      let krWeightedScore = 0;
      let krWeightTotal = 0;
      const krResults = [];

      for (const kr of keyResults) {
        const target = kr.target ?? 100;
        const current = kr.current ?? 0;
        const startValue = kr.startValue ?? 0;
        const weight = kr.weight || 1;
        const confidence = kr.confidence != null ? Math.max(0, Math.min(1, kr.confidence)) : 1;

        // Calculate raw progress (handle both increasing and decreasing targets)
        const range = target - startValue;
        const rawProgress = range !== 0 ? (current - startValue) / range : (current >= target ? 1 : 0);
        const progress = Math.max(0, Math.min(1.5, rawProgress)); // cap at 150%

        // Confidence-adjusted score
        const adjustedScore = progress * confidence;

        // Determine status
        let status;
        if (periodProgress !== null) {
          const expectedProgress = periodProgress;
          const ratio = expectedProgress > 0 ? progress / expectedProgress : (progress > 0 ? 1.5 : 0.5);
          if (ratio >= 0.8) status = "green";
          else if (ratio >= 0.5) status = "yellow";
          else status = "red";
        } else {
          if (progress >= 0.7) status = "green";
          else if (progress >= 0.4) status = "yellow";
          else status = "red";
        }

        // Projected completion
        let projectedCompletion = null;
        if (periodProgress !== null && periodProgress > 0.05 && progress > 0) {
          const projectedFinalProgress = progress / periodProgress;
          projectedCompletion = Math.round(Math.min(2, projectedFinalProgress) * 10000) / 100;
        }

        krResults.push({
          id: kr.id,
          title: kr.title,
          target,
          current,
          unit: kr.unit,
          progress: Math.round(progress * 10000) / 100,
          confidence,
          adjustedScore: Math.round(adjustedScore * 10000) / 100,
          status,
          projectedCompletion,
          onTrack: status === "green",
        });

        krWeightedScore += adjustedScore * weight;
        krWeightTotal += weight;
      }

      const objectiveScore = krWeightTotal > 0
        ? krWeightedScore / krWeightTotal
        : 0;

      const objectiveStatus =
        objectiveScore >= 0.7 ? "green" :
        objectiveScore >= 0.4 ? "yellow" : "red";

      objectiveResults.push({
        id: obj.id,
        title: obj.title,
        weight: objWeight,
        score: Math.round(objectiveScore * 10000) / 100,
        status: objectiveStatus,
        keyResults: krResults,
        krCount: krResults.length,
        krOnTrack: krResults.filter(kr => kr.onTrack).length,
        krAtRisk: krResults.filter(kr => kr.status === "yellow").length,
        krOffTrack: krResults.filter(kr => kr.status === "red").length,
      });

      overallWeightedScore += objectiveScore * objWeight;
      overallWeightTotal += objWeight;
    }

    const overallScore = overallWeightTotal > 0
      ? overallWeightedScore / overallWeightTotal
      : 0;

    const overallStatus =
      overallScore >= 0.7 ? "green" :
      overallScore >= 0.4 ? "yellow" : "red";

    // Summary statistics
    const allKRs = objectiveResults.flatMap(o => o.keyResults);
    const totalKRs = allKRs.length;

    return {
      ok: true,
      result: {
        overallScore: Math.round(overallScore * 10000) / 100,
        overallStatus,
        periodProgress: periodProgress !== null ? Math.round(periodProgress * 10000) / 100 : null,
        objectives: objectiveResults,
        summary: {
          objectiveCount: objectives.length,
          totalKeyResults: totalKRs,
          onTrack: allKRs.filter(kr => kr.status === "green").length,
          atRisk: allKRs.filter(kr => kr.status === "yellow").length,
          offTrack: allKRs.filter(kr => kr.status === "red").length,
          avgProgress: Math.round(allKRs.reduce((s, kr) => s + kr.progress, 0) / Math.max(totalKRs, 1) * 100) / 100,
          avgConfidence: Math.round(allKRs.reduce((s, kr) => s + kr.confidence, 0) / Math.max(totalKRs, 1) * 1000) / 1000,
        },
      },
    };
  });

  /**
   * goalDecomposition
   * Decompose goals into sub-goals with dependency graph, critical path
   * identification, and resource allocation.
   * artifact.data.goals = [{
   *   id, title, duration?, effort?, resources?: [], dependencies?: [goalId],
   *   subGoals?: [{ id, title, duration?, effort?, dependencies? }]
   * }]
   */
  registerLensAction("goals", "goalDecomposition", (ctx, artifact, _params) => {
    const goals = artifact.data?.goals || [];
    if (goals.length === 0) {
      return { ok: true, result: { message: "No goals provided." } };
    }

    // Flatten goals and sub-goals into a single task list
    const tasks = [];
    const taskMap = {};

    for (const goal of goals) {
      const task = {
        id: goal.id,
        title: goal.title,
        duration: goal.duration || 1,
        effort: goal.effort || goal.duration || 1,
        resources: goal.resources || [],
        dependencies: goal.dependencies || [],
        isSubGoal: false,
        parentId: null,
      };
      tasks.push(task);
      taskMap[task.id] = task;

      for (const sub of (goal.subGoals || [])) {
        const subTask = {
          id: sub.id,
          title: sub.title,
          duration: sub.duration || 1,
          effort: sub.effort || sub.duration || 1,
          resources: sub.resources || [],
          dependencies: sub.dependencies || [goal.id],
          isSubGoal: true,
          parentId: goal.id,
        };
        tasks.push(subTask);
        taskMap[subTask.id] = subTask;
      }
    }

    // Validate dependencies
    const invalidDeps = [];
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskMap[depId]) {
          invalidDeps.push({ taskId: task.id, missingDependency: depId });
        }
      }
    }

    // Topological sort for scheduling
    const inDegree = {};
    const adjList = {};
    for (const task of tasks) {
      inDegree[task.id] = 0;
      adjList[task.id] = [];
    }
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (taskMap[dep]) {
          adjList[dep].push(task.id);
          inDegree[task.id]++;
        }
      }
    }

    // Kahn's algorithm
    const topoOrder = [];
    const queue = [];
    for (const task of tasks) {
      if (inDegree[task.id] === 0) queue.push(task.id);
    }
    const tempInDegree = { ...inDegree };
    while (queue.length > 0) {
      const id = queue.shift();
      topoOrder.push(id);
      for (const neighbor of adjList[id]) {
        tempInDegree[neighbor]--;
        if (tempInDegree[neighbor] === 0) queue.push(neighbor);
      }
    }

    const hasCycle = topoOrder.length < tasks.length;
    const cyclicTasks = hasCycle ? tasks.filter(t => !topoOrder.includes(t.id)).map(t => t.id) : [];

    // Forward pass: compute earliest start and finish times
    const earliest = {};
    for (const id of topoOrder) {
      const task = taskMap[id];
      let es = 0;
      for (const dep of task.dependencies) {
        if (earliest[dep]) {
          es = Math.max(es, earliest[dep].finish);
        }
      }
      earliest[id] = { start: es, finish: es + task.duration };
    }

    // Project duration
    const projectDuration = Math.max(...Object.values(earliest).map(e => e.finish), 0);

    // Backward pass: compute latest start and finish times
    const latest = {};
    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const task = taskMap[id];
      let lf = projectDuration;
      for (const successor of adjList[id]) {
        if (latest[successor]) {
          lf = Math.min(lf, latest[successor].start);
        }
      }
      latest[id] = { start: lf - task.duration, finish: lf };
    }

    // Compute slack and identify critical path
    const taskSchedules = [];
    const criticalPath = [];
    for (const id of topoOrder) {
      const task = taskMap[id];
      const e = earliest[id] || { start: 0, finish: task.duration };
      const l = latest[id] || { start: 0, finish: task.duration };
      const slack = l.start - e.start;
      const isCritical = Math.abs(slack) < 0.001;

      if (isCritical) criticalPath.push(id);

      taskSchedules.push({
        id,
        title: task.title,
        duration: task.duration,
        effort: task.effort,
        dependencies: task.dependencies,
        isSubGoal: task.isSubGoal,
        parentId: task.parentId,
        earliestStart: e.start,
        earliestFinish: e.finish,
        latestStart: l.start,
        latestFinish: l.finish,
        slack,
        isCritical,
      });
    }

    // Resource allocation analysis
    const resourceLoad = {};
    for (const task of tasks) {
      for (const resource of task.resources) {
        if (!resourceLoad[resource]) resourceLoad[resource] = { totalEffort: 0, taskCount: 0, tasks: [] };
        resourceLoad[resource].totalEffort += task.effort;
        resourceLoad[resource].taskCount++;
        resourceLoad[resource].tasks.push(task.id);
      }
    }

    // Resource conflicts: find resources assigned to concurrent tasks
    const resourceConflicts = [];
    for (const [resource, load] of Object.entries(resourceLoad)) {
      const concurrentPairs = [];
      for (let i = 0; i < load.tasks.length; i++) {
        for (let j = i + 1; j < load.tasks.length; j++) {
          const eA = earliest[load.tasks[i]];
          const eB = earliest[load.tasks[j]];
          if (eA && eB) {
            // Check overlap
            if (eA.start < eB.finish && eB.start < eA.finish) {
              concurrentPairs.push([load.tasks[i], load.tasks[j]]);
            }
          }
        }
      }
      if (concurrentPairs.length > 0) {
        resourceConflicts.push({ resource, concurrentPairs });
      }
    }

    // Depth of decomposition
    function getDepth(taskId, visited = new Set()) {
      if (visited.has(taskId)) return 0;
      visited.add(taskId);
      const children = tasks.filter(t => t.parentId === taskId);
      if (children.length === 0) return 0;
      return 1 + Math.max(...children.map(c => getDepth(c.id, visited)));
    }
    const maxDepth = Math.max(...goals.map(g => getDepth(g.id)), 0);

    return {
      ok: true,
      result: {
        totalTasks: tasks.length,
        topLevelGoals: goals.length,
        subGoalCount: tasks.filter(t => t.isSubGoal).length,
        maxDecompositionDepth: maxDepth,
        projectDuration,
        criticalPath: { length: criticalPath.length, tasks: criticalPath },
        hasCycle,
        cyclicTasks,
        invalidDependencies: invalidDeps,
        schedule: taskSchedules,
        resourceAllocation: Object.entries(resourceLoad).map(([resource, load]) => ({
          resource,
          totalEffort: load.totalEffort,
          taskCount: load.taskCount,
          tasks: load.tasks,
        })),
        resourceConflicts,
      },
    };
  });

  /**
   * progressForecast
   * Forecast goal completion using linear regression on historical progress data.
   * Trend extrapolation with confidence bands.
   * artifact.data.history = [{ date, progress }] (progress: 0-100)
   * artifact.data.target = number (target progress, default 100)
   * params.confidenceLevel (default 0.95)
   */
  registerLensAction("goals", "progressForecast", (ctx, artifact, params) => {
    const history = artifact.data?.history || [];
    const target = artifact.data?.target ?? 100;
    const confidenceLevel = params.confidenceLevel || 0.95;

    if (history.length < 2) {
      return { ok: true, result: { message: "Need at least 2 historical data points for forecasting." } };
    }

    // Convert dates to numeric (days from first date)
    const sorted = [...history]
      .map(h => ({ date: h.date, progress: h.progress, time: new Date(h.date).getTime() }))
      .filter(h => !isNaN(h.time))
      .sort((a, b) => a.time - b.time);

    if (sorted.length < 2) {
      return { ok: true, result: { message: "Need at least 2 valid dated data points." } };
    }

    const t0 = sorted[0].time;
    const msPerDay = 86400000;
    const xs = sorted.map(h => (h.time - t0) / msPerDay);
    const ys = sorted.map(h => h.progress);
    const n = xs.length;

    // Linear regression: y = slope * x + intercept
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);

    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const yMean = sumY / n;
    const ssRes = ys.reduce((s, y, i) => s + Math.pow(y - (slope * xs[i] + intercept), 2), 0);
    const ssTot = ys.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Standard error
    const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const xMean = sumX / n;
    const sxx = xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);

    // t-value approximation for confidence interval
    // For simplicity, use z-values for common confidence levels
    const zValues = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
    const z = zValues[confidenceLevel] || 1.96;

    // Forecast: when does progress reach target?
    let forecastDays = null;
    let forecastDate = null;
    if (slope > 0) {
      forecastDays = (target - intercept) / slope;
      if (forecastDays > 0) {
        forecastDate = new Date(t0 + forecastDays * msPerDay).toISOString().split("T")[0];
      }
    }

    // Current rate (progress per day)
    const currentProgress = ys[ys.length - 1];
    const daysElapsed = xs[xs.length - 1];

    // Generate forecast points with confidence bands
    const lastDay = xs[xs.length - 1];
    const forecastHorizon = forecastDays ? Math.min(forecastDays * 1.5, lastDay + 365) : lastDay + 90;
    const forecastPoints = [];
    const step = Math.max(1, Math.round((forecastHorizon - lastDay) / 20));

    for (let day = lastDay; day <= forecastHorizon; day += step) {
      const predicted = slope * day + intercept;
      // Prediction interval width
      const piWidth = z * se * Math.sqrt(1 + 1 / n + Math.pow(day - xMean, 2) / sxx);

      forecastPoints.push({
        day: Math.round(day),
        date: new Date(t0 + day * msPerDay).toISOString().split("T")[0],
        predicted: Math.round(predicted * 100) / 100,
        lower: Math.round((predicted - piWidth) * 100) / 100,
        upper: Math.round((predicted + piWidth) * 100) / 100,
      });

      if (predicted >= target) break;
    }

    // Velocity analysis
    const velocities = [];
    for (let i = 1; i < sorted.length; i++) {
      const dayDelta = (sorted[i].time - sorted[i - 1].time) / msPerDay;
      const progressDelta = sorted[i].progress - sorted[i - 1].progress;
      velocities.push({
        period: `${sorted[i - 1].date} to ${sorted[i].date}`,
        days: Math.round(dayDelta * 10) / 10,
        progressDelta: Math.round(progressDelta * 100) / 100,
        velocity: dayDelta > 0 ? Math.round((progressDelta / dayDelta) * 1000) / 1000 : 0,
      });
    }

    const avgVelocity = velocities.length > 0
      ? velocities.reduce((s, v) => s + v.velocity, 0) / velocities.length
      : 0;

    // Trend assessment
    let trendAssessment;
    if (slope > avgVelocity * 1.2) trendAssessment = "accelerating";
    else if (slope > 0) trendAssessment = "steady progress";
    else if (Math.abs(slope) < 0.01) trendAssessment = "stalled";
    else trendAssessment = "declining";

    // Days remaining estimate with confidence band
    let daysRemainingLower = null;
    let daysRemainingUpper = null;
    if (slope > 0) {
      const remaining = target - currentProgress;
      const slopeLower = slope - z * se / Math.sqrt(sxx);
      const slopeUpper = slope + z * se / Math.sqrt(sxx);
      if (slopeUpper > 0) daysRemainingLower = Math.round(remaining / slopeUpper);
      if (slopeLower > 0) daysRemainingUpper = Math.round(remaining / slopeLower);
    }

    const r = (v) => Math.round(v * 10000) / 10000;

    return {
      ok: true,
      result: {
        regression: {
          slope: r(slope),
          intercept: r(intercept),
          rSquared: r(rSquared),
          standardError: r(se),
          fit: rSquared > 0.9 ? "excellent" : rSquared > 0.7 ? "good" : rSquared > 0.5 ? "moderate" : "poor",
          equation: `progress = ${r(slope)} * days + ${r(intercept)}`,
        },
        currentState: {
          progress: currentProgress,
          target,
          remaining: Math.round((target - currentProgress) * 100) / 100,
          daysElapsed: Math.round(daysElapsed),
          percentComplete: Math.round((currentProgress / target) * 10000) / 100,
        },
        forecast: {
          estimatedCompletionDays: forecastDays ? Math.round(forecastDays) : null,
          estimatedCompletionDate: forecastDate,
          daysRemainingBest: daysRemainingLower,
          daysRemainingWorst: daysRemainingUpper,
          confidenceLevel,
          onTrack: forecastDays !== null && forecastDays <= daysElapsed * 3,
        },
        velocity: {
          current: r(slope),
          average: r(avgVelocity),
          trend: trendAssessment,
          history: velocities,
        },
        forecastCurve: forecastPoints,
        dataPoints: sorted.length,
      },
    };
  });
}
