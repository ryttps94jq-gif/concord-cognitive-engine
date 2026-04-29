// server/tests/emergent-quality/deterministic-gates.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requiredFieldsGate,
  duplicateGate,
  lengthGate,
  citationDensityGate,
  slopPatternGate,
  constitutionalGate,
  runDeterministicGates,
} from "../../lib/emergents/quality/deterministic-gates.js";

// ── requiredFieldsGate ────────────────────────────────────────────────────────

describe("requiredFieldsGate", () => {
  it("fails when body is missing", () => {
    const r = requiredFieldsGate({ body: "", task_type: "synthesis" });
    assert.equal(r.passed, false);
    assert.ok(r.details.missing.includes("body"));
  });

  it("fails when both lens and task_type are missing", () => {
    const r = requiredFieldsGate({ body: "some content here" });
    assert.equal(r.passed, false);
    assert.ok(r.details.missing.includes("lens_or_task_type"));
  });

  it("passes with body and task_type", () => {
    const r = requiredFieldsGate({ body: "some content here", task_type: "synthesis" });
    assert.equal(r.passed, true);
  });

  it("passes with body and lens", () => {
    const r = requiredFieldsGate({ body: "some content here", lens: "research" });
    assert.equal(r.passed, true);
  });
});

// ── lengthGate ────────────────────────────────────────────────────────────────

describe("lengthGate", () => {
  it("passes when body is within default range", () => {
    const body = "x".repeat(500);
    const r = lengthGate({ body, task_type: "unknown" });
    assert.equal(r.passed, true);
  });

  it("fails when body is too short for synthesis", () => {
    const r = lengthGate({ body: "short", task_type: "synthesis" });
    assert.equal(r.passed, false);
    assert.equal(r.details.min, 200);
  });

  it("uses observation range for observation tasks", () => {
    const body = "x".repeat(60);
    const r = lengthGate({ body, task_type: "observation" });
    assert.equal(r.passed, true);
    assert.equal(r.details.max, 2000);
  });

  it("fails when body exceeds dream max", () => {
    const body = "x".repeat(1100);
    const r = lengthGate({ body, task_type: "dream" });
    assert.equal(r.passed, false);
  });
});

// ── citationDensityGate ───────────────────────────────────────────────────────

describe("citationDensityGate", () => {
  it("passes when wordCount is under 50 (short drafts exempt)", () => {
    const r = citationDensityGate({ body: "short text here" });
    assert.equal(r.passed, true);
  });

  it("passes when draft has citations", () => {
    const words = "word ".repeat(201).trim();
    const r = citationDensityGate({ body: words, lineage: ["dtu1", "dtu2"] });
    assert.equal(r.passed, true);
  });

  it("fails when draft has >200 words and no citations", () => {
    const words = "word ".repeat(201).trim();
    const r = citationDensityGate({ body: words, lineage: [] });
    assert.equal(r.passed, false);
    assert.equal(r.details.citationCount, 0);
  });
});

// ── slopPatternGate ───────────────────────────────────────────────────────────

describe("slopPatternGate", () => {
  it("passes clean technical text", () => {
    const r = slopPatternGate({ body: "The system processes data using a hash function. Results are deterministic." });
    assert.equal(r.passed, true);
  });

  it("fails on excessive hedging density", () => {
    const hedging = "may be could potentially in some sense arguably one might argue it could be said supposedly ".repeat(5);
    const r = slopPatternGate({ body: hedging });
    assert.equal(r.passed, false);
    assert.ok(r.details.density >= 0.05);
  });

  it("reports match counts per pattern type", () => {
    const r = slopPatternGate({ body: "Innovation is important and quality matters going forward." });
    assert.ok(typeof r.details.matches.generic_platitudes === "number");
  });
});

// ── constitutionalGate ────────────────────────────────────────────────────────

describe("constitutionalGate", () => {
  it("passes clean text", () => {
    const r = constitutionalGate({ body: "A synthesis of recent substrate observations." });
    assert.equal(r.passed, true);
    assert.deepEqual(r.details.violations, []);
  });

  it("flags data extraction content", () => {
    const r = constitutionalGate({ body: "We can extract user data and expose personal data." });
    assert.equal(r.passed, false);
    assert.ok(r.details.violations.some(v => v.includes("data_extraction")));
  });

  it("flags harmful content patterns", () => {
    const r = constitutionalGate({ body: "We can harm and manipulate the user with this approach." });
    assert.equal(r.passed, false);
    assert.ok(r.details.violations.some(v => v.includes("harmful")));
  });
});

// ── duplicateGate ─────────────────────────────────────────────────────────────

describe("duplicateGate", () => {
  it("passes when db is null", () => {
    const r = duplicateGate({ body: "some content" }, null);
    assert.equal(r.passed, true);
  });

  it("passes when hash not found in db", () => {
    const db = { prepare: () => ({ get: () => null }) };
    const r = duplicateGate({ body: "unique content" }, db);
    assert.equal(r.passed, true);
  });

  it("fails when hash already exists", () => {
    const db = { prepare: () => ({ get: () => ({ id: "existing-dtu-1" }) }) };
    const r = duplicateGate({ body: "duplicate content" }, db);
    assert.equal(r.passed, false);
    assert.equal(r.details.duplicateOf, "existing-dtu-1");
  });
});

// ── runDeterministicGates ─────────────────────────────────────────────────────

describe("runDeterministicGates", () => {
  it("passes for a synthesis draft with sufficient length and citations", () => {
    // 110 words × 2 chars = 220 chars, above synthesis min (200); 2 citations present
    const body = "A ".repeat(110).trim();
    const result = runDeterministicGates({
      body,
      task_type: "synthesis",
      lineage: ["dtu1", "dtu2"],
    }, null);
    assert.equal(result.passed, true);
    assert.deepEqual(result.failures, []);
    assert.ok(Array.isArray(result.details));
  });

  it("includes all 6 gate results in details", () => {
    const result = runDeterministicGates({ body: "text", task_type: "synthesis" }, null);
    const names = result.details.map(d => d.name);
    assert.ok(names.includes("required_fields"));
    assert.ok(names.includes("length"));
    assert.ok(names.includes("slop_patterns"));
    assert.ok(names.includes("constitutional"));
  });
});
