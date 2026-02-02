'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Atom, Zap, Waves, RotateCcw, Play, Shuffle } from 'lucide-react';

export default function QuantumLensPage() {
  useLensNav('quantum');
  const [qubits, setQubits] = useState(4);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runSimulation = () => {
    setRunning(true);
    setTimeout(() => {
      const outcomes = Array.from({ length: 2 ** qubits }, (_, i) =>
        i.toString(2).padStart(qubits, '0')
      );
      const selected = outcomes[Math.floor(Math.random() * outcomes.length)];
      setResult(selected);
      setRunning(false);
    }, 1500);
  };

  const circuits = [
    { name: 'Hadamard', desc: 'Superposition gate', icon: '|H⟩' },
    { name: 'CNOT', desc: 'Entanglement gate', icon: '⊕' },
    { name: 'Phase', desc: 'Rotation gate', icon: 'eiθ' },
    { name: 'Measure', desc: 'Collapse state', icon: '📊' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">⚛️</span>
        <div>
          <h1 className="text-xl font-bold">Quantum Lens</h1>
          <p className="text-sm text-gray-400">
            Quantum computing simulations and circuit builder
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Atom className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{qubits}</p>
          <p className="text-sm text-gray-400">Qubits</p>
        </div>
        <div className="lens-card">
          <Waves className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{2 ** qubits}</p>
          <p className="text-sm text-gray-400">States</p>
        </div>
        <div className="lens-card">
          <Shuffle className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">4</p>
          <p className="text-sm text-gray-400">Gates</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{running ? '...' : 'Ready'}</p>
          <p className="text-sm text-gray-400">Status</p>
        </div>
      </div>

      {/* Circuit Builder */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Atom className="w-4 h-4 text-neon-purple" />
          Quantum Circuit
        </h2>
        <div className="flex gap-2 mb-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Qubits:</span>
            <input
              type="range"
              min="1"
              max="8"
              value={qubits}
              onChange={(e) => setQubits(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono">{qubits}</span>
          </label>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {circuits.map((gate) => (
            <div key={gate.name} className="lens-card text-center p-3">
              <span className="text-2xl font-mono">{gate.icon}</span>
              <p className="text-xs font-medium mt-1">{gate.name}</p>
              <p className="text-xs text-gray-500">{gate.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={runSimulation} disabled={running} className="btn-neon purple flex-1">
            <Play className="w-4 h-4 mr-2 inline" />
            {running ? 'Simulating...' : 'Run Circuit'}
          </button>
          <button onClick={() => setResult(null)} className="btn-neon">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="panel p-6 text-center">
          <h3 className="text-sm text-gray-400 mb-2">Measurement Result</h3>
          <p className="text-4xl font-mono text-neon-cyan tracking-widest">|{result}⟩</p>
          <p className="text-sm text-gray-500 mt-2">Collapsed from superposition</p>
        </div>
      )}
    </div>
  );
}
