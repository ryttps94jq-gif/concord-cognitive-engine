// server/tests/agentic/hooks.test.js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register, execute, listHooks, HOOK_TYPES } from "../../lib/agentic/hooks.js";

// Clear all registered hooks before each test by unregistering them
const _cleanups = [];
function reg(type, handler, opts) {
  const unregister = register(type, handler, opts);
  _cleanups.push(unregister);
  return unregister;
}

function cleanup() {
  while (_cleanups.length) _cleanups.pop()();
}

describe("Lifecycle hooks registry", () => {
  it("exports HOOK_TYPES as an array of strings", () => {
    assert.ok(Array.isArray(HOOK_TYPES));
    assert.ok(HOOK_TYPES.includes("before_inference"));
    assert.ok(HOOK_TYPES.includes("before_tool"));
    assert.ok(HOOK_TYPES.includes("on_governance_violation"));
  });

  it("register throws for unknown hook type", () => {
    assert.throws(
      () => register("unknown_hook_type", () => {}),
      /Unknown hook type/
    );
  });

  it("register returns an unregister function", () => {
    const unregister = register("before_tool", () => {});
    assert.equal(typeof unregister, "function");
    unregister();
  });

  it("execute runs registered handler and returns aborted:false", async () => {
    let called = false;
    const unregister = reg("before_tool", async () => { called = true; }, { name: "test-handler" });
    const result = await execute("before_tool", { tool: { type: "test" } });
    cleanup();
    assert.equal(called, true);
    assert.equal(result.aborted, false);
  });

  it("execute runs handlers in priority order (lower first)", async () => {
    const order = [];
    reg("after_inference", async () => { order.push("p50"); }, { priority: 50, name: "p50" });
    reg("after_inference", async () => { order.push("p10"); }, { priority: 10, name: "p10" });
    reg("after_inference", async () => { order.push("p90"); }, { priority: 90, name: "p90" });
    await execute("after_inference", {});
    cleanup();
    assert.deepEqual(order, ["p10", "p50", "p90"]);
  });

  it("abort from handler stops execution and returns aborted:true", async () => {
    const second = [];
    reg("before_inference", async () => ({ abort: true, reason: "test-abort" }), { priority: 10, name: "aborter" });
    reg("before_inference", async () => { second.push("ran"); }, { priority: 20, name: "should-not-run" });
    const result = await execute("before_inference", {});
    cleanup();
    assert.equal(result.aborted, true);
    assert.equal(result.reason, "test-abort");
    assert.equal(second.length, 0);
  });

  it("handler error is non-fatal — remaining handlers still run", async () => {
    const ran = [];
    reg("on_error", async () => { throw new Error("handler blew up"); }, { priority: 5, name: "bad-handler" });
    reg("on_error", async () => { ran.push("ok"); }, { priority: 10, name: "good-handler" });
    const result = await execute("on_error", {});
    cleanup();
    assert.equal(result.aborted, false);
    assert.deepEqual(ran, ["ok"]);
  });

  it("unregister removes a handler", async () => {
    let called = false;
    const unregister = register("on_dtu_creation", async () => { called = true; }, { name: "removable" });
    unregister();
    await execute("on_dtu_creation", {});
    assert.equal(called, false);
  });

  it("listHooks returns all hook types", () => {
    const hooks = listHooks();
    for (const type of HOOK_TYPES) {
      assert.ok(type in hooks, `${type} missing from listHooks`);
      assert.ok(Array.isArray(hooks[type]));
    }
  });
});
