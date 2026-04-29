// server/tests/emergent-quality/track.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordQualityOutcome, updateTrustFromOutcome, detectQualityPatterns } from "../../lib/emergents/quality/track.js";

function makeDb(rows = []) {
  const inserted = [];
  const updated = [];
  return {
    prepare: (sql) => ({
      run: (...args) => {
        if (sql.includes("INSERT")) inserted.push({ sql, args });
        if (sql.includes("UPDATE")) updated.push({ sql, args });
      },
      all: () => rows,
    }),
    _inserted: inserted,
    _updated: updated,
  };
}

// ── recordQualityOutcome ──────────────────────────────────────────────────────

describe("recordQualityOutcome", () => {
  it("returns null when db is null", () => {
    const r = recordQualityOutcome({ emergentId: "e1", decision: "approve" }, null);
    assert.equal(r, null);
  });

  it("returns null when emergentId is null", () => {
    const db = makeDb();
    const r = recordQualityOutcome({ emergentId: null, decision: "approve" }, db);
    assert.equal(r, null);
  });

  it("returns id starting with 'qh_'", () => {
    const db = makeDb();
    const r = recordQualityOutcome({ emergentId: "e1", decision: "approve", stages: {}, qualityScore: 0.8 }, db);
    assert.ok(r.startsWith("qh_"));
  });

  it("inserts a row into the db", () => {
    const db = makeDb();
    recordQualityOutcome({ emergentId: "e1", taskId: "t1", decision: "reject", stages: {}, qualityScore: 0 }, db);
    assert.equal(db._inserted.length, 1);
    const args = db._inserted[0].args;
    assert.equal(args[1], "e1");   // emergent_id
    assert.equal(args[2], "t1");   // task_id
    assert.equal(args[4], "reject"); // decision
  });

  it("handles missing stages gracefully", () => {
    const db = makeDb();
    const r = recordQualityOutcome({ emergentId: "e1", decision: "approve" }, db);
    assert.ok(r !== null);
  });
});

// ── updateTrustFromOutcome ────────────────────────────────────────────────────

describe("updateTrustFromOutcome", () => {
  it("is no-op when db is null", () => {
    assert.doesNotThrow(() => updateTrustFromOutcome("e1", "approve", null));
  });

  it("is no-op when emergentId is null", () => {
    const db = makeDb();
    updateTrustFromOutcome(null, "approve", db);
    assert.equal(db._updated.length, 0);
  });

  it("increments verified_action_count on approve", () => {
    const db = makeDb();
    updateTrustFromOutcome("e1", "approve", db);
    assert.equal(db._updated.length, 1);
    assert.ok(db._updated[0].sql.includes("verified_action_count"));
  });

  it("increments violation_count on reject", () => {
    const db = makeDb();
    updateTrustFromOutcome("e1", "reject", db);
    assert.equal(db._updated.length, 1);
    assert.ok(db._updated[0].sql.includes("violation_count"));
  });

  it("is no-op for unknown decision string", () => {
    const db = makeDb();
    updateTrustFromOutcome("e1", "unknown", db);
    assert.equal(db._updated.length, 0);
  });
});

// ── detectQualityPatterns ─────────────────────────────────────────────────────

describe("detectQualityPatterns", () => {
  it("returns healthy:true when db is null", () => {
    const r = detectQualityPatterns("e1", null);
    assert.equal(r.healthy, true);
  });

  it("returns healthy:true when emergentId is null", () => {
    const db = makeDb([]);
    const r = detectQualityPatterns(null, db);
    assert.equal(r.healthy, true);
  });

  it("returns healthy:true when no history exists", () => {
    const db = makeDb([]);
    const r = detectQualityPatterns("e1", db);
    assert.equal(r.healthy, true);
    assert.equal(r.window, 0);
  });

  it("returns healthy:false when rejection rate >= 0.5", () => {
    const rows = [
      { decision: "reject" },
      { decision: "reject" },
      { decision: "approve" },
      { decision: "approve" },
    ];
    // exactly 50% — boundary
    const db = makeDb(rows);
    const r = detectQualityPatterns("e1", db);
    assert.equal(r.healthy, false);
    assert.equal(r.rejectionRate, 0.5);
  });

  it("returns healthy:true when rejection rate < 0.5", () => {
    const rows = [
      { decision: "reject" },
      { decision: "approve" },
      { decision: "approve" },
      { decision: "approve" },
    ];
    const db = makeDb(rows);
    const r = detectQualityPatterns("e1", db);
    assert.equal(r.healthy, true);
  });
});
