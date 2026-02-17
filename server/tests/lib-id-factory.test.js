import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateId,
  atlasId,
  claimId,
  sourceId,
  traceId,
  sessionId,
  eventId,
  uid,
} from "../lib/id-factory.js";

describe("ID factory", () => {
  it("generateId produces correct format", () => {
    const id = generateId("test");
    assert.ok(id.startsWith("test_"), `Expected prefix 'test_', got: ${id}`);
    const parts = id.split("_");
    assert.equal(parts.length, 3, "Should have 3 parts: prefix_timestamp_random");
    assert.ok(parts[1].length > 0, "timestamp part should be non-empty");
    assert.equal(parts[2].length, 12, "random part should be 12 hex chars (6 bytes)");
  });

  it("generateId with custom random bytes", () => {
    const id = generateId("short", 2);
    const parts = id.split("_");
    assert.equal(parts[2].length, 4, "2 random bytes = 4 hex chars");
  });

  it("atlasId starts with atlas_", () => {
    const id = atlasId();
    assert.ok(id.startsWith("atlas_"), id);
  });

  it("claimId starts with c_", () => {
    const id = claimId();
    assert.ok(id.startsWith("c_"), id);
  });

  it("sourceId starts with src_", () => {
    const id = sourceId();
    assert.ok(id.startsWith("src_"), id);
  });

  it("traceId starts with gt_", () => {
    const id = traceId();
    assert.ok(id.startsWith("gt_"), id);
  });

  it("traceId is monotonically increasing", () => {
    const a = traceId();
    const b = traceId();
    assert.notEqual(a, b, "Consecutive trace IDs should differ");
    // The sequence part (3rd segment) should be increasing
    const seqA = parseInt(a.split("_")[2], 36);
    const seqB = parseInt(b.split("_")[2], 36);
    assert.ok(seqB > seqA, `Sequence should increase: ${seqA} < ${seqB}`);
  });

  it("sessionId starts with ds_", () => {
    const id = sessionId();
    assert.ok(id.startsWith("ds_"), id);
  });

  it("eventId starts with evt_", () => {
    const id = eventId();
    assert.ok(id.startsWith("evt_"), id);
  });

  it("uid uses custom prefix", () => {
    const id = uid("custom");
    assert.ok(id.startsWith("custom_"), id);
  });

  it("all IDs are unique across 1000 generations", () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId("uniq"));
    }
    assert.equal(ids.size, 1000, "All 1000 IDs should be unique");
  });

  it("IDs contain only safe characters", () => {
    const safePattern = /^[a-z0-9_]+$/;
    for (let i = 0; i < 100; i++) {
      const id = generateId("safe");
      assert.ok(safePattern.test(id), `ID should be URL-safe: ${id}`);
    }
  });
});
