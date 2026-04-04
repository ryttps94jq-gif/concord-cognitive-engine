/**
 * Consent Layer — API Routes
 *
 * Settings → Privacy & Sharing
 * Every toggle, every audit trail, every revocation.
 * Nothing leaves without permission.
 */

import express from "express";
import {
  getUserConsents,
  grantConsent,
  revokeConsent,
  updateConsents,
  anonymizeAttribution,
  reclaimAttributions,
  getConsentAuditLog,
  CONSENT_ACTIONS,
} from "../lib/consent.js";

/**
 * Create the consent router.
 * @param {{ db: object, requireAuth: function }} deps
 */
export default function createConsentRouter({ db, requireAuth }) {
  const router = express.Router();

  // All consent routes require authentication
  if (typeof requireAuth === "function") {
    router.use(requireAuth());
  }

  // ── Get All Consents (dashboard) ────────────────────────────────────

  router.get("/", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const result = getUserConsents(db, userId);
    res.json(result);
  });

  // ── Get Consent Actions (schema/definitions) ───────────────────────

  router.get("/actions", (_req, res) => {
    res.json({ ok: true, actions: CONSENT_ACTIONS });
  });

  // ── Grant Consent ──────────────────────────────────────────────────

  router.post("/grant", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: "missing_action" });

    const result = grantConsent(db, userId, action, {
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Revoke Consent ─────────────────────────────────────────────────

  router.post("/revoke", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: "missing_action" });

    const result = revokeConsent(db, userId, action, {
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Bulk Update (Settings page "Save Changes") ─────────────────────

  router.post("/update", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { consents } = req.body || {};
    if (!consents || typeof consents !== "object") {
      return res.status(400).json({ ok: false, error: "missing_consents_object" });
    }

    const result = updateConsents(db, userId, consents, {
      ip: req.ip,
      userAgent: req.headers?.["user-agent"],
    });

    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Anonymize Attribution ──────────────────────────────────────────

  router.post("/anonymize", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { dtuId } = req.body || {};
    if (!dtuId) return res.status(400).json({ ok: false, error: "missing_dtu_id" });

    const result = anonymizeAttribution(db, dtuId, userId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Reclaim Anonymized Attributions ────────────────────────────────

  router.post("/reclaim", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const result = reclaimAttributions(db, userId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── Consent Audit Log ──────────────────────────────────────────────

  router.get("/audit-log", (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const result = getConsentAuditLog(db, userId, { limit, offset });
    res.json(result);
  });

  return router;
}
