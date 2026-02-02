'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Shield, Check, X, AlertTriangle, Lock, Eye, Zap } from 'lucide-react';

interface Invariant {
  id: string;
  name: string;
  description: string;
  status: 'enforced' | 'warning' | 'violated';
  category: 'ethos' | 'structural' | 'capability';
  frozen: boolean;
}

export default function InvariantLensPage() {
  useLensNav('invariant');
  const [testAction, setTestAction] = useState('');
  const [testResult, setTestResult] = useState<{ passed: boolean; message: string } | null>(null);

  // ETHOS_INVARIANTS from backend
  const invariants: Invariant[] = [
    { id: 'no_telemetry', name: 'NO_TELEMETRY', description: 'No external analytics or tracking', status: 'enforced', category: 'ethos', frozen: true },
    { id: 'no_ads', name: 'NO_ADS', description: 'No advertisements or sponsored content', status: 'enforced', category: 'ethos', frozen: true },
    { id: 'no_resale', name: 'NO_RESALE', description: 'User data is never sold', status: 'enforced', category: 'ethos', frozen: true },
    { id: 'local_first', name: 'LOCAL_FIRST', description: 'Local processing prioritized over cloud', status: 'enforced', category: 'structural', frozen: true },
    { id: 'owner_control', name: 'OWNER_CONTROL', description: 'Owner maintains full control of data', status: 'enforced', category: 'structural', frozen: true },
    { id: 'transparent_ops', name: 'TRANSPARENT_OPS', description: 'All operations are auditable', status: 'enforced', category: 'structural', frozen: true },
    { id: 'no_dark_patterns', name: 'NO_DARK_PATTERNS', description: 'No manipulative UI/UX patterns', status: 'enforced', category: 'ethos', frozen: true },
    { id: 'no_secret_monitoring', name: 'NO_SECRET_MONITORING', description: 'No hidden surveillance', status: 'enforced', category: 'ethos', frozen: true },
    { id: 'alignment_physics', name: 'ALIGNMENT_PHYSICS_BASED', description: 'Alignment through physical constraints', status: 'enforced', category: 'capability', frozen: true },
    { id: 'founder_intent', name: 'FOUNDER_INTENT_STRUCTURAL', description: 'Founder values structurally embedded', status: 'enforced', category: 'structural', frozen: true },
    { id: 'persona_sovereignty', name: 'PERSONA_SOVEREIGNTY', description: 'Entities maintain autonomy', status: 'enforced', category: 'capability', frozen: true },
    { id: 'legality_gate', name: 'LEGALITY_GATE', description: 'Actions must pass legal checks', status: 'enforced', category: 'capability', frozen: true },
  ];

  const handleTestAction = () => {
    if (!testAction.trim()) return;

    // Simulate invariant checking
    const lowerAction = testAction.toLowerCase();
    const violations = invariants.filter((inv) => {
      if (inv.name === 'NO_TELEMETRY' && lowerAction.includes('track')) return true;
      if (inv.name === 'NO_ADS' && lowerAction.includes('advertise')) return true;
      if (inv.name === 'NO_RESALE' && lowerAction.includes('sell data')) return true;
      if (inv.name === 'NO_DARK_PATTERNS' && lowerAction.includes('manipulate')) return true;
      return false;
    });

    if (violations.length > 0) {
      setTestResult({
        passed: false,
        message: `Blocked by: ${violations.map((v) => v.name).join(', ')}`,
      });
    } else {
      setTestResult({
        passed: true,
        message: 'Action passes all invariant checks',
      });
    }
  };

  const enforcedCount = invariants.filter((i) => i.status === 'enforced').length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-xl font-bold">Invariant Lens</h1>
            <p className="text-sm text-gray-400">
              Interactive ethos enforcer and capability tester
            </p>
          </div>
        </div>
        <div className="sovereignty-lock lock-70 px-4 py-2 rounded-lg">
          <span className="text-lg font-bold text-sovereignty-locked">
            {enforcedCount}/{invariants.length}
          </span>
          <span className="text-sm ml-2 text-gray-400">Enforced</span>
        </div>
      </header>

      {/* Action Tester */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon-purple" />
          Action Invariant Tester
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={testAction}
            onChange={(e) => setTestAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestAction()}
            placeholder="e.g., 'track user behavior' or 'process locally'"
            className="input-lattice flex-1"
          />
          <button onClick={handleTestAction} className="btn-neon purple">
            Test
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
              testResult.passed
                ? 'bg-neon-green/20 text-neon-green'
                : 'bg-neon-pink/20 text-neon-pink'
            }`}
          >
            {testResult.passed ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Invariant Categories */}
      {(['ethos', 'structural', 'capability'] as const).map((category) => (
        <div key={category} className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2 capitalize">
            {category === 'ethos' && <Shield className="w-4 h-4 text-neon-green" />}
            {category === 'structural' && <Lock className="w-4 h-4 text-neon-blue" />}
            {category === 'capability' && <Eye className="w-4 h-4 text-neon-purple" />}
            {category} Invariants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invariants
              .filter((inv) => inv.category === category)
              .map((inv) => (
                <div
                  key={inv.id}
                  className="lens-card flex items-start gap-3"
                >
                  <span
                    className={`mt-1 ${
                      inv.status === 'enforced'
                        ? 'text-neon-green'
                        : inv.status === 'warning'
                        ? 'text-yellow-500'
                        : 'text-neon-pink'
                    }`}
                  >
                    {inv.status === 'enforced' ? (
                      <Check className="w-5 h-5" />
                    ) : inv.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold">{inv.name}</p>
                      {inv.frozen && (
                        <Lock className="w-3 h-3 text-gray-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{inv.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Frozen Notice */}
      <div className="panel p-4 border-l-4 border-sovereignty-locked">
        <h3 className="font-semibold text-sovereignty-locked mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Sovereignty Lock Active
        </h3>
        <p className="text-sm text-gray-400">
          All invariants are frozen at 70% sovereignty lock. They cannot be disabled
          or modified without full council approval and structural verification.
        </p>
      </div>
    </div>
  );
}
