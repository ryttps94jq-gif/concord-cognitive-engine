/**
 * Sub-Lens Routes
 *
 * REST API for the hierarchical sub-lens registry. Exposes the nested
 * parent/child tree that sits above Concord's flat lens architecture so
 * clients can browse, inspect, and route queries to the most specific
 * matching lens.
 *
 * Endpoints:
 *   GET  /api/sub-lens/tree                     — full hierarchy tree
 *   GET  /api/sub-lens/stats                    — registry statistics
 *   GET  /api/sub-lens/leaves                   — all leaf lenses
 *   POST /api/sub-lens/find-most-specific       — find most specific lens for a query
 *   GET  /api/sub-lens/:lensId/children         — children of a lens
 *   GET  /api/sub-lens/:lensId/ancestors        — ancestor chain
 *   GET  /api/sub-lens/:lensId/descendants      — all descendants
 *
 * Mounted at /api/sub-lens in server.js.
 */

import express from 'express';
import {
  getTree,
  getStats,
  getLeaves,
  getChildren,
  getAncestors,
  getDescendants,
  findMostSpecific,
  hasSubLenses,
  SUB_LENS_TREE,
} from '../lib/sub-lens-registry.js';

export default function createSubLensRoutes({ requireAuth } = {}) {
  const router = express.Router();

  // Auth is optional — these endpoints are read-only metadata. If a
  // requireAuth middleware is provided, use it; otherwise fall through.
  const auth = typeof requireAuth === 'function'
    ? requireAuth
    : (req, res, next) => next();

  // GET /api/sub-lens/tree — full hierarchy tree
  router.get('/tree', auth, (req, res) => {
    try {
      res.json({ ok: true, tree: getTree() });
    } catch (e) {
      console.error('[sub-lens] tree error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/sub-lens/stats — registry statistics
  router.get('/stats', auth, (req, res) => {
    try {
      res.json({ ok: true, stats: getStats() });
    } catch (e) {
      console.error('[sub-lens] stats error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/sub-lens/leaves — all leaf lenses
  router.get('/leaves', auth, (req, res) => {
    try {
      const leaves = getLeaves();
      res.json({ ok: true, leaves, count: leaves.length });
    } catch (e) {
      console.error('[sub-lens] leaves error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // POST /api/sub-lens/find-most-specific — find most specific lens for a query
  router.post('/find-most-specific', auth, (req, res) => {
    try {
      const { query, rootLensId = null } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ ok: false, error: 'query required' });
      }
      const lensId = findMostSpecific(query, rootLensId);
      const ancestors = lensId ? getAncestors(lensId) : [];
      res.json({ ok: true, lensId, ancestors });
    } catch (e) {
      console.error('[sub-lens] find-most-specific error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/sub-lens/:lensId/children — children of a lens
  router.get('/:lensId/children', auth, (req, res) => {
    try {
      const { lensId } = req.params;
      const children = getChildren(lensId);
      res.json({ ok: true, lensId, children, hasSubLenses: hasSubLenses(lensId) });
    } catch (e) {
      console.error('[sub-lens] children error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/sub-lens/:lensId/ancestors — ancestor chain
  router.get('/:lensId/ancestors', auth, (req, res) => {
    try {
      const { lensId } = req.params;
      const ancestors = getAncestors(lensId);
      res.json({ ok: true, lensId, ancestors });
    } catch (e) {
      console.error('[sub-lens] ancestors error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /api/sub-lens/:lensId/descendants — all descendants
  router.get('/:lensId/descendants', auth, (req, res) => {
    try {
      const { lensId } = req.params;
      const descendants = getDescendants(lensId);
      res.json({ ok: true, lensId, descendants, count: descendants.length });
    } catch (e) {
      console.error('[sub-lens] descendants error:', e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // Quick sanity — presence of a given root lens
  router.get('/', auth, (req, res) => {
    res.json({
      ok: true,
      roots: Object.keys(SUB_LENS_TREE),
      stats: getStats(),
    });
  });

  return router;
}
