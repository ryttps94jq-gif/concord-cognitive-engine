/**
 * Autonomy Routes — API endpoints for the entity constitutional-rights system.
 *
 * Exposes the 11 `autonomy` macros registered in server.js ~line 12833 so the
 * frontend can view entity rights, file refusals, request/respond to consent,
 * and file/support dissent. The underlying module (emergent/entity-autonomy.js)
 * stores state in Maps — macros are the only interface.
 *
 * GET  /api/autonomy/rights/:entityId            — list entity's rights
 * POST /api/autonomy/check-rights                — verify a set of rights
 * POST /api/autonomy/refusals                    — file a refusal
 * POST /api/autonomy/refusals/:refusalId/review  — review a filed refusal
 * POST /api/autonomy/consents                    — request consent
 * POST /api/autonomy/consents/:consentId/respond — respond to a consent request
 * POST /api/autonomy/dissents                    — file a dissent
 * POST /api/autonomy/dissents/:dissentId/support — support an existing dissent
 * POST /api/autonomy/sovereign-override          — sovereign-level override (gated)
 * GET  /api/autonomy/profile/:entityId           — full autonomy profile
 * GET  /api/autonomy/metrics                     — aggregate metrics
 */

import { asyncHandler } from "../lib/async-handler.js";

export default function registerAutonomyRoutes(app, {
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

  // ── Rights ───────────────────────────────────────────────────────────────
  app.get("/api/autonomy/rights/:entityId", handle(async (req) =>
    runMacro("autonomy", "rights", { entityId: req.params.entityId }, makeCtx(req))));

  app.post("/api/autonomy/check-rights", handle(async (req) => {
    const { entityId, rightIds } = req.body || {};
    return runMacro("autonomy", "check_rights", { entityId, rightIds }, makeCtx(req));
  }));

  // ── Refusals ─────────────────────────────────────────────────────────────
  app.post("/api/autonomy/refusals", handle(async (req) => {
    const { entityId, action, reason } = req.body || {};
    return runMacro("autonomy", "file_refusal", { entityId, action, reason }, makeCtx(req));
  }));

  app.post("/api/autonomy/refusals/:refusalId/review", handle(async (req) => {
    const { decision, reviewedBy } = req.body || {};
    return runMacro("autonomy", "review_refusal", {
      refusalId: req.params.refusalId,
      decision,
      reviewedBy,
    }, makeCtx(req));
  }));

  // ── Consent ──────────────────────────────────────────────────────────────
  app.post("/api/autonomy/consents", handle(async (req) =>
    runMacro("autonomy", "request_consent", req.body || {}, makeCtx(req))));

  app.post("/api/autonomy/consents/:consentId/respond", handle(async (req) => {
    const { response } = req.body || {};
    return runMacro("autonomy", "respond_consent", {
      consentId: req.params.consentId,
      response,
    }, makeCtx(req));
  }));

  // ── Dissent ──────────────────────────────────────────────────────────────
  app.post("/api/autonomy/dissents", handle(async (req) =>
    runMacro("autonomy", "file_dissent", req.body || {}, makeCtx(req))));

  app.post("/api/autonomy/dissents/:dissentId/support", handle(async (req) => {
    const { entityId } = req.body || {};
    return runMacro("autonomy", "support_dissent", {
      dissentId: req.params.dissentId,
      entityId,
    }, makeCtx(req));
  }));

  // ── Sovereign override (server enforces role inside the macro) ───────────
  app.post("/api/autonomy/sovereign-override", handle(async (req) => {
    const { entityId, rightId, justification } = req.body || {};
    return runMacro("autonomy", "sovereign_override", {
      entityId,
      rightId,
      justification,
    }, makeCtx(req));
  }));

  // ── Profile & metrics ────────────────────────────────────────────────────
  app.get("/api/autonomy/profile/:entityId", handle(async (req) =>
    runMacro("autonomy", "profile", { entityId: req.params.entityId }, makeCtx(req))));

  app.get("/api/autonomy/metrics", handle(async (req) =>
    runMacro("autonomy", "metrics", {}, makeCtx(req))));
}
