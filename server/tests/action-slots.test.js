/**
 * Tests for Emergent Agent Governance — Action Slots (UX Architecture)
 *
 * Coverage:
 *   1. Slot registration & validation
 *   2. Slot config retrieval (single, all, labels)
 *   3. Handler invocation recording & result states
 *   4. Result helpers (makeResult)
 *   5. Unregister
 *   6. Invocation queries & filtering
 *   7. Result distribution analytics
 *   8. Slot coverage audit
 *   9. Failure rate monitoring
 *  10. Metrics
 *  11. Cross-lens integration scenarios
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  SLOT_POSITIONS, ALL_SLOT_POSITIONS, RESULT_STATES, ALL_RESULT_STATES,
  getActionSlotStore, registerSlotConfig, getSlotConfig, getAllSlotConfigs,
  getSlotLabel, recordInvocation, makeResult, unregisterSlotConfig,
  getInvocations, getResultDistribution, auditSlotCoverage,
  getFailureRates, getActionSlotMetrics,
} from "../emergent/action-slots.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function freshState() {
  return {
    __emergent: {
      initialized: true,
      initializedAt: new Date().toISOString(),
      emergents: new Map(),
      sessions: new Map(),
      outputBundles: new Map(),
      gateTraces: new Map(),
      patterns: new Map(),
      reputations: new Map(),
      specializations: [],
      sessionsByEmergent: new Map(),
      contentHashes: new Set(),
      rateBuckets: new Map(),
      activeSessions: 0,
      metrics: {},
    },
    dtus: new Map(),
  };
}

function studioConfig() {
  return {
    primary:   { label: "Record",          handler: "studio.record",     description: "Start recording" },
    secondary: { label: "Mix",             handler: "studio.mix",        description: "Open mixer" },
    explore:   { label: "Browse Projects", handler: "studio.browse",     description: "Browse studio projects" },
    manage:    { label: "Export",           handler: "studio.export",     description: "Export project" },
  };
}

function researchConfig() {
  return {
    primary:   { label: "Synthesize",   handler: "paper.synthesize",  description: "Run synthesis", shortcut: "Cmd+Shift+S" },
    secondary: { label: "Critique",     handler: "paper.critique",    description: "Run critique" },
    explore:   { label: "Browse DTUs",  handler: "paper.browse",      description: "Browse research DTUs" },
    manage:    { label: "Export PDF",   handler: "paper.export",      description: "Export as PDF" },
  };
}

function healthcareConfig() {
  return {
    primary:   { label: "Diagnose",     handler: "healthcare.diagnose" },
    secondary: { label: "Prescribe",    handler: "healthcare.prescribe" },
    explore:   { label: "Patient List", handler: "healthcare.browse" },
    manage:    { label: "Export Chart",  handler: "healthcare.export" },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. SLOT POSITIONS & RESULT STATES (Enums)
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Enums", () => {
  it("should have exactly 4 slot positions", () => {
    assert.equal(ALL_SLOT_POSITIONS.length, 4);
    assert.ok(ALL_SLOT_POSITIONS.includes("primary"));
    assert.ok(ALL_SLOT_POSITIONS.includes("secondary"));
    assert.ok(ALL_SLOT_POSITIONS.includes("explore"));
    assert.ok(ALL_SLOT_POSITIONS.includes("manage"));
  });

  it("should have exactly 5 result states", () => {
    assert.equal(ALL_RESULT_STATES.length, 5);
    assert.ok(ALL_RESULT_STATES.includes("done"));
    assert.ok(ALL_RESULT_STATES.includes("queued"));
    assert.ok(ALL_RESULT_STATES.includes("rejected"));
    assert.ok(ALL_RESULT_STATES.includes("deferred"));
    assert.ok(ALL_RESULT_STATES.includes("failed"));
  });

  it("enums should be frozen", () => {
    assert.throws(() => { SLOT_POSITIONS.NEW = "new"; }, TypeError);
    assert.throws(() => { RESULT_STATES.NEW = "new"; }, TypeError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. SLOT REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Registration", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("should register a full 4-slot configuration", () => {
    const result = registerSlotConfig(STATE, "studio", studioConfig());
    assert.equal(result.ok, true);
    assert.equal(result.domain, "studio");
    assert.equal(result.slots.length, 4);
  });

  it("should register a partial configuration (2 slots)", () => {
    const result = registerSlotConfig(STATE, "minimal", {
      primary:   { label: "Go", handler: "min.go" },
      secondary: { label: "Stop", handler: "min.stop" },
    });
    assert.equal(result.ok, true);
    assert.equal(result.slots.length, 2);
    assert.ok(result.slots.includes("primary"));
    assert.ok(result.slots.includes("secondary"));
  });

  it("should reject registration with no domain", () => {
    const result = registerSlotConfig(STATE, "", studioConfig());
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_domain");
  });

  it("should reject registration with no slots", () => {
    const result = registerSlotConfig(STATE, "empty", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_slots");
  });

  it("should reject slot without label", () => {
    const result = registerSlotConfig(STATE, "bad", {
      primary: { handler: "x.y" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_slot");
  });

  it("should reject slot without handler", () => {
    const result = registerSlotConfig(STATE, "bad", {
      primary: { label: "Go" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_slot");
  });

  it("should overwrite existing config for same domain", () => {
    registerSlotConfig(STATE, "studio", studioConfig());
    const updated = registerSlotConfig(STATE, "studio", {
      primary: { label: "Create", handler: "studio.create" },
    });
    assert.equal(updated.ok, true);
    assert.equal(updated.slots.length, 1);

    const config = getSlotConfig(STATE, "studio");
    assert.equal(config.slots.primary.label, "Create");
    assert.equal(config.slots.secondary, null);
  });

  it("should store optional fields (description, icon, shortcut)", () => {
    registerSlotConfig(STATE, "paper", researchConfig());
    const config = getSlotConfig(STATE, "paper");
    assert.equal(config.slots.primary.shortcut, "Cmd+Shift+S");
    assert.equal(config.slots.primary.description, "Run synthesis");
  });

  it("should increment metrics on registration", () => {
    registerSlotConfig(STATE, "a", { primary: { label: "A", handler: "a.go" } });
    registerSlotConfig(STATE, "b", { primary: { label: "B", handler: "b.go" } });
    const metrics = getActionSlotMetrics(STATE);
    assert.equal(metrics.totalRegistrations, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. SLOT CONFIG RETRIEVAL
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Retrieval", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
  });

  it("should get a specific lens config", () => {
    const result = getSlotConfig(STATE, "studio");
    assert.equal(result.ok, true);
    assert.equal(result.domain, "studio");
    assert.equal(result.slots.primary.label, "Record");
    assert.equal(result.slots.secondary.handler, "studio.mix");
  });

  it("should return not_found for unknown domain", () => {
    const result = getSlotConfig(STATE, "unknown");
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_found");
  });

  it("should get all slot configs", () => {
    const result = getAllSlotConfigs(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.count, 2);
    const domains = result.configs.map(c => c.domain);
    assert.ok(domains.includes("studio"));
    assert.ok(domains.includes("paper"));
  });

  it("should get slot label for registered lens", () => {
    const result = getSlotLabel(STATE, "studio", "primary");
    assert.equal(result.ok, true);
    assert.equal(result.label, "Record");
    assert.equal(result.isDefault, false);
  });

  it("should fall back to universal label for unregistered lens", () => {
    const result = getSlotLabel(STATE, "unknown", "primary");
    assert.equal(result.ok, true);
    assert.equal(result.label, "Primary");
    assert.equal(result.isDefault, true);
  });

  it("should fall back to universal label for unconfigured slot", () => {
    registerSlotConfig(STATE, "minimal", {
      primary: { label: "Go", handler: "min.go" },
    });
    const result = getSlotLabel(STATE, "minimal", "manage");
    assert.equal(result.ok, true);
    assert.equal(result.label, "Manage");
    assert.equal(result.isDefault, true);
  });

  it("should reject invalid position in getSlotLabel", () => {
    const result = getSlotLabel(STATE, "studio", "invalid");
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_position");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. HANDLER INVOCATION RECORDING
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Invocation Recording", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
  });

  it("should record a successful invocation", () => {
    const result = recordInvocation(STATE, "studio", "primary", {
      result: "done",
      userId: "user_1",
      artifactId: "proj_001",
    });
    assert.equal(result.ok, true);
    assert.equal(result.invocation.domain, "studio");
    assert.equal(result.invocation.position, "primary");
    assert.equal(result.invocation.handler, "studio.record");
    assert.equal(result.invocation.label, "Record");
    assert.equal(result.invocation.result, "done");
    assert.equal(result.invocation.userId, "user_1");
    assert.ok(result.invocation.id.startsWith("inv_"));
  });

  it("should record invocations for all result states", () => {
    for (const state of ALL_RESULT_STATES) {
      const result = recordInvocation(STATE, "studio", "primary", { result: state });
      assert.equal(result.ok, true);
      assert.equal(result.invocation.result, state);
    }
  });

  it("should reject invalid position", () => {
    const result = recordInvocation(STATE, "studio", "invalid", { result: "done" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_position");
  });

  it("should reject invalid result state", () => {
    const result = recordInvocation(STATE, "studio", "primary", { result: "unknown" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_result");
  });

  it("should reject missing result", () => {
    const result = recordInvocation(STATE, "studio", "primary", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_result");
  });

  it("should allow invocation for unregistered domain (handler=null)", () => {
    const result = recordInvocation(STATE, "unknown", "primary", { result: "done" });
    assert.equal(result.ok, true);
    assert.equal(result.invocation.handler, null);
    assert.equal(result.invocation.label, "primary");
  });

  it("should update result counts", () => {
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "failed" });
    const metrics = getActionSlotMetrics(STATE);
    assert.equal(metrics.resultCounts.done, 2);
    assert.equal(metrics.resultCounts.failed, 1);
    assert.equal(metrics.totalInvocations, 3);
  });

  it("should cap the invocation log", () => {
    // Fill past the cap (500)
    for (let i = 0; i < 510; i++) {
      recordInvocation(STATE, "studio", "primary", { result: "done" });
    }
    const store = getActionSlotStore(STATE);
    assert.ok(store.invocationLog.length <= 500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. RESULT HELPERS
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — makeResult", () => {
  it("should create a done result (ok=true)", () => {
    const r = makeResult("done", { artifactId: "proj_001" });
    assert.equal(r.ok, true);
    assert.equal(r.state, "done");
    assert.equal(r.artifactId, "proj_001");
    assert.ok(r.timestamp);
  });

  it("should create a queued result (ok=true)", () => {
    const r = makeResult("queued", { jobId: "j_123" });
    assert.equal(r.ok, true);
    assert.equal(r.state, "queued");
  });

  it("should create a rejected result (ok=false)", () => {
    const r = makeResult("rejected", { reason: "insufficient permissions" });
    assert.equal(r.ok, false);
    assert.equal(r.state, "rejected");
    assert.equal(r.reason, "insufficient permissions");
  });

  it("should create a deferred result (ok=false)", () => {
    const r = makeResult("deferred", { waitingFor: "user_confirmation" });
    assert.equal(r.ok, false);
    assert.equal(r.state, "deferred");
  });

  it("should create a failed result (ok=false)", () => {
    const r = makeResult("failed", { error: "handler_timeout" });
    assert.equal(r.ok, false);
    assert.equal(r.state, "failed");
  });

  it("should reject invalid result state", () => {
    const r = makeResult("invalid");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_result_state");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. UNREGISTER
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Unregister", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
  });

  it("should unregister a lens config", () => {
    const result = unregisterSlotConfig(STATE, "studio");
    assert.equal(result.ok, true);
    assert.equal(result.domain, "studio");
    // Verify it's gone
    const config = getSlotConfig(STATE, "studio");
    assert.equal(config.ok, false);
  });

  it("should return not_found for unknown domain", () => {
    const result = unregisterSlotConfig(STATE, "unknown");
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_found");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. INVOCATION QUERIES
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Invocation Queries", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
    // Record some invocations
    recordInvocation(STATE, "studio", "primary",   { result: "done", userId: "u1" });
    recordInvocation(STATE, "studio", "secondary", { result: "done", userId: "u1" });
    recordInvocation(STATE, "studio", "primary",   { result: "failed", userId: "u2" });
    recordInvocation(STATE, "paper",  "primary",   { result: "done", userId: "u1" });
    recordInvocation(STATE, "paper",  "explore",   { result: "queued", userId: "u2" });
  });

  it("should get all invocations", () => {
    const result = getInvocations(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.total, 5);
  });

  it("should filter by domain", () => {
    const result = getInvocations(STATE, { domain: "studio" });
    assert.equal(result.total, 3);
  });

  it("should filter by position", () => {
    const result = getInvocations(STATE, { position: "primary" });
    assert.equal(result.total, 3);
  });

  it("should filter by result", () => {
    const result = getInvocations(STATE, { result: "failed" });
    assert.equal(result.total, 1);
  });

  it("should filter by userId", () => {
    const result = getInvocations(STATE, { userId: "u1" });
    assert.equal(result.total, 3);
  });

  it("should combine filters", () => {
    const result = getInvocations(STATE, { domain: "studio", result: "done" });
    assert.equal(result.total, 2);
  });

  it("should respect limit", () => {
    const result = getInvocations(STATE, { limit: 2 });
    assert.equal(result.invocations.length, 2);
    assert.equal(result.total, 5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. RESULT DISTRIBUTION
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Result Distribution", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
    recordInvocation(STATE, "studio", "primary",   { result: "done" });
    recordInvocation(STATE, "studio", "primary",   { result: "done" });
    recordInvocation(STATE, "studio", "primary",   { result: "failed" });
    recordInvocation(STATE, "studio", "secondary", { result: "done" });
    recordInvocation(STATE, "studio", "manage",    { result: "rejected" });
  });

  it("should compute distribution for a domain", () => {
    const result = getResultDistribution(STATE, "studio");
    assert.equal(result.ok, true);
    assert.equal(result.total, 5);
    assert.equal(result.distribution.done, 3);
    assert.equal(result.distribution.failed, 1);
    assert.equal(result.distribution.rejected, 1);
    assert.equal(result.distribution.queued, 0);
    assert.equal(result.distribution.deferred, 0);
  });

  it("should break down by slot", () => {
    const result = getResultDistribution(STATE, "studio");
    assert.equal(result.bySlot.primary.done, 2);
    assert.equal(result.bySlot.primary.failed, 1);
    assert.equal(result.bySlot.secondary.done, 1);
    assert.equal(result.bySlot.manage.rejected, 1);
  });

  it("should compute global distribution when no domain specified", () => {
    recordInvocation(STATE, "paper", "primary", { result: "queued" });
    const result = getResultDistribution(STATE, undefined);
    assert.equal(result.domain, "all");
    assert.equal(result.total, 6);
    assert.equal(result.distribution.queued, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. SLOT COVERAGE AUDIT
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Coverage Audit", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
  });

  it("should report empty registry", () => {
    const result = auditSlotCoverage(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.total, 0);
    assert.equal(result.complete, 0);
    assert.equal(result.partial, 0);
  });

  it("should identify complete configurations", () => {
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
    const result = auditSlotCoverage(STATE);
    assert.equal(result.complete, 2);
    assert.equal(result.partial, 0);
    assert.equal(result.incomplete.length, 0);
  });

  it("should identify partial configurations", () => {
    registerSlotConfig(STATE, "minimal", {
      primary: { label: "Go", handler: "min.go" },
      explore: { label: "Look", handler: "min.look" },
    });
    const result = auditSlotCoverage(STATE);
    assert.equal(result.complete, 0);
    assert.equal(result.partial, 1);
    assert.equal(result.incomplete.length, 1);
    assert.equal(result.incomplete[0].domain, "minimal");
    assert.ok(result.incomplete[0].missing.includes("secondary"));
    assert.ok(result.incomplete[0].missing.includes("manage"));
  });

  it("should track per-slot coverage counts", () => {
    registerSlotConfig(STATE, "studio", studioConfig());  // all 4
    registerSlotConfig(STATE, "minimal", {
      primary: { label: "Go", handler: "min.go" },
    });
    const result = auditSlotCoverage(STATE);
    assert.equal(result.bySlot.primary, 2);    // both lenses have primary
    assert.equal(result.bySlot.secondary, 1);  // only studio
    assert.equal(result.bySlot.explore, 1);
    assert.equal(result.bySlot.manage, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. FAILURE RATES
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Failure Rates", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
  });

  it("should compute failure rates per lens", () => {
    // Studio: 1 fail out of 4 = 25%
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "failed" });
    // Paper: 0 fails
    recordInvocation(STATE, "paper", "primary", { result: "done" });
    recordInvocation(STATE, "paper", "primary", { result: "done" });

    const result = getFailureRates(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.rates.length, 2);

    const studioRate = result.rates.find(r => r.domain === "studio");
    assert.equal(studioRate.failureRate, 0.25);
    assert.equal(studioRate.total, 4);
    assert.equal(studioRate.failed, 1);
  });

  it("should flag lenses above threshold", () => {
    // All failures for studio
    recordInvocation(STATE, "studio", "primary", { result: "failed" });
    recordInvocation(STATE, "studio", "primary", { result: "failed" });
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    // Paper healthy
    recordInvocation(STATE, "paper", "primary", { result: "done" });

    const result = getFailureRates(STATE, { threshold: 0.5 });
    assert.equal(result.flagged.length, 1);
    assert.equal(result.flagged[0].domain, "studio");
  });

  it("should use default threshold of 0.2", () => {
    // Studio: 1 fail out of 3 = 33% > 20%
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "studio", "primary", { result: "failed" });

    const result = getFailureRates(STATE);
    assert.equal(result.threshold, 0.2);
    assert.equal(result.flagged.length, 1);
  });

  it("should track rejection rates separately", () => {
    recordInvocation(STATE, "studio", "manage", { result: "rejected" });
    recordInvocation(STATE, "studio", "manage", { result: "rejected" });
    recordInvocation(STATE, "studio", "manage", { result: "done" });

    const result = getFailureRates(STATE);
    const studioRate = result.rates.find(r => r.domain === "studio");
    assert.equal(studioRate.rejected, 2);
    assert.ok(studioRate.rejectionRate > 0.6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. METRICS
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Metrics", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("should return initial metrics", () => {
    const metrics = getActionSlotMetrics(STATE);
    assert.equal(metrics.ok, true);
    assert.equal(metrics.registeredLenses, 0);
    assert.equal(metrics.totalInvocations, 0);
    assert.equal(metrics.totalRegistrations, 0);
    assert.equal(metrics.lastInvocation, null);
  });

  it("should track registrations and invocations", () => {
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "paper", "explore", { result: "queued" });

    const metrics = getActionSlotMetrics(STATE);
    assert.equal(metrics.registeredLenses, 2);
    assert.equal(metrics.totalRegistrations, 2);
    assert.equal(metrics.totalInvocations, 2);
    assert.ok(metrics.lastInvocation);
    assert.equal(metrics.resultCounts.done, 1);
    assert.equal(metrics.resultCounts.queued, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. CROSS-LENS INTEGRATION SCENARIOS
// ═════════════════════════════════════════════════════════════════════════════

describe("Action Slots — Cross-Lens Integration", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    registerSlotConfig(STATE, "studio", studioConfig());
    registerSlotConfig(STATE, "paper", researchConfig());
    registerSlotConfig(STATE, "healthcare", healthcareConfig());
  });

  it("same position, different labels across lenses", () => {
    const studioLabel = getSlotLabel(STATE, "studio", "primary");
    const paperLabel = getSlotLabel(STATE, "paper", "primary");
    const healthLabel = getSlotLabel(STATE, "healthcare", "primary");
    assert.equal(studioLabel.label, "Record");
    assert.equal(paperLabel.label, "Synthesize");
    assert.equal(healthLabel.label, "Diagnose");
    // All primary, all different
    assert.notEqual(studioLabel.label, paperLabel.label);
    assert.notEqual(paperLabel.label, healthLabel.label);
  });

  it("should track invocations across lenses independently", () => {
    recordInvocation(STATE, "studio", "primary", { result: "done" });
    recordInvocation(STATE, "paper", "primary", { result: "failed" });
    recordInvocation(STATE, "healthcare", "primary", { result: "deferred" });

    const studioDist = getResultDistribution(STATE, "studio");
    const paperDist = getResultDistribution(STATE, "paper");
    const healthDist = getResultDistribution(STATE, "healthcare");

    assert.equal(studioDist.distribution.done, 1);
    assert.equal(paperDist.distribution.failed, 1);
    assert.equal(healthDist.distribution.deferred, 1);
  });

  it("full audit covers all lenses", () => {
    const audit = auditSlotCoverage(STATE);
    assert.equal(audit.total, 3);
    assert.equal(audit.complete, 3);
    assert.equal(audit.bySlot.primary, 3);
  });

  it("user journey: register, invoke all slots, check distribution", () => {
    // A user uses all 4 slots in studio lens
    recordInvocation(STATE, "studio", "primary",   { result: "done", userId: "user_1" });
    recordInvocation(STATE, "studio", "secondary", { result: "done", userId: "user_1" });
    recordInvocation(STATE, "studio", "explore",   { result: "done", userId: "user_1" });
    recordInvocation(STATE, "studio", "manage",    { result: "queued", userId: "user_1" });

    const invocations = getInvocations(STATE, { domain: "studio", userId: "user_1" });
    assert.equal(invocations.total, 4);

    // Each slot was used once
    const dist = getResultDistribution(STATE, "studio");
    assert.equal(dist.bySlot.primary.done, 1);
    assert.equal(dist.bySlot.secondary.done, 1);
    assert.equal(dist.bySlot.explore.done, 1);
    assert.equal(dist.bySlot.manage.queued, 1);

    // No failures
    const rates = getFailureRates(STATE);
    const studioRate = rates.rates.find(r => r.domain === "studio");
    assert.equal(studioRate.failureRate, 0);
  });
});
