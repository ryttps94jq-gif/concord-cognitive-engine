'use client';

import React, { useState, useMemo } from 'react';

// ── Seed data ──────────────────────────────────────────────────────────────────

const DSL_KEYWORDS = [
  'material',
  'component',
  'structure',
  'validate',
  'publish',
  'for',
  'in',
  'assert',
];

interface Template {
  id: string;
  name: string;
  code: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'beam-family',
    name: 'Beam Family Generator',
    code: `material SteelA992 {
  type: "structural_steel"
  yield_strength: 345 MPa
  density: 7850 kg/m3
  elastic_modulus: 200 GPa
}

component BeamFamily {
  material: SteelA992
  for size in ["W12x26", "W14x30", "W16x36"] {
    beam(size) {
      span: 8.0 m
      load_capacity: auto
    }
  }
}

validate BeamFamily {
  assert deflection_ratio < 1/360
  assert utilization < 0.85
}`,
  },
  {
    id: 'parametric-column',
    name: 'Parametric Column Study',
    code: `material ConcreteC40 {
  type: "reinforced_concrete"
  compressive_strength: 40 MPa
  density: 2400 kg/m3
}

component ColumnStudy {
  material: ConcreteC40
  for height in [3.0, 4.5, 6.0] {
    for width in [0.3, 0.4, 0.5] {
      column(height, width) {
        reinforcement: "4x#8"
        ties: "#3@200mm"
      }
    }
  }
}

validate ColumnStudy {
  assert slenderness_ratio < 22
  assert axial_capacity > 1200 kN
}`,
  },
  {
    id: 'truss-variant',
    name: 'Truss Variant Explorer',
    code: `material SteelA36 {
  type: "structural_steel"
  yield_strength: 250 MPa
  density: 7850 kg/m3
}

component TrussVariants {
  material: SteelA36
  for type in ["pratt", "warren", "howe"] {
    structure truss(type) {
      span: 24.0 m
      depth: 3.0 m
      panel_count: 8
    }
  }
}

validate TrussVariants {
  assert max_stress < 0.9 * yield_strength
  assert node_displacement < 50 mm
}

publish TrussVariants`,
  },
  {
    id: 'material-comparison',
    name: 'Material Comparison',
    code: `material TimberGlulam {
  type: "engineered_wood"
  bending_strength: 24 MPa
  density: 500 kg/m3
}

material SteelS355 {
  type: "structural_steel"
  yield_strength: 355 MPa
  density: 7850 kg/m3
}

component ComparisonBeam {
  for mat in [TimberGlulam, SteelS355] {
    beam("test_beam") {
      material: mat
      span: 10.0 m
      load: 15 kN/m
    }
  }
}

validate ComparisonBeam {
  assert deflection < span / 300
}`,
  },
  {
    id: 'building-gen',
    name: 'Building Generator',
    code: `material ConcreteC30 {
  type: "reinforced_concrete"
  compressive_strength: 30 MPa
  density: 2400 kg/m3
}

material SteelA992 {
  type: "structural_steel"
  yield_strength: 345 MPa
  density: 7850 kg/m3
}

structure OfficeTower {
  floors: 12
  for floor in 1..12 {
    component slab(floor) {
      material: ConcreteC30
      thickness: 200 mm
    }
    component columns(floor) {
      material: SteelA992
      section: "W14x68"
    }
  }
}

validate OfficeTower {
  assert inter_story_drift < 0.02
  assert base_shear_capacity > 4500 kN
}

publish OfficeTower`,
  },
];

const SEED_CODE = TEMPLATES[0].code;

type ActionType = 'parse' | 'compile' | 'compile_validate' | 'compile_publish';

interface ActionOption {
  id: ActionType;
  label: string;
}

const ACTIONS: ActionOption[] = [
  { id: 'parse', label: 'Parse' },
  { id: 'compile', label: 'Compile' },
  { id: 'compile_validate', label: 'Compile & Validate' },
  { id: 'compile_publish', label: 'Compile & Publish' },
];

interface DiagnosticItem {
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface OutputResult {
  action: ActionType;
  success: boolean;
  content: string;
  diagnostics: DiagnosticItem[];
}

// ── Simulated compiler outputs ─────────────────────────────────────────────────

function simulateParse(code: string): OutputResult {
  const lines = code.split('\n');
  const diagnostics: DiagnosticItem[] = [];
  if (code.includes('assert') && !code.includes('validate')) {
    diagnostics.push({
      line: lines.findIndex((l) => l.includes('assert')) + 1,
      col: 3,
      severity: 'error',
      message: 'assert statement must appear inside a validate block',
    });
  }
  const nodeCount = (code.match(/\{/g) || []).length;
  return {
    action: 'parse',
    success: diagnostics.filter((d) => d.severity === 'error').length === 0,
    content: `AST generated successfully.
Nodes: ${nodeCount}
Materials: ${(code.match(/^material /gm) || []).length}
Components: ${(code.match(/^component /gm) || []).length}
Structures: ${(code.match(/^structure /gm) || []).length}
Validate blocks: ${(code.match(/^validate /gm) || []).length}
Publish directives: ${(code.match(/^publish /gm) || []).length}

Parse tree depth: ${Math.min(nodeCount, 8)}
Token count: ${code.split(/\s+/).length}`,
    diagnostics: [
      ...diagnostics,
      {
        line: 1,
        col: 1,
        severity: 'info' as const,
        message: 'Parsing completed in 12ms',
      },
    ],
  };
}

function simulateCompile(code: string): OutputResult {
  const materials = (code.match(/^material\s+(\w+)/gm) || []).map((m) =>
    m.replace('material ', '')
  );
  const components = (code.match(/^component\s+(\w+)/gm) || []).map((c) =>
    c.replace('component ', '')
  );
  const diagnostics: DiagnosticItem[] = [];
  if (materials.length === 0) {
    diagnostics.push({
      line: 1,
      col: 1,
      severity: 'warning',
      message: 'No materials defined; components may lack material bindings',
    });
  }
  const dtuIds = [
    ...materials.map((m) => `DTU-MAT-${m.toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`),
    ...components.map((c) => `DTU-CMP-${c.toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`),
  ];
  return {
    action: 'compile',
    success: true,
    content: `Compilation successful.

Generated DTUs (${dtuIds.length}):
${dtuIds.map((id) => `  ✓ ${id}`).join('\n')}

Dependency graph resolved.
Total compilation time: 47ms`,
    diagnostics: [
      ...diagnostics,
      { line: 0, col: 0, severity: 'info', message: `${dtuIds.length} DTUs emitted` },
    ],
  };
}

function simulateValidate(code: string): OutputResult {
  const assertions = (code.match(/assert .+/g) || []);
  const results = assertions.map((a, i) => ({
    assertion: a.replace('assert ', '').trim(),
    passed: i < assertions.length - 1 || Math.random() > 0.3,
  }));
  const allPassed = results.every((r) => r.passed);
  return {
    action: 'compile_validate',
    success: allPassed,
    content: `Compile & Validate complete.

Validation Results (${results.length} assertions):
${results
  .map(
    (r) => `  ${r.passed ? '✓ PASS' : '✗ FAIL'}  ${r.assertion}`
  )
  .join('\n')}

${allPassed ? 'All validations passed.' : 'Some validations failed. Review assertions above.'}`,
    diagnostics: results
      .filter((r) => !r.passed)
      .map((r) => ({
        line: (code.split('\n').findIndex((l) => l.includes(r.assertion)) + 1) || 1,
        col: 3,
        severity: 'error' as const,
        message: `Assertion failed: ${r.assertion}`,
      })),
  };
}

function simulatePublish(code: string): OutputResult {
  const publishTargets = (code.match(/^publish\s+(\w+)/gm) || []).map((p) =>
    p.replace('publish ', '')
  );
  if (publishTargets.length === 0) {
    return {
      action: 'compile_publish',
      success: false,
      content: 'No publish directives found in source.',
      diagnostics: [
        { line: 1, col: 1, severity: 'error', message: 'Add a publish directive to publish DTUs' },
      ],
    };
  }
  const ids = publishTargets.map(
    (t) => `PUB-${t.toUpperCase()}-${Date.now().toString(36)}`
  );
  return {
    action: 'compile_publish',
    success: true,
    content: `Compile & Publish complete.

Published IDs:
${ids.map((id) => `  📦 ${id}`).join('\n')}

Registry updated. ${ids.length} artifact(s) published to Concord DTU Registry.
Replication factor: 3
Availability: global`,
    diagnostics: [
      { line: 0, col: 0, severity: 'info', message: `Published ${ids.length} artifact(s)` },
    ],
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ConcordDSLEditor() {
  const [code, setCode] = useState(SEED_CODE);
  const [selectedAction, setSelectedAction] = useState<ActionType>('parse');
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [output, setOutput] = useState<OutputResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);

  const highlightedLines = useMemo(() => {
    return lines.map((line) => {
      let html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // keyword highlighting
      DSL_KEYWORDS.forEach((kw) => {
        const re = new RegExp(`\\b(${kw})\\b`, 'g');
        html = html.replace(re, `<span style="color:#c084fc;font-weight:600">$1</span>`);
      });

      // strings
      html = html.replace(
        /(&quot;|")(.*?)(\1|")/g,
        '<span style="color:#86efac">"$2"</span>'
      );

      // numbers with units
      html = html.replace(
        /\b(\d+(?:\.\d+)?)\s*(MPa|GPa|kN|mm|m3|m|kg)/g,
        '<span style="color:#fbbf24">$1</span> <span style="color:#67e8f9">$2</span>'
      );

      // plain numbers
      html = html.replace(
        /\b(\d+(?:\.\d+)?)\b(?!<\/span>)/g,
        '<span style="color:#fbbf24">$1</span>'
      );

      // comments
      html = html.replace(
        /(\/\/.*)$/,
        '<span style="color:#6b7280;font-style:italic">$1</span>'
      );

      return html;
    });
  }, [lines]);

  const errorLines = useMemo(() => {
    if (!output) return new Set<number>();
    return new Set(
      output.diagnostics
        .filter((d) => d.severity === 'error' && d.line > 0)
        .map((d) => d.line)
    );
  }, [output]);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      let result: OutputResult;
      switch (selectedAction) {
        case 'parse':
          result = simulateParse(code);
          break;
        case 'compile':
          result = simulateCompile(code);
          break;
        case 'compile_validate':
          result = simulateValidate(code);
          break;
        case 'compile_publish':
          result = simulatePublish(code);
          break;
      }
      setOutput(result);
      setIsRunning(false);
    }, 400);
  };

  const loadTemplate = (t: Template) => {
    setCode(t.code);
    setOutput(null);
    setShowTemplates(false);
  };

  const severityColor = (s: string) => {
    if (s === 'error') return 'text-red-400';
    if (s === 'warning') return 'text-yellow-400';
    return 'text-sky-400';
  };

  const severityBadge = (s: string) => {
    if (s === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (s === 'warning') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
  };

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-bold">
            DSL
          </div>
          <div>
            <h2 className="text-sm font-semibold">Concord DSL Editor</h2>
            <p className="text-[11px] text-white/40">Domain-specific language compiler</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            Templates
          </button>

          {/* Action selector */}
          <div className="relative">
            <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="px-4 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRunning ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>&#9654;</span>
                )}
                {ACTIONS.find((a) => a.id === selectedAction)?.label}
              </button>
              <button
                onClick={() => setShowActionDropdown(!showActionDropdown)}
                className="px-2 py-1.5 text-xs bg-purple-600/80 hover:bg-purple-500 border-l border-purple-400/30 transition-colors"
              >
                &#9660;
              </button>
            </div>
            {showActionDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl">
                {ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedAction(a.id);
                      setShowActionDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors flex items-center justify-between ${
                      selectedAction === a.id ? 'text-purple-400' : 'text-white/70'
                    }`}
                  >
                    {a.label}
                    {selectedAction === a.id && <span>&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template sidebar overlay */}
      {showTemplates && (
        <div className="absolute right-0 top-12 w-72 bg-gray-900/95 backdrop-blur border border-white/10 rounded-xl m-4 z-50 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold">Template Library</span>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-white/40 hover:text-white text-sm"
            >
              &#10005;
            </button>
          </div>
          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="w-full px-3 py-2.5 text-left text-xs rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="font-medium text-white/90 group-hover:text-purple-400 transition-colors">
                  {t.name}
                </div>
                <div className="text-white/30 mt-0.5 truncate font-mono text-[10px]">
                  {t.code.split('\n')[0]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Code editor */}
        <div className="flex-1 flex overflow-hidden border-r border-white/10">
          {/* Line numbers */}
          <div className="w-12 flex-shrink-0 bg-white/[0.02] border-r border-white/5 overflow-hidden">
            <div className="py-3 px-1 text-right">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={`text-[11px] font-mono leading-[20px] select-none ${
                    errorLines.has(i + 1) ? 'text-red-400 font-bold' : 'text-white/20'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 relative overflow-auto">
            {/* Syntax highlighted overlay */}
            <div
              className="absolute inset-0 py-3 px-4 pointer-events-none"
              aria-hidden="true"
            >
              {highlightedLines.map((html, i) => (
                <div
                  key={i}
                  className={`font-mono text-[13px] leading-[20px] whitespace-pre ${
                    errorLines.has(i + 1) ? 'bg-red-500/10' : ''
                  }`}
                  dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
                />
              ))}
            </div>

            {/* Transparent textarea */}
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setOutput(null);
              }}
              spellCheck={false}
              className="w-full h-full py-3 px-4 font-mono text-[13px] leading-[20px] bg-transparent text-transparent caret-purple-400 resize-none outline-none"
              style={{ WebkitTextFillColor: 'transparent' }}
            />
          </div>
        </div>

        {/* Output panel */}
        <div className="w-[45%] flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
              Output
            </span>
            {output && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  output.success
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {output.success ? 'Success' : 'Failed'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!output ? (
              <div className="flex flex-col items-center justify-center h-full text-white/20 text-xs">
                <div className="text-3xl mb-2">&#9654;</div>
                <p>Run to see output</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Main output */}
                <pre className="text-xs font-mono text-white/80 whitespace-pre-wrap leading-relaxed">
                  {output.content}
                </pre>

                {/* Diagnostics */}
                {output.diagnostics.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-white/5">
                    <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                      Diagnostics
                    </div>
                    {output.diagnostics.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${severityBadge(
                            d.severity
                          )}`}
                        >
                          {d.severity.toUpperCase()}
                        </span>
                        {d.line > 0 && (
                          <span className="text-white/30 font-mono text-[10px] mt-0.5">
                            L{d.line}:{d.col}
                          </span>
                        )}
                        <span className={severityColor(d.severity)}>
                          {d.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/10 bg-white/[0.02] text-[10px] text-white/30">
        <div className="flex items-center gap-4">
          <span>Lines: {lines.length}</span>
          <span>Chars: {code.length}</span>
          <span>
            Keywords: {DSL_KEYWORDS.filter((kw) => code.includes(kw)).length}/{DSL_KEYWORDS.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Concord DSL v1.0</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
