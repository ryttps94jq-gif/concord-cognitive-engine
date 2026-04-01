'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Compass, MapPin, Plane, Hotel, Calendar, Plus, Search, X,
  Edit2, Trash2, DollarSign, Clock, Star, Globe, Layers, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModeTab = 'trips' | 'itineraries' | 'bookings' | 'packing';

interface TripData {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  status: 'planning' | 'booked' | 'in-progress' | 'completed';
  notes: string;
  travelers: string[];
  activities: string[];
}

const STATUS_COLORS: Record<string, string> = {
  planning: 'text-yellow-400 bg-yellow-400/10',
  booked: 'text-neon-cyan bg-neon-cyan/10',
  'in-progress': 'text-neon-green bg-neon-green/10',
  completed: 'text-gray-400 bg-gray-400/10',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TravelLensPage() {
  useLensNav('travel');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('travel');
  const [tab, setTab] = useState<ModeTab>('trips');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', destination: '', startDate: '', endDate: '', budget: 0 });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, update, remove, deleteMut,
  } = useLensData<TripData>('travel', 'trip', { seed: [] });

  const trips = useMemo(() =>
    items.map(item => ({
      id: item.id,
      ...item.data,
      name: item.title || item.data?.name || 'Untitled Trip',
    })).filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.destination?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const stats = useMemo(() => ({
    total: trips.length,
    planning: trips.filter(t => t.status === 'planning').length,
    booked: trips.filter(t => t.status === 'booked').length,
    totalBudget: trips.reduce((s, t) => s + (t.budget || 0), 0),
    totalSpent: trips.reduce((s, t) => s + (t.spent || 0), 0),
  }), [trips]);

  const handleCreate = useCallback(async () => {
    if (!newTrip.name.trim()) return;
    await create({
      title: newTrip.name,
      data: {
        name: newTrip.name,
        destination: newTrip.destination,
        startDate: newTrip.startDate,
        endDate: newTrip.endDate,
        budget: newTrip.budget,
        spent: 0,
        status: 'planning',
        notes: '',
        travelers: [],
        activities: [],
      },
    });
    setNewTrip({ name: '', destination: '', startDate: '', endDate: '', budget: 0 });
    setShowCreate(false);
  }, [newTrip, create]);

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
          <Compass className="w-6 h-6 text-neon-cyan" />
          <div>
            <h1 className="text-xl font-bold">Travel Lens</h1>
            <p className="text-sm text-gray-400">Trip planning & travel management</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="travel" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> New Trip
        </button>
      </header>

      <UniversalActions domain="travel" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Plan a New Trip</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newTrip.name} onChange={e => setNewTrip(p => ({ ...p, name: e.target.value }))} placeholder="Trip name..." className="input-lattice" />
            <input value={newTrip.destination} onChange={e => setNewTrip(p => ({ ...p, destination: e.target.value }))} placeholder="Destination..." className="input-lattice" />
            <input type="date" value={newTrip.startDate} onChange={e => setNewTrip(p => ({ ...p, startDate: e.target.value }))} className="input-lattice" />
            <input type="date" value={newTrip.endDate} onChange={e => setNewTrip(p => ({ ...p, endDate: e.target.value }))} className="input-lattice" />
            <input type="number" value={newTrip.budget || ''} onChange={e => setNewTrip(p => ({ ...p, budget: Number(e.target.value) }))} placeholder="Budget..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newTrip.name.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Creating...' : 'Create Trip'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><Globe className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Total Trips</p></div>
        <div className="lens-card"><Calendar className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">{stats.planning}</p><p className="text-sm text-gray-400">Planning</p></div>
        <div className="lens-card"><Plane className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">{stats.booked}</p><p className="text-sm text-gray-400">Booked</p></div>
        <div className="lens-card"><DollarSign className="w-5 h-5 text-neon-purple mb-2" /><p className="text-2xl font-bold">${stats.totalBudget.toLocaleString()}</p><p className="text-sm text-gray-400">Total Budget</p></div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trips..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
      </div>

      {/* Trip List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="panel p-6 text-center text-gray-400">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="panel p-6 text-center text-gray-400">No trips yet. Create one to get started.</div>
        ) : (
          trips.map(trip => (
            <div key={trip.id} className="panel p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white truncate">{trip.name}</h3>
                  <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[trip.status || 'planning'])}>{trip.status}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {trip.destination && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.destination}</span>}
                  {trip.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{trip.startDate}</span>}
                  {trip.budget > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${trip.budget.toLocaleString()}</span>}
                </div>
              </div>
              <button onClick={() => remove(trip.id)} disabled={deleteMut.isPending} className="text-gray-500 hover:text-red-400 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <RealtimeDataPanel domain="travel" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="travel" /></div>}
      </div>
    </div>
  );
}
