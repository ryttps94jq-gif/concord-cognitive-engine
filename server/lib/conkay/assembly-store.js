// server/lib/conkay/assembly-store.js
// ConKay CAD Wave 1 — multi-part assembly store (sqlite).
// Honesty: assembly + transforms + mate stubs. Not full CAD suite / constraint solver.

import { randomUUID } from 'crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conkay_assemblies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conkay_assembly_parts (
  id TEXT PRIMARY KEY,
  assembly_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mesh',
  source TEXT NOT NULL DEFAULT 'nlp-design',
  parent_id TEXT,
  mate_json TEXT NOT NULL DEFAULT '{}',
  transform_json TEXT NOT NULL DEFAULT '{"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}',
  mesh_json TEXT,
  glb_url TEXT,
  material TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assembly_id) REFERENCES conkay_assemblies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conkay_assembly_parts_assembly ON conkay_assembly_parts(assembly_id);
`;

export function ensureAssemblyTables(db) {
  if (!db) throw new Error('assembly_store_no_db');
  db.exec(SCHEMA);
}

function nowIso() {
  return new Date().toISOString();
}

function defaultTransform(partial) {
  const p = partial && typeof partial === 'object' ? partial : {};
  const pos = p.position && typeof p.position === 'object' ? p.position : {};
  const rot = p.rotation && typeof p.rotation === 'object' ? p.rotation : {};
  const scl = p.scale && typeof p.scale === 'object' ? p.scale : (typeof p.scale === 'number' ? { x: p.scale, y: p.scale, z: p.scale } : {});
  return {
    position: {
      x: Number.isFinite(Number(pos.x)) ? Number(pos.x) : 0,
      y: Number.isFinite(Number(pos.y)) ? Number(pos.y) : 0,
      z: Number.isFinite(Number(pos.z)) ? Number(pos.z) : 0,
    },
    rotation: {
      x: Number.isFinite(Number(rot.x)) ? Number(rot.x) : 0,
      y: Number.isFinite(Number(rot.y)) ? Number(rot.y) : 0,
      z: Number.isFinite(Number(rot.z)) ? Number(rot.z) : 0,
    },
    scale: {
      x: Number.isFinite(Number(scl.x)) ? Number(scl.x) : 1,
      y: Number.isFinite(Number(scl.y)) ? Number(scl.y) : 1,
      z: Number.isFinite(Number(scl.z)) ? Number(scl.z) : 1,
    },
  };
}

function parseJson(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function rowToAssembly(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id || null,
    meta: parseJson(row.meta_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPart(row) {
  if (!row) return null;
  return {
    id: row.id,
    assemblyId: row.assembly_id,
    name: row.name,
    kind: row.kind,
    source: row.source,
    parentId: row.parent_id || null,
    mate: parseJson(row.mate_json, {}),
    transform: parseJson(row.transform_json, defaultTransform()),
    mesh: parseJson(row.mesh_json, null),
    glbUrl: row.glb_url || null,
    material: row.material || null,
    meta: parseJson(row.meta_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAssembly(db, { name, ownerId, meta } = {}) {
  ensureAssemblyTables(db);
  const id = randomUUID();
  const ts = nowIso();
  const nm = String(name || 'assembly').trim() || 'assembly';
  db.prepare(
    `INSERT INTO conkay_assemblies (id, name, owner_id, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, nm, ownerId || null, JSON.stringify(meta || {}), ts, ts);
  return rowToAssembly(db.prepare(`SELECT * FROM conkay_assemblies WHERE id = ?`).get(id));
}

export function getAssembly(db, assemblyId) {
  ensureAssemblyTables(db);
  return rowToAssembly(db.prepare(`SELECT * FROM conkay_assemblies WHERE id = ?`).get(assemblyId));
}

export function listAssemblies(db, { ownerId, limit } = {}) {
  ensureAssemblyTables(db);
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  if (ownerId) {
    return db
      .prepare(`SELECT * FROM conkay_assemblies WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ?`)
      .all(ownerId, lim)
      .map(rowToAssembly);
  }
  return db
    .prepare(`SELECT * FROM conkay_assemblies ORDER BY updated_at DESC LIMIT ?`)
    .all(lim)
    .map(rowToAssembly);
}

export function addPart(db, assemblyId, part) {
  ensureAssemblyTables(db);
  const asm = getAssembly(db, assemblyId);
  if (!asm) return { ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' };

  const id = part?.id && String(part.id).trim() ? String(part.id).trim() : randomUUID();
  const ts = nowIso();
  const name = String(part?.name || part?.kind || 'part').trim() || 'part';
  const kind = String(part?.kind || 'mesh').trim() || 'mesh';
  const source = String(part?.source || 'nlp-design').trim() || 'nlp-design';
  const transform = defaultTransform(part?.transform);
  const mate = part?.mate && typeof part.mate === 'object' ? part.mate : { type: 'fixed' };
  const meshJson = part?.mesh ? JSON.stringify(part.mesh) : null;
  const glbUrl = part?.glbUrl || part?.glb_url || null;
  const material = part?.material || null;
  const parentId = part?.parentId || part?.parent_id || null;
  const meta = part?.meta && typeof part.meta === 'object' ? part.meta : {};

  db.prepare(
    `INSERT INTO conkay_assembly_parts
      (id, assembly_id, name, kind, source, parent_id, mate_json, transform_json, mesh_json, glb_url, material, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    assemblyId,
    name,
    kind,
    source,
    parentId,
    JSON.stringify(mate),
    JSON.stringify(transform),
    meshJson,
    glbUrl,
    material,
    JSON.stringify(meta),
    ts,
    ts,
  );
  db.prepare(`UPDATE conkay_assemblies SET updated_at = ? WHERE id = ?`).run(ts, assemblyId);
  return { ok: true, part: getPart(db, assemblyId, id) };
}

export function getPart(db, assemblyId, partId) {
  ensureAssemblyTables(db);
  return rowToPart(
    db.prepare(`SELECT * FROM conkay_assembly_parts WHERE assembly_id = ? AND id = ?`).get(assemblyId, partId),
  );
}

export function listParts(db, assemblyId) {
  ensureAssemblyTables(db);
  return db
    .prepare(`SELECT * FROM conkay_assembly_parts WHERE assembly_id = ? ORDER BY created_at ASC`)
    .all(assemblyId)
    .map(rowToPart);
}

export function transformPart(db, assemblyId, partId, transformPatch) {
  ensureAssemblyTables(db);
  const existing = getPart(db, assemblyId, partId);
  if (!existing) return { ok: false, error: 'part_not_found', code: 'NOT_FOUND' };
  const next = defaultTransform({
    position: { ...existing.transform.position, ...(transformPatch?.position || {}) },
    rotation: { ...existing.transform.rotation, ...(transformPatch?.rotation || {}) },
    scale:
      typeof transformPatch?.scale === 'number'
        ? { x: transformPatch.scale, y: transformPatch.scale, z: transformPatch.scale }
        : { ...existing.transform.scale, ...(transformPatch?.scale || {}) },
  });
  const ts = nowIso();
  db.prepare(
    `UPDATE conkay_assembly_parts SET transform_json = ?, updated_at = ? WHERE assembly_id = ? AND id = ?`,
  ).run(JSON.stringify(next), ts, assemblyId, partId);
  db.prepare(`UPDATE conkay_assemblies SET updated_at = ? WHERE id = ?`).run(ts, assemblyId);
  return { ok: true, part: getPart(db, assemblyId, partId) };
}

export function removePart(db, assemblyId, partId) {
  ensureAssemblyTables(db);
  const existing = getPart(db, assemblyId, partId);
  if (!existing) return { ok: false, error: 'part_not_found', code: 'NOT_FOUND' };
  db.prepare(`DELETE FROM conkay_assembly_parts WHERE assembly_id = ? AND id = ?`).run(assemblyId, partId);
  db.prepare(`UPDATE conkay_assemblies SET updated_at = ? WHERE id = ?`).run(nowIso(), assemblyId);
  return { ok: true, removed: existing };
}

export function deleteAssembly(db, assemblyId) {
  ensureAssemblyTables(db);
  const asm = getAssembly(db, assemblyId);
  if (!asm) return { ok: false, error: 'assembly_not_found', code: 'NOT_FOUND' };
  db.prepare(`DELETE FROM conkay_assembly_parts WHERE assembly_id = ?`).run(assemblyId);
  db.prepare(`DELETE FROM conkay_assemblies WHERE id = ?`).run(assemblyId);
  return { ok: true, removed: asm };
}

export { defaultTransform };
