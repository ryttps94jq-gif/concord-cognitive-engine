'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Search, FileText, Edit2, Trash2,
  Clock, Eye, TrendingUp, Sparkles, X, Save,
  ChevronRight, Layers, BarChart3, Globe, Filter,
  AlignLeft, Type, PenTool,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type WritingTab = 'works' | 'editor' | 'prompts' | 'workshop';
type WritingGenre = 'fiction' | 'nonfiction' | 'screenplay' | 'short-story' | 'novel' | 'essay' | 'blog' | 'other';

interface WritingWork {
  id: string;
  title: string;
  genre: WritingGenre;
  content: string;
  wordCount: number;
  status: 'draft' | 'revision' | 'published';
  createdAt: string;
  updatedAt: string;
}

const GENRES: { id: WritingGenre; label: string }[] = [
  { id: 'fiction', label: 'Fiction' },
  { id: 'nonfiction', label: 'Non-Fiction' },
  { id: 'screenplay', label: 'Screenplay' },
  { id: 'short-story', label: 'Short Story' },
  { id: 'novel', label: 'Novel' },
  { id: 'essay', label: 'Essay' },
  { id: 'blog', label: 'Blog Post' },
  { id: 'other', label: 'Other' },
];

const WRITING_PROMPTS = [
  'A stranger arrives in a town where everyone shares the same recurring dream.',
  'Write a story that begins with the last sentence.',
  'Two characters who speak different languages must solve a puzzle together.',
  'An object gains sentience during an ordinary day.',
  'Describe a world where music is the primary currency.',
];

export default function CreativeWritingPage() {
  useLensNav('creative-writing');
  const { latestData: realtimeData, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('creative-writing');
  const { contextDTUs, isLoading: dtusLoading } = useLensDTUs({ lens: 'creative-writing' });

  const { items: workItems, isLoading, isError, error, refetch, create: createWork, update: updateWork, remove: removeWork } = useLensData<WritingWork>('creative-writing', 'work', { seed: [] });
  const works = useMemo(() => workItems.map(i => ({ ...(i.data as unknown as WritingWork), id: i.id, title: i.title })), [workItems]);

  const [tab, setTab] = useState<WritingTab>('works');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const [genreFilter, setGenreFilter] = useState<WritingGenre | null>(null);

  // Editor state
  const [editingWork, setEditingWork] = useState<WritingWork | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorGenre, setEditorGenre] = useState<WritingGenre>('fiction');
  const [isSaving, setIsSaving] = useState(false);

  const filteredWorks = useMemo(() => {
    let result = works;
    if (genreFilter) result = result.filter(w => w.genre === genreFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => w.title.toLowerCase().includes(q) || (w.content || '').toLowerCase().includes(q));
    }
    return result;
  }, [works, genreFilter, searchQuery]);

  const startNewWork = useCallback(() => {
    setEditingWork(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorGenre('fiction');
    setTab('editor');
  }, []);

  const openWork = useCallback((work: WritingWork) => {
    setEditingWork(work);
    setEditorTitle(work.title);
    setEditorContent(work.content || '');
    setEditorGenre(work.genre || 'fiction');
    setTab('editor');
  }, []);

  const saveWork = useCallback(async () => {
    setIsSaving(true);
    const wordCount = editorContent.trim().split(/\s+/).filter(Boolean).length;
    const data: Partial<WritingWork> = {
      title: editorTitle || 'Untitled',
      genre: editorGenre,
      content: editorContent,
      wordCount,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    try {
      if (editingWork) {
        await updateWork(editingWork.id, { title: data.title, data: data as unknown as Partial<WritingWork> });
      } else {
        await createWork({ title: data.title!, data: { ...data, createdAt: new Date().toISOString() } as unknown as Record<string, unknown> });
      }
      refetch();
    } catch (err) {
      console.error('Save failed:', err instanceof Error ? err.message : err);
    }
    setIsSaving(false);
  }, [editorTitle, editorContent, editorGenre, editingWork, createWork, updateWork, refetch]);

  const wordCount = useMemo(() => editorContent.trim().split(/\s+/).filter(Boolean).length, [editorContent]);

  const TABS: { id: WritingTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'works', label: 'My Works', icon: FileText },
    { id: 'editor', label: 'Editor', icon: Edit2 },
    { id: 'prompts', label: 'Prompts', icon: Sparkles },
    { id: 'workshop', label: 'Workshop', icon: Globe },
  ];

  return (
    <div data-lens-theme="creative-writing" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold">Creative Writing</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          </div>
          <div className="flex items-center gap-2">
            <DTUExportButton domain="creative-writing" data={{}} compact />
            <button onClick={() => setShowFeatures(!showFeatures)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">Features</button>
            <button onClick={startNewWork} className="px-3 py-1.5 text-xs bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> New Work
            </button>
          </div>
        </div>

        {showFeatures && <LensFeaturePanel lensId="creative-writing" />}
        <RealtimeDataPanel data={realtimeData} insights={realtimeInsights} />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors', tab === t.id ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {isError && <ErrorState error={error?.message} onRetry={refetch} />}

        {/* Works list */}
        {tab === 'works' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search works..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
              <select value={genreFilter || ''} onChange={e => setGenreFilter((e.target.value || null) as WritingGenre | null)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                <option value="">All genres</option>
                {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            {filteredWorks.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No works yet. Start writing!</p>
                <button onClick={startNewWork} className="mt-3 px-4 py-2 text-xs bg-amber-500/20 rounded-lg hover:bg-amber-500/30">New Work</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredWorks.map(work => (
                  <motion.div key={work.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => openWork(work)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-sm">{work.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{work.genre || 'unset'}</span>
                          <span>{work.wordCount || 0} words</span>
                          <span className={cn('px-1.5 py-0.5 rounded', work.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400')}>{work.status || 'draft'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); openWork(work); }} className="p-1 hover:bg-white/10 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={e => { e.stopPropagation(); removeWork(work.id).catch(() => {}); refetch(); }} className="p-1 hover:bg-white/10 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {work.content && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{work.content.slice(0, 200)}</p>}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor */}
        {tab === 'editor' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input value={editorTitle} onChange={e => setEditorTitle(e.target.value)} placeholder="Untitled work" className="text-lg font-semibold bg-transparent border-none focus:outline-none placeholder-gray-600" />
                <select value={editorGenre} onChange={e => setEditorGenre(e.target.value as WritingGenre)} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">
                  {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{wordCount} words</span>
                <button onClick={saveWork} disabled={isSaving} className="px-3 py-1.5 text-xs bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 flex items-center gap-1 disabled:opacity-50">
                  <Save className="w-3 h-3" /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <textarea
              value={editorContent}
              onChange={e => setEditorContent(e.target.value)}
              placeholder="Begin writing..."
              className="w-full h-[60vh] px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-sm leading-relaxed focus:outline-none focus:border-amber-500/30 resize-none font-mono"
            />
          </div>
        )}

        {/* Prompts */}
        {tab === 'prompts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-400" /> Writing Prompts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WRITING_PROMPTS.map((prompt, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-amber-500/30 transition-colors">
                  <p className="text-sm italic text-gray-300 mb-3">&ldquo;{prompt}&rdquo;</p>
                  <button onClick={() => { setEditorContent(prompt + '\n\n'); setEditorTitle(''); setEditingWork(null); setTab('editor'); }} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <PenTool className="w-3 h-3" /> Start writing
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Workshop */}
        {tab === 'workshop' && (
          <div className="text-center py-16 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Writing Workshop</p>
            <p className="text-xs text-gray-600">Share your works for peer review, get feedback, and collaborate with other writers.</p>
            <div className="mt-4 text-xs text-gray-600">DTUs in workshop: {contextDTUs.length}</div>
          </div>
        )}
      </div>
    </div>
  );
}
