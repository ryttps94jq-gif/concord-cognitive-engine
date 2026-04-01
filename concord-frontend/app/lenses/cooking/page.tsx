'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  ChefHat, Plus, Search, Trash2, Clock, Users, Flame,
  Star, UtensilsCrossed, Layers, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface RecipeData {
  name: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  rating: number;
  notes: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-neon-green bg-neon-green/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  hard: 'text-red-400 bg-red-400/10',
};

export default function CookingLensPage() {
  useLensNav('cooking');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('cooking');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: '', cuisine: '', difficulty: 'easy' as 'easy' | 'medium' | 'hard', prepTime: 0, cookTime: 0, servings: 4 });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, remove, deleteMut,
  } = useLensData<RecipeData>('cooking', 'recipe', { seed: [] });

  const recipes = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, name: item.title || item.data?.name || 'Untitled Recipe' }))
      .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.cuisine?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const stats = useMemo(() => ({
    total: recipes.length,
    cuisines: [...new Set(recipes.map(r => r.cuisine).filter(Boolean))].length,
    avgTime: recipes.length ? Math.round(recipes.reduce((s, r) => s + (r.prepTime || 0) + (r.cookTime || 0), 0) / recipes.length) : 0,
    topRated: recipes.filter(r => (r.rating || 0) >= 4).length,
  }), [recipes]);

  const handleCreate = useCallback(async () => {
    if (!newRecipe.name.trim()) return;
    await create({
      title: newRecipe.name,
      data: {
        name: newRecipe.name, cuisine: newRecipe.cuisine, difficulty: newRecipe.difficulty,
        prepTime: newRecipe.prepTime, cookTime: newRecipe.cookTime, servings: newRecipe.servings,
        ingredients: [], instructions: [], tags: [], rating: 0, notes: '',
      },
    });
    setNewRecipe({ name: '', cuisine: '', difficulty: 'easy', prepTime: 0, cookTime: 0, servings: 4 });
    setShowCreate(false);
  }, [newRecipe, create]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div data-lens-theme="cooking" className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-xl font-bold">Cooking Lens</h1>
            <p className="text-sm text-gray-400">Recipes, meal prep & kitchen management</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="cooking" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" /> New Recipe
        </button>
      </header>

      <UniversalActions domain="cooking" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Create Recipe</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={newRecipe.name} onChange={e => setNewRecipe(p => ({ ...p, name: e.target.value }))} placeholder="Recipe name..." className="input-lattice" />
            <input value={newRecipe.cuisine} onChange={e => setNewRecipe(p => ({ ...p, cuisine: e.target.value }))} placeholder="Cuisine (e.g. Italian)..." className="input-lattice" />
            <select value={newRecipe.difficulty} onChange={e => setNewRecipe(p => ({ ...p, difficulty: e.target.value as RecipeData['difficulty'] }))} className="input-lattice">
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
            <input type="number" value={newRecipe.prepTime || ''} onChange={e => setNewRecipe(p => ({ ...p, prepTime: Number(e.target.value) }))} placeholder="Prep (min)..." className="input-lattice" />
            <input type="number" value={newRecipe.cookTime || ''} onChange={e => setNewRecipe(p => ({ ...p, cookTime: Number(e.target.value) }))} placeholder="Cook (min)..." className="input-lattice" />
            <input type="number" value={newRecipe.servings || ''} onChange={e => setNewRecipe(p => ({ ...p, servings: Number(e.target.value) }))} placeholder="Servings..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newRecipe.name.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Creating...' : 'Save Recipe'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><UtensilsCrossed className="w-5 h-5 text-orange-400 mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Recipes</p></div>
        <div className="lens-card"><Flame className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.cuisines}</p><p className="text-sm text-gray-400">Cuisines</p></div>
        <div className="lens-card"><Clock className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">{stats.avgTime}m</p><p className="text-sm text-gray-400">Avg Time</p></div>
        <div className="lens-card"><Star className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">{stats.topRated}</p><p className="text-sm text-gray-400">Top Rated</p></div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full panel p-6 text-center text-gray-400">Loading recipes...</div>
        ) : recipes.length === 0 ? (
          <div className="col-span-full panel p-6 text-center text-gray-400">No recipes yet. Create your first one.</div>
        ) : recipes.map(r => (
          <div key={r.id} className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white truncate">{r.name}</h3>
              <button onClick={() => remove(r.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs mb-2">
              {r.cuisine && <span className="px-2 py-0.5 rounded bg-lattice-elevated text-orange-300">{r.cuisine}</span>}
              {r.difficulty && <span className={cn('px-2 py-0.5 rounded', DIFFICULTY_COLORS[r.difficulty])}>{r.difficulty}</span>}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {(r.prepTime || r.cookTime) > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(r.prepTime || 0) + (r.cookTime || 0)}m</span>}
              {r.servings > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.servings} servings</span>}
            </div>
          </div>
        ))}
      </div>

      <RealtimeDataPanel domain="cooking" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="cooking" /></div>}
      </div>
    </div>
  );
}
