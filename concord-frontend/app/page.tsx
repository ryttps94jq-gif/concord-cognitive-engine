'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { DTUEmpireCard } from '@/components/dtu/DTUEmpireCard';
import { LockDashboard } from '@/components/sovereignty/LockDashboard';
import { CoherenceBadge } from '@/components/graphs/CoherenceBadge';

export default function DashboardPage() {
  // Backend: GET /api/status
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  // Backend: GET /api/dtus
  const { data: dtusData } = useQuery({
    queryKey: ['dtus'],
    queryFn: () => api.get('/api/dtus').then((r) => r.data),
  });

  // Backend: GET /api/events
  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data),
  });

  const dtus = dtusData?.dtus || [];
  const events = eventsData?.events || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-neon">
            Concord Empire Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            {status?.version || 'Loading...'} • {status?.counts?.dtus || 0} DTUs •{' '}
            {status?.llm?.enabled ? 'LLM Ready' : 'Local Mode'}
          </p>
        </div>
        <CoherenceBadge score={events.length} />
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total DTUs"
          value={status?.counts?.dtus || 0}
          icon="📦"
          color="blue"
        />
        <MetricCard
          label="Simulations"
          value={status?.counts?.simulations || 0}
          icon="🧪"
          color="purple"
        />
        <MetricCard
          label="Events"
          value={status?.counts?.events || 0}
          icon="📊"
          color="pink"
        />
        <MetricCard
          label="Sovereignty"
          value="70%"
          icon="🔒"
          color="green"
          locked
        />
      </div>

      {/* Jobs & Queues Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <p className="text-sm text-gray-400">Ingest Queue</p>
          <p className="text-xl font-bold text-neon-blue">
            {status?.queues?.ingest || 0}
          </p>
        </div>
        <div className="lens-card">
          <p className="text-sm text-gray-400">Autocrawl Queue</p>
          <p className="text-xl font-bold text-neon-purple">
            {status?.queues?.autocrawl || 0}
          </p>
        </div>
        <div className="lens-card">
          <p className="text-sm text-gray-400">Macro Domains</p>
          <p className="text-xl font-bold text-neon-cyan">
            {status?.macro?.domains?.length || 0}
          </p>
        </div>
        <div className="lens-card">
          <p className="text-sm text-gray-400">Wallets</p>
          <p className="text-xl font-bold text-neon-green">
            {status?.counts?.wallets || 0}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resonance Universe */}
        <div className="lg:col-span-2 panel p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-neon-blue">◉</span> Resonance Universe
          </h2>
          <div className="h-[400px]">
            <ResonanceEmpireGraph />
          </div>
        </div>

        {/* 70% Lock Dashboard */}
        <div className="panel p-4">
          <LockDashboard />
        </div>
      </div>

      {/* Recent DTUs */}
      <div className="panel p-4">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-neon-cyan">◈</span> Recent DTUs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dtus.slice(0, 6).map((dtu: any) => (
            <DTUEmpireCard key={dtu.id} dtu={dtu} />
          ))}
          {dtus.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No DTUs yet. Start forging in the Chat or Forge lens.
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/lenses/chat" label="Chat" icon="💬" />
        <QuickAction href="/lenses/graph" label="Graph" icon="🕸️" />
        <QuickAction href="/lenses/resonance" label="Resonance" icon="🌊" />
        <QuickAction href="/lenses/council" label="Council" icon="🏛️" />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
  locked,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'purple' | 'pink' | 'green';
  locked?: boolean;
}) {
  const colorClasses = {
    blue: 'border-neon-blue/30 text-neon-blue',
    purple: 'border-neon-purple/30 text-neon-purple',
    pink: 'border-neon-pink/30 text-neon-pink',
    green: 'border-sovereignty-locked/30 text-sovereignty-locked',
  };

  return (
    <div
      className={`lens-card ${locked ? 'sovereignty-lock lock-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="lens-card flex items-center justify-center gap-2 py-4 hover:scale-105 transition-transform"
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}
