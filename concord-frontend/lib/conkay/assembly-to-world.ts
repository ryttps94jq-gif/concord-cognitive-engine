// lib/conkay/assembly-to-world.ts
// Wave 1: assembly APIs → Unity apply_mesh / load_glb / set_transform / clear+redraw.
// Honesty: multi-part assembly LIVE — not full CAD suite.

import { api } from '@/lib/api/client';
import {
  applyMesh,
  loadGlb,
  clearTempPrimitives,
  setTransform,
  unityIframePresent,
  type ApplyMeshPayload,
} from './unity-bridge';

export interface AssemblyPartView {
  id: string;
  name: string;
  kind: string;
  source: string;
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  mesh?: { positions: number[]; indices: number[]; kind?: string } | null;
  glbUrl?: string | null;
  material?: string | null;
  meta?: Record<string, unknown>;
}

export async function createAssembly(name = 'assembly') {
  const res = await api.post('/api/conkay/assemblies', { name });
  return res?.data;
}

export async function addPartFromText(assemblyId: string, text: string, opts?: { name?: string; transform?: unknown }) {
  const res = await api.post(`/api/conkay/assemblies/${assemblyId}/parts`, {
    text,
    name: opts?.name,
    transform: opts?.transform,
  });
  return res?.data;
}

export async function listParts(assemblyId: string) {
  const res = await api.get(`/api/conkay/assemblies/${assemblyId}/parts`);
  return res?.data;
}

export async function transformPartApi(assemblyId: string, partId: string, transform: unknown) {
  const res = await api.patch(`/api/conkay/assemblies/${assemblyId}/parts/${partId}`, { transform });
  return res?.data;
}

export async function reviseAssembly(assemblyId: string, text: string) {
  const res = await api.post(`/api/conkay/assemblies/${assemblyId}/revise`, { text });
  return res?.data;
}

function scalePayload(s: AssemblyPartView['transform']['scale']): number | { x: number; y: number; z: number } {
  if (s.x === s.y && s.y === s.z) return s.x;
  return s;
}

/** Spawn one part into Unity (apply_mesh or load_glb). */
export function spawnPartInUnity(part: AssemblyPartView): { ok: boolean; mode: string; postId?: string; error?: string } {
  if (!unityIframePresent()) return { ok: false, mode: 'none', error: 'no_unity_iframe' };
  const postId = `asm-${part.id}-${Date.now()}`;
  const pos = part.transform?.position || { x: 0, y: 1.2, z: 0 };
  const scale = scalePayload(part.transform?.scale || { x: 1, y: 1, z: 1 });
  const color =
    (part.meta as { utilColor?: { hex?: string } } | undefined)?.utilColor?.hex ||
    '#22c55e';

  if (part.glbUrl) {
    const absolute =
      part.glbUrl.startsWith('http')
        ? part.glbUrl
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${part.glbUrl}`;
    const posted = loadGlb({ url: absolute, position: pos, scale, name: part.id }, postId);
    return { ok: posted, mode: 'load_glb', postId };
  }
  if (part.mesh?.positions && part.mesh?.indices) {
    const payload: ApplyMeshPayload = {
      positions: part.mesh.positions,
      indices: part.mesh.indices,
      color,
      id: part.id,
      position: pos,
      scale,
    };
    const posted = applyMesh(payload, postId);
    return { ok: posted, mode: 'apply_mesh', postId };
  }
  return { ok: false, mode: 'none', error: 'no_geometry' };
}

/** Clear ConKayTemp then redraw all parts. */
export function redrawAssemblyInUnity(parts: AssemblyPartView[]): {
  ok: boolean;
  spawned: Array<{ partId: string; mode: string; ok: boolean }>;
} {
  if (!unityIframePresent()) return { ok: false, spawned: [] };
  clearTempPrimitives(`asm-clear-${Date.now()}`);
  const spawned = parts.map((p) => {
    const r = spawnPartInUnity(p);
    return { partId: p.id, mode: r.mode, ok: r.ok };
  });
  return { ok: spawned.every((s) => s.ok), spawned };
}

/** Prefer set_transform; fall back to re-apply_mesh for that part. */
export function revisePartTransformInUnity(
  part: AssemblyPartView,
): { ok: boolean; mode: 'set_transform' | 'apply_mesh' | 'load_glb' | 'none'; error?: string } {
  if (!unityIframePresent()) return { ok: false, mode: 'none', error: 'no_unity_iframe' };
  const posted = setTransform(
    {
      id: part.id,
      position: part.transform.position,
      scale: scalePayload(part.transform.scale),
      rotation: part.transform.rotation,
    },
    `asm-xf-${part.id}-${Date.now()}`,
  );
  if (posted) return { ok: true, mode: 'set_transform' };
  const r = spawnPartInUnity(part);
  return { ok: r.ok, mode: (r.mode as 'apply_mesh' | 'load_glb' | 'none') || 'none', error: r.error };
}

/**
 * High-level chat revise: call server revise API then sync Unity.
 * "build assembly" creates a new assembly when assemblyId is null.
 */
export async function runAssemblyChatRevise(opts: {
  text: string;
  assemblyId?: string | null;
  syncUnity?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  assemblyId?: string;
  action?: string;
  parts?: AssemblyPartView[];
  part?: AssemblyPartView;
  unity?: unknown;
}> {
  const text = (opts.text || '').trim();
  if (!text) return { ok: false, error: 'empty_text' };

  let assemblyId = opts.assemblyId || null;
  const lower = text.toLowerCase();

  // create assembly if needed / requested
  if (!assemblyId || /^build\s+assembly\b/.test(lower) || /^create\s+assembly\b/.test(lower)) {
    const nameMatch = text.match(/(?:named|called)\s+([A-Za-z0-9_\- ]{1,64})/i);
    const created = await createAssembly(nameMatch?.[1]?.trim() || 'assembly');
    if (!created?.ok || !created.assembly?.id) {
      return { ok: false, error: created?.error || 'create_assembly_failed' };
    }
    assemblyId = created.assembly.id;
    if (/^build\s+assembly\b/.test(lower) || /^create\s+assembly\b/.test(lower)) {
      // If only "build assembly" — done. If "build assembly … add …" continue? keep simple.
      if (!/\badd\b/.test(lower)) {
        return { ok: true, assemblyId: assemblyId ?? undefined, action: 'build', parts: [] };
      }
    }
  }

  const revised = await reviseAssembly(assemblyId!, text);
  if (!revised?.ok) {
    // If revise failed because utterance was "build assembly" already handled
    if (revised?.code === 'UNRECOGNIZED' && assemblyId) {
      return { ok: true, assemblyId, action: 'build', parts: [] };
    }
    return { ok: false, error: revised?.error || 'revise_failed', assemblyId: assemblyId ?? undefined };
  }

  const parts: AssemblyPartView[] = revised.parts || [];
  let unity: unknown = null;
  if (opts.syncUnity !== false && unityIframePresent()) {
    if (revised.action === 'transform' && revised.part) {
      const xf = revisePartTransformInUnity(revised.part);
      const redraw = redrawAssemblyInUnity(parts);
      unity = { setTransform: xf, redraw, ok: !!(redraw.ok || xf.ok) };
    } else if (revised.action === 'add' || revised.action === 'remove') {
      unity = redrawAssemblyInUnity(parts);
    } else if (revised.action === 'list') {
      unity = { ok: true, mode: 'noop' };
    }
  }

  return {
    ok: true,
    assemblyId: assemblyId!,
    action: revised.action,
    parts,
    part: revised.part,
    unity,
  };
}


/** Fetch BOM JSON for an assembly. */
export async function fetchAssemblyBom(assemblyId: string) {
  const res = await api.get(`/api/conkay/assemblies/${assemblyId}/bom`);
  return res?.data;
}

/** Trigger browser download of assembly or part STL (auth cookie/bearer via api client blob). */
export async function downloadStl(opts: { assemblyId: string; partId?: string; filename?: string }) {
  const path = opts.partId
    ? `/api/conkay/assemblies/${opts.assemblyId}/parts/${opts.partId}/stl`
    : `/api/conkay/assemblies/${opts.assemblyId}/stl`;
  const res = await api.get(path, { responseType: 'blob' });
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: 'model/stl' });
  const filename =
    opts.filename ||
    (opts.partId ? `conkay-part-${opts.partId.slice(0, 8)}.stl` : `conkay-assembly-${opts.assemblyId.slice(0, 8)}.stl`);
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return { ok: true, filename, size: blob.size };
}

/** Download BOM as JSON file. */
export async function downloadAssemblyBom(assemblyId: string) {
  const bom = await fetchAssemblyBom(assemblyId);
  if (!bom?.ok) return { ok: false, error: bom?.reason || bom?.error || 'bom_failed' };
  const blob = new Blob([JSON.stringify(bom, null, 2)], { type: 'application/json' });
  const filename = `conkay-bom-${assemblyId.slice(0, 8)}.json`;
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return { ok: true, filename, bom };
}

/** Trigger browser download of assembly or part faceted STEP. */
export async function downloadStep(opts: { assemblyId: string; partId?: string; filename?: string }) {
  const path = opts.partId
    ? `/api/conkay/assemblies/${opts.assemblyId}/parts/${opts.partId}/export.step`
    : `/api/conkay/assemblies/${opts.assemblyId}/export.step`;
  const res = await api.get(path, { responseType: 'blob' });
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: 'application/step' });
  const filename =
    opts.filename ||
    (opts.partId
      ? `conkay-part-${opts.partId.slice(0, 8)}.step`
      : `conkay-assembly-${opts.assemblyId.slice(0, 8)}.step`);
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return { ok: true, filename, size: blob.size };
}
