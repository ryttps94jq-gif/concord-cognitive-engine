// server/domains/attention.js
// Domain actions for attention/focus management: focus scoring, priority matrix, attention budgeting.

export default function registerAttentionActions(registerLensAction) {
  /**
   * focusScore
   * Calculate focus quality from activity data — session duration, interruption
   * frequency, context-switching cost, deep work ratio.
   * artifact.data.sessions: [{ id, startTime, endTime, taskId, interruptions?: number, deepWork?: boolean }]
   * params.deepWorkMinMinutes — minimum uninterrupted minutes to count as deep work (default 25)
   * params.contextSwitchCostMinutes — estimated cost of each context switch in minutes (default 15)
   */
  registerLensAction("attention", "focusScore", (ctx, artifact, params) => {
    const sessions = artifact.data.sessions || [];
    if (sessions.length === 0) {
      return { ok: true, result: { message: "No session data provided." } };
    }

    const deepWorkMinMinutes = params.deepWorkMinMinutes || 25;
    const contextSwitchCostMinutes = params.contextSwitchCostMinutes || 15;

    // Process sessions
    const processed = sessions.map(s => {
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      const durationMinutes = (end - start) / 60000;
      const interruptions = s.interruptions || 0;
      const isDeepWork = s.deepWork !== undefined ? s.deepWork : (durationMinutes >= deepWorkMinMinutes && interruptions === 0);

      return {
        id: s.id,
        taskId: s.taskId,
        durationMinutes: Math.round(durationMinutes * 100) / 100,
        interruptions,
        isDeepWork,
        interruptionRate: durationMinutes > 0 ? Math.round((interruptions / (durationMinutes / 60)) * 100) / 100 : 0,
      };
    }).filter(s => s.durationMinutes > 0);

    const totalMinutes = processed.reduce((s, p) => s + p.durationMinutes, 0);
    const totalInterruptions = processed.reduce((s, p) => s + p.interruptions, 0);
    const deepWorkSessions = processed.filter(p => p.isDeepWork);
    const deepWorkMinutes = deepWorkSessions.reduce((s, p) => s + p.durationMinutes, 0);
    const deepWorkRatio = totalMinutes > 0 ? Math.round((deepWorkMinutes / totalMinutes) * 10000) / 100 : 0;

    // Context switching: count unique task transitions
    const taskSequence = processed.map(p => p.taskId);
    let contextSwitches = 0;
    for (let i = 1; i < taskSequence.length; i++) {
      if (taskSequence[i] !== taskSequence[i - 1]) contextSwitches++;
    }
    const contextSwitchCostTotal = Math.round(contextSwitches * contextSwitchCostMinutes * 100) / 100;
    const effectiveMinutes = Math.max(0, totalMinutes - contextSwitchCostTotal);

    // Average session duration
    const avgSessionDuration = processed.length > 0
      ? Math.round((totalMinutes / processed.length) * 100) / 100
      : 0;

    // Longest uninterrupted streak
    let longestStreak = 0;
    let currentStreak = 0;
    for (const s of processed) {
      if (s.interruptions === 0) {
        currentStreak += s.durationMinutes;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Focus score: 0-100 composite
    // Components: deep work ratio (40%), interruption frequency (25%),
    // context switching (20%), session length (15%)
    const interruptionScore = totalMinutes > 0
      ? Math.max(0, 100 - (totalInterruptions / (totalMinutes / 60)) * 10)
      : 100;
    const switchScore = processed.length > 1
      ? Math.max(0, 100 - (contextSwitches / (processed.length - 1)) * 100)
      : 100;
    const sessionLengthScore = Math.min(100, (avgSessionDuration / 60) * 100);

    const focusScore = Math.round((
      deepWorkRatio * 0.4 +
      interruptionScore * 0.25 +
      switchScore * 0.2 +
      sessionLengthScore * 0.15
    ) * 100) / 100;

    const focusLevel = focusScore >= 80 ? "excellent"
      : focusScore >= 60 ? "good"
      : focusScore >= 40 ? "moderate"
      : focusScore >= 20 ? "poor"
      : "very-poor";

    // Per-task breakdown
    const taskBreakdown = {};
    for (const s of processed) {
      if (!taskBreakdown[s.taskId]) {
        taskBreakdown[s.taskId] = { totalMinutes: 0, sessionCount: 0, interruptions: 0, deepWorkMinutes: 0 };
      }
      taskBreakdown[s.taskId].totalMinutes += s.durationMinutes;
      taskBreakdown[s.taskId].sessionCount++;
      taskBreakdown[s.taskId].interruptions += s.interruptions;
      if (s.isDeepWork) taskBreakdown[s.taskId].deepWorkMinutes += s.durationMinutes;
    }

    for (const taskId of Object.keys(taskBreakdown)) {
      const t = taskBreakdown[taskId];
      t.totalMinutes = Math.round(t.totalMinutes * 100) / 100;
      t.deepWorkMinutes = Math.round(t.deepWorkMinutes * 100) / 100;
      t.deepWorkRatio = t.totalMinutes > 0 ? Math.round((t.deepWorkMinutes / t.totalMinutes) * 10000) / 100 : 0;
    }

    const result = {
      analyzedAt: new Date().toISOString(),
      sessionCount: processed.length,
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      effectiveMinutes: Math.round(effectiveMinutes * 100) / 100,
      focusScore,
      focusLevel,
      deepWork: {
        sessions: deepWorkSessions.length,
        minutes: Math.round(deepWorkMinutes * 100) / 100,
        ratio: deepWorkRatio,
      },
      interruptions: {
        total: totalInterruptions,
        perHour: totalMinutes > 0 ? Math.round((totalInterruptions / (totalMinutes / 60)) * 100) / 100 : 0,
      },
      contextSwitching: {
        switches: contextSwitches,
        costMinutes: contextSwitchCostTotal,
        uniqueTasks: new Set(taskSequence).size,
      },
      avgSessionDuration,
      longestUninterruptedStreak: Math.round(longestStreak * 100) / 100,
      componentScores: {
        deepWorkScore: deepWorkRatio,
        interruptionScore: Math.round(interruptionScore * 100) / 100,
        switchScore: Math.round(switchScore * 100) / 100,
        sessionLengthScore: Math.round(sessionLengthScore * 100) / 100,
      },
      taskBreakdown,
    };

    artifact.data.focusScore = result;
    return { ok: true, result };
  });

  /**
   * priorityMatrix
   * Eisenhower matrix + weighted scoring — urgency/importance with diminishing
   * returns curves, compute optimal task ordering.
   * artifact.data.tasks: [{ id, name, urgency: 0-10, importance: 0-10, effort?: hours, deadline?, dependencies?: [taskId] }]
   * params.urgencyDecay — diminishing returns exponent for urgency (default 0.7)
   * params.importanceDecay — diminishing returns exponent for importance (default 0.8)
   */
  registerLensAction("attention", "priorityMatrix", (ctx, artifact, params) => {
    const tasks = artifact.data.tasks || [];
    if (tasks.length === 0) {
      return { ok: true, result: { message: "No tasks provided for prioritization." } };
    }

    const urgencyDecay = params.urgencyDecay || 0.7;
    const importanceDecay = params.importanceDecay || 0.8;
    const now = new Date();

    // Apply diminishing returns: f(x) = x^decay (normalized 0-1)
    function diminishing(value, decay) {
      const normalized = Math.max(0, Math.min(1, value / 10));
      return Math.pow(normalized, decay);
    }

    const scored = tasks.map(task => {
      let urgency = parseFloat(task.urgency) || 0;
      const importance = parseFloat(task.importance) || 0;
      const effort = parseFloat(task.effort) || 1;

      // Boost urgency based on deadline proximity
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const hoursUntilDeadline = (deadlineDate - now) / 3600000;
        if (hoursUntilDeadline < 0) {
          urgency = 10; // Overdue
        } else if (hoursUntilDeadline < 24) {
          urgency = Math.max(urgency, 9);
        } else if (hoursUntilDeadline < 72) {
          urgency = Math.max(urgency, 7);
        }
      }

      const urgencyScore = diminishing(urgency, urgencyDecay);
      const importanceScore = diminishing(importance, importanceDecay);

      // Eisenhower quadrant
      let quadrant;
      if (urgency >= 5 && importance >= 5) quadrant = "do-first";
      else if (urgency < 5 && importance >= 5) quadrant = "schedule";
      else if (urgency >= 5 && importance < 5) quadrant = "delegate";
      else quadrant = "eliminate";

      // Priority score: weighted combination with effort penalty
      const effortPenalty = 1 / (1 + Math.log2(effort));
      const priorityScore = Math.round(
        (urgencyScore * 0.45 + importanceScore * 0.55) * effortPenalty * 10000
      ) / 100;

      return {
        id: task.id,
        name: task.name,
        rawUrgency: task.urgency,
        adjustedUrgency: Math.round(urgency * 100) / 100,
        rawImportance: task.importance,
        urgencyScore: Math.round(urgencyScore * 10000) / 10000,
        importanceScore: Math.round(importanceScore * 10000) / 10000,
        effort,
        effortPenalty: Math.round(effortPenalty * 10000) / 10000,
        quadrant,
        priorityScore,
        deadline: task.deadline || null,
        dependencies: task.dependencies || [],
      };
    });

    // Topological sort respecting dependencies for optimal ordering
    const taskMap = {};
    for (const t of scored) taskMap[t.id] = t;

    // Simple topological sort with priority tie-breaking
    const order = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(taskId) {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) return; // Cycle detected, skip
      visiting.add(taskId);

      const task = taskMap[taskId];
      if (task) {
        for (const dep of task.dependencies) {
          if (taskMap[dep]) visit(dep);
        }
      }
      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    }

    // Visit in priority order (highest first)
    const sortedByPriority = [...scored].sort((a, b) => b.priorityScore - a.priorityScore);
    for (const task of sortedByPriority) {
      visit(task.id);
    }

    // Quadrant summary
    const quadrants = {
      "do-first": scored.filter(t => t.quadrant === "do-first").sort((a, b) => b.priorityScore - a.priorityScore),
      "schedule": scored.filter(t => t.quadrant === "schedule").sort((a, b) => b.priorityScore - a.priorityScore),
      "delegate": scored.filter(t => t.quadrant === "delegate").sort((a, b) => b.priorityScore - a.priorityScore),
      "eliminate": scored.filter(t => t.quadrant === "eliminate").sort((a, b) => b.priorityScore - a.priorityScore),
    };

    const result = {
      analyzedAt: new Date().toISOString(),
      taskCount: tasks.length,
      optimalOrder: order.map(id => ({ id, name: taskMap[id]?.name, priorityScore: taskMap[id]?.priorityScore })),
      quadrants: {
        "do-first": { count: quadrants["do-first"].length, tasks: quadrants["do-first"] },
        "schedule": { count: quadrants["schedule"].length, tasks: quadrants["schedule"] },
        "delegate": { count: quadrants["delegate"].length, tasks: quadrants["delegate"] },
        "eliminate": { count: quadrants["eliminate"].length, tasks: quadrants["eliminate"] },
      },
      allTasks: sortedByPriority,
      decayParams: { urgencyDecay, importanceDecay },
    };

    artifact.data.priorityMatrix = result;
    return { ok: true, result };
  });

  /**
   * attentionBudget
   * Budget attention across tasks — distribute cognitive load, predict fatigue
   * using logarithmic decay model.
   * artifact.data.tasks: [{ id, name, cognitiveLoad: 1-10, estimatedMinutes, priority?: 1-10 }]
   * params.totalAvailableMinutes — total time budget (default 480, i.e., 8 hours)
   * params.fatigueHalfLife — minutes until cognitive capacity halves (default 90)
   * params.breakDurationMinutes — break duration between tasks (default 10)
   */
  registerLensAction("attention", "attentionBudget", (ctx, artifact, params) => {
    const tasks = artifact.data.tasks || [];
    if (tasks.length === 0) {
      return { ok: true, result: { message: "No tasks provided for attention budgeting." } };
    }

    const totalAvailableMinutes = params.totalAvailableMinutes || 480;
    const fatigueHalfLife = params.fatigueHalfLife || 90;
    const breakDuration = params.breakDurationMinutes || 10;

    // Logarithmic fatigue model: capacity = 1 / (1 + ln(1 + t / halfLife))
    function fatigueMultiplier(elapsedMinutes) {
      return 1 / (1 + Math.log(1 + elapsedMinutes / fatigueHalfLife));
    }

    // Sort tasks by priority * cognitiveLoad (high cognitive tasks first when fresh)
    const scored = tasks.map(t => ({
      id: t.id,
      name: t.name,
      cognitiveLoad: Math.max(1, Math.min(10, t.cognitiveLoad || 5)),
      estimatedMinutes: parseFloat(t.estimatedMinutes) || 30,
      priority: parseFloat(t.priority) || 5,
      // High cognitive + high priority tasks should be scheduled when fresh
      schedulingScore: (parseFloat(t.priority) || 5) * (t.cognitiveLoad || 5),
    })).sort((a, b) => b.schedulingScore - a.schedulingScore);

    // Allocate time slots with fatigue tracking
    let elapsedMinutes = 0;
    const schedule = [];
    let totalAllocated = 0;
    const unscheduled = [];

    for (const task of scored) {
      if (elapsedMinutes >= totalAvailableMinutes) {
        unscheduled.push({ id: task.id, name: task.name, reason: "no-time-remaining" });
        continue;
      }

      const fatigue = fatigueMultiplier(elapsedMinutes);
      // Actual time needed increases as fatigue grows (inverse of capacity)
      const adjustedDuration = Math.round((task.estimatedMinutes / fatigue) * 100) / 100;

      // Check if task fits in remaining budget
      const remainingMinutes = totalAvailableMinutes - elapsedMinutes;
      if (adjustedDuration > remainingMinutes) {
        // Partial allocation
        const partialMinutes = remainingMinutes;
        const completionPct = Math.round((partialMinutes / adjustedDuration) * 10000) / 100;
        schedule.push({
          id: task.id,
          name: task.name,
          startMinute: Math.round(elapsedMinutes),
          allocatedMinutes: Math.round(partialMinutes * 100) / 100,
          estimatedMinutes: task.estimatedMinutes,
          adjustedDuration: Math.round(adjustedDuration * 100) / 100,
          fatigueMultiplier: Math.round(fatigue * 10000) / 10000,
          cognitiveLoad: task.cognitiveLoad,
          completionPct,
          partial: true,
        });
        totalAllocated += partialMinutes;
        elapsedMinutes += partialMinutes;
        break;
      }

      schedule.push({
        id: task.id,
        name: task.name,
        startMinute: Math.round(elapsedMinutes),
        allocatedMinutes: Math.round(adjustedDuration * 100) / 100,
        estimatedMinutes: task.estimatedMinutes,
        adjustedDuration: Math.round(adjustedDuration * 100) / 100,
        fatigueMultiplier: Math.round(fatigue * 10000) / 10000,
        cognitiveLoad: task.cognitiveLoad,
        completionPct: 100,
        partial: false,
      });

      totalAllocated += adjustedDuration;
      elapsedMinutes += adjustedDuration;

      // Add break between tasks
      if (elapsedMinutes < totalAvailableMinutes) {
        elapsedMinutes += breakDuration;
      }
    }

    // Fatigue curve: capacity at key intervals
    const fatigueCurve = [];
    for (let t = 0; t <= totalAvailableMinutes; t += 30) {
      fatigueCurve.push({
        minute: t,
        capacity: Math.round(fatigueMultiplier(t) * 10000) / 10000,
        label: `${Math.floor(t / 60)}h${t % 60 > 0 ? (t % 60) + "m" : ""}`,
      });
    }

    // Cognitive load distribution
    const totalCogLoad = schedule.reduce((s, t) => s + t.cognitiveLoad * t.allocatedMinutes, 0);
    const avgCogLoad = totalAllocated > 0
      ? Math.round((totalCogLoad / totalAllocated) * 100) / 100
      : 0;

    // Efficiency: ratio of base estimated time to fatigue-adjusted time
    const baseTotal = schedule.reduce((s, t) => s + t.estimatedMinutes, 0);
    const efficiency = baseTotal > 0
      ? Math.round((baseTotal / totalAllocated) * 10000) / 100
      : 100;

    const result = {
      analyzedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      scheduledTasks: schedule.length,
      unscheduledTasks: unscheduled,
      totalAvailableMinutes,
      totalAllocatedMinutes: Math.round(totalAllocated * 100) / 100,
      remainingMinutes: Math.round(Math.max(0, totalAvailableMinutes - elapsedMinutes) * 100) / 100,
      efficiency,
      avgCognitiveLoad: avgCogLoad,
      schedule,
      fatigueCurve,
      fatigueModel: {
        halfLife: fatigueHalfLife,
        breakDuration,
        formula: "capacity = 1 / (1 + ln(1 + elapsed / halfLife))",
      },
    };

    artifact.data.attentionBudget = result;
    return { ok: true, result };
  });
}
