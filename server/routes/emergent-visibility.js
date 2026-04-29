// server/routes/emergent-visibility.js
// REST API for emergent visibility — profiles, artifacts, observations, communications, feed.
// Mounted at /api/emergents (plural, distinct from existing /api/emergent macro system).

import express from "express";
import { loadEmergentIdentity } from "../emergent/naming.js";
import { listEmergentArtifacts } from "../emergent/artifacts.js";
import { listCommunications } from "../emergent/communication.js";
import { getFeedEvents } from "../emergent/feed.js";

/**
 * @param {{ db: object, requireAuth?: Function, STATE: object }} opts
 */
export function createEmergentVisibilityRouter({ db, requireAuth, STATE }) {
  const router = express.Router();

  // ── List active named emergents ────────────────────────────────────────────
  router.get("/", (req, res) => {
    try {
      const rows = db
        ? db.prepare(`
            SELECT ei.*
            FROM emergent_identity ei
            WHERE ei.given_name IS NOT NULL
            ORDER BY ei.last_active_at DESC NULLS LAST
            LIMIT 100
          `).all()
        : [];

      // Merge with in-memory state for active/role fields
      const emergentsMap = STATE?.__emergent?.emergents || new Map();
      const result = rows.map(row => ({
        ...row,
        ...(emergentsMap.get(row.emergent_id) || {}),
        id: row.emergent_id,
      }));

      res.json({ ok: true, emergents: result, total: result.length });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Get emergent by given name ─────────────────────────────────────────────
  router.get("/by-name/:name", (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: "db_unavailable" });
    try {
      const row = db.prepare(
        "SELECT * FROM emergent_identity WHERE LOWER(given_name) = LOWER(?)"
      ).get(req.params.name);
      if (!row) return res.status(404).json({ ok: false, error: "emergent_not_found" });

      const stateObj = STATE?.__emergent?.emergents?.get(row.emergent_id) || {};
      res.json({ ok: true, emergent: { ...row, ...stateObj, id: row.emergent_id } });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Get emergent by ID ─────────────────────────────────────────────────────
  router.get("/:id", (req, res) => {
    const identity = loadEmergentIdentity(req.params.id, db);
    const stateObj = STATE?.__emergent?.emergents?.get(req.params.id) || {};
    if (!identity && !stateObj.id) {
      return res.status(404).json({ ok: false, error: "emergent_not_found" });
    }
    res.json({ ok: true, emergent: { ...stateObj, ...identity, id: req.params.id } });
  });

  // ── Artifacts ──────────────────────────────────────────────────────────────
  router.get("/:id/artifacts", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const artifacts = listEmergentArtifacts(req.params.id, db, limit);
    res.json({ ok: true, artifacts, total: artifacts.length });
  });

  // ── Observations ───────────────────────────────────────────────────────────
  router.get("/:id/observations", (req, res) => {
    if (!db) return res.json({ ok: true, observations: [] });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    try {
      const observations = db.prepare(`
        SELECT * FROM emergent_observations
        WHERE emergent_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(req.params.id, limit);
      res.json({ ok: true, observations, total: observations.length });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Communications ─────────────────────────────────────────────────────────
  router.get("/:id/communications", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const comms = listCommunications(req.params.id, db, limit);
    res.json({ ok: true, communications: comms, total: comms.length });
  });

  // ── Activity feed (global or per-emergent) ─────────────────────────────────
  router.get("/feed/recent", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const since = req.query.since ? parseInt(req.query.since) : undefined;
    const events = getFeedEvents(db, { limit, since });
    res.json({ ok: true, events, total: events.length });
  });

  return router;
}
