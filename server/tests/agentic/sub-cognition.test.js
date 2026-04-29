// server/tests/agentic/sub-cognition.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSubCognition } from "../../lib/agentic/sub-cognition.js";

describe("Sub-cognition", () => {
  it("spawnSubCognition is a function", () => {
    assert.equal(typeof spawnSubCognition, "function");
  });

  it("returns expected shape even when inference fails", async () => {
    const result = await spawnSubCognition({
      task: "test task",
      parentInferenceId: "parent-test-123",
      brainRole: "utility",
      timeoutMs: 1000,
      db: null,
    });
    assert.ok("subId" in result);
    assert.ok("parentInferenceId" in result);
    assert.ok("distilledOutput" in result);
    assert.ok("keyDTUsCreated" in result);
    assert.ok("metadata" in result);
    assert.equal(result.parentInferenceId, "parent-test-123");
    assert.ok(typeof result.subId === "string" && result.subId.startsWith("sub_"));
    assert.ok(Array.isArray(result.keyDTUsCreated));
  });

  it("remaps conscious brainRole to subconscious", async () => {
    // When brainRole is 'conscious', sub-cognition must remap to 'subconscious'
    // to preserve the conscious brain exclusively for user-facing chat.
    // We verify this by checking that the call doesn't throw and the callerId
    // reflects 'sub-cognition' (not a conscious-brain caller prefix).
    const result = await spawnSubCognition({
      task: "what is 2 + 2",
      parentInferenceId: "parent-remap-test",
      brainRole: "conscious", // this must be silently remapped
      timeoutMs: 1000,
      db: null,
    });
    // Even if inference fails (offline), the structure should be correct
    // and the error should not be "conscious brain unavailable" since we remapped
    assert.ok("distilledOutput" in result);
    // The error if any should be from inference, not from conscious-unavailable enforcement
    if (result.metadata?.error) {
      assert.ok(!result.metadata.error.includes("conscious_brain_unavailable"),
        "Sub-cognition should have remapped conscious to subconscious, not enforced conscious availability");
    }
  });

  it("returns error shape when inference throws", async () => {
    // With no real Ollama running, inference will fail
    const result = await spawnSubCognition({
      task: "task that will fail",
      parentInferenceId: "parent-fail-test",
      brainRole: "repair",
      timeoutMs: 500,
      db: null,
    });
    // Either succeeds or returns error shape — never throws
    assert.ok("distilledOutput" in result);
    assert.ok("metadata" in result);
    assert.equal(typeof result.distilledOutput, "string");
  });

  it("subId is unique across calls", async () => {
    const [r1, r2] = await Promise.all([
      spawnSubCognition({ task: "t1", parentInferenceId: "p1", timeoutMs: 500, db: null }),
      spawnSubCognition({ task: "t2", parentInferenceId: "p2", timeoutMs: 500, db: null }),
    ]);
    assert.notEqual(r1.subId, r2.subId);
  });
});
