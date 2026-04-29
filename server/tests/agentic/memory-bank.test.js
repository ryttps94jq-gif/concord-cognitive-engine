// server/tests/agentic/memory-bank.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeMemory, readMemory, MEMORY_LAYERS } from "../../lib/agentic/memory-bank.js";

describe("Memory bank", () => {
  it("MEMORY_LAYERS defines episodic, semantic, procedural", () => {
    assert.ok("episodic" in MEMORY_LAYERS);
    assert.ok("semantic" in MEMORY_LAYERS);
    assert.ok("procedural" in MEMORY_LAYERS);
  });

  it("writeMemory throws for unknown layer", async () => {
    await assert.rejects(
      () => writeMemory("unknown_layer", { content: "test" }, { async: false }),
      /Unknown memory layer/
    );
  });

  it("writeMemory episodic with no userId returns written:false", async () => {
    const result = await writeMemory("episodic", { intent: "test" }, { async: false });
    assert.equal(result.written, false);
  });

  it("writeMemory semantic returns written:false (managed externally)", async () => {
    const result = await writeMemory("semantic", { title: "test" }, { async: false });
    assert.equal(result.written, false);
    assert.ok(result.reason?.includes("dtu-pipeline"));
  });

  it("writeMemory procedural returns written:false (managed via skill files)", async () => {
    const result = await writeMemory("procedural", { skill: "test" }, { async: false });
    assert.equal(result.written, false);
  });

  it("writeMemory async path returns a Promise", () => {
    const p = writeMemory("episodic", { intent: "async test" }, { async: true });
    assert.ok(typeof p.then === "function");
  });

  it("readMemory with mock db returns all three layers", async () => {
    const mockDb = {
      prepare: () => ({ all: () => [] }),
    };
    const results = await readMemory({
      layers: ["episodic", "semantic", "procedural"],
      query: "test",
      db: mockDb,
    });
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 3);
    for (const r of results) {
      assert.ok("layer" in r);
      assert.ok("block" in r);
      assert.ok("items" in r);
    }
  });

  it("readMemory episodic returns empty when no sessionKey", async () => {
    const results = await readMemory({
      layers: ["episodic"],
      query: "test query",
      userId: "u1",
      sessionKey: null,
      db: null,
    });
    assert.equal(results[0].layer, "episodic");
    assert.deepEqual(results[0].items, []);
  });

  it("readMemory semantic queries db when provided", async () => {
    const mockDb = {
      prepare: () => ({
        all: () => [{ id: "dtu1", title: "Test", content: "Some relevant content" }],
      }),
    };
    const results = await readMemory({
      layers: ["semantic"],
      query: "test",
      db: mockDb,
    });
    assert.equal(results[0].layer, "semantic");
    assert.equal(results[0].items.length, 1);
    assert.ok(results[0].block.includes("SEMANTIC MEMORY"));
  });

  it("readMemory with unknown layer is skipped gracefully", async () => {
    const results = await readMemory({ layers: ["procedural"], query: "anything" });
    assert.equal(results.length, 1);
    assert.equal(results[0].layer, "procedural");
  });
});
