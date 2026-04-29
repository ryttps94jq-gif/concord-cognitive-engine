'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ControlScheme } from '@/lib/concordia/combat/control-schemes';

interface Props {
  scheme: ControlScheme;
  /** Show only the first N bindings when collapsed. Default 4 */
  previewCount?: number;
}

function KeyChip({ keys }: { keys: string[] }) {
  const label = keys
    .map(k =>
      k === 'Mouse0' ? 'LMB'
      : k === 'Mouse1' ? 'RMB'
      : k === 'ShiftLeft' || k === 'ShiftRight' ? '⇧'
      : k === 'ControlLeft' || k === 'ControlRight' ? 'Ctrl'
      : k === 'AltLeft' || k === 'AltRight' ? 'Alt'
      : k === 'Space' ? '␣'
      : k.replace('Key', '').replace('Digit', '')
    )
    .join('+');
  return (
    <span className="font-mono text-[9px] bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white/80">
      {label}
    </span>
  );
}

export function ControlLegend({ scheme, previewCount = 4 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? scheme.bindings : scheme.bindings.slice(0, previewCount);

  return (
    <div
      className="select-none"
      style={{ borderLeft: `2px solid ${scheme.accentColor}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-white/5 transition-colors"
      >
        <Gamepad2 className="w-3 h-3 shrink-0" style={{ color: scheme.accentColor }} />
        <span className="text-white text-[10px] font-semibold flex-1 truncate">{scheme.name}</span>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-white/40" />
          : <ChevronDown className="w-3 h-3 text-white/40" />}
      </button>

      {/* Bindings */}
      <div className="px-2 pb-1.5 space-y-0.5">
        <AnimatePresence initial={false}>
          {shown.map(b => (
            <motion.div
              key={b.action}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 overflow-hidden"
            >
              <KeyChip keys={b.keys} />
              <span className="text-white/50 text-[9px] truncate">{b.label}</span>
              {b.holdable && (
                <span className="text-[8px] text-white/25 font-mono ml-auto">hold</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {!expanded && scheme.bindings.length > previewCount && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[9px] text-white/30 hover:text-white/60 transition-colors mt-0.5"
          >
            +{scheme.bindings.length - previewCount} more
          </button>
        )}
      </div>
    </div>
  );
}
