/**
 * Chicken2 Gate Routes — REST API for the named reality gate.
 *
 *   POST /api/chicken2/validate  — validate any subject through the gate
 *   GET  /api/chicken2/stats     — aggregate gate statistics
 *   GET  /api/chicken2/layers    — describe the 6 validation layers
 *   POST /api/chicken2/reset     — reset gate statistics (admin only)
 */

import { asyncHandler } from "../lib/async-handler.js";
import { createChicken2Gate } from "../lib/chicken2-gate.js";

/**
 * Register chicken2 routes on the Express app.
 *
 * @param {import("express").Application} app
 * @param {object} deps
 * @param {object} [deps.dtuStore]       — DTU store (STATE.dtus)
 * @param {object} [deps.manifoldStore]  — FeasibilityManifold instance
 * @param {object} [deps.qualityGate]    — quality-gate module
 * @param {Function} [deps.requireAuth]  — auth middleware
 * @param {Function} [deps.requireRole]  — role middleware
 * @param {Function} [deps.log]          — structured logger
 */
export default function registerChicken2Routes(app, {
  dtuStore = null,
  manifoldStore = null,
  qualityGate = null,
  requireAuth = (_req, _res, next) => next(),
  requireRole = () => (_req, _res, next) => next(),
  log = () => {},
} = {}) {
  const gate = createChicken2Gate({ dtuStore, manifoldStore, qualityGate });
  const adminOnly = requireRole("admin");

  // ── POST /api/chicken2/validate ────────────────────────────────────────
  app.post(
    "/api/chicken2/validate",
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const subject = body.subject;
      const kind = body.kind || "answer";
      const metadata = body.metadata || {};

      if (subject === undefined || subject === null) {
        return res.status(400).json({
          ok: false,
          error: "Missing `subject` in request body.",
        });
      }

      if (!["answer", "dtu", "entity", "action"].includes(kind)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid kind: ${kind}. Must be one of: answer, dtu, entity, action.`,
        });
      }

      try {
        const result = await gate.validate(subject, { kind, metadata });
        log("info", "chicken2_validate", {
          kind,
          passed: result.passed,
          confidence: result.confidence,
          tookMs: result.tookMs,
        });
        res.json({ ok: true, result });
      } catch (e) {
        log("error", "chicken2_validate_error", { error: e.message });
        res.status(500).json({ ok: false, error: e.message });
      }
    }),
  );

  // ── GET /api/chicken2/stats ────────────────────────────────────────────
  app.get(
    "/api/chicken2/stats",
    asyncHandler(async (_req, res) => {
      res.json({
        ok: true,
        stats: gate.getStats(),
        timestamp: new Date().toISOString(),
      });
    }),
  );

  // ── GET /api/chicken2/layers ───────────────────────────────────────────
  app.get(
    "/api/chicken2/layers",
    asyncHandler(async (_req, res) => {
      res.json({
        ok: true,
        layers: gate.describeLayers(),
      });
    }),
  );

  // ── POST /api/chicken2/reset ───────────────────────────────────────────
  app.post(
    "/api/chicken2/reset",
    adminOnly,
    asyncHandler(async (_req, res) => {
      gate.resetStats();
      log("info", "chicken2_stats_reset", {});
      res.json({ ok: true, stats: gate.getStats() });
    }),
  );

  return gate;
}
