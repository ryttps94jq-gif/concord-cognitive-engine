'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { useState } from 'react';
import { Pill, AlertTriangle, Search, Plus, Trash2, ClipboardList, Clock, ShieldCheck, Layers, ChevronDown, X } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  rxcui: string;
  prescriber: string;
  startDate: string;
  refillsLeft: number;
  status: 'active' | 'discontinued' | 'pending';
}

interface InteractionCheck {
  drugs: string[];
  severity: string;
  description: string;
}

export default function PharmacyLensPage() {
  useLensNav('pharmacy');

  const [activeTab, setActiveTab] = useState<'medications' | 'interactions' | 'refills'>('medications');
  const [showFeatures, setShowFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('pharmacy');

  const { items: medItems, isLoading, isError, error, refetch, create, update, remove } = useLensData<Record<string, unknown>>('pharmacy', 'medication', { seed: [] });
  const { items: interactionItems, create: createInteraction } = useLensData<Record<string, unknown>>('pharmacy', 'interaction', { seed: [] });
  const runAction = useRunArtifact('pharmacy');

  const medications = medItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (Medication & { id: string; title: string })[];
  const interactions = interactionItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as (InteractionCheck & { id: string })[];

  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: 'daily', route: 'oral' });

  const addMedication = () => {
    if (!newMed.name.trim()) return;
    create({
      title: newMed.name,
      data: {
        ...newMed,
        rxcui: '',
        prescriber: '',
        startDate: new Date().toISOString(),
        refillsLeft: 3,
        status: 'active',
      },
    });
    setNewMed({ name: '', dosage: '', frequency: 'daily', route: 'oral' });
  };

  const checkInteractions = async () => {
    const activeNames = medications.filter(m => m.status === 'active').map(m => m.name || m.title);
    if (activeNames.length < 2) return;
    try {
      await runAction.mutateAsync({ id: medItems[0]?.id || 'check', action: 'checkInteractions', params: { medications: activeNames } });
      refetch();
    } catch { /* handled by UI */ }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto" />
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
    <div data-lens-theme="pharmacy" className="p-6 space-y-6">
      {/* Disclaimer */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-red-200">
            Not medical or pharmaceutical advice. Always consult a licensed healthcare provider or pharmacist before starting, stopping, or changing any medication. Do not rely on this tool for drug interaction or dosage decisions.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-red-400/70"><ShieldCheck className="w-3 h-3" />Informational Only</span>
          </div>
        </div>
      </div>

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pill className="w-8 h-8 text-neon-green" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Pharmacy Lens</h1>
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            </div>
            <p className="text-sm text-gray-400">Medication tracking, interaction checks, and refill management</p>
          </div>
        </div>
      </header>

      <RealtimeDataPanel domain="pharmacy" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="pharmacy" artifactId={undefined} compact />
      <DTUExportButton domain="pharmacy" data={{}} compact />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['medications', 'interactions', 'refills'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-neon-green/20 text-neon-green border-b-2 border-neon-green' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Medications Tab */}
      {activeTab === 'medications' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Medication</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} placeholder="Medication name" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <input value={newMed.dosage} onChange={e => setNewMed({ ...newMed, dosage: e.target.value })} placeholder="Dosage (e.g., 10mg)" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <select value={newMed.frequency} onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="daily">Daily</option>
                <option value="twice-daily">Twice Daily</option>
                <option value="weekly">Weekly</option>
                <option value="as-needed">As Needed</option>
              </select>
              <button onClick={addMedication} className="px-4 py-2 bg-neon-green/20 text-neon-green rounded-lg text-sm hover:bg-neon-green/30">Add</button>
            </div>
          </div>

          <div className="space-y-2">
            {medications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No medications tracked yet.</p>
            ) : (
              medications.map(med => (
                <div key={med.id} className="panel p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-neon-green" />
                      <span className="font-medium">{med.name || med.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${med.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {med.status || 'active'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{med.dosage} - {med.frequency} - {med.route}</p>
                  </div>
                  <button onClick={() => remove(med.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <div className="space-y-4">
          <button onClick={checkInteractions} className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30">
            <AlertTriangle className="w-4 h-4 inline mr-1" /> Check Interactions
          </button>
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Known Interactions</h3>
            {interactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No interaction checks performed yet.</p>
            ) : (
              interactions.map(ix => (
                <div key={ix.id} className="p-3 rounded-lg bg-white/5 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${ix.severity === 'critical' ? 'text-red-400' : ix.severity === 'major' ? 'text-orange-400' : 'text-yellow-400'}`} />
                    <span className="text-sm font-medium">{ix.drugs?.join(' + ')}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">{ix.severity}</span>
                  </div>
                  <p className="text-xs text-gray-400">{ix.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Refills Tab */}
      {activeTab === 'refills' && (
        <div className="panel p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-neon-cyan" /> Refill Tracker</h3>
          {medications.filter(m => m.status === 'active').length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Add active medications to track refills.</p>
          ) : (
            <div className="space-y-2">
              {medications.filter(m => m.status === 'active').map(med => (
                <div key={med.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <span className="text-sm font-medium">{med.name || med.title}</span>
                    <p className="text-xs text-gray-400">{med.dosage}</p>
                  </div>
                  <span className={`text-sm ${(med.refillsLeft || 0) <= 1 ? 'text-red-400' : 'text-green-400'}`}>
                    {med.refillsLeft ?? '?'} refills left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Lens Features & Capabilities</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="pharmacy" /></div>}
      </div>
    </div>
  );
}
