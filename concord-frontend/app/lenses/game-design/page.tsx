'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Plus, Search, Edit2, Trash2, X, Save,
  BookOpen, Target, Users, Swords, Map, Layers,
  BarChart3, Globe, Sparkles, Cpu, GitBranch,
  FileText, Zap, Settings, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type DesignTab = 'projects' | 'gdd' | 'mechanics' | 'narrative' | 'levels' | 'balance';
type GameGenre = 'rpg' | 'platformer' | 'puzzle' | 'strategy' | 'simulation' | 'adventure' | 'action' | 'sandbox' | 'other';

interface GameDesignProject {
  id: string;
  title: string;
  genre: GameGenre;
  description: string;
  status: 'concept' | 'pre-production' | 'production' | 'testing' | 'released';
  mechanics: string[];
  targetPlatform: string;
  createdAt: string;
}

interface GameMechanic {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
}

const GAME_GENRES: { id: GameGenre; label: string }[] = [
  { id: 'rpg', label: 'RPG' },
  { id: 'platformer', label: 'Platformer' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'action', label: 'Action' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'other', label: 'Other' },
];

const MECHANIC_CATEGORIES = ['Core Loop', 'Combat', 'Progression', 'Economy', 'Social', 'Exploration', 'Crafting', 'Narrative', 'UI/UX'];

export default function GameDesignPage() {
  useLensNav('game-design');
  const { latestData: realtimeData, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('game-design');
  const { contextDTUs } = useLensDTUs({ lens: 'game-design' });

  const { items: projectItems, isLoading, isError, error, refetch, create: createProject, update: updateProject, remove: removeProject } = useLensData<GameDesignProject>('game-design', 'project', { seed: [] });
  const projects = useMemo(() => projectItems.map(i => ({ ...(i.data as unknown as GameDesignProject), id: i.id, title: i.title })), [projectItems]);

  const { items: mechanicItems, create: createMechanic, remove: removeMechanic } = useLensData<GameMechanic>('game-design', 'mechanic', { seed: [] });
  const mechanics = useMemo(() => mechanicItems.map(i => ({ ...(i.data as unknown as GameMechanic), id: i.id, name: i.title })), [mechanicItems]);

  // Pull gamification stats from game API
  const { data: gameProfile } = useQuery({
    queryKey: ['game', 'profile'],
    queryFn: () => api.get('/api/game/profile').then(r => r.data?.profile),
  });

  const [tab, setTab] = useState<DesignTab>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GameDesignProject | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState<GameGenre>('rpg');
  const [newDesc, setNewDesc] = useState('');
  const [newPlatform, setNewPlatform] = useState('PC');

  // GDD editor state
  const [gddContent, setGddContent] = useState('');

  // Mechanic form
  const [showMechanicForm, setShowMechanicForm] = useState(false);
  const [mechName, setMechName] = useState('');
  const [mechDesc, setMechDesc] = useState('');
  const [mechCategory, setMechCategory] = useState('Core Loop');
  const [mechComplexity, setMechComplexity] = useState<'low' | 'medium' | 'high'>('medium');

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    const data: Partial<GameDesignProject> = {
      title: newTitle,
      genre: newGenre,
      description: newDesc,
      status: 'concept',
      mechanics: [],
      targetPlatform: newPlatform,
      createdAt: new Date().toISOString(),
    };
    await createProject({ title: newTitle, data: data as unknown as Record<string, unknown> });
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
    refetch();
  }, [newTitle, newGenre, newDesc, newPlatform, createProject, refetch]);

  const handleAddMechanic = useCallback(async () => {
    if (!mechName.trim()) return;
    await createMechanic({
      title: mechName,
      data: { name: mechName, description: mechDesc, category: mechCategory, complexity: mechComplexity, dependencies: [] } as unknown as Record<string, unknown>,
    });
    setShowMechanicForm(false);
    setMechName('');
    setMechDesc('');
  }, [mechName, mechDesc, mechCategory, mechComplexity, createMechanic]);

  const TABS: { id: DesignTab; label: string; icon: typeof Gamepad2 }[] = [
    { id: 'projects', label: 'Projects', icon: Gamepad2 },
    { id: 'gdd', label: 'GDD', icon: FileText },
    { id: 'mechanics', label: 'Mechanics', icon: Settings },
    { id: 'narrative', label: 'Narrative', icon: BookOpen },
    { id: 'levels', label: 'Levels', icon: Map },
    { id: 'balance', label: 'Balance', icon: BarChart3 },
  ];

  return (
    <div data-lens-theme="game-design" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold">Game Design</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          </div>
          <div className="flex items-center gap-2">
            <DTUExportButton domain="game-design" data={{}} compact />
            <button onClick={() => setShowFeatures(!showFeatures)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">Features</button>
            <button onClick={() => setShowCreateModal(true)} className="px-3 py-1.5 text-xs bg-emerald-500/20 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> New Project
            </button>
          </div>
        </div>

        {showFeatures && <LensFeaturePanel lensId="game-design" />}
        <RealtimeDataPanel data={realtimeData} insights={realtimeInsights} />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors', tab === t.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {isError && <ErrorState error={error?.message} onRetry={refetch} />}

        {/* Projects */}
        {tab === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No game projects yet.</p>
                <button onClick={() => setShowCreateModal(true)} className="mt-3 px-4 py-2 text-xs bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30">Create Project</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map(proj => (
                  <motion.div key={proj.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-emerald-500/30 transition-colors cursor-pointer" onClick={() => { setSelectedProject(proj); setTab('gdd'); }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-sm">{proj.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 rounded text-emerald-400">{proj.genre}</span>
                          <span>{proj.targetPlatform || 'PC'}</span>
                          <span className={cn('px-1.5 py-0.5 rounded', proj.status === 'released' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400')}>{proj.status || 'concept'}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeProject(proj.id).catch(() => {}); refetch(); }} className="p-1 hover:bg-white/10 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {proj.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{proj.description}</p>}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GDD */}
        {tab === 'gdd' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Game Design Document {selectedProject ? `- ${selectedProject.title}` : ''}
              </h2>
              <button onClick={() => {
                if (selectedProject) {
                  updateProject(selectedProject.id, { data: { gddContent } as unknown as Partial<GameDesignProject> }).catch(() => {});
                }
              }} className="px-3 py-1.5 text-xs bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30 flex items-center gap-1">
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
            <textarea
              value={gddContent}
              onChange={e => setGddContent(e.target.value)}
              placeholder="# Game Design Document&#10;&#10;## Overview&#10;Describe your game concept...&#10;&#10;## Core Mechanics&#10;&#10;## Target Audience&#10;&#10;## Art Style&#10;&#10;## Technical Requirements"
              className="w-full h-[55vh] px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-sm leading-relaxed focus:outline-none focus:border-emerald-500/30 resize-none font-mono"
            />
          </div>
        )}

        {/* Mechanics */}
        {tab === 'mechanics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Settings className="w-5 h-5 text-emerald-400" /> Game Mechanics</h2>
              <button onClick={() => setShowMechanicForm(!showMechanicForm)} className="px-3 py-1.5 text-xs bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Mechanic
              </button>
            </div>
            {showMechanicForm && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <input value={mechName} onChange={e => setMechName(e.target.value)} placeholder="Mechanic name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                <textarea value={mechDesc} onChange={e => setMechDesc(e.target.value)} placeholder="Description" rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none" />
                <div className="flex gap-2">
                  <select value={mechCategory} onChange={e => setMechCategory(e.target.value)} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                    {MECHANIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={mechComplexity} onChange={e => setMechComplexity(e.target.value as 'low' | 'medium' | 'high')} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <button onClick={handleAddMechanic} disabled={!mechName.trim()} className="px-4 py-2 bg-emerald-500/20 rounded-lg text-sm hover:bg-emerald-500/30 disabled:opacity-50">Add</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mechanics.map(mech => (
                <div key={mech.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-sm">{mech.name}</h3>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', mech.complexity === 'high' ? 'bg-red-500/20 text-red-400' : mech.complexity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400')}>{mech.complexity}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{mech.category}</div>
                  {mech.description && <p className="text-xs text-gray-600 mt-1">{mech.description}</p>}
                </div>
              ))}
              {mechanics.length === 0 && <div className="col-span-full text-center py-8 text-gray-500 text-sm">No mechanics defined yet.</div>}
            </div>
          </div>
        )}

        {/* Narrative */}
        {tab === 'narrative' && (
          <div className="text-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Narrative Design</p>
            <p className="text-xs text-gray-600">Build branching storylines, character profiles, and dialogue trees.</p>
            <div className="mt-4 text-xs text-gray-600">Design DTUs: {contextDTUs.length}</div>
          </div>
        )}

        {/* Levels */}
        {tab === 'levels' && (
          <div className="text-center py-16 text-gray-500">
            <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Level Design</p>
            <p className="text-xs text-gray-600">Plan levels, zones, and encounters. Use the whiteboard lens for spatial layouts.</p>
          </div>
        )}

        {/* Balance */}
        {tab === 'balance' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-400" /> Balance Sheet</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Projects</div>
                <div className="text-2xl font-bold">{projects.length}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Mechanics Defined</div>
                <div className="text-2xl font-bold">{mechanics.length}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Designer Level</div>
                <div className="text-2xl font-bold text-emerald-400">{gameProfile?.level || 1}</div>
              </div>
            </div>
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-900 border border-white/10 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">New Game Project</h3>
                  <button onClick={() => setShowCreateModal(false)}><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Game title" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  <select value={newGenre} onChange={e => setNewGenre(e.target.value as GameGenre)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                    {GAME_GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Game concept description" rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none" />
                  <input value={newPlatform} onChange={e => setNewPlatform(e.target.value)} placeholder="Target platform" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  <button onClick={handleCreate} disabled={!newTitle.trim()} className="w-full py-2 bg-emerald-500/20 rounded-lg text-sm hover:bg-emerald-500/30 disabled:opacity-50">Create</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
