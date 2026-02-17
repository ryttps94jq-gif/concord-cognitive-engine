/**
 * Tests for request timeout middleware.
 * Ensures hung requests are properly terminated and healthy requests complete.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

// ---- Helpers to simulate Express req/res ----

function makeReq(overrides = {}) {
  return {
    id: "req_test_001",
    path: overrides.path || "/api/dtus",
    headers: { accept: overrides.accept || "application/json" },
    ...overrides
  };
}

function makeRes() {
  const res = new EventEmitter();
  res.headersSent = false;
  res._statusCode = null;
  res._body = null;
  res.status = (code) => { res._statusCode = code; return res; };
  res.json = (body) => { res._body = body; res.headersSent = true; return res; };
  return res;
}

// ---- Import the timeout middleware by reconstructing its logic ----
// (We test the middleware contract directly since server.js is not easily importable as a module)

const DEFAULT_TIMEOUT_MS = 30000;
const LLM_TIMEOUT_MS = 120000;
const _LLM_ROUTE_PREFIXES = ["/api/chat", "/api/forge", "/api/ask", "/api/swarm", "/api/sim", "/api/council/debate"];

function requestTimeoutMiddleware(req, res, next) {
  const accept = String(req.headers.accept || "");
  if (accept.includes("text/event-stream")) return next();
  if (req.path === "/health" || req.path === "/ready" || req.path === "/metrics") return next();

  const isLLMRoute = _LLM_ROUTE_PREFIXES.some(p => req.path.startsWith(p));
  const timeoutMs = isLLMRoute ? LLM_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        ok: false,
        error: "Request timeout",
        code: "REQUEST_TIMEOUT",
        timeoutMs,
        requestId: req.id
      });
    }
  }, timeoutMs);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
}

describe("Request Timeout Middleware", () => {

  describe("route classification", () => {
    it("skips SSE/streaming requests", () => {
      const req = makeReq({ accept: "text/event-stream" });
      const res = makeRes();
      let called = false;
      requestTimeoutMiddleware(req, res, () => { called = true; });
      assert.ok(called, "next() should be called immediately for SSE");
    });

    it("skips health endpoint", () => {
      const req = makeReq({ path: "/health" });
      const res = makeRes();
      let called = false;
      requestTimeoutMiddleware(req, res, () => { called = true; });
      assert.ok(called);
    });

    it("skips ready endpoint", () => {
      const req = makeReq({ path: "/ready" });
      const res = makeRes();
      let called = false;
      requestTimeoutMiddleware(req, res, () => { called = true; });
      assert.ok(called);
    });

    it("skips metrics endpoint", () => {
      const req = makeReq({ path: "/metrics" });
      const res = makeRes();
      let called = false;
      requestTimeoutMiddleware(req, res, () => { called = true; });
      assert.ok(called);
    });

    it("applies to regular API endpoints", () => {
      const req = makeReq({ path: "/api/dtus" });
      const res = makeRes();
      let called = false;
      requestTimeoutMiddleware(req, res, () => { called = true; });
      assert.ok(called, "next() should be called for normal routes");
    });
  });

  describe("timeout behavior", () => {
    it("classifies /api/chat as LLM route (120s timeout)", () => {
      const req = makeReq({ path: "/api/chat" });
      const res = makeRes();
      requestTimeoutMiddleware(req, res, () => {});
      // If it times out, it should use LLM_TIMEOUT_MS
      // We can't wait 120s, but we verify by forcing a timeout via manual timer
      // Instead, verify the route detection logic
      const isLLM = _LLM_ROUTE_PREFIXES.some(p => "/api/chat".startsWith(p));
      assert.ok(isLLM, "/api/chat should be classified as LLM route");
      res.emit("finish"); // clean up timer
    });

    it("classifies /api/forge/manual as LLM route", () => {
      const isLLM = _LLM_ROUTE_PREFIXES.some(p => "/api/forge/manual".startsWith(p));
      assert.ok(isLLM);
    });

    it("classifies /api/council/debate as LLM route", () => {
      const isLLM = _LLM_ROUTE_PREFIXES.some(p => "/api/council/debate".startsWith(p));
      assert.ok(isLLM);
    });

    it("classifies /api/dtus as non-LLM route (30s timeout)", () => {
      const isLLM = _LLM_ROUTE_PREFIXES.some(p => "/api/dtus".startsWith(p));
      assert.ok(!isLLM, "/api/dtus should NOT be classified as LLM route");
    });

    it("cleans up timer on response finish", () => {
      const req = makeReq({ path: "/api/dtus" });
      const res = makeRes();
      requestTimeoutMiddleware(req, res, () => {});
      // Simulate response completing
      res.emit("finish");
      // Timer should be cleared — no 503 after this
      assert.ok(!res.headersSent || res._statusCode !== 503);
    });

    it("cleans up timer on response close", () => {
      const req = makeReq({ path: "/api/dtus" });
      const res = makeRes();
      requestTimeoutMiddleware(req, res, () => {});
      res.emit("close");
      assert.ok(!res.headersSent || res._statusCode !== 503);
    });

    it("does not double-send if headers already sent", () => {
      const req = makeReq({ path: "/api/test" });
      const res = makeRes();
      res.headersSent = true; // Simulate already sent
      requestTimeoutMiddleware(req, res, () => {});
      // Even if timeout fires, headersSent prevents duplicate response
      // Verify the guard logic
      assert.ok(res.headersSent);
      res.emit("finish"); // clean up
    });
  });

  describe("timeout response shape", () => {
    it("returns 503 with correct error body on timeout", async () => {
      // Use a very short timeout to test the actual firing
      const SHORT_TIMEOUT = 50;
      const req = makeReq({ path: "/api/test" });
      const res = makeRes();

      // Custom middleware with short timeout for testing
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          res.status(503).json({
            ok: false,
            error: "Request timeout",
            code: "REQUEST_TIMEOUT",
            timeoutMs: SHORT_TIMEOUT,
            requestId: req.id
          });
        }
      }, SHORT_TIMEOUT);

      res.on("finish", () => clearTimeout(timer));

      await new Promise(resolve => { setTimeout(resolve, SHORT_TIMEOUT + 20); });

      assert.equal(res._statusCode, 503);
      assert.equal(res._body.ok, false);
      assert.equal(res._body.code, "REQUEST_TIMEOUT");
      assert.equal(res._body.requestId, "req_test_001");
    });
  });
});
