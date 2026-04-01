'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Shirt, Plus, Search, Trash2, Star, Tag, Palette,
  Calendar, DollarSign, Layers, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface FashionItem {
  name: string;
  category: string;
  color: string;
  brand: string;
  season: string;
  size: string;
  price: number;
  condition: 'new' | 'good' | 'worn' | 'donate';
  wearCount: number;
  lastWorn: string;
  notes: string;
}

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Activewear', 'Formal'];

const CONDITION_COLORS: Record<string, string> = {
  new: 'text-neon-green bg-neon-green/10',
  good: 'text-neon-cyan bg-neon-cyan/10',
  worn: 'text-yellow-400 bg-yellow-400/10',
  donate: 'text-red-400 bg-red-400/10',
};

export default function FashionLensPage() {
  useLensNav('fashion');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('fashion');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Tops', color: '', brand: '', price: 0 });

  const {
    items, isLoading, isError, error, refetch,
    create, createMut, remove, deleteMut,
  } = useLensData<FashionItem>('fashion', 'garment', { seed: [] });

  const garments = useMemo(() =>
    items.map(item => ({ id: item.id, ...item.data, name: item.title || item.data?.name || 'Untitled' }))
      .filter(g => (!search || g.name?.toLowerCase().includes(search.toLowerCase()) || g.brand?.toLowerCase().includes(search.toLowerCase())))
      .filter(g => !catFilter || g.category === catFilter),
    [items, search, catFilter]
  );

  const stats = useMemo(() => ({
    total: garments.length,
    totalValue: garments.reduce((s, g) => s + (g.price || 0), 0),
    categories: [...new Set(garments.map(g => g.category).filter(Boolean))].length,
    toDonate: garments.filter(g => g.condition === 'donate').length,
  }), [garments]);

  const handleCreate = useCallback(async () => {
    if (!newItem.name.trim()) return;
    await create({
      title: newItem.name,
      data: {
        name: newItem.name, category: newItem.category, color: newItem.color,
        brand: newItem.brand, season: '', size: '', price: newItem.price,
        condition: 'new', wearCount: 0, lastWorn: '', notes: '',
      },
    });
    setNewItem({ name: '', category: 'Tops', color: '', brand: '', price: 0 });
    setShowCreate(false);
  }, [newItem, create]);

  if (isError) return <div className="flex items-center justify-center h-full p-8"><ErrorState error={error?.message} onRetry={refetch} /></div>;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shirt className="w-6 h-6 text-neon-purple" />
          <div>
            <h1 className="text-xl font-bold">Fashion Lens</h1>
            <p className="text-sm text-gray-400">Wardrobe & style management</p>
          </div>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
          <DTUExportButton domain="fashion" data={realtimeData || {}} compact />
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-neon purple">
          <Plus className="w-4 h-4 mr-2 inline" /> Add Item
        </button>
      </header>

      <UniversalActions domain="fashion" artifactId={items[0]?.id} compact />

      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Add Wardrobe Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Item name..." className="input-lattice" />
            <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} className="input-lattice">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={newItem.brand} onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))} placeholder="Brand..." className="input-lattice" />
            <input value={newItem.color} onChange={e => setNewItem(p => ({ ...p, color: e.target.value }))} placeholder="Color..." className="input-lattice" />
            <input type="number" value={newItem.price || ''} onChange={e => setNewItem(p => ({ ...p, price: Number(e.target.value) }))} placeholder="Price..." className="input-lattice" />
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending || !newItem.name.trim()} className="btn-neon green w-full">
            {createMut.isPending ? 'Adding...' : 'Add to Wardrobe'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card"><Shirt className="w-5 h-5 text-neon-purple mb-2" /><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-400">Items</p></div>
        <div className="lens-card"><DollarSign className="w-5 h-5 text-neon-green mb-2" /><p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p><p className="text-sm text-gray-400">Total Value</p></div>
        <div className="lens-card"><Tag className="w-5 h-5 text-neon-cyan mb-2" /><p className="text-2xl font-bold">{stats.categories}</p><p className="text-sm text-gray-400">Categories</p></div>
        <div className="lens-card"><Star className="w-5 h-5 text-yellow-400 mb-2" /><p className="text-2xl font-bold">{stats.toDonate}</p><p className="text-sm text-gray-400">To Donate</p></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wardrobe..." className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-lattice w-40">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full panel p-6 text-center text-gray-400">Loading wardrobe...</div>
        ) : garments.length === 0 ? (
          <div className="col-span-full panel p-6 text-center text-gray-400">No items yet. Add your first piece.</div>
        ) : garments.map(g => (
          <div key={g.id} className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white truncate">{g.name}</h3>
              <button onClick={() => remove(g.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {g.category && <span className="px-2 py-0.5 rounded bg-lattice-elevated text-neon-cyan">{g.category}</span>}
              {g.brand && <span className="px-2 py-0.5 rounded bg-lattice-elevated text-gray-300">{g.brand}</span>}
              {g.color && <span className="px-2 py-0.5 rounded bg-lattice-elevated">{g.color}</span>}
              {g.condition && <span className={cn('px-2 py-0.5 rounded', CONDITION_COLORS[g.condition])}>{g.condition}</span>}
            </div>
            {g.price > 0 && <p className="text-sm text-gray-400 mt-2">${g.price}</p>}
          </div>
        ))}
      </div>

      <RealtimeDataPanel domain="fashion" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />

      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFeatures && 'rotate-180')} />
        </button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="fashion" /></div>}
      </div>
    </div>
  );
}
