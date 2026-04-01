'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Hammer, Plus, Search, Trash2, DollarSign, Clock,
  CheckCircle2, AlertTriangle, Wrench, Layers, ChevronDown,
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
  room: string;
  category: string;
  status: 'idea' | 'planning' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  budget: number;
  spent: number;
  contractor: string;
  startDate: string;
  dueDate: string;
  materials: string[];
  notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  idea: 'text-gray-400 bg-gray-400/10',
  planning: 'text-yellow-400 bg-yellow-400/10',
  'in-progress': 'text-neon-cyan bg-neon-cyan/10',
  completed: 'text-neon-green bg-neon-green/10',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

const ROOMS = ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Garage', 'Basement', 'Exterior', 'Garden', 'Office', 'Other'];

export default function HomeImprovementLensPage() {
  useLensNav('home-improvement');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('home-improvement');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', room: 'Kitchen', priority: 'medium' as 'low' | 'medium' | 'high', budget: 0 });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, remove, deleteMut,
  } = useLensData<ProjectData>('home-improvement', 'project', { seed: [] });

  const projects = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, name: item.title || item.data?.name || 'Untitled Project' }))
      .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.room?.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !statusFilter || p.status === statusFilter),
    [items, search, statusFilter]
  );

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p => p.status === 'in-progress').length,
    totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0),
    totalSpent: projects.reduce((s, p) => s + (p.spent || 0), 0),
  }), [projects]);

  const handleCreate = useCallback(async () => {
    if (!newProject.name.trim()) return;
    await create({
      title: newProject.name,
      data: {
        name: newProject.name, room: newProject.room, category: '',
        status: 'idea', priority: newProject.priority, budget: newProject.budget,
        spent: 0, contractor: '', startDate: '', dueDate: '',
        materials: [], notes: '',
      },
    });
    setNewProject({ name: '', room: 'Kitchen', priority: 'medium', budget: 0 });
    setShowCreate(false);
  }, [newProject, create]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div data-lens-theme="home-improvement" className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Hammer className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold">Home Improvement Lens</h1>
            <p className="text-sm text-gray-400">Renovation & improvement projects</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="home-improvement" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> New Project
        </button>
      </header>

      <UniversalActions domain="home-improvement" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">New Home Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} placeholder="Project name..." className="input-lattice" />
            <select value={newProject.room} onChange={e => setNewProject(p => ({ ...p, room: e.target.value }))} className="input-lattice">
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={newProject.priority} onChange={e => setNewProject(p => ({ ...p, priority: e.target.value as ProjectData['priority'] }))} className="input-lattice">
              <option value="low">Low Priority</option><option value="medium">Medium Priority</option><option value="high">High Priority</option>
            </select>
            <input type="number" value={newProject.budget || ''} onChange={e => setNewProject(p => ({ ...p, budget: Number(e.target.value) }))} placeholder="Budget..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newProject.name.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><Hammer className="w-5 h-5 text-amber-400 mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Projects</p></div>
        <div className="lens-card"><Wrench className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-gray-400">In Progress</p></div>
        <div className="lens-card"><DollarSign className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">${stats.totalBudget.toLocaleString()}</p><p className="text-sm text-gray-400">Total Budget</p></div>
        <div className="lens-card"><DollarSign className="w-5 h-5 text-red-400 mb-2" /><p className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</p><p className="text-sm text-gray-400">Total Spent</p></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-lattice w-40">
          <option value="">All Status</option>
          <option value="idea">Idea</option><option value="planning">Planning</option>
          <option value="in-progress">In Progress</option><option value="completed">Completed</option>
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="panel p-6 text-center text-gray-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="panel p-6 text-center text-gray-400">No projects yet.</div>
        ) : projects.map(p => (
          <div key={p.id} className="panel p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[p.status || 'idea'])}>{p.status}</span>
                <span className={cn('text-xs', PRIORITY_COLORS[p.priority || 'medium'])}>{p.priority}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {p.room && <span>{p.room}</span>}
                {p.budget > 0 && <span>${p.budget.toLocaleString()} budget</span>}
              </div>
            </div>
            <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <RealtimeDataPanel domain="home-improvement" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="home-improvement" /></div>}
      </div>
    </div>
  );
}
