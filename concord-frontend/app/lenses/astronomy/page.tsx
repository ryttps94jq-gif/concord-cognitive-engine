'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { useState } from 'react';
import { Star, Moon, Sun, Orbit as Telescope, Plus, Trash2, Search, Layers, ChevronDown, Globe, Target } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type CelestialType = 'star' | 'planet' | 'moon' | 'asteroid' | 'comet' | 'galaxy' | 'nebula';

interface CelestialObject {
  name: string;
  type: CelestialType;
  ra: string;
  dec: string;
  magnitude: number;
  distance: string;
  constellation: string;
  notes: string;
}

interface Observation {
  target: string;
  date: string;
  telescope: string;
  conditions: string;
  notes: string;
}

const TYPE_ICONS: Record<CelestialType, { color: string }> = {
  star: { color: 'text-yellow-400' },
  planet: { color: 'text-blue-400' },
  moon: { color: 'text-gray-300' },
  asteroid: { color: 'text-orange-400' },
  comet: { color: 'text-cyan-400' },
  galaxy: { color: 'text-purple-400' },
  nebula: { color: 'text-pink-400' },
};

export default function AstronomyLensPage() {
  useLensNav('astronomy');

  const [activeTab, setActiveTab] = useState<'catalog' | 'observations' | 'planning'>('catalog');
  const [showFeatures, setShowFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('astronomy');

  const { items: objectItems, isLoading, isError, error, refetch, create, update, remove } = useLensData<Record<string, unknown>>('astronomy', 'object', { seed: [] });
  const { items: obsItems, create: createObs, remove: removeObs } = useLensData<Record<string, unknown>>('astronomy', 'observation', { seed: [] });
  const runAction = useRunArtifact('astronomy');

  const objects = objectItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (CelestialObject & { id: string; title: string })[];
  const observations = obsItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (Observation & { id: string; title: string })[];

  const filtered = objects.filter(o =>
    !searchQuery || (o.name || o.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [newObj, setNewObj] = useState({ name: '', type: 'star' as CelestialType, constellation: '' });

  const addObject = () => {
    if (!newObj.name.trim()) return;
    create({
      title: newObj.name,
      data: { name: newObj.name, type: newObj.type, ra: '', dec: '', magnitude: 0, distance: '', constellation: newObj.constellation, notes: '' },
    });
    setNewObj({ name: '', type: 'star', constellation: '' });
  };

  const [obsForm, setObsForm] = useState({ target: '', telescope: '', conditions: 'clear', notes: '' });

  const logObservation = () => {
    if (!obsForm.target.trim()) return;
    createObs({
      title: `Observation: ${obsForm.target}`,
      data: { target: obsForm.target, date: new Date().toISOString(), telescope: obsForm.telescope, conditions: obsForm.conditions, notes: obsForm.notes },
    });
    setObsForm({ target: '', telescope: '', conditions: 'clear', notes: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
          <Telescope className="w-8 h-8 text-yellow-400" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Astronomy Lens</h1>
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            </div>
            <p className="text-sm text-gray-400">Celestial catalog, observation logging, and session planning</p>
          </div>
        </div>
      </header>

      <RealtimeDataPanel domain="astronomy" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="astronomy" artifactId={undefined} compact />
      <DTUExportButton domain="astronomy" data={{}} compact />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['catalog', 'observations', 'planning'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-yellow-400/20 text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search celestial objects..." className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm" />
          </div>

          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Add Object</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={newObj.name} onChange={e => setNewObj({ ...newObj, name: e.target.value })} placeholder="Object name" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <select value={newObj.type} onChange={e => setNewObj({ ...newObj, type: e.target.value as CelestialType })} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">
                {(Object.keys(TYPE_ICONS) as CelestialType[]).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <input value={newObj.constellation} onChange={e => setNewObj({ ...newObj, constellation: e.target.value })} placeholder="Constellation" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <button onClick={addObject} className="px-4 py-2 bg-yellow-400/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-400/30">
                <Plus className="w-4 h-4 inline mr-1" /> Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No celestial objects cataloged yet.</p>
            ) : (
              filtered.map(obj => (
                <div key={obj.id} className="panel p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className={`w-4 h-4 ${TYPE_ICONS[obj.type as CelestialType]?.color || 'text-gray-400'}`} />
                      <span className="font-medium">{obj.name || obj.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">{obj.type}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      {obj.constellation && <span>{obj.constellation}</span>}
                      {obj.magnitude > 0 && <span>Mag: {obj.magnitude}</span>}
                      {obj.distance && <span>{obj.distance}</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(obj.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'observations' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Log Observation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <input value={obsForm.target} onChange={e => setObsForm({ ...obsForm, target: e.target.value })} placeholder="Target object" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <input value={obsForm.telescope} onChange={e => setObsForm({ ...obsForm, telescope: e.target.value })} placeholder="Telescope/equipment" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={obsForm.notes} onChange={e => setObsForm({ ...obsForm, notes: e.target.value })} placeholder="Observation notes..." className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm resize-none h-20" />
            <button onClick={logObservation} className="mt-2 px-4 py-2 bg-yellow-400/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-400/30">Log</button>
          </div>

          <div className="space-y-2">
            {observations.map(obs => (
              <div key={obs.id} className="panel p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{obs.target || obs.title}</span>
                  <span className="text-xs text-gray-500">{obs.date ? new Date(obs.date).toLocaleDateString() : ''}</span>
                </div>
                <p className="text-xs text-gray-400">{obs.telescope} - {obs.conditions}</p>
                {obs.notes && <p className="text-xs text-gray-300 mt-1">{obs.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="panel p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-yellow-400" /> Session Planner</h3>
          <p className="text-gray-500 text-sm text-center py-4">Select objects from your catalog to plan an observation session. Best results with clear skies and low light pollution.</p>
          {objects.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-400">Suggested targets from your catalog:</p>
              {objects.slice(0, 5).map(obj => (
                <div key={obj.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <Star className={`w-4 h-4 ${TYPE_ICONS[obj.type as CelestialType]?.color || 'text-gray-400'}`} />
                  <span className="text-sm">{obj.name || obj.title}</span>
                  <span className="text-xs text-gray-500 ml-auto">{obj.constellation || obj.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Lens Features & Capabilities</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="astronomy" /></div>}
      </div>
    </div>
  );
}
