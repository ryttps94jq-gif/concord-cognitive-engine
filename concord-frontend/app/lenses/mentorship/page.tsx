'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  BadgeCheck, Plus, Search, Trash2, Users, MessageSquare,
  Star, Calendar, Target, Clock, Layers, ChevronDown,
  UserPlus, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface MentorshipData {
  mentorName: string;
  menteeName: string;
  topic: string;
  status: 'seeking' | 'matched' | 'active' | 'completed' | 'paused';
  goals: string[];
  meetingFrequency: string;
  nextMeeting: string;
  sessionsCompleted: number;
  notes: string;
  skills: string[];
  rating: number;
}

const STATUS_COLORS: Record<string, string> = {
  seeking: 'text-yellow-400 bg-yellow-400/10',
  matched: 'text-neon-cyan bg-neon-cyan/10',
  active: 'text-neon-green bg-neon-green/10',
  completed: 'text-neon-purple bg-neon-purple/10',
  paused: 'text-gray-400 bg-gray-400/10',
};

export default function MentorshipLensPage() {
  useLensNav('mentorship');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('mentorship');
  const [search, setSearch] = useState('');
  const [selectedRelation, setSelectedRelation] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newMentorship, setNewMentorship] = useState({ mentorName: '', menteeName: '', topic: '', meetingFrequency: 'weekly' });
  const [newNote, setNewNote] = useState('');

  // Wire to social profiles for matching
  const { data: profiles } = useQuery({
    queryKey: ['social-profiles-mentorship'],
    queryFn: async () => {
      const { data } = await api.get('/api/social/profiles?limit=50');
      return data;
    },
    staleTime: 60000,
    retry: 1,
  });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, update, remove, deleteMut,
  } = useLensData<MentorshipData>('mentorship', 'relation', { seed: [] });

  const relations = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, topic: item.title || item.data?.topic || 'Untitled' }))
      .filter(r => !search || r.topic?.toLowerCase().includes(search.toLowerCase()) || r.mentorName?.toLowerCase().includes(search.toLowerCase()) || r.menteeName?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const selectedData = useMemo(() => relations.find(r => r.id === selectedRelation), [relations, selectedRelation]);

  const stats = useMemo(() => ({
    total: relations.length,
    active: relations.filter(r => r.status === 'active').length,
    totalSessions: relations.reduce((s, r) => s + (r.sessionsCompleted || 0), 0),
    seeking: relations.filter(r => r.status === 'seeking').length,
  }), [relations]);

  const handleCreate = useCallback(async () => {
    if (!newMentorship.topic.trim()) return;
    await create({
      title: newMentorship.topic,
      data: {
        mentorName: newMentorship.mentorName, menteeName: newMentorship.menteeName,
        topic: newMentorship.topic, status: newMentorship.mentorName && newMentorship.menteeName ? 'matched' : 'seeking',
        goals: [], meetingFrequency: newMentorship.meetingFrequency,
        nextMeeting: '', sessionsCompleted: 0, notes: '', skills: [], rating: 0,
      },
    });
    setNewMentorship({ mentorName: '', menteeName: '', topic: '', meetingFrequency: 'weekly' });
    setShowCreate(false);
  }, [newMentorship, create]);

  const handleAddNote = useCallback(async () => {
    if (!newNote.trim() || !selectedRelation) return;
    const item = items.find(i => i.id === selectedRelation);
    if (!item) return;
    const existing = item.data?.notes || '';
    const timestamp = new Date().toLocaleString();
    const updated = existing ? `${existing}\n\n[${timestamp}] ${newNote}` : `[${timestamp}] ${newNote}`;
    await update(selectedRelation, { data: { ...item.data, notes: updated } as Partial<MentorshipData> });
    setNewNote('');
  }, [newNote, selectedRelation, items, update]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div data-lens-theme="mentorship" className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgeCheck className="w-6 h-6 text-neon-blue" />
          <div>
            <h1 className="text-xl font-bold">Mentorship Lens</h1>
            <p className="text-sm text-gray-400">Mentor matching, tracking & guidance</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="mentorship" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> New Mentorship
        </button>
      </header>

      <UniversalActions domain="mentorship" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Create Mentorship</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newMentorship.topic} onChange={e => setNewMentorship(p => ({ ...p, topic: e.target.value }))} placeholder="Topic / skill area..." className="input-lattice" />
            <select value={newMentorship.meetingFrequency} onChange={e => setNewMentorship(p => ({ ...p, meetingFrequency: e.target.value }))} className="input-lattice">
              <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option><option value="as-needed">As Needed</option>
            </select>
            <input value={newMentorship.mentorName} onChange={e => setNewMentorship(p => ({ ...p, mentorName: e.target.value }))} placeholder="Mentor name (optional)..." className="input-lattice" />
            <input value={newMentorship.menteeName} onChange={e => setNewMentorship(p => ({ ...p, menteeName: e.target.value }))} placeholder="Mentee name (optional)..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newMentorship.topic.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Creating...' : 'Create Mentorship'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><BadgeCheck className="w-5 h-5 text-neon-blue mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Mentorships</p></div>
        <div className="lens-card"><Users className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-gray-400">Active</p></div>
        <div className="lens-card"><Target className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.totalSessions}</p><p className="text-sm text-gray-400">Sessions</p></div>
        <div className="lens-card"><UserPlus className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">{stats.seeking}</p><p className="text-sm text-gray-400">Seeking Match</p></div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mentorships..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Relations list */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-neon-blue" />Mentorships</h2>
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-gray-400 text-center py-4">Loading...</p>
            ) : relations.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No mentorships yet.</p>
            ) : relations.map(r => (
              <button key={r.id} onClick={() => setSelectedRelation(r.id)} className={cn('w-full text-left lens-card transition-all', selectedRelation === r.id && 'border-neon-blue ring-1 ring-neon-blue')}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm truncate">{r.topic}</h3>
                  <span className={cn('text-xs px-2 py-0.5 rounded', STATUS_COLORS[r.status || 'seeking'])}>{r.status}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {r.mentorName && <span>Mentor: {r.mentorName}</span>}
                  {r.mentorName && r.menteeName && <span> | </span>}
                  {r.menteeName && <span>Mentee: {r.menteeName}</span>}
                </div>
                <div className="text-xs text-gray-500 mt-1">{r.sessionsCompleted || 0} sessions | {r.meetingFrequency}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedData ? (
            <>
              <div className="panel p-4">
                <h2 className="font-semibold text-lg mb-2">{selectedData.topic}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Mentor</p>
                    <p className="font-semibold">{selectedData.mentorName || 'Unassigned'}</p>
                  </div>
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Mentee</p>
                    <p className="font-semibold">{selectedData.menteeName || 'Unassigned'}</p>
                  </div>
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Sessions Completed</p>
                    <p className="text-xl font-bold text-neon-cyan">{selectedData.sessionsCompleted || 0}</p>
                  </div>
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Frequency</p>
                    <p className="capitalize">{selectedData.meetingFrequency}</p>
                  </div>
                </div>
                {selectedData.goals?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Goals</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedData.goals.map((g, i) => (
                        <span key={i} className="px-2 py-1 bg-lattice-elevated rounded text-sm">{g}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedData.notes && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Session Notes</p>
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap bg-lattice-deep p-3 rounded-lg max-h-48 overflow-auto">{selectedData.notes}</pre>
                  </div>
                )}
              </div>

              {/* Add note */}
              <div className="panel p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-neon-blue" />Add Session Note</h3>
                <div className="flex gap-2">
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }} placeholder="Session notes..." className="input-lattice flex-1" />
                  <button onClick={handleAddNote} disabled={!newNote.trim()} className="btn-neon"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel p-4 h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BadgeCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a mentorship to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <RealtimeDataPanel domain="mentorship" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="mentorship" /></div>}
      </div>
    </div>
  );
}
