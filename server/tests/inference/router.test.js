// server/tests/inference/router.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectBrain } from "../../lib/inference/router.js";

describe("@concord/inference — Router", () => {
  it("routes conscious role to conscious brain", async () => {
    const { handle } = await selectBrain("conscious", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "conscious");
  });

  it("routes subconscious role to subconscious brain", async () => {
    const { handle } = await selectBrain("subconscious", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "subconscious");
  });

  it("routes utility role to utility brain", async () => {
    const { handle } = await selectBrain("utility", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "utility");
  });

  it("routes repair role to repair brain", async () => {
    const { handle } = await selectBrain("repair", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "repair");
  });

  it("routes multimodal role to multimodal brain", async () => {
    const { handle } = await selectBrain("multimodal", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "multimodal");
  });

  it("respects brainOverride option", async () => {
    const { handle } = await selectBrain("conscious", { brainOverride: "utility", skipAvailabilityCheck: true });
    assert.equal(handle.name, "utility");
  });

  it("handle has chat function", async () => {
    const { handle } = await selectBrain("repair", { skipAvailabilityCheck: true });
    assert.equal(typeof handle.chat, "function");
  });

  it("handle has model and url strings", async () => {
    const { handle } = await selectBrain("utility", { skipAvailabilityCheck: true });
    assert.equal(typeof handle.model, "string");
    assert.equal(typeof handle.url, "string");
  });

  it("fallbacksUsed is empty when primary is selected", async () => {
    const { fallbacksUsed } = await selectBrain("conscious", { skipAvailabilityCheck: true });
    assert.deepEqual(fallbacksUsed, []);
  });

  it("unknown role defaults to conscious brain chain", async () => {
    const { handle } = await selectBrain("unknown_role_xyz", { skipAvailabilityCheck: true });
    assert.equal(handle.name, "conscious");
  });
});
