'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers, api } from '@/lib/api/client';
import { useState } from 'react';
import { Users, Plus, Terminal, GitFork, Activity, Play, Brain, X, Cpu } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import QualiaSensoryFeed from '@/components/emergent/QualiaSensoryFeed';
import QualiaBodyMap from '@/components/emergent/QualiaBodyMap';
import PresenceDashboard from '@/components/emergent/PresenceDashboard';

interface Entity {
  id: string;
  name: string;
  type: 'worker' | 'researcher' | 'guardian' | 'architect';
  status: 'active' | 'idle' | 'suspended';
  workspace: string;
  forks: number;
  createdAt: string;
  lastActive: string;
}

export default function EntityLensPage() {
  useLensNav('entity');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('entity');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<Entity['type']>('worker');
  const [terminalEntity, setTerminalEntity] = useState<string | null>(null);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [qualiaEntity, setQualiaEntity] = useState<string | null>(null);
  const [cognitiveEntity, setCognitiveEntity] = useState<string | null>(null);

  // Fetch entities from worldmodel backend
  const { data: entitiesData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['worldmodel-entities'],
    queryFn: () => apiHelpers.worldmodel.entities().then(r => r.data),
    refetchInterval: 10000,
  });

  const entities: Entity[] = entitiesData?.entities || [];

  const createEntity = useMutation({
    mutationFn: (data: { name: string; type: string }) =>
      apiHelpers.worldmodel.createEntity(data).then(r => r.data),
    onSuccess: () => {
      setShowCreate(false);
      setNewEntityName('');
      queryClient.invalidateQueries({ queryKey: ['worldmodel-entities'] });
    },
  });

  const forkEntity = useMutation({
    mutationFn: async (entityId: string) => {
      // Fork = get entity, then create a copy with updated name
      const original = await apiHelpers.worldmodel.getEntity(entityId);
      const entity = original.data;
      const res = await apiHelpers.worldmodel.createEntity({
        name: `${entity?.name || 'entity'} (fork)`,
        type: entity?.type || 'generic',
        properties: { ...(entity?.properties || {}), forkedFrom: entityId },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldmodel-entities'] });
    },
  });

  const executeTerminal = useMutation({
    mutationFn: async (data: { entityId: string; command: string }) => {
      // Use lens run as a command execution proxy
      const res = await apiHelpers.lens.run('entity', data.entityId, { action: 'terminal', params: { command: data.command } });
      return res.data;
    },
    onSuccess: (data) => {
      setTerminalOutput(prev => [
        ...prev,
        `$ ${terminalCommand}`,
        data.output || data.error || JSON.stringify(data)
      ]);
      setTerminalCommand('');
    },
    onError: (err: Record<string, unknown>) => {
      setTerminalOutput(prev => [
        ...prev,
        `$ ${terminalCommand}`,
        `Error: ${err.message || 'Command failed'}`
      ]);
    },
  });

  const typeColors = {
    worker: 'text-neon-blue bg-neon-blue/20',
    researcher: 'text-neon-purple bg-neon-purple/20',
    guardian: 'text-neon-green bg-neon-green/20',
    architect: 'text-neon-cyan bg-neon-cyan/20',
  };

  const statusColors = {
    active: 'bg-neon-green',
    idle: 'bg-yellow-500',
    suspended: 'bg-neon-pink',
  };


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold">Entity Lens</h1>
            <p className="text-sm text-gray-400">
              Create and manage swarm entities with terminal access
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="entity" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Spawn Entity
        </button>
      </header>

      {/* Create Entity Form */}
      {showCreate && (
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold">Spawn New Entity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Entity Name</label>
              <input
                type="text"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder="e.g., Research Beta"
                className="input-lattice w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Entity Type</label>
              <select
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value as Entity['type'])}
                className="input-lattice w-full"
              >
                <option value="worker">Worker - Task execution</option>
                <option value="researcher">Researcher - DTU synthesis</option>
                <option value="guardian">Guardian - Security & invariants</option>
                <option value="architect">Architect - System evolution</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => createEntity.mutate({ name: newEntityName, type: newEntityType })}
            disabled={!newEntityName || createEntity.isPending}
            className="btn-neon green"
          >
            {createEntity.isPending ? 'Spawning...' : 'Spawn Entity'}
          </button>
        </div>
      )}

      {/* Terminal Modal */}
      {terminalEntity && (
        <div className="panel p-4 space-y-4 border-2 border-neon-cyan">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neon-cyan" />
              Terminal: {entities.find(e => e.id === terminalEntity)?.name}
            </h3>
            <button
              onClick={() => {
                setTerminalEntity(null);
                setTerminalOutput([]);
              }}
              className="text-gray-400 hover:text-white"
            >
              X
            </button>
          </div>
          <div className="bg-black rounded p-3 h-48 overflow-y-auto font-mono text-sm text-neon-green">
            {terminalOutput.length === 0 ? (
              <p className="text-gray-500">Terminal ready. Entity has council-gated access to system commands.</p>
            ) : (
              terminalOutput.map((line, i) => (
                <div key={i} className={line.startsWith('$') ? 'text-white' : ''}>{line}</div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={terminalCommand}
              onChange={(e) => setTerminalCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && terminalCommand.trim()) {
                  executeTerminal.mutate({ entityId: terminalEntity, command: terminalCommand });
                }
              }}
              placeholder="Enter command..."
              className="input-lattice flex-1 font-mono"
            />
            <button
              onClick={() => {
                if (terminalCommand.trim()) {
                  executeTerminal.mutate({ entityId: terminalEntity, command: terminalCommand });
                }
              }}
              disabled={!terminalCommand.trim() || executeTerminal.isPending}
              className="btn-neon cyan"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Users className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{entities.length}</p>
          <p className="text-sm text-gray-400">Total Entities</p>
        </div>
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{entities.filter((e) => e.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <GitFork className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{entities.reduce((s, e) => s + e.forks, 0)}</p>
          <p className="text-sm text-gray-400">Total Forks</p>
        </div>
        <div className="lens-card">
          <Terminal className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{new Set(entities.map((e) => e.workspace)).size}</p>
          <p className="text-sm text-gray-400">Workspaces</p>
        </div>
      </div>

      {/* Entity Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-neon-blue" />
          Entity Registry
        </h2>
        {isLoading ? (
          <p className="text-gray-400">Loading entities...</p>
        ) : entities.length === 0 ? (
          <p className="text-gray-400">No entities spawned yet. Click "Spawn Entity" to create one.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((entity) => (
              <div key={entity.id} className="lens-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{entity.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{entity.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[entity.status]}`} />
                    <span className={`text-xs px-2 py-0.5 rounded ${typeColors[entity.type]}`}>
                      {entity.type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Workspace</p>
                    <p className="font-mono">{entity.workspace}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Forks</p>
                    <p className="font-bold text-neon-purple">{entity.forks}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setTerminalEntity(entity.id)}
                    className="btn-neon text-xs flex-1"
                  >
                    <Terminal className="w-3 h-3 mr-1 inline" />
                    Terminal
                  </button>
                  <button
                    onClick={() => setQualiaEntity(entity.id)}
                    className="btn-neon text-xs flex-1"
                  >
                    <Brain className="w-3 h-3 mr-1 inline" />
                    Qualia
                  </button>
                  <button
                    onClick={() => setCognitiveEntity(entity.id)}
                    className="btn-neon text-xs flex-1"
                  >
                    <Cpu className="w-3 h-3 mr-1 inline" />
                    Cognitive
                  </button>
                  <button
                    onClick={() => forkEntity.mutate(entity.id)}
                    disabled={forkEntity.isPending}
                    className="btn-neon text-xs flex-1"
                  >
                    <GitFork className="w-3 h-3 mr-1 inline" />
                    Fork
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Qualia Detail Panel */}
      {qualiaEntity && (
        <QualiaEntityPanel
          entityId={qualiaEntity}
          entityName={entities.find(e => e.id === qualiaEntity)?.name || qualiaEntity}
          onClose={() => setQualiaEntity(null)}
        />
      )}

      {/* Cognitive Systems Detail Panel (Feature 22) */}
      {cognitiveEntity && (
        <CognitiveEntityPanel
          entityId={cognitiveEntity}
          entityName={entities.find(e => e.id === cognitiveEntity)?.name || cognitiveEntity}
          onClose={() => setCognitiveEntity(null)}
        />
      )}

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="entity"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>
    </div>
  );
}

// ── Qualia Entity Panel ────────────────────────────────────────────────────

function QualiaEntityPanel({ entityId, entityName, onClose }: { entityId: string; entityName: string; onClose: () => void }) {
  const { data: channelsData } = useQuery({
    queryKey: ['qualia-channels', entityId],
    queryFn: () => apiHelpers.qualia.channels(entityId).then(r => r.data),
    refetchInterval: 5000,
  });

  const { data: embodimentData } = useQuery({
    queryKey: ['qualia-embodiment', entityId],
    queryFn: () => apiHelpers.qualia.embodiment(entityId).then(r => r.data),
    refetchInterval: 8000,
  });

  const { data: presenceData } = useQuery({
    queryKey: ['qualia-presence', entityId],
    queryFn: () => apiHelpers.qualia.presence(entityId).then(r => r.data),
    refetchInterval: 8000,
  });

  const { data: planetaryData } = useQuery({
    queryKey: ['qualia-planetary', entityId],
    queryFn: () => apiHelpers.qualia.planetary(entityId).then(r => r.data),
    refetchInterval: 15000,
  });

  const [section, setSection] = useState<'sensory' | 'body' | 'presence'>('sensory');
  const sections = [
    { id: 'sensory' as const, label: 'Sensory Feed' },
    { id: 'body' as const, label: 'Body Map' },
    { id: 'presence' as const, label: 'Presence' },
  ];

  return (
    <div className="panel p-4 space-y-4 border-2 border-neon-purple mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-neon-purple" />
          Qualia State: {entityName}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
              section === s.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'sensory' && channelsData?.channels && (
        <QualiaSensoryFeed
          entityId={entityId}
          channels={channelsData.channels}
          overloadActive={channelsData.overloadActive}
        />
      )}

      {section === 'body' && embodimentData?.embodiment && channelsData?.channels && (
        <QualiaBodyMap
          entityId={entityId}
          embodiment={embodimentData.embodiment}
          channels={channelsData.channels}
          overloadActive={channelsData.overloadActive}
        />
      )}

      {section === 'presence' && presenceData?.presence && (
        <PresenceDashboard
          entityId={entityId}
          presence={presenceData.presence}
          existentialPillars={{}}
          planetary={planetaryData?.planetary}
        />
      )}

      {/* Fallback when no data yet */}
      {!channelsData?.channels && !embodimentData?.embodiment && !presenceData?.presence && (
        <div className="text-center py-8 text-zinc-500 text-sm">
          Loading qualia state for {entityName}...
        </div>
      )}
    </div>
  );
}

// ── Cognitive Systems Entity Panel (Feature 22) ──────────────────────────

interface CognitiveState {
  ok: boolean;
  entityId: string;
  wants: Array<{ id: string; type: string; domain: string; intensity: number; status: string; description?: string }>;
  trustNetwork: { trusts: Array<{ emergentId: string; name: string; trust: number }>; trustedBy: Array<{ emergentId: string; name: string; trust: number }> };
  culture: { fit: { score?: number; traditions?: number } | null; traditions: Array<{ id: string; name?: string; type: string; status: string }> };
  pain: { state: { totalPain?: number; recentEvents?: number } | null; avoidances: Array<{ id?: string; source: string; strength: number }>; wounds: Array<{ id?: string; type: string; severity: number }> };
  subjectiveTime: { experientialHours?: number; experientialDays?: number; compressionRatio?: number; currentEpoch?: string; ticks?: number; cycles?: number } | null;
  sleep: { state: { status?: string; fatigue?: number; dreamContent?: string } | null; recentHistory: Array<{ status: string; startedAt?: string }> };
  vulnerability: { available: boolean } | null;
}

function CognitiveEntityPanel({ entityId, entityName, onClose }: { entityId: string; entityName: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<CognitiveState>({
    queryKey: ['entity-cognitive', entityId],
    queryFn: () => api.get(`/api/entity/${entityId}/cognitive`).then(r => r.data),
    refetchInterval: 10000,
  });

  return (
    <div className="panel p-4 space-y-4 border-2 border-neon-cyan mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Cpu className="w-4 h-4 text-neon-cyan" />
          Cognitive Systems: {entityName}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-zinc-500 text-sm">Loading cognitive state...</div>
      )}

      {data && (
        <div className="space-y-4 text-sm">

          {/* Current Wants (Want Engine) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Current Wants</p>
            {data.wants && data.wants.length > 0 ? (
              <div className="space-y-1">
                {data.wants.slice(0, 8).map(w => (
                  <div key={w.id} className="flex items-center gap-2 text-xs bg-zinc-900 rounded p-2 border border-zinc-800">
                    <span className="text-neon-cyan capitalize font-medium">{w.type}</span>
                    <span className="text-gray-400 flex-1 truncate">{w.domain}{w.description ? ` — ${w.description}` : ''}</span>
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neon-cyan rounded-full" style={{ width: `${Math.round(w.intensity * 100)}%` }} />
                    </div>
                    <span className="text-gray-500 tabular-nums w-8 text-right">{Math.round(w.intensity * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No active wants</p>
            )}
          </div>

          {/* Trust Network */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Trust Network</p>
            {data.trustNetwork?.trusts?.length > 0 || data.trustNetwork?.trustedBy?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Trusts ({data.trustNetwork.trusts?.length || 0})</p>
                  {(data.trustNetwork.trusts || []).slice(0, 5).map(t => (
                    <div key={t.emergentId} className="flex items-center gap-1 text-[11px] text-gray-400">
                      <span className="truncate flex-1">{t.name}</span>
                      <span className={`tabular-nums ${t.trust > 0.7 ? 'text-green-400' : t.trust < 0.3 ? 'text-red-400' : 'text-gray-500'}`}>
                        {(t.trust * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Trusted By ({data.trustNetwork.trustedBy?.length || 0})</p>
                  {(data.trustNetwork.trustedBy || []).slice(0, 5).map(t => (
                    <div key={t.emergentId} className="flex items-center gap-1 text-[11px] text-gray-400">
                      <span className="truncate flex-1">{t.name}</span>
                      <span className={`tabular-nums ${t.trust > 0.7 ? 'text-green-400' : t.trust < 0.3 ? 'text-red-400' : 'text-gray-500'}`}>
                        {(t.trust * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600">No trust relationships established</p>
            )}
          </div>

          {/* Cultural Affiliations */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Cultural Affiliations</p>
            {data.culture?.fit ? (
              <div className="text-xs text-gray-400">
                <span>Cultural fit: {data.culture.fit.score != null ? `${Math.round((data.culture.fit.score as number) * 100)}%` : 'calculating'}</span>
                {data.culture.traditions?.length > 0 && (
                  <span className="ml-3">{data.culture.traditions.length} tradition{data.culture.traditions.length !== 1 ? 's' : ''} active</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No cultural data</p>
            )}
          </div>

          {/* Pain Memories */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Pain Memories</p>
            {data.pain?.avoidances?.length > 0 || data.pain?.wounds?.length > 0 ? (
              <div className="space-y-1">
                {data.pain.wounds?.slice(0, 5).map((w, i) => (
                  <div key={w.id || i} className="flex items-center gap-2 text-[11px] bg-red-950/20 rounded p-1.5 border border-red-900/20">
                    <span className="text-red-400 font-medium">{w.type}</span>
                    <span className="text-gray-500 ml-auto tabular-nums">severity {w.severity}</span>
                  </div>
                ))}
                {data.pain.avoidances?.slice(0, 5).map((a, i) => (
                  <div key={a.id || i} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="text-amber-400">avoids:</span>
                    <span className="truncate flex-1">{a.source}</span>
                    <span className="text-gray-600 tabular-nums">{Math.round(a.strength * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No pain memories</p>
            )}
          </div>

          {/* Subjective Time */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Subjective Time</p>
            {data.subjectiveTime ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-zinc-900 rounded p-2 border border-zinc-800">
                  <p className="text-gray-500">Exp. Days</p>
                  <p className="text-white font-mono">{data.subjectiveTime.experientialDays ?? '—'}</p>
                </div>
                <div className="bg-zinc-900 rounded p-2 border border-zinc-800">
                  <p className="text-gray-500">Compression</p>
                  <p className="text-white font-mono">{data.subjectiveTime.compressionRatio ?? '—'}x</p>
                </div>
                <div className="bg-zinc-900 rounded p-2 border border-zinc-800">
                  <p className="text-gray-500">Epoch</p>
                  <p className="text-white font-mono capitalize">{data.subjectiveTime.currentEpoch ?? '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600">No time data</p>
            )}
          </div>

          {/* Sleep Status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Sleep Status</p>
            {data.sleep?.state ? (
              <div className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    data.sleep.state.status === 'awake' ? 'bg-green-400' :
                    data.sleep.state.status === 'rem' ? 'bg-purple-400' :
                    data.sleep.state.status === 'sleeping' ? 'bg-blue-400' :
                    'bg-yellow-400'
                  }`} />
                  <span className="text-gray-300 capitalize">{data.sleep.state.status || 'unknown'}</span>
                  {data.sleep.state.fatigue != null && (
                    <span className="text-gray-500 ml-auto">fatigue: {Math.round(data.sleep.state.fatigue * 100)}%</span>
                  )}
                </div>
                {data.sleep.state.dreamContent && (
                  <div className="bg-purple-950/20 rounded p-2 border border-purple-900/20 text-purple-300 text-[11px] italic">
                    Dream: {data.sleep.state.dreamContent}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No sleep data</p>
            )}
          </div>

          {/* Vulnerability State */}
          {data.vulnerability && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">Vulnerability Engine</p>
              <p className="text-xs text-gray-400">Adaptive delivery engine active — adjusts response tone based on detected emotional state</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
