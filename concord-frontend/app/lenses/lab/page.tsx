'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { FlaskConical, Play, Square, History, Zap } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

export default function LabLensPage() {
  useLensNav('lab');

  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [selectedOrgan, setSelectedOrgan] = useState('abstraction_governor');

  const { items: organItems, isLoading, isError: isError, error: error, refetch: refetch } = useLensData<Record<string, unknown>>('lab', 'organ', { seed: [] });
  const organs = organItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const { items: experimentItems, isError: isError2, error: error2, refetch: refetch2, create: createExperiment } = useLensData<Record<string, unknown>>('lab', 'experiment', { seed: [] });
  const experiments = experimentItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const runExperiment = useMutation({
    mutationFn: (payload: { code: string; organ: string }) =>
      createExperiment({ title: `experiment-${Date.now()}`, data: { ...payload, ranAt: new Date().toISOString() } }),
    onSuccess: () => {
      refetch2();
    },
    onError: (err) => console.error('runExperiment failed:', err instanceof Error ? err.message : err),
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <h1 className="text-xl font-bold">Lab Lens</h1>
            <p className="text-sm text-gray-400">
              Experiment sandbox for Growth OS organs
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Experiment Editor */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-neon-purple" />
              Experiment Sandbox
            </h2>
            <select
              value={selectedOrgan}
              onChange={(e) => setSelectedOrgan(e.target.value)}
              className="input-lattice w-auto"
            >
              {organs?.map((organ: Record<string, unknown>) => (
                <option key={organ.name as string} value={organ.name as string}>
                  {String(organ.name)}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Write experiment code here..."
            className="input-lattice font-mono text-sm h-64 resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => runExperiment.mutate({ code, organ: selectedOrgan })}
              disabled={runExperiment.isPending}
              className="btn-neon purple flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {runExperiment.isPending ? 'Running...' : 'Run Experiment'}
            </button>
            <button
              onClick={() => setCode('')}
              className="btn-neon flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Organ Status */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-green" />
            Growth Organs
          </h2>
          <div className="space-y-2">
            {organs?.map((organ: Record<string, unknown>) => (
              <div
                key={organ.name as string}
                className={`lens-card cursor-pointer ${
                  selectedOrgan === (organ.name as string) ? 'border-neon-purple' : ''
                }`}
                onClick={() => setSelectedOrgan(organ.name as string)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{String(organ.name)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      organ.active
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {organ.active ? 'Active' : 'Dormant'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Experiment History */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-neon-blue" />
          Recent Experiments
        </h2>
        <div className="space-y-2">
          {experiments?.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No experiments yet. Run your first experiment!
            </p>
          ) : (
            experiments?.map((exp: Record<string, unknown>) => (
              <div key={exp.id as string} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{String(exp.organ)}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(exp.timestamp as string).toLocaleString()}
                  </span>
                </div>
                <pre className="text-xs text-gray-300 mt-2 overflow-auto max-h-24">
                  {String(exp.result)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
