'use client';

/**
 * SolidWorks-class feature-tree authoring UI for ConKay.
 * Interactive panel: list OCC features, add-feature form, undo, rebuild + stats.
 * Honesty: feature-tree authoring UI LIVE via OCC APIs — NOT SolidWorks UI parity.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAssembly,
  listParts,
  occFeatureAppend,
  occFeatureCreate,
  occFeatureList,
  occFeatureRebuild,
  occFeatureUndo,
  rebuildPartSolid,
  type AssemblyPartView,
} from '@/lib/conkay/assembly-to-world';
import { mintConkayArtifactDtu } from '@/lib/conkay/mint-artifact-dtu';
import { applyMesh } from '@/lib/conkay/unity-bridge';

const FEATURE_TYPES = [
  'box',
  'cylinder',
  'extrude',
  'cut',
  'fillet',
  'chamfer',
  'shell',
  'revolve',
  'pattern',
  'union',
] as const;

type FeatureType = (typeof FEATURE_TYPES)[number];

type FeatureRow = {
  id?: string;
  type?: string;
  op?: string;
  kind?: string;
  params?: Record<string, unknown>;
  [k: string]: unknown;
};

function readStoredAssemblyId(): string {
  try {
    return String(sessionStorage.getItem('conkay.assemblyId') || '');
  } catch {
    return '';
  }
}

function defaultParams(type: FeatureType): Record<string, number> {
  switch (type) {
    case 'box':
      return { dx: 1, dy: 1, dz: 1 };
    case 'cylinder':
      return { r: 0.5, h: 2 };
    case 'extrude':
      return { dx: 1, dy: 1, depth: 0.5 };
    case 'cut':
      return { dx: 0.4, dy: 0.4, dz: 0.4 };
    case 'fillet':
      return { radius: 0.05 };
    case 'chamfer':
      return { distance: 0.05 };
    case 'shell':
      return { thickness: 0.05 };
    case 'revolve':
      return { angle: 360 };
    case 'pattern':
      return { count: 3, spacing: 1.2 };
    case 'union':
      return { dx: 0.5, dy: 0.5, dz: 0.5 };
    default:
      return {};
  }
}

function featureLabel(f: FeatureRow, idx: number): string {
  const t = String(f.type || f.op || f.kind || 'feature');
  const id = f.id ? String(f.id).slice(0, 8) : `#${idx + 1}`;
  return `${idx + 1}. ${t} (${id})`;
}

function buildFeaturePayload(type: FeatureType, params: Record<string, number>): Record<string, unknown> {
  if (type === 'box') {
    return { type: 'box', params: { dx: params.dx, dy: params.dy, dz: params.dz } };
  }
  if (type === 'cylinder') {
    return { type: 'cylinder', params: { r: params.r, h: params.h } };
  }
  if (type === 'extrude') {
    return {
      type: 'extrude',
      params: { dx: params.dx, dy: params.dy, depth: params.depth },
    };
  }
  if (type === 'cut') {
    return {
      type: 'cut',
      tool: { type: 'box', params: { dx: params.dx, dy: params.dy, dz: params.dz } },
    };
  }
  if (type === 'fillet') {
    return { type: 'fillet', params: { radius: params.radius } };
  }
  if (type === 'chamfer') {
    return { type: 'chamfer', params: { distance: params.distance } };
  }
  if (type === 'shell') {
    return { type: 'shell', params: { thickness: params.thickness } };
  }
  if (type === 'revolve') {
    return { type: 'revolve', params: { angle: params.angle } };
  }
  if (type === 'pattern') {
    return {
      type: 'pattern',
      params: { count: params.count, spacing: params.spacing, axis: 'x' },
    };
  }
  // union
  return {
    type: 'union',
    tool: { type: 'box', params: { dx: params.dx, dy: params.dy, dz: params.dz } },
  };
}

export function FeatureTreePanel() {
  const [assemblyId, setAssemblyId] = useState('');
  const [parts, setParts] = useState<AssemblyPartView[]>([]);
  const [partId, setPartId] = useState('');
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [featureType, setFeatureType] = useState<FeatureType>('box');
  const [params, setParams] = useState<Record<string, number>>(defaultParams('box'));
  const [status, setStatus] = useState('Idle — pick/create assembly + part');
  const [busy, setBusy] = useState(false);
  const [rebuildStats, setRebuildStats] = useState<{
    advanced_brep?: boolean;
    solids?: number;
    triangleCount?: number | null;
    vertexCount?: number | null;
    featureCount?: number;
    notes?: string[];
  } | null>(null);

  const paramKeys = useMemo(() => Object.keys(params), [params]);

  const refreshParts = useCallback(async (aid: string) => {
    if (!aid) {
      setParts([]);
      return;
    }
    const res = await listParts(aid);
    const list = (res?.parts || res?.data?.parts || []) as AssemblyPartView[];
    setParts(Array.isArray(list) ? list : []);
    if (!partId && list?.[0]?.id) setPartId(list[0].id);
  }, [partId]);

  const refreshFeatures = useCallback(async (pid: string) => {
    if (!pid) {
      setFeatures([]);
      return;
    }
    // Prefer assembly part meta.featureTree when present; else OCC feature-list store.
    const local = parts.find((p) => p.id === pid);
    const tree = (local?.meta?.featureTree as FeatureRow[] | undefined) || [];
    if (tree.length) {
      setFeatures(tree);
    }
    try {
      const listed = await occFeatureList(pid);
      const feats = (listed?.features || []) as FeatureRow[];
      if (Array.isArray(feats)) setFeatures(feats);
    } catch {
      /* keep local */
    }
  }, [parts]);

  useEffect(() => {
    const aid = readStoredAssemblyId();
    if (aid) setAssemblyId(aid);
    const onAsm = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.assemblyId) setAssemblyId(String(detail.assemblyId));
    };
    window.addEventListener('conkay:assembly', onAsm as EventListener);
    return () => window.removeEventListener('conkay:assembly', onAsm as EventListener);
  }, []);

  useEffect(() => {
    void refreshParts(assemblyId);
  }, [assemblyId, refreshParts]);

  useEffect(() => {
    void refreshFeatures(partId);
  }, [partId, refreshFeatures]);

  const onTypeChange = (t: FeatureType) => {
    setFeatureType(t);
    setParams(defaultParams(t));
  };

  const ensureAssembly = async () => {
    setBusy(true);
    try {
      if (assemblyId) {
        setStatus(`Using assembly ${assemblyId.slice(0, 8)}…`);
        await refreshParts(assemblyId);
        return;
      }
      const created = await createAssembly('feature-tree-ui');
      const id = created?.assembly?.id || created?.id;
      if (!id) {
        setStatus(`Create assembly failed — ${created?.error || 'unknown'}`);
        return;
      }
      setAssemblyId(id);
      try {
        sessionStorage.setItem('conkay.assemblyId', id);
        window.dispatchEvent(new CustomEvent('conkay:assembly', { detail: { assemblyId: id } }));
      } catch {
        /* ignore */
      }
      setStatus(`Assembly created ${String(id).slice(0, 8)}…`);
    } finally {
      setBusy(false);
    }
  };

  const seedBaseIfEmpty = async (pid: string) => {
    const listed = await occFeatureList(pid);
    const count = Number(listed?.count ?? listed?.features?.length ?? 0);
    if (count > 0) return listed;
    return occFeatureCreate({
      partId: pid,
      features: [{ type: 'box', params: { dx: 1, dy: 1, dz: 1 } }],
    });
  };

  const addFeature = async () => {
    if (!partId) {
      setStatus('Select or enter a partId first');
      return;
    }
    setBusy(true);
    setStatus(`Adding ${featureType}…`);
    try {
      await seedBaseIfEmpty(partId);
      const feature = buildFeaturePayload(featureType, params);
      // Primitive types replace/create; ops append
      let out;
      if (featureType === 'box' || featureType === 'cylinder') {
        const listed = await occFeatureList(partId);
        const existing = (listed?.features || []) as FeatureRow[];
        if (!existing.length) {
          out = await occFeatureCreate({ partId, features: [feature] });
        } else {
          out = await occFeatureAppend({ partId, feature });
        }
      } else {
        out = await occFeatureAppend({ partId, feature });
      }
      if (!out?.ok && out?.reason) {
        setStatus(`Add failed — ${out.reason || out.error || 'unknown'}`);
        return;
      }
      await refreshFeatures(partId);
      const feats = (out?.features || []) as FeatureRow[];
      if (feats.length) setFeatures(feats);
      setStatus(`Added ${featureType} — features=${out?.featureCount ?? feats.length ?? '?'}`);
      void mintConkayArtifactDtu({
        title: `Feature add · ${featureType}`,
        work: {
          action: 'feature_tree_add',
          channel: 'cad',
          partId,
          assemblyId: assemblyId || null,
          featureType,
          feature,
          featureCount: out?.featureCount ?? feats.length ?? null,
        },
        tags: ['feature-tree', featureType],
      });
    } catch (e) {
      setStatus(`Add failed — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const undoFeature = async () => {
    if (!partId) {
      setStatus('Select a partId first');
      return;
    }
    setBusy(true);
    try {
      const out = await occFeatureUndo({ partId });
      if (!out?.ok) {
        setStatus(`Undo failed — ${out?.reason || out?.error || 'unknown'}`);
        return;
      }
      const feats = (out?.features || []) as FeatureRow[];
      setFeatures(feats);
      setStatus(`Undo LIVE — removed ${out?.removed?.type || out?.removed?.op || 'feature'}; left=${feats.length}`);
      void mintConkayArtifactDtu({
        title: 'Feature undo',
        work: {
          action: 'feature_tree_undo',
          channel: 'cad',
          partId,
          assemblyId: assemblyId || null,
          removed: out?.removed || null,
          featureCount: feats.length,
        },
        tags: ['feature-tree', 'undo'],
      });
    } catch (e) {
      setStatus(`Undo failed — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const rebuild = async () => {
    if (!partId) {
      setStatus('Select a partId first');
      return;
    }
    setBusy(true);
    setStatus('Rebuilding solid…');
    try {
      let out: Record<string, unknown> | null = null;
      if (assemblyId && parts.some((p) => p.id === partId)) {
        out = (await rebuildPartSolid(assemblyId, partId, {
          features: features.length ? features : undefined,
        })) as Record<string, unknown>;
      } else {
        out = (await occFeatureRebuild({
          partId,
          features: features.length ? features : undefined,
          include_mesh: true,
        })) as Record<string, unknown>;
      }
      if (!out?.ok) {
        setStatus(`Rebuild failed — ${String(out?.reason || out?.error || 'unknown')}`);
        return;
      }
      const mesh = out.mesh as
        | { positions?: number[]; indices?: number[]; triangleCount?: number; vertexCount?: number }
        | undefined;
      const exportInfo = (out.export || {}) as { advanced_brep?: boolean };
      const stats = {
        advanced_brep: !!(exportInfo.advanced_brep ?? out.advanced_brep),
        solids: Number(out.solids ?? 0) || undefined,
        triangleCount:
          mesh?.triangleCount ??
          (mesh?.indices?.length ? Math.floor(mesh.indices.length / 3) : null),
        vertexCount:
          mesh?.vertexCount ?? (mesh?.positions?.length ? Math.floor(mesh.positions.length / 3) : null),
        featureCount: Number(out.featureCount ?? (out.features as unknown[])?.length ?? features.length),
        notes: Array.isArray(out.notes) ? (out.notes as string[]) : undefined,
      };
      setRebuildStats(stats);
      if (Array.isArray(out.features)) setFeatures(out.features as FeatureRow[]);
      if (mesh?.positions?.length && mesh?.indices?.length) {
        applyMesh({
          id: `feat-${partId.slice(0, 8)}`,
          positions: mesh.positions,
          indices: mesh.indices,
          color: '#67e8f9',
        });
      }
      setStatus(
        `Rebuild LIVE — advanced_brep=${stats.advanced_brep} tris=${stats.triangleCount ?? '?'} verts=${stats.vertexCount ?? '?'} solids=${stats.solids ?? '?'}`,
      );
      void mintConkayArtifactDtu({
        title: 'Feature rebuild',
        work: {
          action: 'feature_tree_rebuild',
          channel: 'cad',
          partId,
          assemblyId: assemblyId || null,
          ...stats,
        },
        tags: ['feature-tree', 'rebuild'],
      });
    } catch (e) {
      setStatus(`Rebuild failed — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="ck-feature-tree-panel"
      className="mx-auto mt-2 max-w-2xl rounded-xl border border-cyan-400/15 bg-black/30 p-3 text-[11px] text-white/80"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="text-[10px] uppercase tracking-wide text-cyan-300/60">Feature tree</div>
        <div className="text-[9px] text-white/35" data-testid="ck-feature-tree-honesty">
          OCC authoring UI LIVE — not SolidWorks parity
        </div>
      </div>

      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          data-testid="ck-feature-tree-assembly-id"
          className="rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px] text-cyan-100"
          placeholder="assemblyId"
          value={assemblyId}
          onChange={(e) => setAssemblyId(e.target.value.trim())}
        />
        <button
          type="button"
          data-testid="ck-feature-tree-ensure-assembly"
          disabled={busy}
          onClick={() => void ensureAssembly()}
          className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-40"
        >
          {assemblyId ? 'Refresh' : 'Create asm'}
        </button>
      </div>

      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
        <select
          data-testid="ck-feature-tree-part-select"
          className="rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px]"
          value={partId}
          onChange={(e) => setPartId(e.target.value)}
        >
          <option value="">— select part —</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.kind} ({p.id.slice(0, 8)})
            </option>
          ))}
        </select>
        <input
          data-testid="ck-feature-tree-part-id"
          className="w-36 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px]"
          placeholder="or partId"
          value={partId}
          onChange={(e) => setPartId(e.target.value.trim())}
        />
      </div>

      <div
        data-testid="ck-feature-tree-list"
        className="mb-2 max-h-40 overflow-auto rounded border border-white/10 bg-black/25"
      >
        {features.length === 0 ? (
          <div data-testid="ck-feature-tree-empty" className="px-2 py-3 text-white/35">
            No features yet — add a base box/cylinder, then ops.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {features.map((f, i) => (
              <li
                key={String(f.id || i)}
                data-testid={`ck-feature-tree-row-${i}`}
                className="px-2 py-1.5 font-mono text-[10px] text-cyan-100/90"
              >
                {featureLabel(f, i)}
                {f.params ? (
                  <span className="ml-2 text-white/35">{JSON.stringify(f.params).slice(0, 60)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        data-testid="ck-feature-tree-add-form"
        className="mb-2 rounded border border-cyan-400/20 bg-cyan-400/5 p-2"
      >
        <div className="mb-1 text-[10px] uppercase tracking-wide text-cyan-300/50">Add feature</div>
        <div className="mb-2 flex flex-wrap gap-2">
          <select
            data-testid="ck-feature-tree-type"
            className="rounded border border-white/10 bg-black/40 px-2 py-1"
            value={featureType}
            onChange={(e) => onTypeChange(e.target.value as FeatureType)}
          >
            {FEATURE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {paramKeys.map((k) => (
            <label key={k} className="flex items-center gap-1 text-white/60">
              <span>{k}</span>
              <input
                data-testid={`ck-feature-tree-param-${k}`}
                type="number"
                step="any"
                className="w-16 rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono"
                value={Number.isFinite(params[k]) ? params[k] : 0}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [k]: Number(e.target.value) }))
                }
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="ck-feature-tree-add"
            disabled={busy}
            onClick={() => void addFeature()}
            className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40"
          >
            Add feature
          </button>
          <button
            type="button"
            data-testid="ck-feature-tree-undo"
            disabled={busy}
            onClick={() => void undoFeature()}
            className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-200 hover:bg-amber-400/20 disabled:opacity-40"
          >
            Undo feature
          </button>
          <button
            type="button"
            data-testid="ck-feature-tree-rebuild"
            disabled={busy}
            onClick={() => void rebuild()}
            className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-40"
          >
            Rebuild solid
          </button>
        </div>
      </div>

      {rebuildStats ? (
        <div
          data-testid="ck-feature-tree-rebuild-stats"
          className="mb-2 rounded border border-white/10 bg-black/25 px-2 py-1.5 font-mono text-[10px] text-cyan-100/80"
        >
          advanced_brep={String(!!rebuildStats.advanced_brep)} · tris=
          {rebuildStats.triangleCount ?? '?'} · verts={rebuildStats.vertexCount ?? '?'} · solids=
          {rebuildStats.solids ?? '?'} · features={rebuildStats.featureCount ?? '?'}
          {rebuildStats.notes?.length ? ` · notes=${rebuildStats.notes.join(',')}` : ''}
        </div>
      ) : null}

      <div data-testid="ck-feature-tree-status" className="px-1 text-[10px] text-white/50">
        {status}
      </div>
    </div>
  );
}

export default FeatureTreePanel;
