'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import {
  Heart, Plus, Search, Trash2, BarChart3,
  Layers, ChevronDown, Users, Calendar,
  Stethoscope, Syringe, Pill, ClipboardList,
  Eye, AlertTriangle, FileText, Clock,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

type ModeTab = 'Dashboard' | 'Patients' | 'Appointments' | 'Records' | 'Pharmacy' | 'Lab' | 'Boarding';

interface PatientData {
  name: string;
  species: 'canine' | 'feline' | 'equine' | 'bovine' | 'avian' | 'reptile' | 'exotic' | 'other';
  breed: string;
  age: number;
  weight: number;
  sex: 'male' | 'female' | 'neutered_male' | 'spayed_female';
  owner: string;
  ownerPhone: string;
  microchip: string;
  allergies: string[];
  status: 'active' | 'deceased' | 'transferred' | 'inactive';
  lastVisit: string;
}

interface AppointmentData {
  patient: string;
  owner: string;
  type: 'wellness' | 'sick' | 'surgery' | 'dental' | 'emergency' | 'vaccination' | 'follow_up';
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  vet: string;
  date: string;
  time: string;
  duration: number;
  notes: string;
  reason: string;
}

interface RecordData {
  patient: string;
  type: 'exam' | 'surgery' | 'lab' | 'imaging' | 'vaccination' | 'prescription';
  date: string;
  vet: string;
  diagnosis: string;
  treatment: string;
  medications: string[];
  followUp: string;
  weight: number;
  vitals: string;
  notes: string;
}

type ArtifactDataUnion = PatientData | AppointmentData | RecordData | Record<string, unknown>;

const MODE_TABS: { key: ModeTab; label: string; icon: typeof Heart }[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'Patients', label: 'Patients', icon: Heart },
  { key: 'Appointments', label: 'Appointments', icon: Calendar },
  { key: 'Records', label: 'Records', icon: ClipboardList },
  { key: 'Pharmacy', label: 'Pharmacy', icon: Pill },
  { key: 'Lab', label: 'Lab', icon: Stethoscope },
  { key: 'Boarding', label: 'Boarding', icon: Users },
];

function getTypeForTab(tab: ModeTab): string {
  const map: Record<ModeTab, string> = {
    Dashboard: 'Patient', Patients: 'Patient', Appointments: 'Appointment',
    Records: 'Record', Pharmacy: 'Prescription', Lab: 'Lab', Boarding: 'Boarding',
  };
  return map[tab];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10', deceased: 'text-gray-500 bg-gray-500/10',
  transferred: 'text-blue-400 bg-blue-400/10', inactive: 'text-gray-400 bg-gray-400/10',
  scheduled: 'text-blue-400 bg-blue-400/10', checked_in: 'text-yellow-400 bg-yellow-400/10',
  in_progress: 'text-green-400 bg-green-400/10', completed: 'text-gray-400 bg-gray-400/10',
  no_show: 'text-red-400 bg-red-400/10', cancelled: 'text-red-400 bg-red-400/10',
};

export default function VeterinaryLensPage() {
  useLensNav('veterinary');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('veterinary');

  const [activeMode, setActiveMode] = useState<ModeTab>('Dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);

  const currentType = getTypeForTab(activeMode);
  const { items, isLoading, isError, error, refetch, create, remove } =
    useLensData<ArtifactDataUnion>('veterinary', currentType, { search: searchQuery || undefined });

  const { items: patients } = useLensData<PatientData>('veterinary', 'Patient', { seed: [] });
  const { items: appointments } = useLensData<AppointmentData>('veterinary', 'Appointment', { seed: [] });

  const runAction = useRunArtifact('veterinary');

  const stats = useMemo(() => ({
    activePatients: patients.filter(p => (p.data as PatientData).status === 'active').length,
    totalPatients: patients.length,
    todayAppts: appointments.filter(a => {
      const d = (a.data as AppointmentData).date;
      return d && new Date(d).toDateString() === new Date().toDateString();
    }).length,
    totalAppts: appointments.length,
  }), [patients, appointments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading veterinary clinic...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;
  }

  return (
    <div className={cn(ds.pageContainer, 'space-y-4')}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Veterinary Medicine</h1>
            <p className="text-sm text-gray-400">Patients, appointments, medical records & pharmacy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="veterinary" data={realtimeData || {}} compact />
        </div>
      </header>

      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 overflow-x-auto">
        {MODE_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveMode(key)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
              activeMode === key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${currentType.toLowerCase()}s...`}
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-gray-500" />
        </div>
        <button onClick={() => create({ title: `New ${currentType}`, data: {} })} className="flex items-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> New {currentType}
        </button>
      </div>

      {activeMode === 'Dashboard' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Patients', value: stats.activePatients, total: stats.totalPatients, color: 'pink' },
            { label: "Today's Appointments", value: stats.todayAppts, total: stats.totalAppts, color: 'blue' },
          ].map(s => (
            <div key={s.label} className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <p className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xs text-gray-600">of {s.total} total</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                {!!(item.data as Record<string, unknown>).status && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[String((item.data as Record<string, unknown>).status)] || 'text-gray-400 bg-gray-400/10')}>
                    {String((item.data as Record<string, unknown>).status)}
                  </span>
                )}
                {!!(item.data as Record<string, unknown>).species && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-gray-300">
                    {String((item.data as Record<string, unknown>).species)}
                  </span>
                )}
              </div>
              <button onClick={() => remove(item.id)} className="p-1.5 hover:bg-zinc-800 rounded text-gray-500 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No {currentType.toLowerCase()} records found</p>
          </div>
        )}
      </div>

      <UniversalActions domain="veterinary" artifactId={items[0]?.id} />
      <RealtimeDataPanel data={insights} />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> Lens Features</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="veterinary" /></div>}
      </div>
    </div>
  );
}
