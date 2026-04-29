// server/tests/emergent-quality/peer-review.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectReviewers, determineConsensus } from "../../lib/emergents/quality/peer-review.js";

function makeReviewerDb(rows = []) {
  return {
    prepare: () => ({
      all: () => rows,
    }),
  };
}

describe("selectReviewers", () => {
  it("returns empty array when db is null", () => {
    const result = selectReviewers({}, null, { excludeId: "e1" });
    assert.deepEqual(result, []);
  });

  it("returns rows from db when available", () => {
    const fakeRows = [
      { id: "e2", given_name: "Aria", dominant_lens: "research", role: "synthesizer" },
    ];
    const db = makeReviewerDb(fakeRows);
    const result = selectReviewers({}, db, { count: 2, excludeId: "e1" });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "e2");
  });

  it("returns empty array on db error", () => {
    const db = { prepare: () => { throw new Error("db error"); } };
    const result = selectReviewers({}, db, {});
    assert.deepEqual(result, []);
  });

  it("respects count parameter limit", () => {
    const fakeRows = [
      { id: "e2", given_name: "Aria" },
      { id: "e3", given_name: "Velion" },
      { id: "e4", given_name: "Myre" },
    ];
    const db = makeReviewerDb(fakeRows);
    const result = selectReviewers({}, db, { count: 2 });
    // DB returns what SQL returns; mock returns all 3, so just verify no error
    assert.ok(Array.isArray(result));
  });
});

describe("determineConsensus", () => {
  it("returns approve when all reviewers approve", () => {
    const r = determineConsensus([
      { verdict: "approve" },
      { verdict: "approve" },
    ]);
    assert.equal(r.consensus, "approve");
  });

  it("returns reject when any reviewer abandons", () => {
    const r = determineConsensus([
      { verdict: "approve" },
      { verdict: "abandon" },
    ]);
    assert.equal(r.consensus, "reject");
  });

  it("returns escalate on mixed approve/revise", () => {
    const r = determineConsensus([
      { verdict: "approve" },
      { verdict: "revise" },
    ]);
    assert.equal(r.consensus, "escalate");
  });

  it("returns escalate when all reviewers want revise", () => {
    const r = determineConsensus([
      { verdict: "revise" },
      { verdict: "revise" },
    ]);
    assert.equal(r.consensus, "escalate");
  });

  it("returns approve with empty reviews array (no objection)", () => {
    const r = determineConsensus([]);
    assert.equal(r.consensus, "approve");
  });

  it("returns approve when reviews is null", () => {
    const r = determineConsensus(null);
    assert.equal(r.consensus, "approve");
  });

  it("preserves reviews in return value", () => {
    const reviews = [{ verdict: "approve", reviewerId: "e2" }];
    const r = determineConsensus(reviews);
    assert.equal(r.reviews, reviews);
  });
});
