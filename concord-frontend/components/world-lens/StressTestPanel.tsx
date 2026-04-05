'use client';

import React, { useState, useCallback } from 'react';
import { AlertTriangle, Loader2, BarChart2, Flame, Wind, Droplets, Activity } from 'lucide-react';

const panel = 'bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg';

type ScenarioType = 'earthquake' | 'hurricane' | 'flood' | 'fire';

interface StressTestResult {
  scenario: ScenarioType;
  magnitude: number;
  buildingsTested: number;
  passed: number;
  marginal: number;
  failed: number;
  details: Array<{ buildingId: string; status: string; details: string }>;
}

const SCENARIOS: { id: ScenarioType; name: string; icon: React.ComponentType<{ className?: string }>; unit: string; range: [number, number]; step: number }[] = [
  { id: 'earthquake', name: 'Earthquake', icon: Activity, unit: 'Magnitude', range: [3, 9], step: 0.5 },
  { id: 'hurricane', name: 'Hurricane', icon: Wind, unit: 'Category', range: [1, 5], step: 1 },
  { id: 'flood', name: 'Flood', icon: Droplets, unit: 'Rainfall (mm/hr)', range: [10, 200], step: 10 },
  { id: 'fire', name: 'Fire', icon: Flame, unit: 'Origin Building', range: [1, 10], step: 1 },
];

interface StressTestPanelProps {
  districtId: string;
  buildingCount: number;
}

export default function StressTestPanel({ districtId, buildingCount }: StressTestPanelProps) {
  const [scenario, setScenario] = useState<ScenarioType>('earthquake');
  const [magnitude, setMagnitude] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [result2, setResult2] = useState<StressTestResult | null>(null);

  const scenarioDef = SCENARIOS.find(s => s.id === scenario)!;

  const runTest = useCallback((isCompare = false) => {
    setRunning(true);
    // Simulate stress test
    setTimeout(() => {
      const tested = buildingCount;
      const failRate = Math.min(0.9, (magnitude / scenarioDef.range[1]) ** 2);
      const marginalRate = Math.min(0.3, failRate * 0.5);
      const failed = Math.round(tested * failRate);
      const marginal = Math.round(tested * marginalRate);
      const passed = tested - failed - marginal;

      const testResult: StressTestResult = {
        scenario,
        magnitude,
        buildingsTested: tested,
        passed: Math.max(0, passed),
        marginal,
        failed,
        details: Array.from({ length: tested }, (_, i) => {
          const r = Math.random();
          return {
            buildingId: `bldg-${i + 1}`,
            status: r < failRate ? 'failed' : r < failRate + marginalRate ? 'marginal' : 'passed',
            details: r < failRate ? `Structure failed at ${scenario} ${magnitude}` : 'Passed',
          };
        }),
      };

      if (isCompare) {
        setResult2(testResult);
      } else {
        setResult(testResult);
      }
      setRunning(false);
    }, 1200);
  }, [scenario, magnitude, buildingCount, scenarioDef]);

  return (
    <div className={`${panel} p-4 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          Disaster Stress Test
        </h3>
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`text-[10px] px-2 py-1 rounded border ${
            compareMode ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10' : 'border-white/10 text-gray-400'
          }`}
        >
          <BarChart2 className="w-3 h-3 inline mr-1" />
          Compare Mode
        </button>
      </div>

      {/* Scenario selection */}
      <div className="grid grid-cols-4 gap-1">
        {SCENARIOS.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`p-2 rounded text-center text-[10px] border transition-colors ${
                scenario === s.id
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 mx-auto mb-0.5" />
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Magnitude slider */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>{scenarioDef.unit}</span>
          <span className="font-mono text-orange-300">{magnitude}</span>
        </div>
        <input
          type="range"
          min={scenarioDef.range[0]}
          max={scenarioDef.range[1]}
          step={scenarioDef.step}
          value={magnitude}
          onChange={e => setMagnitude(parseFloat(e.target.value))}
          className="w-full h-1.5 accent-orange-500"
        />
      </div>

      {/* Run button */}
      <button
        onClick={() => runTest(false)}
        disabled={running}
        className="w-full py-2 bg-orange-500/20 text-orange-300 rounded text-xs hover:bg-orange-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
        {running ? 'Running...' : `Run ${scenarioDef.name} Test`}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-green-500/10 text-center">
              <p className="text-lg font-bold text-green-400">{result.passed}</p>
              <p className="text-[9px] text-green-400/60">Survived</p>
            </div>
            <div className="p-2 rounded bg-yellow-500/10 text-center">
              <p className="text-lg font-bold text-yellow-400">{result.marginal}</p>
              <p className="text-[9px] text-yellow-400/60">Marginal</p>
            </div>
            <div className="p-2 rounded bg-red-500/10 text-center">
              <p className="text-lg font-bold text-red-400">{result.failed}</p>
              <p className="text-[9px] text-red-400/60">Failed</p>
            </div>
          </div>

          {/* Survival rate bar */}
          <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${(result.passed / result.buildingsTested) * 100}%` }} />
            <div className="h-full bg-yellow-500" style={{ width: `${(result.marginal / result.buildingsTested) * 100}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${(result.failed / result.buildingsTested) * 100}%` }} />
          </div>

          {/* Per-building details */}
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {result.details.map((d, i) => (
              <div key={i} className={`text-[9px] px-2 py-0.5 rounded ${
                d.status === 'passed' ? 'text-green-400' : d.status === 'marginal' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {d.buildingId}: {d.details}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare results */}
      {compareMode && result && (
        <div className="border-t border-white/10 pt-3">
          <p className="text-[10px] text-gray-400 mb-2">Change magnitude and run again to compare:</p>
          <button
            onClick={() => runTest(true)}
            disabled={running}
            className="w-full py-1.5 border border-cyan-500/50 text-cyan-300 rounded text-xs hover:bg-cyan-500/10 transition-colors"
          >
            Run Comparison Test
          </button>
          {result2 && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded border border-white/10">
                <p className="text-gray-400">Test 1: {result.scenario} M{result.magnitude}</p>
                <p className="text-green-400">{result.passed} passed</p>
              </div>
              <div className="p-2 rounded border border-cyan-500/30">
                <p className="text-gray-400">Test 2: {result2.scenario} M{result2.magnitude}</p>
                <p className="text-green-400">{result2.passed} passed</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
