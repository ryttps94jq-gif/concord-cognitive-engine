'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Trophy, Plus, Search, Trash2, Calendar, Users,
  Target, Clock, TrendingUp, Layers, ChevronDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type Tab = 'games' | 'teams' | 'stats' | 'training';

interface GameData {
  title: string;
  sport: string;
  team: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
  scoreHome: number;
  scoreAway: number;
  notes: string;
}

const RESULT_COLORS: Record<string, string> = {
  win: 'text-neon-green bg-neon-green/10',
  loss: 'text-red-400 bg-red-400/10',
  draw: 'text-yellow-400 bg-yellow-400/10',
  upcoming: 'text-neon-cyan bg-neon-cyan/10',
};

export default function SportsLensPage() {
  useLensNav('sports');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('sports');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newGame, setNewGame] = useState({ title: '', sport: '', team: '', opponent: '', date: '' });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, remove, deleteMut,
  } = useLensData<GameData>('sports', 'game', { seed: [] });

  const games = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, title: item.title || item.data?.title || 'Untitled Game' }))
      .filter(g => !search || g.title?.toLowerCase().includes(search.toLowerCase()) || g.sport?.toLowerCase().includes(search.toLowerCase()) || g.team?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const stats = useMemo(() => ({
    total: games.length,
    wins: games.filter(g => g.result === 'win').length,
    upcoming: games.filter(g => g.result === 'upcoming').length,
    winRate: games.filter(g => ['win', 'loss', 'draw'].includes(g.result)).length > 0
      ? Math.round(games.filter(g => g.result === 'win').length / games.filter(g => ['win', 'loss', 'draw'].includes(g.result)).length * 100)
      : 0,
  }), [games]);

  const handleCreate = useCallback(async () => {
    if (!newGame.title.trim()) return;
    await create({
      title: newGame.title,
      data: {
        title: newGame.title, sport: newGame.sport, team: newGame.team,
        opponent: newGame.opponent, date: newGame.date, time: '', location: '',
        result: 'upcoming', scoreHome: 0, scoreAway: 0, notes: '',
      },
    });
    setNewGame({ title: '', sport: '', team: '', opponent: '', date: '' });
    setShowCreate(false);
  }, [newGame, create]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div data-lens-theme="sports" className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <h1 className="text-xl font-bold">Sports Lens</h1>
            <p className="text-sm text-gray-400">Games, teams & training</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="sports" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> Add Game
        </button>
      </header>

      <UniversalActions domain="sports" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Add Game / Match</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={newGame.title} onChange={e => setNewGame(p => ({ ...p, title: e.target.value }))} placeholder="Game title..." className="input-lattice" />
            <input value={newGame.sport} onChange={e => setNewGame(p => ({ ...p, sport: e.target.value }))} placeholder="Sport..." className="input-lattice" />
            <input value={newGame.team} onChange={e => setNewGame(p => ({ ...p, team: e.target.value }))} placeholder="Your team..." className="input-lattice" />
            <input value={newGame.opponent} onChange={e => setNewGame(p => ({ ...p, opponent: e.target.value }))} placeholder="Opponent..." className="input-lattice" />
            <input type="date" value={newGame.date} onChange={e => setNewGame(p => ({ ...p, date: e.target.value }))} className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newGame.title.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Adding...' : 'Add Game'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><Trophy className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Total Games</p></div>
        <div className="lens-card"><Zap className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">{stats.wins}</p><p className="text-sm text-gray-400">Wins</p></div>
        <div className="lens-card"><Calendar className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.upcoming}</p><p className="text-sm text-gray-400">Upcoming</p></div>
        <div className="lens-card"><TrendingUp className="w-5 h-5 text-neon-purple mb-2" /><p className="text-2xl font-bold">{stats.winRate}%</p><p className="text-sm text-gray-400">Win Rate</p></div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="panel p-6 text-center text-gray-400">Loading games...</div>
        ) : games.length === 0 ? (
          <div className="panel p-6 text-center text-gray-400">No games or matches tracked yet. Log your first competition.</div>
        ) : games.map(g => (
          <div key={g.id} className="panel p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">{g.title}</h3>
                <span className={cn('text-xs px-2 py-0.5 rounded', RESULT_COLORS[g.result || 'upcoming'])}>{g.result}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {g.sport && <span>{g.sport}</span>}
                {g.team && g.opponent && <span>{g.team} vs {g.opponent}</span>}
                {g.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{g.date}</span>}
                {g.result !== 'upcoming' && <span className="font-mono">{g.scoreHome}-{g.scoreAway}</span>}
              </div>
            </div>
            <button onClick={() => remove(g.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <RealtimeDataPanel domain="sports" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="sports" /></div>}
      </div>
    </div>
  );
}
