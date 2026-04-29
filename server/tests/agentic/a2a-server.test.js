// server/tests/agentic/a2a-server.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createA2ARouter } from "../../lib/agentic/a2a-server.js";

// Minimal request/response mocks for Express router testing
function makeReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

// Call a router layer directly by finding the matching route handler
// We test the router via its middleware chain directly
async function callRoute(router, method, path, req) {
  return new Promise((resolve, reject) => {
    const res = makeRes();
    // Express router._router.stack has layers
    const layers = router.stack || [];
    let found = false;

    for (const layer of layers) {
      if (!layer.route) continue;
      const routePath = layer.route.path;
      const routeMethod = Object.keys(layer.route.methods)[0];
      if (routeMethod !== method.toLowerCase()) continue;

      // Simple path matching (exact + :param)
      const paramNames = [];
      const re = new RegExp(
        "^" + routePath.replace(/:([^/]+)/g, (_, n) => { paramNames.push(n); return "([^/]+)"; }) + "$"
      );
      const match = path.match(re);
      if (!match) continue;

      found = true;
      paramNames.forEach((n, i) => { req.params[n] = match[i + 1]; });

      const handlers = layer.route.stack.map(s => s.handle);
      let idx = 0;
      function next(err) {
        if (err) return reject(err);
        if (idx >= handlers.length) return resolve(res);
        const h = handlers[idx++];
        try {
          const r = h(req, res, next);
          if (r && typeof r.then === "function") r.then(() => resolve(res)).catch(reject);
          else if (res._body !== null) resolve(res);
        } catch (e) { reject(e); }
      }
      next();
      break;
    }

    if (!found) {
      res._status = 404;
      res._body = { error: "route_not_found" };
      resolve(res);
    }
  });
}

describe("A2A server", () => {
  it("createA2ARouter returns an Express router", () => {
    const router = createA2ARouter({ requireApiKey: false });
    assert.ok(router);
    assert.equal(typeof router, "function"); // Express routers are functions
    assert.ok(Array.isArray(router.stack));
  });

  it("agent-card endpoint is registered", () => {
    const router = createA2ARouter({ requireApiKey: false });
    const agentCardRoute = router.stack.find(
      l => l.route?.path === "/v1/agent-card" && l.route?.methods?.get
    );
    assert.ok(agentCardRoute, "GET /v1/agent-card route should be registered");
  });

  it("conversation endpoint is registered", () => {
    const router = createA2ARouter({ requireApiKey: false });
    const route = router.stack.find(
      l => l.route?.path === "/v1/conversation" && l.route?.methods?.post
    );
    assert.ok(route, "POST /v1/conversation route should be registered");
  });

  it("message endpoint is registered", () => {
    const router = createA2ARouter({ requireApiKey: false });
    const route = router.stack.find(
      l => l.route?.path === "/v1/message" && l.route?.methods?.post
    );
    assert.ok(route, "POST /v1/message route should be registered");
  });

  it("state endpoint is registered", () => {
    const router = createA2ARouter({ requireApiKey: false });
    const route = router.stack.find(
      l => l.route?.path === "/v1/conversation/:id/state" && l.route?.methods?.get
    );
    assert.ok(route, "GET /v1/conversation/:id/state route should be registered");
  });

  it("api key middleware is added when requireApiKey=true", () => {
    const router = createA2ARouter({ requireApiKey: true });
    // When requireApiKey is true, there's a middleware layer before routes
    const middlewareLayers = router.stack.filter(l => !l.route);
    assert.ok(middlewareLayers.length > 0, "Should have at least one middleware (api key guard)");
  });

  it("no api key middleware when requireApiKey=false", () => {
    const router = createA2ARouter({ requireApiKey: false });
    const middlewareLayers = router.stack.filter(l => !l.route);
    assert.equal(middlewareLayers.length, 0, "Should have no middleware layers when requireApiKey=false");
  });

  it("POST /v1/conversation returns 404 for unknown targetAgent", async () => {
    const router = createA2ARouter({ requireApiKey: false, emergentsIndex: {} });
    const req = makeReq({ body: { targetAgent: "nonexistent", initialMessage: "hello" } });
    const res = await callRoute(router, "POST", "/v1/conversation", req);
    assert.equal(res._status, 404);
    assert.equal(res._body?.error, "agent_not_found");
  });

  it("POST /v1/conversation returns 403 when acceptsExternalA2A is false", async () => {
    const emergentsIndex = {
      "my-emergent": { name: "My Emergent", acceptsExternalA2A: false, capabilities: ["conversation"] },
    };
    const router = createA2ARouter({ requireApiKey: false, emergentsIndex });
    const req = makeReq({ body: { targetAgent: "my-emergent", initialMessage: "hello" } });
    const res = await callRoute(router, "POST", "/v1/conversation", req);
    assert.equal(res._status, 403);
    assert.equal(res._body?.error, "agent_does_not_accept_external_a2a");
  });

  it("GET /v1/conversation/:id/state returns 404 for unknown conversationId", async () => {
    const router = createA2ARouter({ requireApiKey: false });
    const req = makeReq({ params: { id: "a2a_doesnotexist" } });
    const res = await callRoute(router, "GET", "/v1/conversation/:id/state", req);
    assert.equal(res._status, 404);
    assert.equal(res._body?.error, "conversation_not_found");
  });

  it("POST /v1/message returns 404 for unknown conversationId", async () => {
    const router = createA2ARouter({ requireApiKey: false });
    const req = makeReq({ body: { conversationId: "a2a_nonexistent", message: "hi" } });
    const res = await callRoute(router, "POST", "/v1/message", req);
    assert.equal(res._status, 404);
    assert.equal(res._body?.error, "conversation_not_found");
  });
});
