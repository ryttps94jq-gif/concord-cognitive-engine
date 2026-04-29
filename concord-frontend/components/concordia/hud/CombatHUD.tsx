'use client';

import React from 'react';
import { CombatState } from '@/hooks/useCombatState';
import { VATSTarget, BodyPart } from '@/lib/concordia/combat/vats';
import { cooldownProgress } from '@/lib/concordia/combat/hotbar';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';

// ── Sub-components ───────────────────────────────────────────────────

function Bar({
  value, max, color, label,
}: { value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-0.5 min-w-[120px]">
      <div className="flex justify-between text-xs text-white/70 font-mono">
        <span>{label}</span>
        <span>{Math.round(value)}/{max}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function HotbarSlot({
  skill, index, active, onActivate,
}: {
  skill: CombatState['hotbar']['slots'][number];
  index: number;
  active: boolean;
  onActivate: () => void;
}) {
  const cooldown = skill ? cooldownProgress(skill) : 1;
  const onCD = skill ? cooldown < 1 : false;

  return (
    <button
      onClick={onActivate}
      className={`relative w-12 h-12 rounded border text-white/90 text-xs font-bold
        flex flex-col items-center justify-center gap-0.5
        ${active ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-black/60'}
        ${onCD ? 'opacity-50' : 'hover:border-white/50'}
        transition-all`}
    >
      <span className="text-[10px] text-white/40 absolute top-0.5 left-1">{index + 1}</span>
      {skill ? (
        <>
          <span className="truncate w-10 text-center">{skill.name.slice(0, 6)}</span>
          {onCD && (
            <div
              className="absolute inset-0 bg-black/50 rounded"
              style={{ clipPath: `inset(${Math.round((1 - cooldown) * 100)}% 0 0 0)` }}
            />
          )}
        </>
      ) : (
        <span className="text-white/20">—</span>
      )}
    </button>
  );
}

function TargetIndicator({ target }: { target: NonNullable<CombatState['target']> }) {
  const pct = (target.health / target.maxHealth) * 100;
  const color = pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444';
  return (
    <div className="bg-black/80 border border-white/10 rounded-lg px-3 py-2 min-w-[180px]">
      <div className="text-white text-sm font-semibold mb-1">{target.name}</div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-right text-xs text-white/50 mt-0.5 font-mono">
        {target.health}/{target.maxHealth}
      </div>
    </div>
  );
}

function VATSOverlay({
  targets, apCurrent, apMax, onSelectPart, onExit,
}: {
  targets: VATSTarget[];
  apCurrent: number;
  apMax: number;
  onSelectPart: (targetId: string, part: BodyPart, apCost: number) => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-green-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-black/90 border border-green-400/60 rounded-xl p-6 min-w-[340px] text-green-300 font-mono">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-bold text-green-400">V.A.T.S.</span>
          <span className="text-sm">AP: {Math.round(apCurrent)}/{apMax}</span>
        </div>
        {targets.map(t => (
          <div key={t.entityId} className="mb-4">
            <div className="text-sm font-semibold mb-2">{t.entityName} ({Math.round(t.distance)}m)</div>
            <div className="grid grid-cols-2 gap-1">
              {t.bodyParts.map(bp => (
                <button
                  key={bp.part}
                  onClick={() => onSelectPart(t.entityId, bp.part, bp.apCost)}
                  disabled={apCurrent < bp.apCost}
                  className="flex justify-between items-center px-2 py-1 rounded border border-green-400/30
                    hover:bg-green-400/10 disabled:opacity-40 text-xs text-left"
                >
                  <span className="capitalize">{bp.part.replace('_', ' ')}</span>
                  <span className="text-green-400">{bp.hitChance}%</span>
                  <span className="text-green-600">{bp.apCost}AP</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={onExit} className="mt-2 w-full text-sm text-green-400/60 hover:text-green-400">
          Exit VATS [V]
        </button>
      </div>
    </div>
  );
}

// ── Main HUD ─────────────────────────────────────────────────────────

interface CombatHUDProps {
  state: CombatState;
  vatsTargets?: VATSTarget[];
  onActivateSkill: (slot: number) => void;
  onDodge: () => void;
  onBlock: (held: boolean) => void;
  onToggleVATS: () => void;
  onQueueShot: (targetId: string, part: BodyPart, apCost: number) => void;
}

export function CombatHUD({
  state,
  vatsTargets = [],
  onActivateSkill,
  onDodge,
  onBlock,
  onToggleVATS,
  onQueueShot,
}: CombatHUDProps) {
  // Hotbar keys 1–9 + combat bindings
  useKeyboardInput({
    Digit1: () => onActivateSkill(0),
    Digit2: () => onActivateSkill(1),
    Digit3: () => onActivateSkill(2),
    Digit4: () => onActivateSkill(3),
    Digit5: () => onActivateSkill(4),
    Digit6: () => onActivateSkill(5),
    Digit7: () => onActivateSkill(6),
    Digit8: () => onActivateSkill(7),
    Digit9: () => onActivateSkill(8),
    KeyQ: onDodge,
    ShiftLeft: { onDown: () => onBlock(true), onUp: () => onBlock(false) },
    KeyV: onToggleVATS,
  });

  return (
    <>
      {/* VATS overlay */}
      {state.vats.active && (
        <VATSOverlay
          targets={vatsTargets}
          apCurrent={state.vats.ap}
          apMax={state.vats.maxAp}
          onSelectPart={onQueueShot}
          onExit={onToggleVATS}
        />
      )}

      {/* Bottom-left: health + stamina + AP */}
      <div className="absolute bottom-24 left-4 flex flex-col gap-2">
        <Bar value={state.health} max={state.maxHealth} color="#ef4444" label="HP" />
        <Bar value={state.stamina} max={state.maxStamina} color="#22c55e" label="STA" />
        <Bar value={state.vats.ap} max={state.vats.maxAp} color="#22d3ee" label="AP" />
      </div>

      {/* Top-center: target */}
      {state.target && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2">
          <TargetIndicator target={state.target} />
        </div>
      )}

      {/* Bottom-center: hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
        {state.hotbar.slots.map((skill, i) => (
          <HotbarSlot
            key={i}
            skill={skill}
            index={i}
            active={state.hotbar.activeSlot === i}
            onActivate={() => onActivateSkill(i)}
          />
        ))}
      </div>

      {/* Bottom-right: combat log */}
      <div className="absolute bottom-24 right-4 w-48 flex flex-col gap-0.5 pointer-events-none">
        {state.log.slice(0, 6).map(entry => (
          <div
            key={entry.id}
            className={`text-xs font-mono px-2 py-0.5 rounded bg-black/50
              ${entry.type === 'hit'  ? 'text-yellow-300' : ''}
              ${entry.type === 'crit' ? 'text-orange-400 font-bold' : ''}
              ${entry.type === 'miss' ? 'text-white/40' : ''}
              ${entry.type === 'death' ? 'text-red-400' : ''}
              ${entry.type === 'dodge' ? 'text-cyan-300' : ''}
              ${entry.type === 'info' ? 'text-white/60' : ''}
            `}
          >
            {entry.text}
          </div>
        ))}
      </div>
    </>
  );
}
