'use client';

import React, { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type CellType =
  | 'markdown'
  | 'dtu'
  | 'validation'
  | 'visualization'
  | 'lens-query'
  | 'code'
  | 'publish';

interface MarkdownData {
  source: string;
  preview: boolean;
}

interface DTUData {
  material: string;
  length: string;
  width: string;
  height: string;
}

interface ValidationTest {
  id: string;
  label: string;
  enabled: boolean;
  passed: boolean | null;
  safetyFactor: number | null;
}

interface ValidationData {
  tests: ValidationTest[];
  environment: string;
  hasRun: boolean;
}

interface CodeData {
  source: string;
  output: string;
}

interface PublishData {
  name: string;
  version: string;
  description: string;
  published: boolean;
  registryUrl: string;
}

interface Cell {
  id: string;
  type: CellType;
  markdown?: MarkdownData;
  dtu?: DTUData;
  validation?: ValidationData;
  code?: CodeData;
  publish?: PublishData;
  running: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CELL_TYPE_COLORS: Record<CellType, string> = {
  markdown: 'bg-blue-500/80',
  dtu: 'bg-emerald-500/80',
  validation: 'bg-amber-500/80',
  visualization: 'bg-purple-500/80',
  'lens-query': 'bg-cyan-500/80',
  code: 'bg-rose-500/80',
  publish: 'bg-pink-500/80',
};

const CELL_TYPE_LABELS: Record<CellType, string> = {
  markdown: 'Markdown',
  dtu: 'DTU',
  validation: 'Validation',
  visualization: 'Visualization',
  'lens-query': 'Lens Query',
  code: 'Code',
  publish: 'Publish',
};

const MATERIALS = [
  'Structural Steel A992',
  'Reinforced Concrete C40',
  'Timber Glulam GL24h',
  'Aluminum 6061-T6',
  'Carbon Fiber Composite',
  'Stainless Steel 316L',
];

let nextId = 100;
function uid(): string {
  nextId += 1;
  return `cell-${nextId}`;
}

function makeValidationTests(overrides?: Partial<ValidationTest>[]): ValidationTest[] {
  const defaults: ValidationTest[] = [
    { id: 'gravity', label: 'Gravity Load', enabled: true, passed: null, safetyFactor: null },
    { id: 'wind', label: 'Wind Load', enabled: true, passed: null, safetyFactor: null },
    { id: 'seismic', label: 'Seismic Load', enabled: true, passed: null, safetyFactor: null },
    { id: 'thermal', label: 'Thermal Expansion', enabled: true, passed: null, safetyFactor: null },
    { id: 'fire', label: 'Fire Resistance', enabled: true, passed: null, safetyFactor: null },
  ];
  if (overrides) {
    overrides.forEach((o, i) => {
      if (i < defaults.length) Object.assign(defaults[i], o);
    });
  }
  return defaults;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

function seedCells(): Cell[] {
  return [
    {
      id: uid(),
      type: 'markdown',
      markdown: {
        source:
          '# Bridge Design Study\n\nThis notebook documents the structural analysis of a pedestrian bridge spanning 24 m over the Concord River delta. We will define the primary beam DTU, validate against environmental loads, run a custom analysis script, and publish the final component to the registry.\n\n**Author:** @engineer_dutch  \n**Date:** 2026-04-05  \n**Status:** Draft',
        preview: true,
      },
      running: false,
    },
    {
      id: uid(),
      type: 'dtu',
      dtu: {
        material: 'Structural Steel A992',
        length: '24000',
        width: '600',
        height: '1200',
      },
      running: false,
    },
    {
      id: uid(),
      type: 'validation',
      validation: {
        tests: makeValidationTests([
          { enabled: true, passed: true, safetyFactor: 2.4 },
          { enabled: true, passed: true, safetyFactor: 1.8 },
          { enabled: true, passed: true, safetyFactor: 1.6 },
          { enabled: true, passed: true, safetyFactor: 3.1 },
          { enabled: true, passed: true, safetyFactor: 2.0 },
        ]),
        environment: 'Coastal temperate, wind zone III',
        hasRun: true,
      },
      running: false,
    },
    {
      id: uid(),
      type: 'code',
      code: {
        source: [
          '// Deflection analysis for main beam',
          'const E = 200e3; // MPa – Young\'s modulus steel',
          'const I = (600 * Math.pow(1200, 3)) / 12; // mm^4',
          'const L = 24000; // mm span',
          'const w = 5.2; // N/mm distributed load',
          '',
          'const delta = (5 * w * Math.pow(L, 4)) / (384 * E * I);',
          'console.log(`Max deflection: ${delta.toFixed(2)} mm`);',
          'console.log(`L/delta ratio : ${(L / delta).toFixed(0)}`);',
          'console.log(`Limit L/250   : ${(L / 250).toFixed(1)} mm`);',
          'console.log(delta < L / 250 ? "PASS" : "FAIL");',
        ].join('\n'),
        output: 'Max deflection: 18.72 mm\nL/delta ratio : 1282\nLimit L/250   : 96.0 mm\nPASS',
      },
      running: false,
    },
    {
      id: uid(),
      type: 'publish',
      publish: {
        name: 'bridge-beam-24m-steel',
        version: '0.1.0',
        description: 'Primary I-beam for 24 m pedestrian bridge. Validated for coastal wind zone III.',
        published: false,
        registryUrl: '',
      },
      running: false,
    },
  ];
}

// ─── Simple Markdown Renderer ────────────────────────────────────────────────

function renderMarkdown(src: string): string {
  let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white/90 mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white/90 mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-sm font-mono">$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotebookEditor() {
  const [title, setTitle] = useState('Bridge Design Study');
  const [cells, setCells] = useState<Cell[]>(seedCells);
  const [savedAt, setSavedAt] = useState('12:34:05 PM');
  const [isPublic, setIsPublic] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // ── Cell helpers ──

  const updateCell = (id: string, patch: Partial<Cell>) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const deleteCell = (id: string) => {
    setCells((prev) => prev.filter((c) => c.id !== id));
  };

  const addCell = (index: number, type: CellType) => {
    const base: Cell = { id: uid(), type, running: false };
    switch (type) {
      case 'markdown':
        base.markdown = { source: '', preview: false };
        break;
      case 'dtu':
        base.dtu = { material: MATERIALS[0], length: '', width: '', height: '' };
        break;
      case 'validation':
        base.validation = { tests: makeValidationTests(), environment: '', hasRun: false };
        break;
      case 'code':
        base.code = { source: '', output: '' };
        break;
      case 'publish':
        base.publish = { name: '', version: '0.1.0', description: '', published: false, registryUrl: '' };
        break;
    }
    setCells((prev) => {
      const next = [...prev];
      next.splice(index, 0, base);
      return next;
    });
  };

  const runCell = (id: string) => {
    updateCell(id, { running: true });
    setTimeout(() => {
      setCells((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const updated = { ...c, running: false };
          if (c.type === 'validation' && c.validation) {
            updated.validation = {
              ...c.validation,
              hasRun: true,
              tests: c.validation.tests.map((t) =>
                t.enabled
                  ? { ...t, passed: true, safetyFactor: +(1.2 + Math.random() * 2).toFixed(1) }
                  : { ...t, passed: null, safetyFactor: null }
              ),
            };
          }
          if (c.type === 'code' && c.code) {
            updated.code = { ...c.code, output: '// executed successfully\n> Done.' };
          }
          if (c.type === 'publish' && c.publish && !c.publish.published) {
            updated.publish = {
              ...c.publish,
              published: true,
              registryUrl: `concord://registry/${c.publish.name || 'component'}@${c.publish.version || '0.1.0'}`,
            };
          }
          return updated;
        })
      );
      setSavedAt(new Date().toLocaleTimeString());
    }, 800);
  };

  const runAll = () => {
    cells.forEach((c) => runCell(c.id));
  };

  const cellCount = useMemo(() => cells.length, [cells]);

  // ── Add-cell popover state ──
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);

  const cellTypes: CellType[] = [
    'markdown',
    'dtu',
    'validation',
    'visualization',
    'lens-query',
    'code',
    'publish',
  ];

  // ── Render helpers ──

  const renderAddButton = (index: number) => (
    <div className="flex justify-center py-1 relative group" key={`add-${index}`}>
      <button
        onClick={() => setAddMenuIndex(addMenuIndex === index ? null : index)}
        className="w-7 h-7 rounded-full border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all text-lg flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Add cell"
      >
        +
      </button>
      {addMenuIndex === index && (
        <div className="absolute top-8 z-50 bg-black/95 border border-white/10 rounded-lg p-2 backdrop-blur-xl shadow-2xl flex flex-wrap gap-1 w-80">
          {cellTypes.map((ct) => (
            <button
              key={ct}
              onClick={() => {
                addCell(index, ct);
                setAddMenuIndex(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/80 hover:bg-white/10 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${CELL_TYPE_COLORS[ct]}`} />
              {CELL_TYPE_LABELS[ct]}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderCellBody = (cell: Cell) => {
    switch (cell.type) {
      // ── Markdown ──
      case 'markdown': {
        const md = cell.markdown!;
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() =>
                  updateCell(cell.id, { markdown: { ...md, preview: !md.preview } })
                }
                className="text-xs px-2 py-0.5 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                {md.preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {md.preview ? (
              <div
                className="prose prose-invert text-sm text-white/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(md.source) }}
              />
            ) : (
              <textarea
                value={md.source}
                onChange={(e) =>
                  updateCell(cell.id, {
                    markdown: { ...md, source: e.target.value },
                  })
                }
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/90 font-mono resize-y focus:outline-none focus:border-white/25"
                placeholder="Write markdown..."
              />
            )}
          </div>
        );
      }

      // ── DTU ──
      case 'dtu': {
        const d = cell.dtu!;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-4">
                <label className="block text-xs text-white/50 mb-1">Material</label>
                <select
                  value={d.material}
                  onChange={(e) =>
                    updateCell(cell.id, { dtu: { ...d, material: e.target.value } })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/25"
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m} className="bg-gray-900">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {(['length', 'width', 'height'] as const).map((dim) => (
                <div key={dim}>
                  <label className="block text-xs text-white/50 mb-1 capitalize">{dim} (mm)</label>
                  <input
                    type="number"
                    value={d[dim]}
                    onChange={(e) =>
                      updateCell(cell.id, { dtu: { ...d, [dim]: e.target.value } })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/25"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            {d.length && d.width && d.height && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-emerald-400">DTU Preview</div>
                <div className="text-sm text-white/80">
                  <span className="text-white/50">Material:</span> {d.material}
                </div>
                <div className="text-sm text-white/80">
                  <span className="text-white/50">Dimensions:</span> {d.length} x {d.width} x{' '}
                  {d.height} mm
                </div>
                <div className="text-sm text-white/80">
                  <span className="text-white/50">Volume:</span>{' '}
                  {((+d.length * +d.width * +d.height) / 1e9).toFixed(3)} m&sup3;
                </div>
                <div className="text-sm text-white/80">
                  <span className="text-white/50">Type:</span> structural-beam
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── Validation ──
      case 'validation': {
        const v = cell.validation!;
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {v.tests.map((t, ti) => (
                <label key={t.id} className="flex items-center gap-1.5 text-sm text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={() => {
                      const next = { ...v, tests: v.tests.map((x, xi) => (xi === ti ? { ...x, enabled: !x.enabled } : x)) };
                      updateCell(cell.id, { validation: next });
                    }}
                    className="accent-amber-500"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Environment</label>
              <input
                type="text"
                value={v.environment}
                onChange={(e) =>
                  updateCell(cell.id, { validation: { ...v, environment: e.target.value } })
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/25"
                placeholder="e.g. Coastal temperate, wind zone III"
              />
            </div>
            <button
              onClick={() => runCell(cell.id)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors"
            >
              Run Validation
            </button>
            {v.hasRun && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1.5">
                <div className="text-xs font-semibold text-white/60 mb-2">Results</div>
                {v.tests
                  .filter((t) => t.enabled)
                  .map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={t.passed ? 'text-green-400' : 'text-red-400'}>
                          {t.passed ? '\u2713' : '\u2717'}
                        </span>
                        <span className="text-white/80">{t.label}</span>
                      </div>
                      <span className="text-white/50 text-xs font-mono">
                        SF {t.safetyFactor?.toFixed(1) ?? '---'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      }

      // ── Code ──
      case 'code': {
        const cd = cell.code!;
        return (
          <div className="space-y-2">
            <textarea
              value={cd.source}
              onChange={(e) =>
                updateCell(cell.id, { code: { ...cd, source: e.target.value } })
              }
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/90 font-mono resize-y focus:outline-none focus:border-white/25 leading-relaxed"
              placeholder="// Write code..."
            />
            <button
              onClick={() => runCell(cell.id)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-medium hover:bg-rose-500/30 transition-colors"
            >
              Execute
            </button>
            {cd.output && (
              <pre className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-green-300/80 font-mono whitespace-pre-wrap">
                {cd.output}
              </pre>
            )}
          </div>
        );
      }

      // ── Publish ──
      case 'publish': {
        const p = cell.publish!;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Component Name</label>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) =>
                    updateCell(cell.id, { publish: { ...p, name: e.target.value } })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/25"
                  placeholder="component-name"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Version</label>
                <input
                  type="text"
                  value={p.version}
                  onChange={(e) =>
                    updateCell(cell.id, { publish: { ...p, version: e.target.value } })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/25"
                  placeholder="0.1.0"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Description</label>
              <textarea
                value={p.description}
                onChange={(e) =>
                  updateCell(cell.id, { publish: { ...p, description: e.target.value } })
                }
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 resize-y focus:outline-none focus:border-white/25"
                placeholder="Describe this component..."
              />
            </div>
            {!p.published ? (
              <button
                onClick={() => runCell(cell.id)}
                className="px-4 py-1.5 rounded-lg bg-pink-500/20 text-pink-300 text-xs font-medium hover:bg-pink-500/30 transition-colors"
              >
                Publish to Registry
              </button>
            ) : (
              <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-pink-400">Published</div>
                <div className="text-sm text-white/80 font-mono break-all">{p.registryUrl}</div>
              </div>
            )}
          </div>
        );
      }

      // ── Fallback for visualization / lens-query ──
      default:
        return (
          <div className="text-sm text-white/40 italic py-4 text-center">
            {CELL_TYPE_LABELS[cell.type]} cell &mdash; configure and run to see output.
          </div>
        );
    }
  };

  // ── Main render ──

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Editable title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-white font-semibold text-base focus:outline-none border-b border-transparent focus:border-white/30 transition-colors"
          />
          <span className="text-xs text-white/40">
            {cellCount} cell{cellCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Autosave indicator */}
          <span className="text-xs text-white/30 mr-2">Saved {savedAt}</span>

          {/* Public / Private toggle */}
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              isPublic
                ? 'border-green-500/40 text-green-400 bg-green-500/10'
                : 'border-white/10 text-white/50 bg-white/5'
            }`}
          >
            {isPublic ? 'Public' : 'Private'}
          </button>

          {/* Run All */}
          <button
            onClick={runAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-medium hover:bg-white/15 transition-colors"
          >
            <span className="text-[10px]">\u25B6</span> Run All
          </button>

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-medium hover:bg-white/15 transition-colors"
            >
              Export \u25BE
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-9 z-50 bg-black/95 border border-white/10 rounded-lg py-1 shadow-2xl backdrop-blur-xl min-w-[140px]">
                {['PDF', 'HTML', 'DTU-bundle'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportOpen(false)}
                    className="block w-full text-left px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Export as {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fork */}
          <button className="px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-medium hover:bg-white/15 transition-colors">
            Fork
          </button>
        </div>
      </div>

      {/* ── Cell List ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {renderAddButton(0)}

        {cells.map((cell, idx) => (
          <React.Fragment key={cell.id}>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
              {/* Cell header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 font-mono w-5 text-right">
                    {idx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white/90 ${CELL_TYPE_COLORS[cell.type]}`}
                  >
                    {CELL_TYPE_LABELS[cell.type]}
                  </span>
                  {/* Type selector */}
                  <select
                    value={cell.type}
                    onChange={(e) =>
                      updateCell(cell.id, { type: e.target.value as CellType })
                    }
                    className="bg-transparent border-none text-xs text-white/40 focus:outline-none cursor-pointer"
                  >
                    {cellTypes.map((ct) => (
                      <option key={ct} value={ct} className="bg-gray-900">
                        {CELL_TYPE_LABELS[ct]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  {cell.running && (
                    <span className="text-[10px] text-amber-400 animate-pulse mr-1">
                      running...
                    </span>
                  )}
                  <button
                    onClick={() => runCell(cell.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-xs"
                    title="Run cell"
                  >
                    \u25B6
                  </button>
                  <button
                    onClick={() => deleteCell(cell.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                    title="Delete cell"
                  >
                    \u00D7
                  </button>
                </div>
              </div>

              {/* Cell body */}
              <div className="px-4 py-3">{renderCellBody(cell)}</div>
            </div>

            {renderAddButton(idx + 1)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
