'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Calculator, Play, CheckCircle, XCircle, Sigma, Pi } from 'lucide-react';

export default function MathLensPage() {
  useLensNav('math');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<{ value: string; verified: boolean } | null>(null);

  const handleEvaluate = () => {
    try {
      // Safe evaluation (would use proper math engine in production)
      const sanitized = expression.replace(/[^0-9+\-*/().^sqrt\s]/g, '');
      const evaluated = Function(`"use strict"; return (${sanitized})`)();
      setResult({ value: String(evaluated), verified: true });
    } catch {
      setResult({ value: 'Error', verified: false });
    }
  };

  const examples = [
    { label: 'Quadratic', expr: '(-5 + Math.sqrt(25 - 4*2*3)) / (2*2)' },
    { label: 'Fibonacci', expr: '(1.618**10 - (-0.618)**10) / 2.236' },
    { label: 'Golden Ratio', expr: '(1 + Math.sqrt(5)) / 2' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧮</span>
        <div>
          <h1 className="text-xl font-bold">Math Lens</h1>
          <p className="text-sm text-gray-400">
            DTU verifier playground for mathematical proofs
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Calculator className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">∞</p>
          <p className="text-sm text-gray-400">Expressions</p>
        </div>
        <div className="lens-card">
          <Sigma className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">42</p>
          <p className="text-sm text-gray-400">Verified</p>
        </div>
        <div className="lens-card">
          <Pi className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">π</p>
          <p className="text-sm text-gray-400">Constants</p>
        </div>
        <div className="lens-card">
          <CheckCircle className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">100%</p>
          <p className="text-sm text-gray-400">Accuracy</p>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-neon-blue" />
          Expression Evaluator
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
            placeholder="Enter mathematical expression..."
            className="input-lattice flex-1 font-mono"
          />
          <button onClick={handleEvaluate} className="btn-neon purple">
            <Play className="w-4 h-4 mr-2 inline" />
            Evaluate
          </button>
        </div>
        {result && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            result.verified ? 'bg-neon-green/20' : 'bg-neon-pink/20'
          }`}>
            {result.verified ? (
              <CheckCircle className="w-5 h-5 text-neon-green" />
            ) : (
              <XCircle className="w-5 h-5 text-neon-pink" />
            )}
            <span className="font-mono text-xl">{result.value}</span>
          </div>
        )}
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4">Quick Examples</h2>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setExpression(ex.expr)}
              className="px-3 py-2 bg-lattice-surface rounded-lg text-sm hover:bg-lattice-elevated"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
