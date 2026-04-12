/**
 * STSVK Routes
 *
 * REST API for the STSVK mathematical core: the 3-regime classifier and
 * the feasibility manifold. These endpoints sit alongside /api/oracle and
 * expose the formal machinery that the Oracle uses for constraint checks.
 *
 * Endpoints:
 *   GET  /api/stsvk/regimes            — list all 3 regimes with equations
 *   POST /api/stsvk/classify           — classify a DTU/behavior into a regime
 *   GET  /api/stsvk/golden-ratio       — show the phi derivation from regime 2
 *   POST /api/stsvk/manifold/check     — check if a point is inside the manifold
 *   POST /api/stsvk/manifold/repair    — compute a repair trajectory
 *   GET  /api/stsvk/manifold/metrics   — manifold statistics
 *
 * Mounted at /api/stsvk in server.js.
 */

import express from 'express';
import {
  REGIMES,
  REGIME_INFO,
  PHI,
  INV_PHI,
  NEG_PHI,
  listRegimes,
  classifyRegime,
  verifyRegime,
  deriveGoldenRatio,
  regime1FixedPoints,
  regime2SolutionsAtBinary,
  regime3SolutionsAtBinary,
  getMetrics as getRegimeMetrics,
} from '../lib/stsvk-regimes.js';
import { createFeasibilityManifold } from '../lib/feasibility-manifold.js';

/**
 * Build the STSVK router.
 *
 * @param {object} opts
 * @param {object} opts.STATE               - server STATE bag
 * @param {Function} [opts.requireAuth]     - optional auth middleware
 * @param {object} [opts.dtuStore]          - DTU store with values() iterator
 * @returns {import('express').Router}
 */
export default function createStsvkRoutes({ STATE, requireAuth, dtuStore } = {}) {
  const router = express.Router();
  const auth = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();

  // Lazy singleton manifold — the DTU store may not be fully populated at
  // import time, so defer construction until first use.
  let manifoldInstance = null;
  const getManifold = () => {
    if (!manifoldInstance) {
      manifoldInstance = createFeasibilityManifold({
        dtuStore: (STATE && STATE.dtus) || dtuStore,
      });
    }
    return manifoldInstance;
  };

  // ── GET /api/stsvk/regimes ────────────────────────────────────────────────
  router.get('/regimes', (_req, res) => {
    try {
      res.json({
        ok: true,
        regimes: listRegimes(),
        constants: { phi: PHI, inv_phi: INV_PHI, neg_phi: NEG_PHI },
        fixed_points: {
          regime1: regime1FixedPoints(),
          regime2_at_binary: regime2SolutionsAtBinary(),
          regime3_at_binary: regime3SolutionsAtBinary(),
        },
      });
    } catch (e) {
      console.error('[stsvk] regimes error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  // ── POST /api/stsvk/classify ──────────────────────────────────────────────
  router.post('/classify', auth, (req, res) => {
    try {
      const subject = req.body && (req.body.subject || req.body.dtu || req.body);
      if (subject == null) {
        return res.status(400).json({ ok: false, error: 'subject required' });
      }
      const regime = classifyRegime(subject);
      const claimed = req.body && req.body.claimedRegime;
      const verification = claimed ? verifyRegime(subject, claimed) : null;
      res.json({
        ok: true,
        regime,
        info: regime !== 'outside' ? REGIME_INFO[regime] : null,
        verification,
      });
    } catch (e) {
      console.error('[stsvk] classify error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  // ── GET /api/stsvk/golden-ratio ───────────────────────────────────────────
  router.get('/golden-ratio', (_req, res) => {
    try {
      res.json({ ok: true, ...deriveGoldenRatio() });
    } catch (e) {
      console.error('[stsvk] golden-ratio error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  // ── POST /api/stsvk/manifold/check ────────────────────────────────────────
  router.post('/manifold/check', auth, async (req, res) => {
    try {
      const point = req.body && (req.body.point || req.body.subject || req.body);
      const relevantDomains =
        (req.body && Array.isArray(req.body.relevantDomains))
          ? req.body.relevantDomains
          : [];
      if (point == null) {
        return res.status(400).json({ ok: false, error: 'point required' });
      }
      const manifold = getManifold();
      const result = await manifold.isInside(point, { relevantDomains });
      const topology = await manifold.localTopology(point);
      const distance = await manifold.distanceToBoundary(point);
      res.json({ ok: true, ...result, topology, distance });
    } catch (e) {
      console.error('[stsvk] manifold/check error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  // ── POST /api/stsvk/manifold/repair ───────────────────────────────────────
  router.post('/manifold/repair', auth, async (req, res) => {
    try {
      const point = req.body && (req.body.point || req.body.subject || req.body);
      if (point == null) {
        return res.status(400).json({ ok: false, error: 'point required' });
      }
      const manifold = getManifold();
      const trajectory = await manifold.repairTrajectory(point);
      res.json({ ok: true, ...trajectory });
    } catch (e) {
      console.error('[stsvk] manifold/repair error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  // ── GET /api/stsvk/manifold/metrics ───────────────────────────────────────
  router.get('/manifold/metrics', (_req, res) => {
    try {
      const manifold = getManifold();
      res.json({
        ok: true,
        manifold: manifold.getMetrics(),
        regimes: getRegimeMetrics(),
      });
    } catch (e) {
      console.error('[stsvk] manifold/metrics error:', e);
      res.status(500).json({ ok: false, error: String(e && e.message || e) });
    }
  });

  return router;
}

/**
 * Module-level metrics shim so callers can read stats without holding a
 * router reference.
 * @returns {object}
 */
export function getMetrics() {
  return { regimes: getRegimeMetrics() };
}
