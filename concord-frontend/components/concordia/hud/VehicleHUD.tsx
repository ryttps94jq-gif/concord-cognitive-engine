'use client';

import React from 'react';
import { VehicleState } from '@/hooks/useVehicleState';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';
import { modeManager } from '@/lib/concordia/mode-manager';

// ── Gauge helpers ────────────────────────────────────────────────────

function ArcGauge({
  value, max, label, unit, redline, color,
}: {
  value: number; max: number; label: string; unit: string;
  redline?: number; color: string;
}) {
  const pct = Math.min(1, value / max);
  const inRedline = redline !== undefined && value > redline;
  const radius = 36;
  const circumference = Math.PI * radius;    // half-circle
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="50" viewBox="0 0 88 50">
        {/* Track */}
        <path d="M 8,44 A 36,36 0 0,1 80,44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 8,44 A 36,36 0 0,1 80,44"
          fill="none"
          stroke={inRedline ? '#ef4444' : color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.08s linear' }}
        />
        <text x="44" y="42" textAnchor="middle" fill="white" fontSize="12" fontFamily="monospace" fontWeight="bold">
          {Math.round(value)}
        </text>
      </svg>
      <div className="text-[10px] text-white/50 font-mono -mt-1">{label} {unit}</div>
    </div>
  );
}

function GearDisplay({ gear }: { gear: number }) {
  const label = gear === 0 ? 'N' : gear === -1 ? 'R' : String(gear);
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl font-bold font-mono text-yellow-400">{label}</div>
      <div className="text-[10px] text-white/40 font-mono">GEAR</div>
    </div>
  );
}

function FuelBar({ value }: { value: number }) {
  const color = value > 30 ? '#22c55e' : value > 10 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-1 text-xs text-white/60 font-mono">
      <span>FUEL</span>
      <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span>{Math.round(value)}%</span>
    </div>
  );
}

function DamagePanel({ damage }: { damage: Record<string, number> }) {
  const parts = Object.entries(damage).filter(([, v]) => v > 0);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {parts.map(([part, pct]) => (
        <div key={part} className="flex items-center gap-1 text-xs font-mono">
          <span className="text-white/40 capitalize w-14">{part}</span>
          <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main HUD ─────────────────────────────────────────────────────────

interface VehicleHUDProps {
  state: VehicleState;
  onExit: () => void;
  onHorn: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
}

export function VehicleHUD({ state, onExit, onHorn, onShiftUp, onShiftDown }: VehicleHUDProps) {
  const specs = state.specs;
  const maxSpeed = specs?.maxSpeedKph ?? 120;
  const redline  = specs?.redlineRpm   ?? 7000;

  useKeyboardInput({
    KeyE: () => {
      onExit();
      modeManager.pop();
    },
    KeyH: onHorn,
    ShiftLeft:    { onDown: onShiftUp },
    ControlLeft:  { onDown: onShiftDown },
    ArrowUp:      { onDown: () => undefined },
    ArrowDown:    { onDown: () => undefined },
    Space:        { onDown: () => undefined }, // handbrake handled by parent
  });

  return (
    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      {/* Gauges row */}
      <div className="flex gap-4 items-end">
        <ArcGauge
          value={state.speedKph}
          max={maxSpeed}
          label="SPEED"
          unit="kph"
          color="#22c55e"
        />
        <ArcGauge
          value={state.rpm}
          max={redline}
          label="RPM"
          unit="×100"
          redline={redline * 0.85}
          color="#3b82f6"
        />
        <GearDisplay gear={state.gear} />
      </div>

      {/* Fuel */}
      <FuelBar value={state.fuel} />

      {/* Damage */}
      <DamagePanel damage={state.damage} />

      {/* Exit hint */}
      <div className="text-[10px] text-white/30 font-mono text-center">
        [E] Exit · [H] Horn · [Shift/Ctrl] Shift gear
      </div>
    </div>
  );
}
