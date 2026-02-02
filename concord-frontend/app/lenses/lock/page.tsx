'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { use70Lock } from '@/hooks/use70Lock';
import { Lock, Shield, Eye, AlertTriangle, Check, Key } from 'lucide-react';

export default function LockLensPage() {
  useLensNav('lock');
  const { lockPercentage, invariants, isLocked, invariantSummary } = use70Lock();

  const lockHistory = [
    { date: '2026-01-15', event: 'Lock initialized', level: 70 },
    { date: '2026-01-20', event: 'Invariant added: LEGALITY_GATE', level: 70 },
    { date: '2026-01-25', event: 'Audit passed', level: 70 },
    { date: '2026-02-01', event: 'Sovereignty check: PASS', level: 70 },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <h1 className="text-xl font-bold">Lock Lens</h1>
            <p className="text-sm text-gray-400">
              70% sovereignty lock deep-dive and invariant visualization
            </p>
          </div>
        </div>
        <div className={`sovereignty-lock lock-70 px-6 py-3 rounded-xl ${
          isLocked ? 'border-sovereignty-locked' : 'border-sovereignty-danger'
        }`}>
          <span className="text-3xl font-bold text-sovereignty-locked">{lockPercentage}%</span>
        </div>
      </header>

      {/* Lock Gauge */}
      <div className="panel p-6">
        <div className="relative w-full h-12 bg-lattice-deep rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sovereignty-danger via-sovereignty-warning to-sovereignty-locked transition-all"
            style={{ width: `${lockPercentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-lg drop-shadow">
              {lockPercentage >= 70 ? 'SOVEREIGNTY LOCKED' : 'WARNING: Below Threshold'}
            </span>
          </div>
          {/* 70% marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white"
            style={{ left: '70%' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0%</span>
          <span className="text-sovereignty-locked">70% Threshold</span>
          <span>100%</span>
        </div>
      </div>

      {/* Invariant Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="lens-card text-center">
          <Check className="w-6 h-6 text-neon-green mx-auto mb-2" />
          <p className="text-2xl font-bold text-neon-green">{invariantSummary.enforced}</p>
          <p className="text-sm text-gray-400">Enforced</p>
        </div>
        <div className="lens-card text-center">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-500">{invariantSummary.warning}</p>
          <p className="text-sm text-gray-400">Warning</p>
        </div>
        <div className="lens-card text-center">
          <AlertTriangle className="w-6 h-6 text-neon-pink mx-auto mb-2" />
          <p className="text-2xl font-bold text-neon-pink">{invariantSummary.violated}</p>
          <p className="text-sm text-gray-400">Violated</p>
        </div>
      </div>

      {/* Active Invariants */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon-green" />
          Active Invariants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {invariants.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-3 bg-lattice-deep rounded-lg">
              <span className={`w-3 h-3 rounded-full ${
                inv.status === 'enforced' ? 'bg-neon-green' :
                inv.status === 'warning' ? 'bg-yellow-500' : 'bg-neon-pink'
              }`} />
              <div className="flex-1">
                <p className="font-mono text-sm">{inv.name}</p>
                <p className="text-xs text-gray-500">{inv.description}</p>
              </div>
              <Lock className="w-4 h-4 text-gray-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Lock History */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-neon-purple" />
          Lock History
        </h2>
        <div className="space-y-2">
          {lockHistory.map((entry, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm">{entry.event}</p>
                  <p className="text-xs text-gray-500">{entry.date}</p>
                </div>
              </div>
              <span className="text-sovereignty-locked font-mono">{entry.level}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
