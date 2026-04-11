/**
 * Audit log routes — queryable audit trail endpoints.
 * Mounted at /api/audit
 */
import express from "express";
import { getAuditLog, getAuditLogForUser } from "../lib/audit-logger.js";

/**
 * Create the audit-log router.
 *
 * @param {object} deps
 * @param {Function} deps.requireRole - RBAC middleware (e.g. requireRole("owner","admin"))
 * @returns {import('express').Router}
 */
export default function createAuditRouter({ requireRole }) {
  const router = express.Router();

  // ── GET /api/audit — admin-only: list all audit entries ────────────────────
  router.get("/", requireRole("owner", "admin"), (req, res) => {
    const {
      actor,
      action,
      target,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const result = getAuditLog({
      actor,
      action,
      target,
      startDate,
      endDate,
      limit:  Math.max(1, Math.min(Number(limit)  || 50, 200)),
      offset: Math.max(0, Number(offset) || 0),
    });

    res.json({ ok: true, ...result });
  });

  // ── GET /api/audit/me — authenticated user's own audit trail ──────────────
  router.get("/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { action, startDate, endDate, limit = 50, offset = 0 } = req.query;

    const result = getAuditLogForUser(req.user.id, {
      action,
      startDate,
      endDate,
      limit:  Math.max(1, Math.min(Number(limit)  || 50, 200)),
      offset: Math.max(0, Number(offset) || 0),
    });

    res.json({ ok: true, ...result });
  });

  // ── GET /api/audit/dtu/:id — audit trail for a specific DTU ───────────────
  router.get("/dtu/:id", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const dtuId = req.params.id;
    const { action, startDate, endDate, limit = 50, offset = 0 } = req.query;

    const result = getAuditLog({
      target: dtuId,
      action,
      startDate,
      endDate,
      limit:  Math.max(1, Math.min(Number(limit)  || 50, 200)),
      offset: Math.max(0, Number(offset) || 0),
    });

    res.json({ ok: true, ...result });
  });

  return router;
}
