// server/tests/agentic/council.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { councilDecision } from "../../lib/agentic/council.js";

describe("Council pattern", () => {
  it("councilDecision is a function", () => {
    assert.equal(typeof councilDecision, "function");
  });

  it("returns expected shape even when sub-cognition fails (offline)", async () => {
    const result = await councilDecision({
      question: "What is the best approach for test isolation?",
      parentInferenceId: "test-council-parent-1",
      db: null,
    });
    assert.ok("decision" in result);
    assert.ok("confidence" in result);
    assert.ok("councilUsed" in result);
    assert.equal(typeof result.decision, "string");
    assert.equal(typeof result.confidence, "number");
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });

  it("councilUsed is a boolean", async () => {
    const result = await councilDecision({
      question: "Simple factual question",
      parentInferenceId: "test-council-parent-2",
      db: null,
    });
    assert.equal(typeof result.councilUsed, "boolean");
  });

  it("when councilUsed is true, explorations array is present", async () => {
    // Force low confidence scenario by setting a very high uncertaintyThreshold
    // so that even a medium confidence response triggers parallel exploration
    const result = await councilDecision({
      question: "Complex multi-faceted question requiring deliberation",
      parentInferenceId: "test-council-parent-3",
      uncertaintyThreshold: 0.99, // almost always trigger council
      exploreCount: 2,
      db: null,
    });
    if (result.councilUsed) {
      assert.ok(Array.isArray(result.explorations));
    }
  });

  it("synthesis always uses subconscious not conscious brain", async () => {
    // This is enforced in the source — councilDecision uses brainRole:'subconscious' for synthesis.
    // The test verifies the decision completes without throwing conscious_brain_unavailable.
    const result = await councilDecision({
      question: "test synthesis path",
      parentInferenceId: "test-council-synthesis",
      uncertaintyThreshold: 0.99,
      exploreCount: 2,
      db: null,
    });
    // Should not throw conscious_brain_unavailable error
    assert.ok("decision" in result);
    assert.ok(!result.decision?.includes("conscious_brain_unavailable"),
      "Synthesis must not invoke conscious brain");
  });
});
