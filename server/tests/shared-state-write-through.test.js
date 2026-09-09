// Pins multi-HTTP shared-state write-through helpers (fail-soft, no Redis required).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionActivityBridge,
  createMacroRateBridge,
  createApiRateBridge,
  sharedStateCoverage,
} from "../lib/concurrency/shared-state.js";

describe("shared-state write-through", () => {
  it("session activity write-behind no-ops without redis", () => {
    const bridge = createSessionActivityBridge(() => null);
    bridge.writeBehindTouch("jti-1", Date.now());
    bridge.writeBehindClear("jti-1");
    assert.ok(true);
  });

  it("hydrateInto falls back to local map", async () => {
    const bridge = createSessionActivityBridge(() => null);
    const map = new Map([["a", 100]]);
    const v = await bridge.hydrateInto(map, "a");
    assert.equal(v, 100);
    const miss = await bridge.hydrateInto(map, "missing");
    assert.equal(miss, null);
  });

  it("macro rate write-behind no-ops without redis", () => {
    const bridge = createMacroRateBridge(() => null);
    bridge.writeBehindHit("scope.metrics", 60000);
    assert.ok(true);
  });

  it("api rate bridge exists", () => {
    const bridge = createApiRateBridge(() => null);
    bridge.writeBehindHit("user:1", 60000);
    assert.ok(true);
  });

  it("coverage doc lists priority keys", () => {
    const c = sharedStateCoverage();
    assert.ok(c.writeThrough.includes("_SESSION_ACTIVITY.lastSeen"));
    assert.ok(c.writeThrough.includes("_macroRateLimits"));
    assert.ok(c.perNodeOk.includes("STATE.qualia"));
    assert.ok(c.stickyRequired.includes("STATE.sessions"));
  });

  it("with mock redis, session touch writes setEx", async () => {
    const calls = [];
    const fake = {
      setEx: async (k, ttl, v) => { calls.push(["setEx", k, ttl, v]); },
      del: async (k) => { calls.push(["del", k]); },
      get: async () => null,
    };
    const bridge = createSessionActivityBridge(() => fake);
    bridge.writeBehindTouch("abc", 12345);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls[0][0], "setEx");
    assert.match(calls[0][1], /session-activity:abc$/);
    bridge.writeBehindClear("abc");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.at(-1)[0], "del");
  });
});
