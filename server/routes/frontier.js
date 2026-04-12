/**
 * Frontier Features API Routes — Unified Router
 *
 * Combines all 16 frontier feature modules into a single router
 * mounted at /api/frontier. Each part handles a subset of features:
 *
 *   Part 1: Fabrication, Sensors, Blockchain, Shell        (15 routes)
 *   Part 2: Notebook, Marketplace, Certificates, Federation (20 routes)
 *   Part 3: DSL Compiler, Digital Twins, Voice, Replay     (14 routes)
 *   Part 4: Agents, Standards, DTU Diff, Dependency Graph  (13 routes)
 *
 * Total: 62 routes across 16 frontier features
 */

import { Router } from 'express';
import { createRequire } from 'module';
import createFrontierRoutesPart1 from './frontier-part1.js';
import createFrontierRoutesPart2 from './frontier-part2.js';
import createFrontierRoutesPart3 from './frontier-part3.js';
import createFrontierRoutesPart4 from './frontier-part4.js';

// Load CommonJS frontier config via createRequire (config is CJS)
const require = createRequire(import.meta.url);
const frontierConfig = require('../config/frontier.cjs');

/**
 * @param {object} [opts]
 * @param {Function} [opts.requireAuth] - Auth middleware
 * @returns {Router}
 */
export default function createFrontierRoutes({ requireAuth } = {}) {
  const router = Router();

  // Expose frontier config to all route handlers via req.frontierConfig
  router.use((_req, _res, next) => {
    _req.frontierConfig = frontierConfig;
    next();
  });

  // Mount each feature group
  router.use('/', createFrontierRoutesPart1({ requireAuth }));
  router.use('/', createFrontierRoutesPart2({ requireAuth }));
  router.use('/', createFrontierRoutesPart3({ requireAuth }));
  router.use('/', createFrontierRoutesPart4({ requireAuth }));

  // ── Health & Discovery ──────────────────────────────────────────────────

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'frontier',
      features: [
        'fabrication', 'sensors', 'blockchain', 'shell',
        'notebooks', 'marketplace', 'certificates', 'federation',
        'dsl', 'twins', 'voice', 'replay',
        'agents', 'standards', 'dtu-diff', 'dependency-graph',
      ],
      featureCount: 16,
      status: 'operational',
      uptime: process.uptime(),
    });
  });

  // Expose frontier feature configuration
  router.get('/config', (_req, res) => {
    res.json({
      ok: true,
      config: frontierConfig,
      featureCount: Object.keys(frontierConfig).length,
    });
  });

  router.get('/routes', (_req, res) => {
    const routes = [];
    const extractRoutes = (stack, prefix = '') => {
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
          routes.push({ methods, path: prefix + layer.route.path });
        } else if (layer.name === 'router' && layer.handle?.stack) {
          extractRoutes(layer.handle.stack, prefix + (layer.regexp?.source === '^\\/?$' ? '' : ''));
        }
      }
    };
    extractRoutes(router.stack);
    res.json({ ok: true, routes, count: routes.length });
  });

  return router;
}
