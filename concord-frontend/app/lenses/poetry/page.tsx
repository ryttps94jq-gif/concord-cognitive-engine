'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Feather, Plus, Search, Edit2, Trash2, BookOpen,
  Heart, Share2, Eye, X, Save, Sparkles,
  AlignLeft, Type, BarChart3, Globe, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type PoetryTab = 'collection' | 'compose' | 'forms' | 'workshop';
type PoemForm = 'free-verse' | 'sonnet' | 'haiku' | 'limerick' | 'villanelle' | 'ballad' | 'ode' | 'elegy' | 'acrostic' | 'other';

interface Poem {
  id: string;
  title: string;
  content: string;
  form: PoemForm;
  lineCount: number;
  wordCount: number;
  status: 'draft' | 'polished' | 'published';
  tags: string[];
  createdAt: string;
}

const POEM_FORMS: { id: PoemForm; label: string; description: string }[] = [
  { id: 'free-verse', label: 'Free Verse', description: 'No fixed structure, pure expression' },
  { id: 'sonnet', label: 'Sonnet', description: '14 lines, iambic pentameter' },
  { id: 'haiku', label: 'Haiku', description: '5-7-5 syllable structure' },
  { id: 'limerick', label: 'Limerick', description: '5 lines, AABBA rhyme scheme' },
  { id: 'villanelle', label: 'Villanelle', description: '19 lines, two refrains' },
  { id: 'ballad', label: 'Ballad', description: 'Narrative verse, ABAB rhyme' },
  { id: 'ode', label: 'Ode', description: 'Lyric poem of praise' },
  { id: 'elegy', label: 'Elegy', description: 'Poem of mourning or reflection' },
  { id: 'acrostic', label: 'Acrostic', description: 'First letters spell a word' },
  { id: 'other', label: 'Other', description: 'Experimental or hybrid form' },
];

export default function PoetryPage() {
  useLensNav('poetry');
  const { latestData: realtimeData, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('poetry');
  const { contextDTUs } = useLensDTUs({ lens: 'poetry' });

  const { items: poemItems, isLoading, isError, error, refetch, create: createPoem, update: updatePoem, remove: removePoem } = useLensData<Poem>('poetry', 'poem', { seed: [] });
  const poems = useMemo(() => poemItems.map(i => ({ ...(i.data as unknown as Poem), id: i.id, title: i.title })), [poemItems]);

  const [tab, setTab] = useState<PoetryTab>('collection');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const [formFilter, setFormFilter] = useState<PoemForm | null>(null);

  // Composer state
  const [composingPoem, setComposingPoem] = useState<Poem | null>(null);
  const [compTitle, setCompTitle] = useState('');
  const [compContent, setCompContent] = useState('');
  const [compForm, setCompForm] = useState<PoemForm>('free-verse');
  const [isSaving, setIsSaving] = useState(false);

  const filteredPoems = useMemo(() => {
    let result = poems;
    if (formFilter) result = result.filter(p => p.form === formFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q));
    }
    return result;
  }, [poems, formFilter, searchQuery]);

  const startNew = useCallback(() => {
    setComposingPoem(null);
    setCompTitle('');
    setCompContent('');
    setCompForm('free-verse');
    setTab('compose');
  }, []);

  const openPoem = useCallback((poem: Poem) => {
    setComposingPoem(poem);
    setCompTitle(poem.title);
    setCompContent(poem.content || '');
    setCompForm(poem.form || 'free-verse');
    setTab('compose');
  }, []);

  const savePoem = useCallback(async () => {
    setIsSaving(true);
    const lines = compContent.split('\n').filter(l => l.trim());
    const words = compContent.trim().split(/\s+/).filter(Boolean).length;
    const data: Partial<Poem> = {
      title: compTitle || 'Untitled',
      content: compContent,
      form: compForm,
      lineCount: lines.length,
      wordCount: words,
      status: 'draft',
      tags: [compForm],
    };
    try {
      if (composingPoem) {
        await updatePoem(composingPoem.id, { title: data.title, data: data as unknown as Partial<Poem> });
      } else {
        await createPoem({ title: data.title!, data: { ...data, createdAt: new Date().toISOString() } as unknown as Record<string, unknown> });
      }
      refetch();
    } catch (err) {
      console.error('Save failed:', err instanceof Error ? err.message : err);
    }
    setIsSaving(false);
  }, [compTitle, compContent, compForm, composingPoem, createPoem, updatePoem, refetch]);

  // Use creative generation for AI-assisted poetry
  const [aiGenerating, setAiGenerating] = useState(false);
  const generatePoem = useCallback(async () => {
    setAiGenerating(true);
    try {
      const resp = await api.post('/api/lens/run', { domain: 'creative', action: 'generate', mode: 'structural_poetry', form: compForm });
      if (resp.data?.result?.content) {
        setCompContent(prev => prev ? prev + '\n\n' + resp.data.result.content : resp.data.result.content);
      }
    } catch (err) {
      console.error('AI generation failed:', err instanceof Error ? err.message : err);
    }
    setAiGenerating(false);
  }, [compForm]);

  const lineCount = useMemo(() => compContent.split('\n').filter(l => l.trim()).length, [compContent]);
  const wordCount = useMemo(() => compContent.trim().split(/\s+/).filter(Boolean).length, [compContent]);

  const TABS: { id: PoetryTab; label: string; icon: typeof Feather }[] = [
    { id: 'collection', label: 'Collection', icon: BookOpen },
    { id: 'compose', label: 'Compose', icon: Feather },
    { id: 'forms', label: 'Forms', icon: AlignLeft },
    { id: 'workshop', label: 'Workshop', icon: Globe },
  ];

  return (
    <div data-lens-theme="poetry" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Feather className="w-6 h-6 text-rose-400" />
            <h1 className="text-2xl font-bold">Poetry</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          </div>
          <div className="flex items-center gap-2">
            <DTUExportButton domain="poetry" data={{}} compact />
            <button onClick={() => setShowFeatures(!showFeatures)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">Features</button>
            <button onClick={startNew} className="px-3 py-1.5 text-xs bg-rose-500/20 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> New Poem
            </button>
          </div>
        </div>

        {showFeatures && <LensFeaturePanel lensId="poetry" />}
        <RealtimeDataPanel data={realtimeData} insights={realtimeInsights} />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors', tab === t.id ? 'bg-rose-500/20 text-rose-400' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {isError && <ErrorState error={error?.message} onRetry={refetch} />}

        {/* Collection */}
        {tab === 'collection' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search poems..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-rose-500/50" />
              </div>
              <select value={formFilter || ''} onChange={e => setFormFilter((e.target.value || null) as PoemForm | null)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                <option value="">All forms</option>
                {POEM_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            {filteredPoems.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Feather className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No poems yet. Begin composing.</p>
                <button onClick={startNew} className="mt-3 px-4 py-2 text-xs bg-rose-500/20 rounded-lg hover:bg-rose-500/30">Compose</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPoems.map(poem => (
                  <motion.div key={poem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-rose-500/30 transition-colors cursor-pointer" onClick={() => openPoem(poem)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm italic">{poem.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{poem.form || 'free-verse'}</span>
                          <span>{poem.lineCount || 0} lines</span>
                          <span>{poem.wordCount || 0} words</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); openPoem(poem); }} className="p-1 hover:bg-white/10 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={e => { e.stopPropagation(); removePoem(poem.id).catch(() => {}); refetch(); }} className="p-1 hover:bg-white/10 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {poem.content && (
                      <pre className="text-xs text-gray-500 mt-2 font-serif whitespace-pre-wrap line-clamp-4">{poem.content.slice(0, 300)}</pre>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compose */}
        {tab === 'compose' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input value={compTitle} onChange={e => setCompTitle(e.target.value)} placeholder="Poem title" className="text-lg font-semibold bg-transparent border-none focus:outline-none placeholder-gray-600 italic" />
                <select value={compForm} onChange={e => setCompForm(e.target.value as PoemForm)} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">
                  {POEM_FORMS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{lineCount} lines / {wordCount} words</span>
                <button onClick={generatePoem} disabled={aiGenerating} className="px-3 py-1.5 text-xs bg-white/5 rounded-lg hover:bg-white/10 flex items-center gap-1 disabled:opacity-50">
                  <Sparkles className="w-3 h-3" /> {aiGenerating ? 'Generating...' : 'AI Assist'}
                </button>
                <button onClick={savePoem} disabled={isSaving} className="px-3 py-1.5 text-xs bg-rose-500/20 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 flex items-center gap-1 disabled:opacity-50">
                  <Save className="w-3 h-3" /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <textarea
              value={compContent}
              onChange={e => setCompContent(e.target.value)}
              placeholder="Write your poem here..."
              className="w-full h-[55vh] px-8 py-6 bg-white/5 border border-white/10 rounded-lg text-sm leading-loose focus:outline-none focus:border-rose-500/30 resize-none font-serif italic"
            />
          </div>
        )}

        {/* Forms guide */}
        {tab === 'forms' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><AlignLeft className="w-5 h-5 text-rose-400" /> Poetic Forms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POEM_FORMS.map(form => (
                <div key={form.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-rose-500/30 transition-colors">
                  <h3 className="font-medium text-sm">{form.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{form.description}</p>
                  <button onClick={() => { setCompForm(form.id); setCompTitle(''); setCompContent(''); setComposingPoem(null); setTab('compose'); }} className="mt-2 text-xs text-rose-400 hover:text-rose-300">
                    Try this form
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workshop */}
        {tab === 'workshop' && (
          <div className="text-center py-16 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Poetry Workshop</p>
            <p className="text-xs text-gray-600">Share poems for critique, participate in collaborative verse, and discover other poets.</p>
            <div className="mt-4 text-xs text-gray-600">Poetry DTUs: {contextDTUs.length}</div>
          </div>
        )}
      </div>
    </div>
  );
}
