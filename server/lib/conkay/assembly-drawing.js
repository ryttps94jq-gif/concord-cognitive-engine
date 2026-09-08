// server/lib/conkay/assembly-drawing.js
// Orthographic 2D drawing views from triangle meshes (front/top/side).
// Honesty: projected line segments / silhouette SVG — NOT drafting CAD / GD&T / sheets.

import { listParts, getAssembly } from './assembly-store.js';

function applyTransformToPositions(positions, transform) {
  const pos = transform?.position || { x: 0, y: 0, z: 0 };
  const scl = transform?.scale || { x: 1, y: 1, z: 1 };
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = positions[i] * (scl.x ?? 1) + (pos.x ?? 0);
    out[i + 1] = positions[i + 1] * (scl.y ?? 1) + (pos.y ?? 0);
    out[i + 2] = positions[i + 2] * (scl.z ?? 1) + (pos.z ?? 0);
  }
  return out;
}

/** Project 3D → 2D for orthographic views. */
function projectPoint(x, y, z, view) {
  switch (view) {
    case 'front': // looking −Z: X right, Y up
      return { u: x, v: y };
    case 'top': // looking −Y: X right, Z up (or −Z depending convention; use −Z so +Z toward viewer bottom? keep Z up on paper)
      return { u: x, v: -z };
    case 'side': // looking +X: Z right, Y up (right side)
      return { u: z, v: y };
    default:
      return { u: x, v: y };
  }
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Extract unique triangle edges (wireframe). Optional silhouette: edges with face count === 1.
 * @returns {{ segments: Array<{x1,y1,x2,y2}>, bounds: {minU,minV,maxU,maxV}, edgeCount: number }}
 */
export function projectMeshView(positions, indices, view = 'front', { silhouette = true } = {}) {
  const pos = positions instanceof Float32Array ? positions : new Float32Array(positions);
  const idx = indices;
  const faceCount = new Map();
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    for (const [i, j] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = edgeKey(i, j);
      faceCount.set(k, (faceCount.get(k) || 0) + 1);
    }
  }

  const segments = [];
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  for (const [k, count] of faceCount) {
    if (silhouette && count !== 1 && count !== 2) {
      // keep all for wireframe when not silhouette-only; silhouette prefers boundary (1) but
      // closed manifold meshes have all interior edges count=2 — use projected silhouette heuristic:
      // include all edges when silhouette=false; when true include boundary OR all (fallback wire)
    }
    if (silhouette && count > 1) continue; // true boundary only
    const [ia, ib] = k.split('|').map(Number);
    const ax = pos[ia * 3];
    const ay = pos[ia * 3 + 1];
    const az = pos[ia * 3 + 2];
    const bx = pos[ib * 3];
    const by = pos[ib * 3 + 1];
    const bz = pos[ib * 3 + 2];
    const p1 = projectPoint(ax, ay, az, view);
    const p2 = projectPoint(bx, by, bz, view);
    segments.push({ x1: p1.u, y1: p1.v, x2: p2.u, y2: p2.v });
    minU = Math.min(minU, p1.u, p2.u);
    minV = Math.min(minV, p1.v, p2.v);
    maxU = Math.max(maxU, p1.u, p2.u);
    maxV = Math.max(maxV, p1.v, p2.v);
  }

  // Closed solids have no boundary edges (all count=2). Fall back to wireframe.
  if (!segments.length) {
    for (const [k] of faceCount) {
      const [ia, ib] = k.split('|').map(Number);
      const ax = pos[ia * 3];
      const ay = pos[ia * 3 + 1];
      const az = pos[ia * 3 + 2];
      const bx = pos[ib * 3];
      const by = pos[ib * 3 + 1];
      const bz = pos[ib * 3 + 2];
      const p1 = projectPoint(ax, ay, az, view);
      const p2 = projectPoint(bx, by, bz, view);
      segments.push({ x1: p1.u, y1: p1.v, x2: p2.u, y2: p2.v });
      minU = Math.min(minU, p1.u, p2.u);
      minV = Math.min(minV, p1.v, p2.v);
      maxU = Math.max(maxU, p1.u, p2.u);
      maxV = Math.max(maxV, p1.v, p2.v);
    }
  }

  if (!Number.isFinite(minU)) {
    minU = 0;
    minV = 0;
    maxU = 1;
    maxV = 1;
  }

  return {
    view,
    segments,
    bounds: { minU, minV, maxU, maxV },
    edgeCount: segments.length,
    mode: silhouette && faceCount.size && [...faceCount.values()].some((c) => c === 1) ? 'silhouette' : 'wireframe',
  };
}

/** Build SVG string for one or more views. */
export function viewsToSvg(views, { width = 900, height = 320, padding = 24 } = {}) {
  const panelW = (width - padding * (views.length + 1)) / views.length;
  const panelH = height - padding * 2 - 20;
  const labels = { front: 'FRONT', top: 'TOP', side: 'SIDE' };
  let bodies = '';
  views.forEach((view, i) => {
    const ox = padding + i * (panelW + padding);
    const oy = padding + 16;
    const { minU, minV, maxU, maxV } = view.bounds;
    const spanU = Math.max(1e-9, maxU - minU);
    const spanV = Math.max(1e-9, maxV - minV);
    const scale = Math.min(panelW / spanU, panelH / spanV) * 0.9;
    const cx = ox + panelW / 2;
    const cy = oy + panelH / 2;
    const midU = (minU + maxU) / 2;
    const midV = (minV + maxV) / 2;
    const lines = view.segments
      .map((s) => {
        const x1 = cx + (s.x1 - midU) * scale;
        const y1 = cy - (s.y1 - midV) * scale;
        const x2 = cx + (s.x2 - midU) * scale;
        const y2 = cy - (s.y2 - midV) * scale;
        return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`;
      })
      .join('\n');
    bodies += `
  <g class="view-${view.view}">
    <text x="${ox + 4}" y="${oy - 4}" fill="#67e8f9" font-size="12" font-family="monospace">${labels[view.view] || view.view.toUpperCase()} (${view.mode})</text>
    <rect x="${ox}" y="${oy}" width="${panelW}" height="${panelH}" fill="none" stroke="#164e63" stroke-width="1"/>
    <g stroke="#e2e8f0" stroke-width="1.2" fill="none">${lines}</g>
  </g>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="${padding}" y="${height - 8}" fill="#64748b" font-size="10" font-family="monospace">ConKay orthographic drawing — projected mesh lines (not drafting CAD)</text>
  ${bodies}
</svg>
`;
}

function meshFromParts(parts) {
  const allPos = [];
  const allIdx = [];
  let vertOffset = 0;
  const included = [];
  const skipped = [];
  for (const p of parts) {
    if (!p.mesh?.positions?.length || !p.mesh?.indices?.length) {
      skipped.push({ id: p.id, name: p.name, reason: p.glbUrl ? 'glb_only' : 'no_mesh' });
      continue;
    }
    const positions = applyTransformToPositions(p.mesh.positions, p.transform);
    for (let i = 0; i < positions.length; i++) allPos.push(positions[i]);
    for (const ix of p.mesh.indices) allIdx.push(ix + vertOffset);
    vertOffset += positions.length / 3;
    included.push({ id: p.id, name: p.name, kind: p.kind });
  }
  return { allPos, allIdx, included, skipped };
}

/** Build drawing JSON + SVG for a single part. */
export function exportPartDrawing(part, opts = {}) {
  if (!part) return { ok: false, reason: 'part_not_found' };
  if (!part.mesh?.positions?.length || !part.mesh?.indices?.length) {
    return {
      ok: false,
      reason: 'no_triangle_mesh',
      detail: part.glbUrl ? 'GLB parts need mesh arrays for drawing' : 'part has no mesh',
    };
  }
  const positions = applyTransformToPositions(part.mesh.positions, part.transform);
  const views = ['front', 'top', 'side'].map((v) =>
    projectMeshView(positions, part.mesh.indices, v, { silhouette: opts.silhouette !== false }),
  );
  const svg = viewsToSvg(views, opts);
  return {
    ok: true,
    format: 'conkay-drawing/v1',
    partId: part.id,
    views: views.map((v) => ({
      name: v.view,
      mode: v.mode,
      edgeCount: v.edgeCount,
      bounds: v.bounds,
      segments: v.segments,
    })),
    svg,
    honesty: {
      note: 'Orthographic projected line segments from triangle mesh — not drafting CAD / GD&T sheets',
    },
  };
}

/** Build drawing JSON + SVG for an assembly (merged meshes). */
export function exportAssemblyDrawing(db, assemblyId, opts = {}) {
  const asm = getAssembly(db, assemblyId);
  if (!asm) return { ok: false, reason: 'assembly_not_found' };
  const parts = listParts(db, assemblyId);
  const { allPos, allIdx, included, skipped } = meshFromParts(parts);
  if (!allIdx.length) {
    return { ok: false, reason: 'no_exportable_mesh_parts', skipped };
  }
  const views = ['front', 'top', 'side'].map((v) =>
    projectMeshView(allPos, allIdx, v, { silhouette: opts.silhouette !== false }),
  );
  const svg = viewsToSvg(views, opts);
  return {
    ok: true,
    format: 'conkay-drawing/v1',
    assemblyId,
    assemblyName: asm.name,
    included,
    skipped,
    views: views.map((v) => ({
      name: v.view,
      mode: v.mode,
      edgeCount: v.edgeCount,
      bounds: v.bounds,
      segments: v.segments,
    })),
    svg,
    honesty: {
      note: 'Orthographic projected line segments from triangle meshes — not drafting CAD / GD&T sheets',
    },
  };
}
