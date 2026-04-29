'use client';

import React, { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface World {
  id: string;
  name: string;
  universe_type: string;
  description: string;
  population: number;
  total_visits: number;
  npc_count: number;
  status: string;
}

interface TransitHubProps {
  currentWorldId?: string;
  onTravelled?: (worldId: string) => void;
  className?: string;
}

// Domain accent colours keyed by universe_type
const UNIVERSE_ACCENTS: Record<string, { accent: string; icon: string }> = {
  standard:        { accent: '#22d3ee', icon: '🏙️' },
  fantasy:         { accent: '#a78bfa', icon: '🧙' },
  superpowered:    { accent: '#f59e0b', icon: '⚡' },
  post_apocalyptic:{ accent: '#ef4444', icon: '☢️' },
  urban_crime:     { accent: '#6366f1', icon: '🔫' },
  military:        { accent: '#84cc16', icon: '🪖' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PopulationBadge({ count }: { count: number }) {
  const colour = count === 0 ? 'text-white/30' : count < 10 ? 'text-emerald-400' : count < 50 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-mono ${colour}`}>{count} online</span>;
}

interface ConfirmModalProps {
  world: World;
  onConfirm: () => void;
  onCancel: () => void;
  travelling: boolean;
}

function ConfirmModal({ world, onConfirm, onCancel, travelling }: ConfirmModalProps) {
  const { accent, icon } = UNIVERSE_ACCENTS[world.universe_type] || { accent: '#64748b', icon: '🌍' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
        <div className="text-2xl text-center">{icon}</div>
        <h2 className="text-lg font-bold text-white text-center">Travel to {world.name}?</h2>
        <p className="text-sm text-white/60 text-center">{world.description}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={travelling}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-black transition disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {travelling ? 'Travelling…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TransitHub({ currentWorldId, onTravelled, className = '' }: TransitHubProps) {
  const [worlds,     setWorlds]     = useState<World[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [confirm,    setConfirm]    = useState<World | null>(null);
  const [travelling, setTravelling] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/worlds')
      .then(r => r.json())
      .then(d => setWorlds(d.worlds || []))
      .catch(() => setError('Failed to load worlds'))
      .finally(() => setLoading(false));
  }, []);

  const handleTravel = useCallback(async (world: World) => {
    setTravelling(true);
    setError(null);
    try {
      const res = await fetch('/api/worlds/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldId: world.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Travel failed');
      }
      setConfirm(null);
      onTravelled?.(world.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Travel failed');
    } finally {
      setTravelling(false);
    }
  }, [onTravelled]);

  if (loading) {
    return <div className={`text-white/40 text-sm font-mono p-4 ${className}`}>Loading worlds…</div>;
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {error && (
        <div className="text-red-400 text-xs font-mono bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {worlds.map(world => {
          const isCurrent = world.id === currentWorldId;
          const { accent, icon } = UNIVERSE_ACCENTS[world.universe_type] || { accent: '#64748b', icon: '🌍' };

          return (
            <button
              key={world.id}
              onClick={() => !isCurrent && setConfirm(world)}
              disabled={isCurrent}
              className={[
                'text-left rounded-xl border p-4 transition flex flex-col gap-2',
                isCurrent
                  ? 'border-white/20 bg-white/5 opacity-60 cursor-default'
                  : 'border-white/10 bg-black/40 hover:bg-white/5 cursor-pointer',
              ].join(' ')}
              style={{ borderLeftColor: isCurrent ? accent : undefined, borderLeftWidth: isCurrent ? 3 : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg">{icon}</span>
                {isCurrent && (
                  <span className="text-xs bg-white/10 text-white/60 rounded px-1.5 py-0.5 font-mono">Here</span>
                )}
              </div>
              <div className="font-semibold text-white">{world.name}</div>
              <div className="text-xs text-white/50 line-clamp-2">{world.description}</div>
              <div className="flex items-center justify-between mt-1">
                <PopulationBadge count={world.population} />
                <span className="text-xs text-white/30 font-mono">{world.total_visits.toLocaleString()} visits</span>
              </div>
            </button>
          );
        })}
      </div>

      {confirm && (
        <ConfirmModal
          world={confirm}
          onConfirm={() => handleTravel(confirm)}
          onCancel={() => setConfirm(null)}
          travelling={travelling}
        />
      )}
    </div>
  );
}
