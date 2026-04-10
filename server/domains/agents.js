// server/domains/agents.js
// Domain actions for autonomous agents: capability scoring, task routing,
// swarm coordination, performance benchmarking, policy compliance.

export default function registerAgentsActions(registerLensAction) {
  registerLensAction("agents", "evaluateCapability", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const skills = data.skills || [];
    const taskHistory = data.taskHistory || [];
    const successRate = taskHistory.length > 0
      ? taskHistory.filter(t => t.success || t.status === "completed").length / taskHistory.length : 0;
    const avgLatency = taskHistory.length > 0
      ? taskHistory.reduce((s, t) => s + (parseFloat(t.latencyMs) || 0), 0) / taskHistory.length : 0;
    const skillCoverage = skills.length;
    const capabilityScore = Math.round((successRate * 40 + Math.min(skillCoverage / 10, 1) * 30 + Math.max(0, 1 - avgLatency / 5000) * 30) * 100) / 100;
    return {
      ok: true, result: {
        agentName: data.name || artifact.title,
        capabilityScore,
        successRate: Math.round(successRate * 100),
        avgLatencyMs: Math.round(avgLatency),
        skillCount: skillCoverage,
        tasksCompleted: taskHistory.filter(t => t.success || t.status === "completed").length,
        totalTasks: taskHistory.length,
        tier: capabilityScore >= 80 ? "Elite" : capabilityScore >= 60 ? "Proficient" : capabilityScore >= 40 ? "Developing" : "Novice",
        recommendations: [
          successRate < 0.7 ? "Improve task completion reliability" : null,
          avgLatency > 3000 ? "Optimize response latency" : null,
          skillCoverage < 5 ? "Expand skill repertoire" : null,
        ].filter(Boolean),
      },
    };
  });

  registerLensAction("agents", "routeTask", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const task = data.task || {};
    const agents = data.agents || [];
    if (agents.length === 0) return { ok: true, result: { message: "No agents available for routing." } };
    const taskSkills = task.requiredSkills || [];
    const scored = agents.map(a => {
      const agentSkills = (a.skills || []).map(s => s.toLowerCase());
      const skillMatch = taskSkills.filter(s => agentSkills.includes(s.toLowerCase())).length;
      const skillScore = taskSkills.length > 0 ? skillMatch / taskSkills.length : 0.5;
      const loadScore = Math.max(0, 1 - (parseInt(a.currentLoad) || 0) / 10);
      const reliabilityScore = parseFloat(a.reliability) || 0.5;
      const total = Math.round((skillScore * 0.5 + loadScore * 0.25 + reliabilityScore * 0.25) * 100);
      return { name: a.name, score: total, skillMatch, currentLoad: a.currentLoad || 0, reliability: reliabilityScore };
    }).sort((a, b) => b.score - a.score);
    return { ok: true, result: { task: task.name || "Unnamed task", bestAgent: scored[0]?.name, rankings: scored.slice(0, 5), totalAgents: agents.length } };
  });

  registerLensAction("agents", "swarmStatus", (ctx, artifact, _params) => {
    const agents = artifact.data?.agents || [];
    const active = agents.filter(a => a.status === "active" || a.status === "running");
    const idle = agents.filter(a => a.status === "idle");
    const errored = agents.filter(a => a.status === "error" || a.status === "failed");
    const totalTasks = agents.reduce((s, a) => s + (parseInt(a.tasksCompleted) || 0), 0);
    const avgLoad = agents.length > 0 ? agents.reduce((s, a) => s + (parseInt(a.currentLoad) || 0), 0) / agents.length : 0;
    return {
      ok: true, result: {
        totalAgents: agents.length, active: active.length, idle: idle.length, errored: errored.length,
        totalTasksCompleted: totalTasks, avgLoad: Math.round(avgLoad * 10) / 10,
        healthScore: agents.length > 0 ? Math.round(((active.length + idle.length) / agents.length) * 100) : 0,
        alerts: errored.length > 0 ? [`${errored.length} agent(s) in error state`] : [],
      },
    };
  });

  registerLensAction("agents", "benchmarkAgent", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const metrics = data.metrics || {};
    const throughput = parseFloat(metrics.tasksPerMinute) || 0;
    const accuracy = parseFloat(metrics.accuracy) || 0;
    const uptime = parseFloat(metrics.uptimePercent) || 99;
    const memoryMB = parseFloat(metrics.memoryMB) || 0;
    const score = Math.round((throughput / 10 * 25 + accuracy * 25 + uptime / 100 * 25 + Math.max(0, 1 - memoryMB / 1024) * 25) * 100) / 100;
    return {
      ok: true, result: {
        agentName: data.name || artifact.title, benchmarkScore: Math.min(100, score),
        metrics: { throughput, accuracy: Math.round(accuracy * 100), uptimePercent: uptime, memoryMB },
        grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F",
      },
    };
  });
}
