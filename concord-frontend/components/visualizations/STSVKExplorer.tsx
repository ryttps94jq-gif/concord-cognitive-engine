'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Theorem {
  id: string;
  domain: string;
  statement: string;
  proof: string;
}

export interface STSVKExplorerProps {
  theorems?: Theorem[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Hardcoded sample theorems for the 0-1 binary foundation (x^2 - x = 0)
// ---------------------------------------------------------------------------

const SAMPLE_THEOREMS: Theorem[] = [
  {
    id: 'stsvk-001',
    domain: 'Foundation',
    statement: 'The equation x\u00B2 - x = 0 has exactly two solutions in \u211D: x = 0 and x = 1.',
    proof: 'Factor: x(x - 1) = 0. By the zero-product property, x = 0 or x = 1. Since the polynomial is degree 2, there are at most 2 roots. Both are verified by substitution. \u220E',
  },
  {
    id: 'stsvk-002',
    domain: 'Foundation',
    statement: 'The function f(x) = x\u00B2 - x achieves its minimum value of -1/4 at x = 1/2.',
    proof: 'f\'(x) = 2x - 1 = 0 implies x = 1/2. f(1/2) = 1/4 - 1/2 = -1/4. f\'\'(x) = 2 > 0, so this is a minimum. \u220E',
  },
  {
    id: 'stsvk-003',
    domain: 'Boolean Logic',
    statement: 'In \u2124/2\u2124 (the integers mod 2), x\u00B2 = x for all x. This is the idempotent law of Boolean algebra.',
    proof: 'There are only two elements: 0 and 1. Check: 0\u00B2 = 0 = 0 (mod 2) and 1\u00B2 = 1 = 1 (mod 2). \u220E',
  },
  {
    id: 'stsvk-004',
    domain: 'Set Theory',
    statement: 'The characteristic function \u03C7_A of any set A satisfies \u03C7_A\u00B2 = \u03C7_A, since \u03C7_A maps to {0, 1}.',
    proof: 'For any x, \u03C7_A(x) \u2208 {0, 1}. If \u03C7_A(x) = 0, then 0\u00B2 = 0. If \u03C7_A(x) = 1, then 1\u00B2 = 1. Thus \u03C7_A\u00B2 = \u03C7_A. \u220E',
  },
  {
    id: 'stsvk-005',
    domain: 'Probability',
    statement: 'A Bernoulli random variable X with p \u2208 {0,1} is deterministic and satisfies X\u00B2 = X a.s.',
    proof: 'If p = 0, X = 0 a.s., so X\u00B2 = 0 = X. If p = 1, X = 1 a.s., so X\u00B2 = 1 = X. \u220E',
  },
  {
    id: 'stsvk-006',
    domain: 'Linear Algebra',
    statement: 'A matrix P satisfying P\u00B2 = P is a projection matrix. Its eigenvalues lie in {0, 1}.',
    proof: 'If Pv = \u03BBv for eigenvector v, then P\u00B2v = \u03BB\u00B2v = Pv = \u03BBv, so \u03BB\u00B2 = \u03BB, hence \u03BB \u2208 {0, 1}. \u220E',
  },
  {
    id: 'stsvk-007',
    domain: 'Category Theory',
    statement: 'An idempotent morphism e: A \u2192 A in a category satisfies e \u2218 e = e, the categorical analog of x\u00B2 = x.',
    proof: 'By definition, an idempotent is a morphism e with e \u2218 e = e. If the category splits idempotents, e factors as e = r \u2218 s where s \u2218 r = id, giving the image as a retract. \u220E',
  },
  {
    id: 'stsvk-008',
    domain: 'Information Theory',
    statement: 'Binary entropy H(p) = -p log p - (1-p) log(1-p) vanishes exactly at the roots of x\u00B2 - x = 0.',
    proof: 'H(0) = 0 and H(1) = 0 (using continuity: lim_{p\u21920} p log p = 0). H(p) > 0 for p \u2208 (0,1). The zero-entropy states correspond to deterministic bits. \u220E',
  },
];

// ---------------------------------------------------------------------------
// Domain colors
// ---------------------------------------------------------------------------

const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string; fill: string }> = {
  Foundation:          { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/30',   fill: '#22d3ee' },
  'Boolean Logic':     { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', fill: '#a855f7' },
  'Set Theory':        { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/30',  fill: '#22c55e' },
  'Probability':       { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30',  fill: '#f59e0b' },
  'Linear Algebra':    { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30',   fill: '#3b82f6' },
  'Category Theory':   { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/30',   fill: '#ec4899' },
  'Information Theory': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', fill: '#f97316' },
};

function getDomainStyle(domain: string) {
  return DOMAIN_COLORS[domain] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', fill: '#6b7280' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function STSVKExplorer({ theorems: externalTheorems, className }: STSVKExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 300 });
  const [sliderX, setSliderX] = useState(0.5); // x value for interactive slider
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [expandedTheorem, setExpandedTheorem] = useState<string | null>(null);

  const theorems = useMemo(() => {
    const t = externalTheorems && externalTheorems.length > 0 ? externalTheorems : SAMPLE_THEOREMS;
    if (!selectedDomain) return t;
    return t.filter(th => th.domain === selectedDomain);
  }, [externalTheorems, selectedDomain]);

  const allTheorems = useMemo(() => externalTheorems && externalTheorems.length > 0 ? externalTheorems : SAMPLE_THEOREMS, [externalTheorems]);

  const domains = useMemo(() => {
    const s = new Set(allTheorems.map(t => t.domain));
    return [...s];
  }, [allTheorems]);

  // Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) setCanvasSize({ w: width, h: 300 });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw the parabola
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvasSize.w;
    const H = canvasSize.h;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, W, H);

    // Coordinate transform: map math coords to canvas
    const xRange = { min: -0.5, max: 1.5 };
    const yRange = { min: -0.5, max: 0.8 };
    const toCanvasX = (x: number) => ((x - xRange.min) / (xRange.max - xRange.min)) * W;
    const toCanvasY = (y: number) => H - ((y - yRange.min) / (yRange.max - yRange.min)) * H;

    // Grid lines
    ctx.strokeStyle = '#1f293730';
    ctx.lineWidth = 1;
    for (let x = -0.5; x <= 1.5; x += 0.25) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), 0);
      ctx.lineTo(toCanvasX(x), H);
      ctx.stroke();
    }
    for (let y = -0.5; y <= 0.8; y += 0.25) {
      ctx.beginPath();
      ctx.moveTo(0, toCanvasY(y));
      ctx.lineTo(W, toCanvasY(y));
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    // x-axis
    ctx.beginPath();
    ctx.moveTo(0, toCanvasY(0));
    ctx.lineTo(W, toCanvasY(0));
    ctx.stroke();
    // y-axis
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), 0);
    ctx.lineTo(toCanvasX(0), H);
    ctx.stroke();

    // Axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('0', toCanvasX(0) - 10, toCanvasY(0) + 14);
    ctx.fillText('1', toCanvasX(1), toCanvasY(0) + 14);
    ctx.fillText('x', W - 15, toCanvasY(0) + 14);
    ctx.textAlign = 'left';
    ctx.fillText('y', toCanvasX(0) + 6, 14);

    // Draw the parabola f(x) = x^2 - x
    ctx.beginPath();
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const x = xRange.min + (i / steps) * (xRange.max - xRange.min);
      const y = x * x - x;
      const cx = toCanvasX(x);
      const cy = toCanvasY(y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label the curve
    ctx.font = 'italic 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#22d3ee';
    ctx.textAlign = 'left';
    ctx.fillText('f(x) = x\u00B2 - x', toCanvasX(1.05), toCanvasY(0.2));

    // Mark the roots with glowing dots
    const roots = [0, 1];
    for (const root of roots) {
      const rx = toCanvasX(root);
      const ry = toCanvasY(0);

      // Glow
      const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, 20);
      glow.addColorStop(0, '#a855f780');
      glow.addColorStop(1, '#a855f700');
      ctx.beginPath();
      ctx.arc(rx, ry, 20, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff50';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#a855f7';
      ctx.textAlign = 'center';
      ctx.fillText(`x = ${root}`, rx, ry - 14);
    }

    // Mark the minimum at x = 0.5
    const minX = toCanvasX(0.5);
    const minY = toCanvasY(-0.25);
    ctx.beginPath();
    ctx.arc(minX, minY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'center';
    ctx.fillText('min = -1/4', minX, minY + 14);

    // Interactive slider position
    const sx = toCanvasX(sliderX);
    const sy = toCanvasY(sliderX * sliderX - sliderX);
    const fVal = sliderX * sliderX - sliderX;

    // Vertical dashed line from axis to point
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(sx, toCanvasY(0));
    ctx.lineTo(sx, sy);
    ctx.strokeStyle = '#facc1580';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Horizontal dashed line from axis to point
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(toCanvasX(0), sy);
    ctx.lineTo(sx, sy);
    ctx.strokeStyle = '#facc1580';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Point on curve
    const ptGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
    ptGlow.addColorStop(0, '#facc1560');
    ptGlow.addColorStop(1, '#facc1500');
    ctx.beginPath();
    ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.fillStyle = ptGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();

    // Value readout
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(`(${sliderX.toFixed(2)}, ${fVal.toFixed(3)})`, sx + 10, sy - 8);

    // x^2 - x readout
    ctx.font = '10px monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`x\u00B2 - x = ${fVal.toFixed(4)}`, sx + 10, sy + 8);

  }, [canvasSize, sliderX]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('bg-lattice-surface border border-lattice-border rounded-xl overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lattice-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <h3 className="text-sm font-semibold text-white">STSVK Theorem Explorer</h3>
          <span className="text-xs text-gray-500">x&sup2; - x = 0 Foundation</span>
        </div>
        <span className="text-[10px] text-gray-600">{allTheorems.length} theorems across {domains.length} domains</span>
      </div>

      {/* Canvas + Slider */}
      <div ref={containerRef} className="relative w-full px-4 pt-3">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 300 }}
          className="rounded-lg"
        />

        {/* Slider */}
        <div className="mt-3 mb-2 flex items-center gap-3">
          <span className="text-[10px] text-gray-500 font-mono w-10 text-right">x = {sliderX.toFixed(2)}</span>
          <input
            type="range"
            min="-0.3"
            max="1.3"
            step="0.01"
            value={sliderX}
            onChange={(e) => setSliderX(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-lattice-border cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-yellow-400/30 [&::-webkit-slider-thumb]:cursor-grab"
          />
          <span className={cn(
            'text-[10px] font-mono w-24',
            Math.abs(sliderX * sliderX - sliderX) < 0.01 ? 'text-neon-green font-bold' : 'text-gray-500'
          )}>
            f(x) = {(sliderX * sliderX - sliderX).toFixed(4)}
          </span>
        </div>

        {/* Insight badge */}
        {Math.abs(sliderX * sliderX - sliderX) < 0.005 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 text-xs text-neon-green bg-neon-green/5 border border-neon-green/20 rounded-lg px-3 py-1.5 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            Root found! x = {sliderX.toFixed(2)} satisfies x&sup2; - x = 0 (the binary foundation)
          </motion.div>
        )}
      </div>

      {/* Domain filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-lattice-border/50 overflow-x-auto">
        <button
          onClick={() => setSelectedDomain(null)}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap',
            !selectedDomain ? 'bg-white/10 border-white/20 text-white' : 'border-lattice-border text-gray-500 hover:text-gray-300'
          )}
        >
          All ({allTheorems.length})
        </button>
        {domains.map(d => {
          const style = getDomainStyle(d);
          const count = allTheorems.filter(t => t.domain === d).length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDomain(selectedDomain === d ? null : d)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap',
                selectedDomain === d ? `${style.bg} ${style.border} ${style.text}` : 'border-lattice-border text-gray-500 hover:text-gray-300'
              )}
            >
              {d} ({count})
            </button>
          );
        })}
      </div>

      {/* Theorem cards */}
      <div className="px-4 pb-4 space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {theorems.map((thm) => {
            const style = getDomainStyle(thm.domain);
            const isExpanded = expandedTheorem === thm.id;
            return (
              <motion.div
                key={thm.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  'rounded-lg border p-3 cursor-pointer transition-colors hover:bg-white/[0.02]',
                  isExpanded ? `${style.bg} ${style.border}` : 'bg-lattice-deep border-lattice-border'
                )}
                onClick={() => setExpandedTheorem(isExpanded ? null : thm.id)}
              >
                <div className="flex items-start gap-2">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5', style.bg, style.border, style.text)}>
                    {thm.domain}
                  </span>
                  <p className="text-xs text-gray-200 leading-relaxed flex-1">{thm.statement}</p>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-2 border-t border-white/10">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Proof</p>
                        <p className="text-xs text-gray-400 leading-relaxed font-mono">{thm.proof}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
