// server/tests/agentic/trust-trajectory.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTrustScore,
  permissionScopeFor,
  hasPermission,
  loadTrustStats,
  PERMISSION_SCOPES,
} from "../../lib/agentic/trust-trajectory.js";

describe("Trust trajectory", () => {
  it("PERMISSION_SCOPES is a non-empty frozen array", () => {
    assert.ok(Array.isArray(PERMISSION_SCOPES));
    assert.ok(PERMISSION_SCOPES.length >= 5);
    assert.throws(() => { PERMISSION_SCOPES.push({}); }, /Cannot add property/);
  });

  it("computeTrustScore with no sessions returns observation_only", () => {
    const { score, scope } = computeTrustScore({ sessionCount: 0 });
    assert.equal(scope, "observation_only");
    assert.ok(score >= 0 && score <= 1);
  });

  it("computeTrustScore with many sessions returns elevated scope", () => {
    const { scope } = computeTrustScore({ sessionCount: 500, verifiedActionCount: 500 });
    const highScopes = ["medium_risk_with_council", "high_risk_with_council", "sovereign_within_constitution"];
    assert.ok(highScopes.includes(scope), `Expected elevated scope, got ${scope}`);
  });

  it("constitutional violations lower score", () => {
    const clean = computeTrustScore({ sessionCount: 200 });
    const violated = computeTrustScore({ sessionCount: 200, constitutionalViolationCount: 5 });
    assert.ok(violated.score < clean.score, "Violations should lower score");
  });

  it("recent violations apply heavier penalty than historical", () => {
    // Use sessionCount:500 so baseTrust≈0.5 — high enough that both penalties result in non-zero scores
    const historical = computeTrustScore({ sessionCount: 500, constitutionalViolationCount: 1 });
    const recent = computeTrustScore({ sessionCount: 500, recentViolations: 1 });
    assert.ok(recent.score < historical.score, "Recent violations should penalize more than historical");
  });

  it("action verification bonus caps at 0.3", () => {
    const mid = computeTrustScore({ sessionCount: 100, verifiedActionCount: 500 });
    const high = computeTrustScore({ sessionCount: 100, verifiedActionCount: 9999 });
    assert.ok(high.components.actionBonus <= 0.3);
    assert.ok(Math.abs(high.components.actionBonus - mid.components.actionBonus) < 0.001,
      "Bonus should be capped at same value for very high counts");
  });

  it("score is clamped between 0 and 1", () => {
    const extreme = computeTrustScore({
      sessionCount: 0,
      constitutionalViolationCount: 100,
      recentViolations: 100,
    });
    assert.ok(extreme.score >= 0);
    assert.ok(extreme.score <= 1);
  });

  it("permissionScopeFor returns observation_only for score=0", () => {
    assert.equal(permissionScopeFor(0), "observation_only");
  });

  it("permissionScopeFor returns sovereign scope for score=1", () => {
    assert.equal(permissionScopeFor(1), "sovereign_within_constitution");
  });

  it("hasPermission returns true when score meets threshold", () => {
    assert.equal(hasPermission(0.95, "sovereign_within_constitution"), true);
    assert.equal(hasPermission(0.5, "low_risk_actions"), true);
  });

  it("hasPermission returns false for insufficient score", () => {
    assert.equal(hasPermission(0.1, "medium_risk_with_council"), false);
  });

  it("hasPermission returns false for unknown scope", () => {
    assert.equal(hasPermission(1.0, "nonexistent_scope"), false);
  });

  it("loadTrustStats returns zeros when db is null", () => {
    const stats = loadTrustStats("emergent-1", null);
    assert.equal(stats.sessionCount, 0);
    assert.equal(stats.verifiedActionCount, 0);
    assert.equal(stats.constitutionalViolationCount, 0);
  });

  it("loadTrustStats returns zeros when emergent not found in db", () => {
    const mockDb = {
      prepare: () => ({ get: () => null }),
    };
    const stats = loadTrustStats("unknown-emergent", mockDb);
    assert.equal(stats.sessionCount, 0);
  });

  it("loadTrustStats reads from db row when found", () => {
    const mockDb = {
      prepare: () => ({
        get: () => ({ session_count: 42, verified_action_count: 100, violation_count: 2 }),
      }),
    };
    const stats = loadTrustStats("emergent-2", mockDb);
    assert.equal(stats.sessionCount, 42);
    assert.equal(stats.verifiedActionCount, 100);
    assert.equal(stats.constitutionalViolationCount, 2);
  });
});
