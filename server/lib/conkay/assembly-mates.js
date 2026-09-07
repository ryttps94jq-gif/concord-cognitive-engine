// server/lib/conkay/assembly-mates.js
// Wave 3 — minimal mate stubs (fixed / coincident / offset) that write transforms.
// Honesty: kinematic stubs — NOT a full constraint solver / CAD kernel.

import { getPart, listParts, transformPart, getAssembly } from './assembly-store.js';

const MATE_TYPES = Object.freeze(['fixed', 'coincident', 'offset']);

/**
 * Apply a mate between two parts (or part→world origin).
 * Writes transforms into sqlite; does not iterate a true solver.
 *
 * @param {object} db
 * @param {string} assemblyId
 * @param {{ type: string, aPartId: string, bPartId?: string|null, axis?: 'x'|'y'|'z', offset?: number }} spec
 */
export function applyMate(db, assemblyId, spec) {
  const type = String(spec?.type || '').toLowerCase();
  if (!MATE_TYPES.includes(type)) {
    return { ok: false, error: `unsupported_mate — need one of: ${MATE_TYPES.join(', ')}`, code: 'BAD_MATE' };
  }
  if (!getAssembly(db, assemblyId)) {
    return { ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' };
  }
  const a = getPart(db, assemblyId, spec.aPartId);
  if (!a) return { ok: false, error: 'a_part_not_found', code: 'NOT_FOUND' };

  const axis = ['x', 'y', 'z'].includes(String(spec.axis || '').toLowerCase())
    ? String(spec.axis).toLowerCase()
    : 'x';
  const offset = Number.isFinite(Number(spec.offset)) ? Number(spec.offset) : 0;

  let b = null;
  if (spec.bPartId) {
    b = getPart(db, assemblyId, spec.bPartId);
    if (!b) return { ok: false, error: 'b_part_not_found', code: 'NOT_FOUND' };
  }

  const mate = {
    type,
    aPartId: a.id,
    bPartId: b?.id || null,
    axis,
    offset,
    appliedAt: new Date().toISOString(),
  };

  // World reference when b is null
  const bPos = b?.transform?.position || { x: 0, y: 0, z: 0 };
  const aPos = { ...(a.transform?.position || { x: 0, y: 0, z: 0 }) };

  if (type === 'fixed') {
    // Lock A to B's position (or world origin) — copy position
    aPos.x = bPos.x;
    aPos.y = bPos.y;
    aPos.z = bPos.z;
  } else if (type === 'coincident') {
    // Align A to B on chosen axis (match that coordinate)
    aPos[axis] = bPos[axis];
  } else if (type === 'offset') {
    // Place A on axis at B[axis] + offset (other coords unchanged relative intent: keep A's other axes)
    aPos[axis] = bPos[axis] + offset;
  }

  const xf = transformPart(db, assemblyId, a.id, { position: aPos });
  if (!xf.ok) return xf;

  // Persist mate stub on both parts' mate_json (best-effort)
  try {
    db.prepare(
      `UPDATE conkay_assembly_parts SET mate_json = ?, updated_at = ? WHERE assembly_id = ? AND id = ?`,
    ).run(JSON.stringify({ ...mate, role: 'a' }), new Date().toISOString(), assemblyId, a.id);
    if (b) {
      db.prepare(
        `UPDATE conkay_assembly_parts SET mate_json = ?, updated_at = ? WHERE assembly_id = ? AND id = ?`,
      ).run(JSON.stringify({ ...mate, role: 'b' }), new Date().toISOString(), assemblyId, b.id);
    }
  } catch {
    /* non-fatal */
  }

  return {
    ok: true,
    mate,
    part: xf.part,
    parts: listParts(db, assemblyId),
    honesty: {
      wave: 3,
      note: 'Kinematic mate stub wrote transforms — not a full constraint solver',
    },
  };
}

export { MATE_TYPES };
