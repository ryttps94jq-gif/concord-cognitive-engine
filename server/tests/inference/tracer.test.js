// server/tests/inference/tracer.test.js
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emit, getSpans, clearSpans, addListener } from "../../lib/inference/tracer.js";

describe("@concord/inference — Tracer", () => {
  beforeEach(() => clearSpans());

  it("emit stores a span", () => {
    emit("start", "inf_001", { brainUsed: "conscious", callerId: "test" });
    const spans = getSpans();
    assert.equal(spans.length, 1);
    assert.equal(spans[0].inferenceId, "inf_001");
    assert.equal(spans[0].type, "start");
  });

  it("emit sanitizes user content — intent not captured", () => {
    emit("finish", "inf_002", { brainUsed: "utility", intent: "user private text", tokensIn: 100 });
    const span = getSpans("inf_002")[0];
    assert.ok(!("intent" in span.data), "intent (user content) must not appear in span");
  });

  it("emit sanitizes personal substrate content", () => {
    emit("step", "inf_003", { content: "private notes", scope: "user-private", tokensOut: 50 });
    const span = getSpans("inf_003")[0];
    assert.ok(!("content" in span.data), "content must not appear in span");
    assert.equal(span.data.scope, "user-private");
  });

  it("getSpans filters by inferenceId", () => {
    emit("start", "inf_A", { brainUsed: "conscious" });
    emit("finish", "inf_B", { brainUsed: "utility" });
    assert.equal(getSpans("inf_A").length, 1);
    assert.equal(getSpans("inf_B").length, 1);
  });

  it("getSpans with no id returns all", () => {
    emit("start", "inf_X", {});
    emit("finish", "inf_X", {});
    assert.ok(getSpans().length >= 2);
  });

  it("addListener is called on emit", () => {
    let called = false;
    const unsub = addListener(() => { called = true; });
    emit("failure", "inf_F", { error: "test" });
    assert.equal(called, true);
    unsub();
  });

  it("addListener unsubscribe stops notifications", () => {
    let count = 0;
    const unsub = addListener(() => { count++; });
    emit("start", "inf_G", {});
    unsub();
    emit("finish", "inf_G", {});
    assert.equal(count, 1);
  });

  it("no user data in span.data for any allowed key", () => {
    emit("finish", "inf_H", {
      brainUsed: "conscious", modelUsed: "qwen", role: "conscious",
      tokensIn: 100, tokensOut: 50, latencyMs: 200, callerId: "chat",
    });
    const span = getSpans("inf_H")[0];
    assert.equal(span.data.brainUsed, "conscious");
    assert.equal(span.data.tokensIn, 100);
  });

  it("privacy: history array not captured", () => {
    emit("start", "inf_I", { history: [{ role: "user", content: "private" }], brainUsed: "conscious" });
    const span = getSpans("inf_I")[0];
    assert.ok(!("history" in span.data));
  });
});
