'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { useUIStore } from '@/store/ui';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film, Plus, Search, Play, Users, Star, Clock, Eye,
  DollarSign, TrendingUp, Clapperboard, Camera, Mic,
  Music, Layers, BarChart3, Share2, Gift, X, ChevronRight,
  Monitor, Globe, Award, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type FilmTab = 'discover' | 'my-films' | 'create' | 'analytics' | 'watch-parties';

interface FilmProject {
  id: string;
  title: string;
  type: string;
  status: string;
  duration?: number;
  resolution?: string;
  crew: { role: string; name: string }[];
  components: { type: string; label: string }[];
  createdAt: string;
}

export default function FilmStudiosPage() {
  useLensNav('film-studios');
  const queryClient = useQueryClient();
  const { latestData: realtimeData, alerts: _alerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('film-studios');
  const { contextDTUs, isLoading: dtusLoading } = useLensDTUs({ lens: 'film-studios' });

  const [tab, setTab] = useState<FilmTab>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('short_film');
  const [newResolution, setNewResolution] = useState('1080p');

  // Fetch constants from film-studio API
  const { data: constants } = useQuery({
    queryKey: ['film-studio', 'constants'],
    queryFn: () => apiHelpers.filmStudio.constants().then(r => r.data),
  });

  // Discover films
  const { data: discoveredFilms, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['film-studio', 'discover', searchQuery],
    queryFn: () => apiHelpers.filmStudio.discover({ q: searchQuery || undefined }).then(r => r.data?.films || r.data?.items || r.data || []).catch(() => []),
    initialData: [],
  });

  // My films via useLensData
  const { items: myFilmItems, create: createFilmItem, isError: isError2, error: error2, refetch: refetch2 } = useLensData<Record<string, unknown>>('film-studios', 'film', { seed: [] });
  const myFilms = useMemo(() => myFilmItems.map(i => ({ ...(i.data as unknown as FilmProject), id: i.id, title: i.title })), [myFilmItems]);

  // Create film mutation
  const createFilmMutation = useMutation({
    mutationFn: async (data: { title: string; type: string; resolution: string }) => {
      const resp = await apiHelpers.filmStudio.create(data);
      // Also persist as lens artifact
      await createFilmItem({ title: data.title, data: { ...data, status: 'draft', createdAt: new Date().toISOString() } });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['film-studio'] });
      setShowCreateModal(false);
      setNewTitle('');
      refetch2();
    },
  });

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    createFilmMutation.mutate({ title: newTitle, type: newType, resolution: newResolution });
  }, [newTitle, newType, newResolution, createFilmMutation]);

  const filmTypes = constants?.filmTypes || ['short_film', 'feature', 'documentary', 'music_video', 'series_episode', 'animation'];
  const resolutions = constants?.resolutions || ['720p', '1080p', '4K', '8K'];

  const TABS: { id: FilmTab; label: string; icon: typeof Film }[] = [
    { id: 'discover', label: 'Discover', icon: Globe },
    { id: 'my-films', label: 'My Films', icon: Film },
    { id: 'create', label: 'Create', icon: Plus },
    { id: 'watch-parties', label: 'Watch Parties', icon: Monitor },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div data-lens-theme="film-studios" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-neon-purple" />
            <h1 className="text-2xl font-bold">Film Studios</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          </div>
          <div className="flex items-center gap-2">
            <DTUExportButton domain="film-studios" data={{}} compact />
            <button onClick={() => setShowFeatures(!showFeatures)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
              Features
            </button>
            <button onClick={() => setShowCreateModal(true)} className="px-3 py-1.5 text-xs bg-neon-purple/20 border border-neon-purple/30 rounded-lg hover:bg-neon-purple/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> New Film
            </button>
          </div>
        </div>

        {showFeatures && <LensFeaturePanel lensId="film-studios" />}
        <RealtimeDataPanel data={realtimeData} insights={realtimeInsights} />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors', tab === t.id ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {(isError || isError2) && <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />}

        {/* Discover */}
        {tab === 'discover' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search films, creators, genres..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-purple/50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(discoveredFilms as FilmProject[]).map((film: FilmProject) => (
                <motion.div key={film.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-neon-purple/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">{film.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple">{film.type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {film.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(film.duration / 60)}m</span>}
                    {film.resolution && <span>{film.resolution}</span>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="flex-1 text-xs py-1.5 bg-neon-purple/20 rounded hover:bg-neon-purple/30 flex items-center justify-center gap-1"><Play className="w-3 h-3" /> Preview</button>
                    <button className="text-xs py-1.5 px-2 bg-white/5 rounded hover:bg-white/10"><Share2 className="w-3 h-3" /></button>
                  </div>
                </motion.div>
              ))}
              {!isLoading && (discoveredFilms as FilmProject[]).length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 text-sm">No films found. Create your first film to get started.</div>
              )}
            </div>
          </div>
        )}

        {/* My Films */}
        {tab === 'my-films' && (
          <div className="space-y-4">
            {myFilms.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No films yet. Create your first project.</p>
                <button onClick={() => setShowCreateModal(true)} className="mt-3 px-4 py-2 text-xs bg-neon-purple/20 rounded-lg hover:bg-neon-purple/30">Create Film</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myFilms.map(film => (
                  <div key={film.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm">{film.title}</h3>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', film.status === 'draft' ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400')}>{film.status || 'draft'}</span>
                    </div>
                    <div className="text-xs text-gray-500">{film.type} {film.resolution && `- ${film.resolution}`}</div>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 text-xs py-1.5 bg-white/5 rounded hover:bg-white/10 flex items-center justify-center gap-1"><Layers className="w-3 h-3" /> Components</button>
                      <button className="flex-1 text-xs py-1.5 bg-white/5 rounded hover:bg-white/10 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Crew</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create tab */}
        {tab === 'create' && (
          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Clapperboard className="w-5 h-5 text-neon-purple" /> New Film Project</h2>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Film title" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-purple/50" />
            <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
              {(filmTypes as string[]).map((t: string) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={newResolution} onChange={e => setNewResolution(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
              {(resolutions as string[]).map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={handleCreate} disabled={!newTitle.trim() || createFilmMutation.isPending} className="w-full py-2 bg-neon-purple/20 border border-neon-purple/30 rounded-lg text-sm hover:bg-neon-purple/30 disabled:opacity-50">
              {createFilmMutation.isPending ? 'Creating...' : 'Create Film'}
            </button>
          </div>
        )}

        {/* Watch Parties */}
        {tab === 'watch-parties' && (
          <div className="text-center py-16 text-gray-500">
            <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Watch Parties</p>
            <p className="text-xs text-gray-600">Create synchronized viewing sessions for your films. Invite collaborators and audiences.</p>
            <button onClick={() => {
              apiHelpers.filmStudio.watchParty.create({ title: 'New Watch Party' })
                .then(() => useUIStore.getState().addToast({ type: 'success', message: 'Watch party created!' }))
                .catch(() => useUIStore.getState().addToast({ type: 'error', message: 'Failed to create watch party' }));
            }} className="mt-4 px-4 py-2 text-xs bg-neon-purple/20 rounded-lg hover:bg-neon-purple/30">Start Watch Party</button>
          </div>
        )}

        {/* Analytics */}
        {tab === 'analytics' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Total Films</div>
              <div className="text-2xl font-bold">{myFilms.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Film DTUs</div>
              <div className="text-2xl font-bold">{contextDTUs.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-2xl font-bold text-green-400">{isLive ? 'Live' : 'Offline'}</div>
            </div>
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-900 border border-white/10 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Create Film</h3>
                  <button onClick={() => setShowCreateModal(false)}><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Film title" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                    {(filmTypes as string[]).map((t: string) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  <button onClick={handleCreate} disabled={!newTitle.trim()} className="w-full py-2 bg-neon-purple/20 rounded-lg text-sm hover:bg-neon-purple/30 disabled:opacity-50">
                    {createFilmMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
