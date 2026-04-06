'use client';

import React, { useState, useMemo } from 'react';

// ── Seed Data ──────────────────────────────────────────────────────────────────

interface DTUVersion {
  id: string;
  version: string;
  name: string;
  material: string;
  length: string;
  width: string;
  height: string;
  seismicRating: number;
  windRating: string;
  weight: string;
  connections: number;
  stiffenerPlates?: number;
  author: string;
  date: string;
  validations: {
    gravity: string;
    wind: string;
    seismic: string;
    thermal: string;
    fire: string;
  };
}

const VERSIONS: DTUVersion[] = [
  {
    id: 'dtu-3204-v1.0',
    version: 'v1.0',
    name: 'USB-A Beam 6m',
    material: 'USB-A',
    length: '6m',
    width: '0.2m',
    height: '0.35m',
    seismicRating: 6.2,
    windRating: '120mph',
    weight: '142kg',
    connections: 2,
    author: 'eng.martinez',
    date: '2025-08-14',
    validations: {
      gravity: '2.3 SF',
      wind: '120mph',
      seismic: '6.2',
      thermal: 'pass',
      fire: '2.0hr',
    },
  },
  {
    id: 'dtu-3204-v1.1',
    version: 'v1.1',
    name: 'USB-A Beam 6m (Draft)',
    material: 'USB-A',
    length: '6m',
    width: '0.2m',
    height: '0.36m',
    seismicRating: 6.4,
    windRating: '125mph',
    weight: '146kg',
    connections: 2,
    author: 'eng.martinez',
    date: '2025-10-02',
    validations: {
      gravity: '2.35 SF',
      wind: '125mph',
      seismic: '6.4',
      thermal: 'pass',
      fire: '2.0hr',
    },
  },
  {
    id: 'dtu-3204-v2.0',
    version: 'v2.0',
    name: 'USB-A Beam 6m (Reinforced)',
    material: 'USB-A+',
    length: '6m',
    width: '0.22m',
    height: '0.38m',
    seismicRating: 7.1,
    windRating: '145mph',
    weight: '159kg',
    connections: 2,
    stiffenerPlates: 2,
    author: 'eng.chen',
    date: '2026-01-19',
    validations: {
      gravity: '2.5 SF',
      wind: '145mph',
      seismic: '7.1',
      thermal: 'pass',
      fire: '2.5hr',
    },
  },
];

// ── Diff helpers ───────────────────────────────────────────────────────────────

type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffRow {
  field: string;
  v1: string | undefined;
  v2: string | undefined;
  delta: string;
  status: DiffStatus;
}

function computeDelta(field: string, v1Val: string | undefined, v2Val: string | undefined): string {
  if (v1Val === undefined) return '+ new';
  if (v2Val === undefined) return '- removed';
  if (v1Val === v2Val) return '—';

  const n1 = parseFloat(v1Val);
  const n2 = parseFloat(v2Val);
  if (!isNaN(n1) && !isNaN(n2)) {
    const diff = n2 - n1;
    const pct = ((diff / n1) * 100).toFixed(1);
    const arrow = diff > 0 ? '▲' : '▼';
    const sign = diff > 0 ? '+' : '';
    return `${arrow} ${sign}${diff.toFixed(2)} (${sign}${pct}%)`;
  }
  return 'changed';
}

function buildDiffRows(a: DTUVersion, b: DTUVersion): DiffRow[] {
  const fields: { field: string; key: keyof DTUVersion }[] = [
    { field: 'Name', key: 'name' },
    { field: 'Material', key: 'material' },
    { field: 'Length', key: 'length' },
    { field: 'Width', key: 'width' },
    { field: 'Height', key: 'height' },
    { field: 'Seismic Rating', key: 'seismicRating' },
    { field: 'Wind Rating', key: 'windRating' },
    { field: 'Weight', key: 'weight' },
    { field: 'Connections', key: 'connections' },
    { field: 'Stiffener Plates', key: 'stiffenerPlates' },
    { field: 'Author', key: 'author' },
    { field: 'Date', key: 'date' },
  ];

  return fields.map(({ field, key }) => {
    const v1 = a[key] !== undefined ? String(a[key]) : undefined;
    const v2 = b[key] !== undefined ? String(b[key]) : undefined;

    let status: DiffStatus = 'unchanged';
    if (v1 === undefined && v2 !== undefined) status = 'added';
    else if (v1 !== undefined && v2 === undefined) status = 'removed';
    else if (v1 !== v2) status = 'modified';

    return { field, v1, v2, delta: computeDelta(field, v1, v2), status };
  });
}

// ── Status color maps ──────────────────────────────────────────────────────────

const statusRowBg: Record<DiffStatus, string> = {
  added: 'bg-green-900/30 border-l-2 border-green-500',
  removed: 'bg-red-900/30 border-l-2 border-red-500',
  modified: 'bg-yellow-900/20 border-l-2 border-yellow-500',
  unchanged: 'bg-white/[0.02]',
};

const statusDeltaColor: Record<DiffStatus, string> = {
  added: 'text-green-400',
  removed: 'text-red-400',
  modified: 'text-yellow-300',
  unchanged: 'text-white/30',
};

const legendItems: { status: DiffStatus; label: string; color: string }[] = [
  { status: 'added', label: 'Added', color: 'bg-green-500' },
  { status: 'removed', label: 'Removed', color: 'bg-red-500' },
  { status: 'modified', label: 'Modified', color: 'bg-yellow-500' },
  { status: 'unchanged', label: 'Unchanged', color: 'bg-white/20' },
];

// ── Validation comparison helper ───────────────────────────────────────────────

interface ValidationRow {
  test: string;
  v1: string;
  v2: string;
  indicator: string;
  indicatorColor: string;
}

function buildValidationRows(a: DTUVersion, b: DTUVersion): ValidationRow[] {
  const tests: { test: string; key: keyof DTUVersion['validations'] }[] = [
    { test: 'Gravity', key: 'gravity' },
    { test: 'Wind', key: 'wind' },
    { test: 'Seismic', key: 'seismic' },
    { test: 'Thermal', key: 'thermal' },
    { test: 'Fire Rating', key: 'fire' },
  ];

  return tests.map(({ test, key }) => {
    const v1 = a.validations[key];
    const v2 = b.validations[key];
    const same = v1 === v2;
    return {
      test,
      v1,
      v2,
      indicator: same ? '— same' : '▲ improved',
      indicatorColor: same ? 'text-white/40' : 'text-green-400',
    };
  });
}

// ── Summary builder ────────────────────────────────────────────────────────────

function buildSummary(a: DTUVersion, b: DTUVersion): string {
  const parts: string[] = [];

  if (a.material !== b.material) parts.push(`Upgraded material to ${b.material}`);
  if (a.width !== b.width || a.height !== b.height) parts.push('increased cross-section');
  if (b.stiffenerPlates && !a.stiffenerPlates)
    parts.push(`added ${b.stiffenerPlates} stiffener plates`);

  const seismicDelta = (
    ((b.seismicRating - a.seismicRating) / a.seismicRating) *
    100
  ).toFixed(1);
  parts.push(
    `Seismic rating improved from ${a.seismicRating} to ${b.seismicRating} (+${seismicDelta}%)`
  );

  const w1 = parseFloat(a.weight);
  const w2 = parseFloat(b.weight);
  const weightDelta = (((w2 - w1) / w1) * 100).toFixed(0);
  parts.push(`Weight increased by ${weightDelta}%`);

  return `${b.version}: ${parts.join(', ')}.`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DTUDiffViewer() {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(2);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const leftVersion = VERSIONS[leftIdx];
  const rightVersion = VERSIONS[rightIdx];

  const diffRows = useMemo(() => buildDiffRows(leftVersion, rightVersion), [leftVersion, rightVersion]);
  const validationRows = useMemo(
    () => buildValidationRows(leftVersion, rightVersion),
    [leftVersion, rightVersion]
  );
  const summary = useMemo(() => buildSummary(leftVersion, rightVersion), [leftVersion, rightVersion]);

  const visibleRows = useMemo(
    () => (showUnchanged ? diffRows : diffRows.filter((r) => r.status !== 'unchanged')),
    [diffRows, showUnchanged]
  );

  const unchangedCount = diffRows.filter((r) => r.status === 'unchanged').length;

  // Timeline selection
  const handleTimelineClick = (idx: number, side: 'left' | 'right') => {
    if (side === 'left') setLeftIdx(idx);
    else setRightIdx(idx);
  };

  const [timelineSide, setTimelineSide] = useState<'left' | 'right'>('left');

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-4 font-mono text-sm text-white/90">
      {/* ── Header / Version Selectors ────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-5">
        <h2 className="text-lg font-semibold mb-4 tracking-wide">DTU Diff Viewer</h2>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left version selector */}
          <div className="flex-1">
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">
              Base Version
            </label>
            <select
              value={leftIdx}
              onChange={(e) => setLeftIdx(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-blue-500/60"
            >
              {VERSIONS.map((v, i) => (
                <option key={v.id} value={i} className="bg-black text-white">
                  {v.version} — {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-center text-white/30 text-xl pb-2">
            &rarr;
          </div>

          {/* Right version selector */}
          <div className="flex-1">
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">
              Compare Version
            </label>
            <select
              value={rightIdx}
              onChange={(e) => setRightIdx(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-blue-500/60"
            >
              {VERSIONS.map((v, i) => (
                <option key={v.id} value={i} className="bg-black text-white">
                  {v.version} — {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary Banner ────────────────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-blue-400 text-lg">i</span>
          <p className="text-white/70 leading-relaxed">
            <span className="text-white/90 font-medium">Version {summary}</span>
          </p>
        </div>
      </div>

      {/* ── Properties Diff Table ─────────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h3 className="font-semibold tracking-wide">Properties Diff</h3>
          <button
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="text-xs px-3 py-1 rounded-md border border-white/10 hover:border-white/30 transition-colors text-white/50 hover:text-white/80"
          >
            {showUnchanged ? 'Hide' : 'Show'} unchanged ({unchangedCount})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40 uppercase tracking-wider">
                <th className="px-5 py-3 w-1/4">Field</th>
                <th className="px-5 py-3 w-1/4">{leftVersion.version}</th>
                <th className="px-5 py-3 w-1/4">{rightVersion.version}</th>
                <th className="px-5 py-3 w-1/4">Delta</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.field} className={`${statusRowBg[row.status]} transition-colors`}>
                  <td className="px-5 py-2.5 text-white/70 font-medium">{row.field}</td>
                  <td className="px-5 py-2.5 text-white/60">{row.v1 ?? '—'}</td>
                  <td className="px-5 py-2.5 text-white/80">{row.v2 ?? '—'}</td>
                  <td className={`px-5 py-2.5 font-medium ${statusDeltaColor[row.status]}`}>
                    {row.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Validation Comparison ─────────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h3 className="font-semibold tracking-wide">Validation Comparison</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x sm:divide-white/10">
          {/* v1 column header */}
          <div className="px-5 py-2 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider">
            {leftVersion.version} Results
          </div>
          <div className="px-5 py-2 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider">
            {rightVersion.version} Results
          </div>

          {validationRows.map((row) => (
            <React.Fragment key={row.test}>
              {/* Left result */}
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/5">
                <span className="text-white/60">{row.test}</span>
                <span className="text-white/50">{row.v1}</span>
              </div>
              {/* Right result */}
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/5">
                <span className="text-white/80">{row.v2}</span>
                <span className={`text-xs font-medium ${row.indicatorColor}`}>
                  {row.indicator}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 3D Diff Overlay Legend ─────────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-5">
        <h3 className="font-semibold tracking-wide mb-3">3D Diff Overlay Legend</h3>
        <div className="flex flex-wrap gap-4">
          {legendItems.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${item.color}`} />
              <span className="text-white/60 text-xs uppercase tracking-wider">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-3">
          Enable the 3D overlay in the viewport to see geometric changes highlighted on the model.
        </p>
      </div>

      {/* ── Version Timeline ──────────────────────────────────────────── */}
      <div className="rounded-xl bg-black/80 backdrop-blur border border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold tracking-wide">Version Timeline</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setTimelineSide('left')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                timelineSide === 'left'
                  ? 'border-blue-500/60 text-blue-400 bg-blue-500/10'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              Select Base
            </button>
            <button
              onClick={() => setTimelineSide('right')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                timelineSide === 'right'
                  ? 'border-blue-500/60 text-blue-400 bg-blue-500/10'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              Select Compare
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-between px-4 py-6">
          {/* Connecting line */}
          <div className="absolute left-8 right-8 top-1/2 h-px bg-white/10" />

          {VERSIONS.map((v, i) => {
            const isLeft = i === leftIdx;
            const isRight = i === rightIdx;
            return (
              <button
                key={v.id}
                onClick={() => handleTimelineClick(i, timelineSide)}
                className="relative z-10 flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    isLeft && isRight
                      ? 'border-purple-400 bg-purple-500/40 scale-125'
                      : isLeft
                      ? 'border-blue-400 bg-blue-500/40 scale-110'
                      : isRight
                      ? 'border-green-400 bg-green-500/40 scale-110'
                      : 'border-white/20 bg-white/5 group-hover:border-white/40 group-hover:scale-110'
                  }`}
                />
                <span
                  className={`text-xs transition-colors ${
                    isLeft || isRight ? 'text-white/90 font-medium' : 'text-white/40'
                  }`}
                >
                  {v.version}
                </span>
                <span className="text-[10px] text-white/30">{v.date}</span>
                {isLeft && (
                  <span className="text-[10px] text-blue-400 font-medium">BASE</span>
                )}
                {isRight && !isLeft && (
                  <span className="text-[10px] text-green-400 font-medium">COMPARE</span>
                )}
                {isLeft && isRight && (
                  <span className="text-[10px] text-purple-400 font-medium">BOTH</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
