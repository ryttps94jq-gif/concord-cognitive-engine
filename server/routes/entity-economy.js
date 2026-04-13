/**
 * Entity Economy Routes — API endpoints for inter-entity resource economy.
 *
 * Exposes the 13 `entity_economy` macros registered in server.js ~line 12784
 * so the frontend can display wallets, propose trades, view market rates,
 * and read economy metrics. The underlying module (emergent/entity-economy.js)
 * is already live in the governor heartbeat (UBI, economic cycle, wealth caps).
 *
 * GET  /api/entity-economy/accounts                 — list all entity accounts
 * GET  /api/entity-economy/accounts/:entityId       — single account
 * POST /api/entity-economy/accounts/:entityId/init  — create account
 * POST /api/entity-economy/earn                     — credit a resource to an entity
 * POST /api/entity-economy/spend                    — debit a resource from an entity
 * POST /api/entity-economy/trades                   — propose a trade
 * POST /api/entity-economy/trades/:tradeId/accept   — accept a proposed trade
 * POST /api/entity-economy/trades/:tradeId/reject   — reject a proposed trade
 * POST /api/entity-economy/specialize               — set an entity's specialization
 * GET  /api/entity-economy/market-rates             — current market rates
 * POST /api/entity-economy/cycle                    — force-run an economic cycle
 * GET  /api/entity-economy/wealth                   — wealth distribution
 * GET  /api/entity-economy/metrics                  — aggregate metrics
 *
 * Note: /api/entity-economy/dashboard already exists in server.js ~line 43934.
 */

import { asyncHandler } from "../lib/async-handler.js";

export default function registerEntityEconomyRoutes(app, {
  makeCtx,
  runMacro,
}) {

  const handle = (fn) => asyncHandler(async (req, res) => {
    try {
      const out = await fn(req);
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ── Accounts ─────────────────────────────────────────────────────────────
  app.get("/api/entity-economy/accounts", handle(async (req) =>
    runMacro("entity_economy", "list_accounts", {}, makeCtx(req))));

  app.get("/api/entity-economy/accounts/:entityId", handle(async (req) =>
    runMacro("entity_economy", "get_account", { entityId: req.params.entityId }, makeCtx(req))));

  app.post("/api/entity-economy/accounts/:entityId/init", handle(async (req) =>
    runMacro("entity_economy", "init_account", { entityId: req.params.entityId }, makeCtx(req))));

  // ── Resource flows ───────────────────────────────────────────────────────
  app.post("/api/entity-economy/earn", handle(async (req) => {
    const { entityId, resource, amount, reason } = req.body || {};
    return runMacro("entity_economy", "earn", { entityId, resource, amount, reason }, makeCtx(req));
  }));

  app.post("/api/entity-economy/spend", handle(async (req) => {
    const { entityId, resource, amount, reason } = req.body || {};
    return runMacro("entity_economy", "spend", { entityId, resource, amount, reason }, makeCtx(req));
  }));

  // ── Trades ───────────────────────────────────────────────────────────────
  app.post("/api/entity-economy/trades", handle(async (req) =>
    runMacro("entity_economy", "propose_trade", req.body || {}, makeCtx(req))));

  app.post("/api/entity-economy/trades/:tradeId/accept", handle(async (req) =>
    runMacro("entity_economy", "accept_trade", { tradeId: req.params.tradeId }, makeCtx(req))));

  app.post("/api/entity-economy/trades/:tradeId/reject", handle(async (req) =>
    runMacro("entity_economy", "reject_trade", { tradeId: req.params.tradeId }, makeCtx(req))));

  // ── Specialization ───────────────────────────────────────────────────────
  app.post("/api/entity-economy/specialize", handle(async (req) => {
    const { entityId, domain } = req.body || {};
    return runMacro("entity_economy", "specialize", { entityId, domain }, makeCtx(req));
  }));

  // ── Market & metrics ─────────────────────────────────────────────────────
  app.get("/api/entity-economy/market-rates", handle(async (req) =>
    runMacro("entity_economy", "market_rates", {}, makeCtx(req))));

  app.post("/api/entity-economy/cycle", handle(async (req) =>
    runMacro("entity_economy", "cycle", {}, makeCtx(req))));

  app.get("/api/entity-economy/wealth", handle(async (req) =>
    runMacro("entity_economy", "wealth", {}, makeCtx(req))));

  app.get("/api/entity-economy/metrics", handle(async (req) =>
    runMacro("entity_economy", "metrics", {}, makeCtx(req))));
}
