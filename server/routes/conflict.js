/**
 * Conflict Routes — API endpoints for the three-tier dispute resolution system.
 *
 * Exposes the 11 `conflict` macros registered in server.js ~line 12857 so the
 * frontend can file/list disputes, walk the mediation/arbitration flow, and
 * query precedent. The underlying module (emergent/conflict-resolution.js)
 * handles mediation → arbitration → adjudication escalation.
 *
 * Not to be confused with /api/disputes (marketplace transaction disputes in
 * routes/disputes.js — a separate subsystem).
 *
 * POST /api/conflict/disputes                         — file a new dispute
 * GET  /api/conflict/disputes                         — list disputes
 * GET  /api/conflict/disputes/:id                     — get a single dispute
 * POST /api/conflict/disputes/:id/mediator            — assign a mediator
 * POST /api/conflict/disputes/:id/resolutions         — propose a resolution
 * POST /api/conflict/disputes/:id/resolutions/accept  — party accepts resolution
 * POST /api/conflict/disputes/:id/resolutions/reject  — party rejects resolution
 * POST /api/conflict/disputes/:id/escalate            — escalate to next tier
 * POST /api/conflict/disputes/:id/adjudicate          — final adjudication
 * GET  /api/conflict/precedents                       — search precedent
 * GET  /api/conflict/metrics                          — aggregate metrics
 */

import { asyncHandler } from "../lib/async-handler.js";

export default function registerConflictRoutes(app, {
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

  // ── File / list / get ────────────────────────────────────────────────────
  app.post("/api/conflict/disputes", handle(async (req) =>
    runMacro("conflict", "file_dispute", req.body || {}, makeCtx(req))));

  app.get("/api/conflict/disputes", handle(async (req) =>
    runMacro("conflict", "list_disputes", {
      status: req.query.status,
      type: req.query.type,
      limit: Math.min(Number(req.query.limit) || 50, 200),
    }, makeCtx(req))));

  app.get("/api/conflict/disputes/:id", handle(async (req) =>
    runMacro("conflict", "get_dispute", { id: req.params.id }, makeCtx(req))));

  // ── Mediation ────────────────────────────────────────────────────────────
  app.post("/api/conflict/disputes/:id/mediator", handle(async (req) => {
    const { mediatorId } = req.body || {};
    return runMacro("conflict", "assign_mediator", {
      disputeId: req.params.id,
      mediatorId,
    }, makeCtx(req));
  }));

  app.post("/api/conflict/disputes/:id/resolutions", handle(async (req) => {
    const { resolution } = req.body || {};
    return runMacro("conflict", "propose_resolution", {
      disputeId: req.params.id,
      resolution,
    }, makeCtx(req));
  }));

  app.post("/api/conflict/disputes/:id/resolutions/accept", handle(async (req) => {
    const { partyId } = req.body || {};
    return runMacro("conflict", "accept_resolution", {
      disputeId: req.params.id,
      partyId,
    }, makeCtx(req));
  }));

  app.post("/api/conflict/disputes/:id/resolutions/reject", handle(async (req) => {
    const { partyId, reason } = req.body || {};
    return runMacro("conflict", "reject_resolution", {
      disputeId: req.params.id,
      partyId,
      reason,
    }, makeCtx(req));
  }));

  // ── Escalation / adjudication ────────────────────────────────────────────
  app.post("/api/conflict/disputes/:id/escalate", handle(async (req) =>
    runMacro("conflict", "escalate", { disputeId: req.params.id }, makeCtx(req))));

  app.post("/api/conflict/disputes/:id/adjudicate", handle(async (req) => {
    const { ruling } = req.body || {};
    return runMacro("conflict", "adjudicate", {
      disputeId: req.params.id,
      ruling,
    }, makeCtx(req));
  }));

  // ── Precedent & metrics ──────────────────────────────────────────────────
  app.get("/api/conflict/precedents", handle(async (req) =>
    runMacro("conflict", "find_precedent", { query: req.query.q || "" }, makeCtx(req))));

  app.get("/api/conflict/metrics", handle(async (req) =>
    runMacro("conflict", "metrics", {}, makeCtx(req))));
}
