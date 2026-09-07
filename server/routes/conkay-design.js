// server/routes/conkay-design.js
// POST /api/conkay/design — free-text NLP → intent → runFEA + partMesh → mesh arrays.
// Auth required. Deterministic; no LLM; no fake FEA.

import { Router } from 'express';
import {
  parseDesignIntent,
  intentToPartMeshParams,
  intentToFeaModel,
  buildPartMesh,
  feaUtilToColor,
} from '../lib/conkay/nlp-design-intent.js';

export default function createConkayDesignRouter({ requireAuth }) {
  const router = Router();
  const auth = requireAuth;

  /**
   * POST /api/conkay/design
   * body: { text: string }
   * → { ok, intent, fea?, mesh:{positions,indices,...}, utilColor }
   */
  router.post('/design', auth, async (req, res) => {
    try {
      const text = req.body?.text ?? req.body?.prompt ?? '';
      const parsed = parseDesignIntent(String(text));
      if (!parsed.ok) {
        return res.status(400).json({ ok: false, error: parsed.error, code: parsed.code });
      }
      const intent = parsed.intent;
      const { kind, params } = intentToPartMeshParams(intent);
      const mesh = buildPartMesh(kind, params);

      let fea = null;
      let utilColor = feaUtilToColor(0.125);
      try {
        const { runFEA } = await import('../lib/simulation/fea-solver.js');
        const model = intentToFeaModel(intent);
        const result = runFEA(model);
        if (result && result.ok !== false) {
          const maxUtilization = Number(result.summary?.maxUtilization);
          if (Number.isFinite(maxUtilization)) {
            utilColor = feaUtilToColor(maxUtilization);
            fea = {
              ok: true,
              maxUtilization,
              jobId: result.jobId ?? null,
              band: utilColor.band,
              summary: result.summary ?? null,
            };
          } else {
            fea = { ok: true, maxUtilization: null, note: 'runFEA ok but maxUtilization missing' };
          }
        } else {
          fea = { ok: false, error: result?.error || 'runFEA failed' };
        }
      } catch (e) {
        fea = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }

      return res.json({
        ok: true,
        intent,
        fea,
        mesh: {
          positions: mesh.positions,
          indices: mesh.indices,
          kind: mesh.kind,
          vertexCount: mesh.vertexCount,
          triangleCount: mesh.triangleCount,
        },
        utilColor,
        honesty: {
          path: 'nlp-intent→deterministic-FEA/partMesh→mesh-arrays',
          note: 'Not industrial CAD suite / GLB. apply_mesh expected client-side.',
          glb: false,
        },
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return router;
}
