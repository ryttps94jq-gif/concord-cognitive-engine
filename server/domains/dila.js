// server/domains/dila.js
//
// Dila runtime onboarding — capabilities, profiles, SWE harness, worker roster.

import { profileSummary, applyDeploymentProfile, PROFILES } from "../lib/runtime/deployment-profiles.js";
import { computeDilaCapabilityIndex } from "../lib/runtime/dila-capability-index.js";
import { listCapabilities as listForgeCapabilities } from "../lib/capability-forge/index.js";
import { listPromotableCapabilities, promoteForgedCapability } from "../lib/runtime/capability-promotion.js";
import { runSweHarness, SWE_MINI_CASES } from "../lib/runtime/swe-harness.js";
import { filterAllowedWorkers, isWorkerAllowed } from "../lib/runtime/worker-adapters.js";
import { getWorkerRoster } from "../lib/dila-workers.js";
import { gatherObservationSnapshot } from "../lib/runtime/continuous-observation.js";
import { getConfig, setConfig, listConfig } from "../lib/runtime/runtime-config.js";
import { executePceTask, pceOverview, buildCodeSpace, compileIntent, runCodingPipeline, buildRepoBrain, impactAnalysis, pceMetricsSummary, runPceBench, runConcordBench, concordBenchHistory, runPceImprovementCycle, proposePatternsFromFailures, runPatternLifecyclePass, buildConcordBenchReport, seedProvenBenchPatterns, CONCORD_BENCH_CASES, runPceExcellenceCycle, excellenceRunHistory, runAllBenchSuites, listBenchSuites, ALL_BENCH_CASE_COUNT, runRegressionGate, deterministicCoverageReport, runLearningPipeline } from "../lib/pce/index.js";

export default function registerDila(registerLensAction) {
  registerLensAction("dila", "onboarding", async (_input, ctx) => {
    const db = ctx.db;
    const profile = profileSummary(db);
    const caps = computeDilaCapabilityIndex(db);
    const obs = gatherObservationSnapshot(db);
    const roster = await getWorkerRoster();
    const allowed = filterAllowedWorkers(roster.workers || []);
    const benchReport = buildConcordBenchReport(db, { sinceDays: 7 });

    return {
      ok: true,
      profile,
      capabilityIndex: caps,
      observation: obs.snapshot,
      workers: {
        total: roster.workers?.length ?? 0,
        allowed: allowed.length,
      },
      sweCases: SWE_MINI_CASES.map((c) => ({ id: c.id, description: c.description })),
      concordBench: benchReport,
      concordBenchCases: CONCORD_BENCH_CASES.length,
    };
  });

  registerLensAction("dila", "apply_profile", async (input, ctx) => {
    const profileId = input?.profile || input?.data?.profile || "local";
    return applyDeploymentProfile(ctx.db, profileId);
  });

  registerLensAction("dila", "list_profiles", async () => ({
    ok: true,
    profiles: Object.values(PROFILES).map((p) => ({
      id: p.id, label: p.label, enforceAutonomous: p.enforceAutonomous,
    })),
  }));

  registerLensAction("dila", "worker_roster", async () => {
    const roster = await getWorkerRoster();
    const workers = (roster.workers || []).map((w) => ({
      ...w,
      allowed: isWorkerAllowed(w.name),
    }));
    return { ok: true, workers, allowed: workers.filter((w) => w.allowed).length };
  });

  registerLensAction("dila", "run_swe_harness", async (input, ctx) => {
    const caseIds = input?.caseIds || input?.data?.caseIds;
    return runSweHarness({ db: ctx.db, caseIds });
  });

  registerLensAction("dila", "promote_capability", async (input, ctx) => {
    const id = input?.capabilityId || input?.data?.capabilityId || input?.id;
    return promoteForgedCapability(ctx.db, { capabilityId: id });
  });

  registerLensAction("dila", "list_promotable", async (input, ctx) => {
    const limit = input?.limit || input?.data?.limit || 20;
    return listPromotableCapabilities(ctx.db, { limit });
  });

  registerLensAction("dila", "runtime_config_list", async (_input, ctx) => ({
    ok: true,
    config: listConfig(ctx.db),
  }));

  registerLensAction("dila", "runtime_config_set", async (input, ctx) => {
    const key = input?.key || input?.data?.key;
    const value = input?.value ?? input?.data?.value;
    if (!key) return { ok: false, reason: "missing_key" };
    return setConfig(ctx.db, key, value, { source: "operator" });
  });

  registerLensAction("dila", "observation", async (_input, ctx) => gatherObservationSnapshot(ctx.db));

  registerLensAction("dila", "capabilities", async (_input, ctx) => ({
    ok: true,
    forge: listForgeCapabilities(ctx.db),
    index: computeDilaCapabilityIndex(ctx.db),
    enforceAutonomous: getConfig(ctx.db, "auth_gate.enforce_autonomous", false),
  }));

  registerLensAction("dila", "pce_overview", async (_input, ctx) => pceOverview(ctx.db));

  registerLensAction("dila", "pce_execute", async (input, ctx) => {
    const intent = input?.intent || input?.data?.intent || input?.goal;
    return executePceTask({
      db: ctx.db,
      intent,
      repoRoot: input?.repoRoot || input?.data?.repoRoot,
      params: input?.params || input?.data?.params,
      manualSteps: input?.steps || input?.data?.steps,
    });
  });

  registerLensAction("dila", "pce_compile", async (input, ctx) => {
    const intent = input?.intent || input?.data?.intent;
    const codeSpace = await buildCodeSpace(ctx.db);
    return compileIntent(intent, { db: ctx.db, codeSpace });
  });

  registerLensAction("dila", "code_space", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    return buildCodeSpace(ctx.db, repoRoot);
  });

  registerLensAction("dila", "repo_brain", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    const query = input?.query || input?.data?.query;
    return buildRepoBrain(ctx.db, repoRoot, { query });
  });

  registerLensAction("dila", "impact_analysis", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    const brain = await buildRepoBrain(ctx.db, repoRoot, { query: input?.symbol });
    return impactAnalysis(brain, {
      filePath: input?.filePath || input?.data?.filePath,
      symbol: input?.symbol || input?.data?.symbol,
    });
  });

  registerLensAction("dila", "coding_pipeline", async (input, ctx) => {
    return runCodingPipeline({
      db: ctx.db,
      intent: input?.intent || input?.data?.intent,
      repoRoot: input?.repoRoot || input?.data?.repoRoot,
      params: input?.params || input?.data?.params,
      manualSteps: input?.steps || input?.data?.steps,
    });
  });

  registerLensAction("dila", "pce_metrics", async (input, ctx) => {
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 30;
    return pceMetricsSummary(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "pce_bench", async (input, ctx) => {
    const categories = input?.categories || input?.data?.categories;
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    return runPceBench(ctx.db, { categories, repoRoot });
  });

  registerLensAction("dila", "concord_bench", async (input, ctx) => {
    const caseIds = input?.caseIds || input?.data?.caseIds;
    const categories = input?.categories || input?.data?.categories;
    const suites = input?.suites || input?.data?.suites;
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    return runConcordBench(ctx.db, { caseIds, categories, concordRoot: repoRoot, suites });
  });

  registerLensAction("dila", "concord_bench_history", async (input, ctx) => {
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 7;
    return concordBenchHistory(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "pce_improvement_cycle", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    const runToyBench = input?.runToyBench || input?.data?.runToyBench;
    return runPceImprovementCycle({ db: ctx.db, concordRoot: repoRoot, runToyBench });
  });

  registerLensAction("dila", "pattern_lifecycle", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    const proposals = proposePatternsFromFailures(ctx.db);
    const lifecycle = await runPatternLifecyclePass(ctx.db, { concordRoot: repoRoot });
    return { ok: true, proposals, lifecycle };
  });

  registerLensAction("dila", "pce_excellence_cycle", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    const suiteIds = input?.suiteIds || input?.data?.suiteIds;
    return runPceExcellenceCycle({ db: ctx.db, concordRoot: repoRoot, suiteIds });
  });

  registerLensAction("dila", "excellence_history", async (input, ctx) => {
    const limit = input?.limit || input?.data?.limit || 20;
    return excellenceRunHistory(ctx.db, { limit });
  });

  registerLensAction("dila", "bench_catalog", async () => {
    return { ok: true, suites: listBenchSuites(), totalCases: ALL_BENCH_CASE_COUNT };
  });

  registerLensAction("dila", "regression_gate", async (input, ctx) => {
    const repoRoot = input?.repoRoot || input?.data?.repoRoot;
    return runRegressionGate(ctx.db, { concordRoot: repoRoot });
  });

  registerLensAction("dila", "deterministic_coverage", async (input, ctx) => {
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 7;
    return deterministicCoverageReport(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "learning_pipeline", async (ctx, _artifact, params = {}) => {
    const repoRoot = params?.repoRoot || params?.data?.repoRoot;
    const benchResults = params?.benchResults || params?.data?.benchResults;
    try {
      return await runLearningPipeline(ctx.db, { benchResults, concordRoot: repoRoot });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  registerLensAction("dila", "bench_report", async (input, ctx) => {
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 7;
    return buildConcordBenchReport(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "seed_bench_patterns", async (_input, ctx) => {
    return seedProvenBenchPatterns(ctx.db, { onlyMissing: false });
  });

  registerLensAction("dila", "dhtp_compile", async (input, ctx) => {
    const { compileExecutiveCognition } = await import("../runtime/dhtp-compiler.js");
    return compileExecutiveCognition({
      db: ctx.db,
      mission: input?.mission || input?.data?.mission || { goal: input?.goal || input?.data?.goal },
      step: input?.step || input?.data?.step || { tool: "dhtp_compile" },
      stepIndex: input?.stepIndex ?? input?.data?.stepIndex ?? 0,
      route: input?.route || input?.data?.route || { taskClass: "reasoning" },
    });
  });

  registerLensAction("dila", "dhtp_metrics", async (input, ctx) => {
    const { dhtpMetricsSummary } = await import("../runtime/dhtp-metrics.js");
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 7;
    return dhtpMetricsSummary(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "dhtp_process_delta", async (input, ctx) => {
    const { processCognitiveResponse } = await import("../runtime/dhtp-compiler.js");
    const text = input?.text || input?.data?.text || "";
    const f0Authorized = input?.f0Authorized || input?.data?.f0Authorized || false;
    return processCognitiveResponse(text, { f0Authorized });
  });

  registerLensAction("dila", "dhtp_execute_delta", async (input, ctx) => {
    const { executeCognitiveDelta } = await import("../runtime/cognitive-delta-runtime.js");
    return executeCognitiveDelta({
      db: ctx.db,
      text: input?.text || input?.data?.text,
      delta: input?.delta || input?.data?.delta,
      mission: input?.mission || input?.data?.mission,
      step: input?.step || input?.data?.step,
      stepIndex: input?.stepIndex ?? input?.data?.stepIndex ?? 0,
      route: input?.route || input?.data?.route,
      gateCtx: { actor: ctx.user || { role: "member" }, db: ctx.db },
    });
  });

  registerLensAction("dila", "dhtp_policy_learn", async (input, ctx) => {
    const { runDhtpPolicyLearningCycle } = await import("../runtime/dhtp-policy-learner.js");
    const sinceDays = input?.sinceDays || input?.data?.sinceDays || 14;
    return runDhtpPolicyLearningCycle(ctx.db, { sinceDays });
  });

  registerLensAction("dila", "cognitive_cache_stats", async (_input, ctx) => {
    const { cognitiveCacheStats } = await import("../runtime/cognitive-cache.js");
    return cognitiveCacheStats(ctx.db);
  });

  registerLensAction("dila", "cognitive_mission_bench", async (ctx, _artifact, params = {}) => {
    if (params?.smoke || params?.data?.smoke) {
      return {
        ok: true,
        result: {
          smoke: true,
          note: "Harness smoke path — full benchmark via server/scripts/run-cognitive-mission-bench.mjs",
          iterations: 0,
        },
      };
    }
    const { runCognitiveMissionBench } = await import("../runtime/cognitive-mission-bench.js");
    const iterations = params?.iterations || params?.data?.iterations || 5;
    const minCacheUses = params?.minCacheUses ?? params?.data?.minCacheUses;
    const dispatchMCP = ctx.dispatchMCP || (async (tool) => ({
      ok: true,
      decision: "ALLOW",
      result: { ok: true, observation: { tool } },
    }));
    try {
      return await runCognitiveMissionBench({
        db: ctx.db,
        dispatchMCP,
        iterations,
        minCacheUses,
        runF0Probe: iterations > 0,
        runPolicyLearning: iterations > 0,
      });
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });
}
