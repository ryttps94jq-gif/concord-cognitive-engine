// server/routes/conkay-assembly.js
// ConKay CAD Wave 1 — assembly CRUD + part mesh/GLB attach.
// Mounted at /api/conkay (alongside design router). Auth required.

import { Router } from 'express';
import {
  ensureAssemblyTables,
  createAssembly,
  getAssembly,
  listAssemblies,
  addPart,
  listParts,
  getPart,
  transformPart,
  removePart,
  deleteAssembly,
  defaultTransform,
} from '../lib/conkay/assembly-store.js';
import {
  parseDesignIntent,
  intentToPartMeshParams,
  buildPartMesh,
  feaUtilToColor,
} from '../lib/conkay/nlp-design-intent.js';
import { parseAssemblyUtterance } from '../lib/conkay/assembly-nlp.js';
import {
  exportPartStl,
  exportAssemblyStl,
  buildBom,
} from '../lib/conkay/assembly-export.js';

export default function createConkayAssemblyRouter({ requireAuth, db }) {
  const router = Router();
  const auth = requireAuth;

  function needDb(res) {
    if (!db) {
      res.status(503).json({ ok: false, error: 'no_db', code: 'NO_DB' });
      return false;
    }
    try {
      ensureAssemblyTables(db);
    } catch (e) {
      res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
      return false;
    }
    return true;
  }

  /** POST /api/conkay/assemblies  { name?, meta? } */
  router.post('/assemblies', auth, (req, res) => {
    if (!needDb(res)) return;
    try {
      const ownerId = req.user?.id || req.user?.userId || null;
      const asm = createAssembly(db, {
        name: req.body?.name,
        ownerId,
        meta: req.body?.meta,
      });
      return res.json({
        ok: true,
        assembly: asm,
        honesty: { wave: 1, note: 'Assembly store LIVE — not full CAD suite' },
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** GET /api/conkay/assemblies */
  router.get('/assemblies', auth, (req, res) => {
    if (!needDb(res)) return;
    const ownerId = req.query?.mine === '1' ? (req.user?.id || req.user?.userId || null) : null;
    const list = listAssemblies(db, { ownerId, limit: req.query?.limit });
    return res.json({ ok: true, assemblies: list });
  });

  /** GET /api/conkay/assemblies/:id */
  router.get('/assemblies/:id', auth, (req, res) => {
    if (!needDb(res)) return;
    const asm = getAssembly(db, req.params.id);
    if (!asm) return res.status(404).json({ ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' });
    const parts = listParts(db, asm.id);
    return res.json({ ok: true, assembly: asm, parts });
  });

  /** DELETE /api/conkay/assemblies/:id */
  router.delete('/assemblies/:id', auth, (req, res) => {
    if (!needDb(res)) return;
    const out = deleteAssembly(db, req.params.id);
    if (!out.ok) return res.status(404).json(out);
    return res.json(out);
  });

  /**
   * POST /api/conkay/assemblies/:id/parts
   * body: {
   *   name?, kind?, source?, transform?, parentId?, mate?, material?,
   *   text? (NLP design → mesh), glbUrl?, mesh?: {positions,indices,kind?}
   * }
   */
  router.post('/assemblies/:id/parts', auth, async (req, res) => {
    if (!needDb(res)) return;
    try {
      const assemblyId = req.params.id;
      if (!getAssembly(db, assemblyId)) {
        return res.status(404).json({ ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' });
      }

      let mesh = req.body?.mesh || null;
      let glbUrl = req.body?.glbUrl || req.body?.glb_url || null;
      let kind = req.body?.kind || null;
      let material = req.body?.material || null;
      let source = req.body?.source || null;
      let utilColor = null;
      let intent = null;

      const text = req.body?.text || req.body?.prompt || '';
      if (!mesh && !glbUrl && text) {
        const parsed = parseDesignIntent(String(text));
        if (!parsed.ok) {
          return res.status(400).json({ ok: false, error: parsed.error, code: parsed.code || 'NLP_FAIL' });
        }
        intent = parsed.intent;
        const pm = intentToPartMeshParams(intent);
        const built = buildPartMesh(pm.kind, pm.params);
        mesh = {
          positions: built.positions,
          indices: built.indices,
          kind: built.kind,
          vertexCount: built.vertexCount,
          triangleCount: built.triangleCount,
        };
        kind = kind || built.kind;
        material = material || intent.material || null;
        source = source || 'nlp-design';
        utilColor = feaUtilToColor(0.125);
      }

      if (glbUrl) {
        source = source || 'evo-glb';
        kind = kind || 'glb';
      }
      if (mesh) {
        source = source || 'mesh';
        kind = kind || mesh.kind || 'mesh';
      }
      if (!mesh && !glbUrl) {
        return res.status(400).json({
          ok: false,
          error: 'need_text_or_mesh_or_glbUrl',
          code: 'MISSING_GEOMETRY',
        });
      }

      const transform = defaultTransform(req.body?.transform);
      // Auto-offset new parts along X if caller did not set position
      if (!req.body?.transform?.position) {
        const existing = listParts(db, assemblyId);
        transform.position.x = existing.length * 1.5;
        transform.position.y = 1.2;
      }

      const out = addPart(db, assemblyId, {
        name: req.body?.name || kind || intent?.part || 'part',
        kind,
        source,
        transform,
        parentId: req.body?.parentId,
        mate: req.body?.mate || { type: 'fixed' },
        mesh,
        glbUrl,
        material,
        meta: {
          ...(req.body?.meta || {}),
          intent: intent || undefined,
          utilColor: utilColor || undefined,
          text: text || undefined,
        },
      });
      if (!out.ok) return res.status(400).json(out);
      return res.json({
        ok: true,
        part: out.part,
        honesty: {
          wave: 1,
          path: glbUrl ? 'glbUrl→assembly part' : 'nlp/mesh→assembly part',
          note: 'Assembly part stored — client apply_mesh/load_glb for Unity',
        },
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** GET /api/conkay/assemblies/:id/parts */
  router.get('/assemblies/:id/parts', auth, (req, res) => {
    if (!needDb(res)) return;
    if (!getAssembly(db, req.params.id)) {
      return res.status(404).json({ ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' });
    }
    return res.json({ ok: true, parts: listParts(db, req.params.id) });
  });

  /** PATCH /api/conkay/assemblies/:id/parts/:partId  { transform } */
  router.patch('/assemblies/:id/parts/:partId', auth, (req, res) => {
    if (!needDb(res)) return;
    const out = transformPart(db, req.params.id, req.params.partId, req.body?.transform || req.body);
    if (!out.ok) return res.status(404).json(out);
    return res.json({
      ok: true,
      part: out.part,
      honesty: { wave: 1, note: 'Server transform updated — Unity set_transform or clear+redraw' },
    });
  });

  /** DELETE /api/conkay/assemblies/:id/parts/:partId */
  router.delete('/assemblies/:id/parts/:partId', auth, (req, res) => {
    if (!needDb(res)) return;
    const out = removePart(db, req.params.id, req.params.partId);
    if (!out.ok) return res.status(404).json(out);
    return res.json(out);
  });

  /**
   * POST /api/conkay/assemblies/:id/revise
   * body: { text } — chat revise: "add beam…", "move part X …"
   */
  router.post('/assemblies/:id/revise', auth, async (req, res) => {
    if (!needDb(res)) return;
    try {
      const assemblyId = req.params.id;
      if (!getAssembly(db, assemblyId)) {
        return res.status(404).json({ ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' });
      }
      const text = String(req.body?.text || req.body?.prompt || '').trim();
      const parsed = parseAssemblyUtterance(text, { parts: listParts(db, assemblyId) });
      if (!parsed.ok) {
        return res.status(400).json({ ok: false, error: parsed.error, code: parsed.code });
      }

      if (parsed.action === 'add') {
        // Reuse add-part logic via internal call shape
        req.body = {
          text: parsed.addText || text,
          name: parsed.name,
          transform: parsed.transform,
        };
        // Inline add (avoid recursive router)
        const nlp = parseDesignIntent(String(req.body.text));
        if (!nlp.ok) return res.status(400).json({ ok: false, error: nlp.error, code: nlp.code });
        const pm = intentToPartMeshParams(nlp.intent);
        const built = buildPartMesh(pm.kind, pm.params);
        const transform = defaultTransform(req.body.transform);
        if (!req.body.transform?.position) {
          const existing = listParts(db, assemblyId);
          transform.position.x = existing.length * 1.5;
          transform.position.y = 1.2;
        }
        const out = addPart(db, assemblyId, {
          name: req.body.name || pm.kind || 'part',
          kind: pm.kind,
          source: 'nlp-design',
          transform,
          mate: { type: 'fixed' },
          mesh: {
            positions: built.positions,
            indices: built.indices,
            kind: built.kind,
            vertexCount: built.vertexCount,
            triangleCount: built.triangleCount,
          },
          material: nlp.intent.material || null,
          meta: { intent: nlp.intent, text },
        });
        return res.json({
          ok: true,
          action: 'add',
          part: out.part,
          parts: listParts(db, assemblyId),
          utterance: parsed,
        });
      }

      if (parsed.action === 'move' || parsed.action === 'transform') {
        const out = transformPart(db, assemblyId, parsed.partId, parsed.transform);
        if (!out.ok) return res.status(404).json(out);
        return res.json({
          ok: true,
          action: 'transform',
          part: out.part,
          parts: listParts(db, assemblyId),
          utterance: parsed,
        });
      }

      if (parsed.action === 'remove') {
        const out = removePart(db, assemblyId, parsed.partId);
        if (!out.ok) return res.status(404).json(out);
        return res.json({
          ok: true,
          action: 'remove',
          removed: out.removed,
          parts: listParts(db, assemblyId),
          utterance: parsed,
        });
      }

      if (parsed.action === 'list') {
        return res.json({
          ok: true,
          action: 'list',
          parts: listParts(db, assemblyId),
          utterance: parsed,
        });
      }

      return res.status(400).json({ ok: false, error: 'unsupported_action', action: parsed.action });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });


  /** GET /api/conkay/assemblies/:id/bom */
  router.get('/assemblies/:id/bom', auth, (req, res) => {
    if (!needDb(res)) return;
    const bom = buildBom(db, req.params.id);
    if (!bom.ok) return res.status(404).json(bom);
    return res.json(bom);
  });

  /** GET /api/conkay/assemblies/:id/parts/:partId/stl — binary STL download */
  router.get('/assemblies/:id/parts/:partId/stl', auth, (req, res) => {
    if (!needDb(res)) return;
    const part = getPart(db, req.params.id, req.params.partId);
    if (!part) return res.status(404).json({ ok: false, error: 'part_not_found', code: 'NOT_FOUND' });
    const stl = exportPartStl(part);
    if (!stl.ok) return res.status(422).json(stl);
    const filename = `conkay-part-${part.name || part.id}.stl`.replace(/[^\w.\-]+/g, '_');
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-ConKay-Triangle-Count', String(stl.triangleCount));
    res.setHeader('X-ConKay-Vertex-Count', String(stl.vertexCount));
    return res.send(stl.buffer);
  });

  /** GET /api/conkay/assemblies/:id/stl — merged assembly STL */
  router.get('/assemblies/:id/stl', auth, (req, res) => {
    if (!needDb(res)) return;
    const stl = exportAssemblyStl(db, req.params.id);
    if (!stl.ok) return res.status(422).json(stl);
    const filename = `conkay-assembly-${req.params.id.slice(0, 8)}.stl`;
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-ConKay-Triangle-Count', String(stl.triangleCount));
    res.setHeader('X-ConKay-Included-Parts', String(stl.included?.length || 0));
    res.setHeader('X-ConKay-Skipped-Parts', String(stl.skipped?.length || 0));
    return res.send(stl.buffer);
  });

  return router;
}
