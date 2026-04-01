'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { useState } from 'react';
import { Brain, Heart, Shield, Activity, Smile, Frown, Meh, AlertTriangle, Plus, Search, X, Trash2, Layers, ChevronDown } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type MoodLevel = 'great' | 'good' | 'neutral' | 'low' | 'crisis';

interface MoodEntry {
  date: string;
  mood: MoodLevel;
  score: number;
  notes: string;
  triggers: string[];
  copingUsed: string[];
}

interface JournalEntry {
  date: string;
  content: string;
  sentiment: number;
  tags: string[];
}

const MOOD_CONFIG: Record<MoodLevel, { label: string; color: string; icon: React.ElementType }> = {
  great: { label: 'Great', color: 'text-green-400', icon: Smile },
  good: { label: 'Good', color: 'text-neon-cyan', icon: Smile },
  neutral: { label: 'Neutral', color: 'text-yellow-400', icon: Meh },
  low: { label: 'Low', color: 'text-orange-400', icon: Frown },
  crisis: { label: 'Crisis', color: 'text-red-400', icon: AlertTriangle },
};

export default function MentalHealthLensPage() {
  useLensNav('mental-health');

  const [activeTab, setActiveTab] = useState<'mood' | 'journal' | 'coping' | 'resources'>('mood');
  const [showFeatures, setShowFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('mental-health');

  const { items: moodItems, isLoading, isError, error, refetch, create, update, remove } = useLensData<Record<string, unknown>>('mental-health', 'mood', { seed: [] });
  const { items: journalItems, create: createJournal, remove: removeJournal } = useLensData<Record<string, unknown>>('mental-health', 'journal', { seed: [] });
  const { items: copingItems, create: createCoping } = useLensData<Record<string, unknown>>('mental-health', 'coping', { seed: [] });
  const runAction = useRunArtifact('mental-health');

  const moods = moodItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as (MoodEntry & { id: string })[];
  const journals = journalItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as (JournalEntry & { id: string; title: string })[];

  const [newMood, setNewMood] = useState<MoodLevel>('neutral');
  const [newNotes, setNewNotes] = useState('');
  const [journalText, setJournalText] = useState('');

  const logMood = () => {
    create({
      title: `Mood: ${newMood}`,
      data: {
        date: new Date().toISOString(),
        mood: newMood,
        score: { great: 5, good: 4, neutral: 3, low: 2, crisis: 1 }[newMood],
        notes: newNotes,
        triggers: [],
        copingUsed: [],
      },
    });
    setNewNotes('');
  };

  const saveJournal = () => {
    if (!journalText.trim()) return;
    createJournal({
      title: `Journal ${new Date().toLocaleDateString()}`,
      data: {
        date: new Date().toISOString(),
        content: journalText,
        sentiment: 0,
        tags: [],
      },
    });
    setJournalText('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto" />
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
    <div data-lens-theme="mental-health" className="p-6 space-y-6">
      {/* Disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-200">
            Not medical advice. This tool is for self-reflection and tracking only. It is not a substitute for professional mental health care. If you are in crisis, contact a mental health professional or call 988 (Suicide & Crisis Lifeline).
          </p>
        </div>
      </div>

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-neon-purple" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Mental Health & Wellbeing</h1>
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            </div>
            <p className="text-sm text-gray-400">Mood tracking, journaling, and coping strategies</p>
          </div>
        </div>
      </header>

      <RealtimeDataPanel domain="mental-health" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="mental-health" artifactId={undefined} compact />
      <DTUExportButton domain="mental-health" data={{}} compact />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['mood', 'journal', 'coping', 'resources'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-neon-purple/20 text-neon-purple border-b-2 border-neon-purple' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Mood Tab */}
      {activeTab === 'mood' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">Log Mood</h3>
            <div className="flex gap-2 mb-3">
              {(Object.keys(MOOD_CONFIG) as MoodLevel[]).map(level => {
                const cfg = MOOD_CONFIG[level];
                const Icon = cfg.icon;
                return (
                  <button
                    key={level}
                    onClick={() => setNewMood(level)}
                    className={`flex-1 p-3 rounded-lg text-center transition-all ${
                      newMood === level ? 'bg-white/10 ring-1 ring-neon-purple' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-1 ${cfg.color}`} />
                    <span className="text-xs">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="How are you feeling? (optional)"
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm resize-none h-20"
            />
            <button onClick={logMood} className="mt-2 px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg text-sm hover:bg-neon-purple/30">
              <Plus className="w-4 h-4 inline mr-1" /> Log Mood
            </button>
          </div>

          {/* Mood History */}
          <div className="panel p-4 space-y-2">
            <h3 className="font-semibold mb-3">Mood History</h3>
            {moods.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No mood entries yet. Log your first mood above.</p>
            ) : (
              moods.slice(0, 20).map(entry => {
                const cfg = MOOD_CONFIG[entry.mood] || MOOD_CONFIG.neutral;
                const Icon = cfg.icon;
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                      {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-500">{entry.date ? new Date(entry.date).toLocaleDateString() : ''}</span>
                    <button onClick={() => remove(entry.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Journal Tab */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-semibold mb-3">New Journal Entry</h3>
            <textarea
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
              placeholder="Write your thoughts..."
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm resize-none h-32"
            />
            <button onClick={saveJournal} className="mt-2 px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg text-sm hover:bg-neon-purple/30">
              Save Entry
            </button>
          </div>
          <div className="space-y-2">
            {journals.map(entry => (
              <div key={entry.id} className="panel p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{entry.title}</span>
                  <span className="text-xs text-gray-500">{entry.date ? new Date(entry.date).toLocaleDateString() : ''}</span>
                </div>
                <p className="text-sm text-gray-300">{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coping Tab */}
      {activeTab === 'coping' && (
        <div className="panel p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-neon-cyan" /> Coping Strategies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Deep breathing', 'Grounding (5-4-3-2-1)', 'Progressive muscle relaxation', 'Journaling', 'Physical exercise', 'Mindful meditation', 'Social connection', 'Creative expression'].map(strategy => (
              <div key={strategy} className="lens-card flex items-center gap-2">
                <Heart className="w-4 h-4 text-neon-pink" />
                <span className="text-sm">{strategy}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-green-400" /> Crisis Resources</h3>
          <div className="space-y-2">
            {[
              { name: '988 Suicide & Crisis Lifeline', detail: 'Call or text 988' },
              { name: 'Crisis Text Line', detail: 'Text HOME to 741741' },
              { name: 'SAMHSA Helpline', detail: '1-800-662-4357' },
              { name: 'NAMI Helpline', detail: '1-800-950-6264' },
            ].map(r => (
              <div key={r.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-sm text-neon-cyan">{r.detail}</span>
              </div>
            ))}
          </div>
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
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="mental-health" /></div>}
      </div>
    </div>
  );
}
