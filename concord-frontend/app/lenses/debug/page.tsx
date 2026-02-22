'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Terminal, Eye, RefreshCw, Play, Database } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

export default function DebugLensPage() {
  useLensNav('debug');
  const [activeTab, setActiveTab] = useState<'status' | 'events' | 'test'>('status');
  const [debugOutput, setDebugOutput] = useState<string[]>(['$ concord debug', 'Ready. Type command or click button above.']);
  const debugCmd = useMutation({
    mutationFn: async (cmd: string) => {
      setDebugOutput(prev => [...prev, `$ ${cmd}...`]);
      if (cmd === 'tick') return apiHelpers.bridge.heartbeatTick();
      if (cmd === 'organs') return apiHelpers.guidance.health();
      if (cmd === 'invariants') return apiHelpers.emergent.status();
      if (cmd === 'growth') return apiHelpers.pipeline.metrics();
      return api.get('/api/status');
    },
    onSuccess: (res) => setDebugOutput(prev => [...prev, JSON.stringify(res.data, null, 2).slice(0, 500)]),
    onError: (err) => setDebugOutput(prev => [...prev, `Error: ${err instanceof Error ? err.message : 'Unknown'}`]),
  });

  // Backend: GET /api/status
  const { data: status, isLoading, refetch: refetchStatus, isError: isError, error: error,} = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  // Backend: GET /api/events
  const { data: events, refetch: refetchEvents, isError: isError2, error: error2,} = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data),
  });

  // Backend: GET /api/jobs/status
  const { data: jobs, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['jobs-status'],
    queryFn: () => api.get('/api/jobs/status').then((r) => r.data),
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetchStatus(); refetchEvents(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐛</span>
          <div>
            <h1 className="text-xl font-bold">Debug Lens</h1>
            <p className="text-sm text-gray-400">
              TEST surface UI - peek STATE, organs, sim ticks
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            refetchStatus();
            refetchEvents();
          }}
          className="btn-neon"
        >
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['status', 'events', 'test'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg capitalize ${
              activeTab === tab
                ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                : 'bg-lattice-surface text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* System Status */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-neon-blue" />
              System Status
            </h2>
            <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono text-gray-300">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>

          {/* Jobs Status */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-neon-green" />
              Jobs Status
            </h2>
            <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-60 text-sm font-mono text-gray-300">
              {JSON.stringify(jobs, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-neon-cyan" />
            Recent Events ({events?.events?.length || 0})
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {(events?.events || []).slice(0, 50).map((event: Record<string, unknown>) => (
              <details key={event.id as string} className="bg-lattice-deep rounded-lg">
                <summary className="flex items-center justify-between p-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-neon-purple text-sm">{String(event.type)}</span>
                    <span className="text-xs text-gray-500">{String(event.at)}</span>
                  </div>
                </summary>
                <pre className="px-3 pb-3 text-xs text-gray-400 overflow-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'test' && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neon-green" />
            Test Console
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => debugCmd.mutate('tick')} disabled={debugCmd.isPending} className="lens-card text-center hover:border-neon-green">
                <p className="text-sm font-medium">Tick Kernel</p>
              </button>
              <button onClick={() => debugCmd.mutate('organs')} disabled={debugCmd.isPending} className="lens-card text-center hover:border-neon-blue">
                <p className="text-sm font-medium">Check Organs</p>
              </button>
              <button onClick={() => debugCmd.mutate('invariants')} disabled={debugCmd.isPending} className="lens-card text-center hover:border-neon-purple">
                <p className="text-sm font-medium">Verify Invariants</p>
              </button>
              <button onClick={() => debugCmd.mutate('growth')} disabled={debugCmd.isPending} className="lens-card text-center hover:border-neon-cyan">
                <p className="text-sm font-medium">Sim Growth</p>
              </button>
            </div>
            <div className="bg-lattice-void p-4 rounded-lg h-48 font-mono text-sm text-gray-400 overflow-y-auto">
              {debugOutput.map((line, i) => (
                <p key={i} className={line.startsWith('$') ? 'text-neon-green' : ''}>{line}</p>
              ))}
              <p className="animate-pulse">_</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
