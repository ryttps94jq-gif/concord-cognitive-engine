'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface Recipe {
  id: string;
  name: string;
  description: string;
  tier: number;
  required_tool_tier: number;
  required_skill_level: number;
  materials_json: string;
  output_quality: number;
}

interface OwnedTool {
  id: string;
  recipe_id: string;
  name: string;
  tier: number;
  quality: number;
}

interface ToolTreePanelProps {
  onClose: () => void;
}

const TIER_COLORS = ['#6b7280', '#78716c', '#a16207', '#1d4ed8', '#7c3aed'];
const TIER_NAMES = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];

export function ToolTreePanel({ onClose }: ToolTreePanelProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [owned, setOwned] = useState<OwnedTool[]>([]);
  const [currentTier, setCurrentTier] = useState(0);
  const [crafting, setCrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/tools/recipes').then(r => setRecipes(r.data?.recipes ?? [])),
      api.get('/api/tools/mine').then(r => {
        setOwned(r.data?.tools ?? []);
        setCurrentTier(r.data?.tier ?? 0);
      }),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const ownedIds = new Set(owned.map(t => t.recipe_id));

  const handleCraft = useCallback(async (recipeId: string) => {
    setCrafting(recipeId);
    setError(null);
    try {
      await api.post('/api/tools/craft', { recipeId });
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'craft_failed';
      setError(msg);
    } finally {
      setCrafting(null);
    }
  }, [reload]);

  const byTier = [0, 1, 2, 3, 4].map(t => recipes.filter(r => r.tier === t));

  if (loading) return <div className="p-6 text-white/40 text-sm text-center">Loading tool tree…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-white font-bold text-sm">Tool Tree</h3>
          <span className="text-white/40 text-xs">Current tier: {currentTier}</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {error && <div className="text-xs text-red-400 font-mono bg-red-400/10 px-3 py-2 rounded-lg">{error}</div>}

        {byTier.map((tierRecipes, tier) => (
          <div key={tier}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{TIER_NAMES[tier]}</span>
              {tier === 0 && <span className="text-[10px] text-white/30">— always available</span>}
            </div>
            <div className="space-y-2 ml-5">
              {tierRecipes.map(r => {
                const isOwned = ownedIds.has(r.id);
                const canCraft = !isOwned && currentTier >= r.required_tool_tier;
                const materials = (() => { try { return JSON.parse(r.materials_json); } catch { return []; } })();

                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isOwned ? 'border-green-500/30 bg-green-500/5' : 'border-white/8 bg-white/3 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isOwned && <span className="text-green-400 text-xs">✓</span>}
                          <span className="text-white text-xs font-semibold">{r.name}</span>
                        </div>
                        <div className="text-white/40 text-[10px] mt-0.5">{r.description}</div>
                        {materials.length > 0 && (
                          <div className="text-white/30 text-[10px] mt-1">
                            Needs: {materials.map((m: { id: string; quantity: number }) => `${m.quantity}x ${m.id.replace(/_/g, ' ')}`).join(', ')}
                          </div>
                        )}
                        {r.required_skill_level > 0 && (
                          <div className="text-white/30 text-[10px]">Min skill: {r.required_skill_level}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-white/30 font-mono">Q{r.output_quality}</span>
                        {!isOwned && (
                          <button
                            onClick={() => handleCraft(r.id)}
                            disabled={!canCraft || crafting === r.id}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30
                              bg-blue-600 hover:bg-blue-500 text-white disabled:bg-white/10 disabled:text-white/30"
                          >
                            {crafting === r.id ? '…' : 'Craft'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
