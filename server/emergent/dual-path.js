/**
 * Dual-Path Simulation Engine — Human Path vs Concordos Path
 *
 * For any scenario, runs TWO parallel simulations:
 *   1. Human path: standard parameters, no Concordos assistance
 *   2. Concordos path: same scenario, Concordos optimizes
 *
 * Compares results. Identifies where Concordos adds value.
 * Generates insight DTUs that go through normal governance.
 *
 * Additive only. One file. Plugs into existing worldmodel simulate infra.
 */

import crypto from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function nowISO() {
  return new Date().toISOString();
}

// In-memory store of simulation results
const _simulations = new Map();

// ── Path Simulation ─────────────────────────────────────────────────────────

/**
 * Simulate a single path through a scenario.
 *
 * @param {object} params - Simulation parameters
 * @returns {object} Path result with stability, risk, efficiency, ethics scores
 */
function simulatePath(params) {
  const p = params || {};
  const timeHorizon = Number(p.timeHorizon || 10);
  const baseRisk = clamp01(p.risk || 0.5);
  const baseRedundancy = clamp01(p.redundancy || 0.3);
  const assistance = p.assistance || "none";

  // Concordos modifiers
  const riskReduction = assistance === "concordos" ? clamp01(p.riskReduction || 0.2) : 0;
  const redundancyBoost = assistance === "concordos" ? clamp01(p.redundancyBoost || 0.2) : 0;
  const responseMultiplier = assistance === "concordos" ? clamp01(p.responseTimeMultiplier || 0.6) : 1.0;

  const effectiveRisk = clamp01(baseRisk - riskReduction);
  const effectiveRedundancy = clamp01(baseRedundancy + redundancyBoost);

  // Run time-series simulation
  const outcomeProjections = [];
  const failurePoints = [];
  let cumulativeStability = 1.0;
  let cumulativeEfficiency = 0.5;

  for (let t = 0; t < timeHorizon; t++) {
    // Random event generation (bounded rationality for human, optimized for Concordos)
    const eventRisk = effectiveRisk * (0.8 + Math.random() * 0.4);
    const recovery = effectiveRedundancy * responseMultiplier;

    // Stability degrades with unmitigated risk
    const netImpact = eventRisk - recovery;
    cumulativeStability = clamp01(cumulativeStability - netImpact * 0.1);

    // Efficiency improves with redundancy and response time
    cumulativeEfficiency = clamp01(cumulativeEfficiency + (recovery - eventRisk) * 0.05);

    outcomeProjections.push({
      t,
      stability: Math.round(cumulativeStability * 1000) / 1000,
      risk: Math.round(eventRisk * 1000) / 1000,
      efficiency: Math.round(cumulativeEfficiency * 1000) / 1000,
    });

    // Record failure points (stability drops below 0.3)
    if (cumulativeStability < 0.3) {
      failurePoints.push({ t, stability: cumulativeStability, cause: "stability_collapse" });
    }
  }

  // Ethical score: higher redundancy + lower risk = better ethical outcome
  const ethicalScore = clamp01((effectiveRedundancy + (1 - effectiveRisk)) / 2);

  return {
    assistance,
    stabilityScore: Math.round(cumulativeStability * 1000) / 1000,
    riskProfile: {
      initial: baseRisk,
      effective: effectiveRisk,
      total: Math.round(effectiveRisk * timeHorizon * 100) / 100,
      mitigated: Math.round(riskReduction * timeHorizon * 100) / 100,
    },
    outcomeProjections,
    failurePoints,
    resourceEfficiency: Math.round(cumulativeEfficiency * 1000) / 1000,
    ethicalScore: Math.round(ethicalScore * 1000) / 1000,
    timeHorizon,
    existentialTrace: null, // Populated by runExistentialTrace
  };
}

// ── Existential Trace ───────────────────────────────────────────────────────

/**
 * Run existential traces on a simulated path using qualia channels.
 *
 * @param {object} pathResult - Simulation path result
 * @param {string[]} osChannels - Which Existential OS channels to trace
 * @returns {object} Existential trace data
 */
function runExistentialTrace(pathResult, osChannels) {
  const channels = osChannels || ["probability_os", "resource_os", "ethics_os"];
  const trace = {};

  for (const os of channels) {
    const readings = [];
    for (const point of (pathResult.outcomeProjections || [])) {
      // Map simulation values to qualia-like readings
      let value;
      if (os === "probability_os") {
        value = clamp01(1 - point.risk); // Lower risk = higher confidence
      } else if (os === "resource_os") {
        value = point.efficiency;
      } else if (os === "ethics_os") {
        value = clamp01(point.stability * 0.7 + (1 - point.risk) * 0.3);
      } else if (os === "emergence_os") {
        value = clamp01(point.stability * point.efficiency);
      } else {
        value = point.stability;
      }
      readings.push({ t: point.t, value: Math.round(value * 1000) / 1000 });
    }
    trace[os] = {
      readings,
      avgIntensity: readings.length > 0
        ? Math.round((readings.reduce((s, r) => s + r.value, 0) / readings.length) * 1000) / 1000
        : 0,
    };
  }

  return trace;
}

// ── Comparison Engine ───────────────────────────────────────────────────────

/**
 * Compare human path vs Concordos path results.
 *
 * @param {object} humanPath
 * @param {object} concordPath
 * @returns {object} Comparison analysis
 */
function comparePaths(humanPath, concordPath) {
  const betterPath = concordPath.stabilityScore > humanPath.stabilityScore
    ? "concordos"
    : concordPath.stabilityScore < humanPath.stabilityScore
      ? "human"
      : "equivalent";

  const stabilityDelta = Math.round((concordPath.stabilityScore - humanPath.stabilityScore) * 1000) / 1000;
  const riskReduction = Math.round((humanPath.riskProfile.total - concordPath.riskProfile.total) * 100) / 100;
  const efficiencyGain = Math.round((concordPath.resourceEfficiency - humanPath.resourceEfficiency) * 1000) / 1000;
  const ethicalDelta = Math.round((concordPath.ethicalScore - humanPath.ethicalScore) * 1000) / 1000;

  // Identify key differences
  const keyDifferences = [];
  if (Math.abs(stabilityDelta) > 0.1) {
    keyDifferences.push({
      dimension: "stability",
      humanValue: humanPath.stabilityScore,
      concordValue: concordPath.stabilityScore,
      delta: stabilityDelta,
      significance: "high",
    });
  }
  if (Math.abs(efficiencyGain) > 0.05) {
    keyDifferences.push({
      dimension: "efficiency",
      humanValue: humanPath.resourceEfficiency,
      concordValue: concordPath.resourceEfficiency,
      delta: efficiencyGain,
      significance: efficiencyGain > 0.15 ? "high" : "medium",
    });
  }
  if (concordPath.failurePoints.length !== humanPath.failurePoints.length) {
    keyDifferences.push({
      dimension: "failure_points",
      humanValue: humanPath.failurePoints.length,
      concordValue: concordPath.failurePoints.length,
      delta: humanPath.failurePoints.length - concordPath.failurePoints.length,
      significance: "high",
    });
  }

  // Causal factors
  const causalFactors = [];
  if (riskReduction > 0) {
    causalFactors.push({ factor: "predictive_risk_reduction", contribution: riskReduction });
  }
  if (concordPath.riskProfile.mitigated > 0) {
    causalFactors.push({ factor: "systemic_redundancy", contribution: concordPath.riskProfile.mitigated });
  }
  if (concordPath.resourceEfficiency > humanPath.resourceEfficiency) {
    causalFactors.push({ factor: "optimized_response_time", contribution: efficiencyGain });
  }

  return {
    betterPath,
    stabilityDelta,
    riskReduction,
    efficiencyGain,
    ethicalDelta,
    keyDifferences,
    causalFactors,
  };
}

// ── Insight DTU Generation ──────────────────────────────────────────────────

/**
 * Generate insight DTUs from significant simulation deltas.
 *
 * @param {object} comparison - Path comparison result
 * @param {string} scenarioId
 * @returns {object[]} DTU proposals
 */
function generateInsightDTUs(comparison, scenarioId) {
  const dtus = [];

  if (Math.abs(comparison.stabilityDelta) > 0.1) {
    dtus.push({
      title: `Dual-Path Insight: ${comparison.betterPath === "concordos" ? "Concordos" : "Human"} path more stable for ${scenarioId}`,
      tags: ["simulation", "dual-path", "insight", "stability"],
      claims: [`${comparison.betterPath === "concordos" ? "Concordos" : "Human"} approach yields ${Math.abs(comparison.stabilityDelta * 100).toFixed(1)}% ${comparison.stabilityDelta > 0 ? "higher" : "lower"} stability`],
      source: "dual-path-simulation",
    });
  }

  for (const diff of comparison.keyDifferences) {
    if (diff.significance === "high") {
      dtus.push({
        title: `Simulation Delta: ${diff.dimension} (${scenarioId})`,
        tags: ["simulation", "dual-path", "delta", diff.dimension],
        claims: [`${diff.dimension}: human=${diff.humanValue}, concordos=${diff.concordValue}, delta=${diff.delta}`],
        source: "dual-path-simulation",
      });
    }
  }

  return dtus;
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run a full dual-path simulation.
 *
 * @param {object} scenario
 * @param {string} scenario.scenarioId
 * @param {string} [scenario.hypothesis]
 * @param {object} [scenario.params] - { risk, redundancy, timeHorizon }
 * @param {string[]} [scenario.existentialOSChannels]
 * @returns {object} Full simulation result
 */
export function runDualPathSimulation(scenario) {
  const s = scenario || {};
  const scenarioId = s.scenarioId || uid("sim");
  const params = s.params || {};

  // Step 1: Human path
  const humanPath = simulatePath({
    ...params,
    assistance: "none",
    decisionModel: "human_bounded_rationality",
  });

  // Step 2: Concordos path
  const concordPath = simulatePath({
    ...params,
    assistance: "concordos",
    decisionModel: "constraint_optimized",
    riskReduction: params.riskReduction || 0.2,
    redundancyBoost: params.redundancyBoost || 0.2,
    responseTimeMultiplier: params.responseTimeMultiplier || 0.6,
  });

  // Step 3: Run existential traces
  const osChannels = s.existentialOSChannels || ["probability_os", "resource_os", "ethics_os"];
  humanPath.existentialTrace = runExistentialTrace(humanPath, osChannels);
  concordPath.existentialTrace = runExistentialTrace(concordPath, osChannels);

  // Step 4: Compare
  const comparison = comparePaths(humanPath, concordPath);

  // Step 5: Generate insight DTUs
  const proposedDTUs = generateInsightDTUs(comparison, scenarioId);

  const result = {
    simId: uid("sim"),
    scenarioId,
    hypothesis: s.hypothesis || null,
    humanPath,
    concordPath,
    comparison,
    proposedDTUs,
    timestamp: nowISO(),
  };

  // Store for later retrieval
  _simulations.set(result.simId, result);
  // Keep max 100 simulations in memory
  if (_simulations.size > 100) {
    const oldest = _simulations.keys().next().value;
    _simulations.delete(oldest);
  }

  return result;
}

/**
 * Get a specific simulation result.
 *
 * @param {string} simId
 * @returns {object|null}
 */
export function getSimulation(simId) {
  return _simulations.get(simId) || null;
}

/**
 * List recent simulation results (summaries).
 *
 * @param {number} [limit=20]
 * @returns {object[]}
 */
export function listSimulations(limit = 20) {
  const results = [];
  for (const sim of _simulations.values()) {
    results.push({
      simId: sim.simId,
      scenarioId: sim.scenarioId,
      hypothesis: sim.hypothesis,
      betterPath: sim.comparison.betterPath,
      stabilityDelta: sim.comparison.stabilityDelta,
      timestamp: sim.timestamp,
    });
  }
  return results.reverse().slice(0, limit);
}
