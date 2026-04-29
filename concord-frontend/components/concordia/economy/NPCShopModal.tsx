'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  itemType: string;
}

interface Shop {
  id: string;
  name: string;
  inventory: ShopItem[];
}

interface NPCShopModalProps {
  npcId: string;
  onClose: () => void;
}

export function NPCShopModal({ npcId, onClose }: NPCShopModalProps) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [sparks, setSparks] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    api.get(`/api/npc-shop/${npcId}`).then(r => {
      setShop(r.data?.shop ?? null);
      setSparks(r.data?.sparks ?? 0);
    }).finally(() => setLoading(false));
  }, [npcId]);

  useEffect(() => { reload(); }, [reload]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleBuy = useCallback(async (item: ShopItem) => {
    const qty = quantities[item.id] ?? 1;
    if (qty < 1) return;
    setBuying(item.id);
    try {
      const r = await api.post(`/api/npc-shop/${npcId}/buy`, { itemId: item.id, quantity: qty });
      setSparks(r.data?.newSparksBalance ?? 0);
      showToast(`Bought ${qty}x ${item.name} for ${item.price * qty} Sparks`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg === 'insufficient_sparks' ? 'Not enough Sparks!' : 'Purchase failed');
    } finally {
      setBuying(null);
    }
  }, [npcId, quantities]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
        <div className="bg-black/90 rounded-2xl p-8 text-white/40">Loading…</div>
      </div>
    );
  }

  if (!shop) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-black/90 border border-white/10 rounded-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-white font-bold">{shop.name}</h3>
            <div className="text-xs text-yellow-400 font-mono mt-0.5">⚡ {sparks.toLocaleString()} Sparks</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-lg">✕</button>
        </div>

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {shop.inventory.map(item => {
            const qty = quantities[item.id] ?? 1;
            const total = item.price * qty;
            const canAfford = sparks >= total;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{item.name}</div>
                  <div className="text-white/40 text-xs">{item.price} Sparks each</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(1, (q[item.id] ?? 1) - 1) }))}
                    className="w-6 h-6 rounded text-white/50 hover:text-white bg-white/5 hover:bg-white/10 text-sm flex items-center justify-center"
                  >−</button>
                  <span className="text-white font-mono text-sm w-6 text-center">{qty}</span>
                  <button
                    onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(item.quantity, (q[item.id] ?? 1) + 1) }))}
                    className="w-6 h-6 rounded text-white/50 hover:text-white bg-white/5 hover:bg-white/10 text-sm flex items-center justify-center"
                  >+</button>
                </div>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={!canAfford || buying === item.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30
                    bg-yellow-600 hover:bg-yellow-500 text-white"
                >
                  {buying === item.id ? '…' : `${total} ⚡`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-white/5 text-[10px] text-white/20 text-center">
          Sparks only — these items have no real-world value
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/20 rounded-xl px-4 py-2 text-white text-sm z-60">
          {toast}
        </div>
      )}
    </div>
  );
}
