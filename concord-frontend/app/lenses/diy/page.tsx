'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Wrench, Plus, Search, Trash2, DollarSign, Clock,
  CheckCircle2, Hammer, Package, Layers, ChevronDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface ProjectData {
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'idea' | 'gathering' | 'in-progress' | 'completed';
  estimatedHours: number;
  hoursSpent: number;
  cost: number;
  tools: string[];
  materials: string[];
  steps: string[];
  notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  idea: 'text-gray-400 bg-gray-400/10',
  gathering: 'text-yellow-400 bg-yellow-400/10',
  'in-progress': 'text-neon-cyan bg-neon-cyan/10',
  completed: 'text-neon-green bg-neon-green/10',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-neon-green',
  intermediate: 'text-yellow-400',
  advanced: 'text-red-400',
};

const CATEGORIES = ['Woodworking', 'Electronics', 'Sewing', 'Metalwork', 'Painting', 'Pottery', 'Leatherwork', '3D Printing', 'Jewelry', 'Other'];

export default function DIYLensPage() {
  useLensNav('diy');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('diy');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', category: 'Woodworking', difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced', estimatedHours: 0, cost: 0 });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, remove, deleteMut,
  } = useLensData<ProjectData>('diy', 'project', { seed: [] });

  const projects = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, name: item.title || item.data?.name || 'Untitled Project' }))
      .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !statusFilter || p.status === statusFilter),
    [items, search, statusFilter]
  );

  const stats = useMemo(() => ({
    total: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalHours: projects.reduce((s, p) => s + (p.hoursSpent || 0), 0),
    totalCost: projects.reduce((s, p) => s + (p.cost || 0), 0),
  }), [projects]);

  const handleCreate = useCallback(async () => {
    if (!newProject.name.trim()) return;
    await create({
      title: newProject.name,
      data: {
        name: newProject.name, category: newProject.category,
        difficulty: newProject.difficulty, status: 'idea',
        estimatedHours: newProject.estimatedHours, hoursSpent: 0,
        cost: newProject.cost, tools: [], materials: [], steps: [], notes: '',
      },
    });
    setNewProject({ name: '', category: 'Woodworking', difficulty: 'beginner', estimatedHours: 0, cost: 0 });
    setShowCreate(false);
  }, [newProject, create]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-xl font-bold">DIY Lens</h1>
            <p className="text-sm text-gray-400">Projects, crafts & maker space</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="diy" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> New Project
        </button>
      </header>

      <UniversalActions domain="diy" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">New DIY Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} placeholder="Project name..." className="input-lattice" />
            <select value={newProject.category} onChange={e => setNewProject(p => ({ ...p, category: e.target.value }))} className="input-lattice">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newProject.difficulty} onChange={e => setNewProject(p => ({ ...p, difficulty: e.target.value as ProjectData['difficulty'] }))} className="input-lattice">
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <input type="number" value={newProject.estimatedHours || ''} onChange={e => setNewProject(p => ({ ...p, estimatedHours: Number(e.target.value) }))} placeholder="Estimated hours..." className="input-lattice" />
            <input type="number" value={newProject.cost || ''} onChange={e => setNewProject(p => ({ ...p, cost: Number(e.target.value) }))} placeholder="Estimated cost..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newProject.name.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Creating...' : 'Start Project'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><Hammer className="w-5 h-5 text-orange-400 mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Projects</p></div>
        <div className="lens-card"><CheckCircle2 className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">{stats.completed}</p><p className="text-sm text-gray-400">Completed</p></div>
        <div className="lens-card"><Clock className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.totalHours}h</p><p className="text-sm text-gray-400">Hours Spent</p></div>
        <div className="lens-card"><DollarSign className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">${stats.totalCost.toLocaleString()}</p><p className="text-sm text-gray-400">Total Cost</p></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-lattice w-40">
          <option value="">All Status</option>
          <option value="idea">Idea</option><option value="gathering">Gathering</option>
          <option value="in-progress">In Progress</option><option value="completed">Completed</option>
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="panel p-6 text-center text-gray-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="panel p-6 text-center text-gray-400">No DIY projects yet. Start making!</div>
        ) : projects.map(p => (
          <div key={p.id} className="panel p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[p.status || 'idea'])}>{p.status}</span>
                <span className={cn('text-xs', DIFFICULTY_COLORS[p.difficulty || 'beginner'])}>{p.difficulty}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {p.category && <span>{p.category}</span>}
                {p.estimatedHours > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.hoursSpent || 0}/{p.estimatedHours}h</span>}
                {p.cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${p.cost}</span>}
              </div>
            </div>
            <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <RealtimeDataPanel domain="diy" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="diy" /></div>}
      </div>
    </div>
  );
}
