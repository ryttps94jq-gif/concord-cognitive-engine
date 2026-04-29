'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface Challenge {
  id: string;
  title: string;
  description?: string;
  xpReward?: number;
  completed: boolean;
  completedAt?: string;
}

interface Season {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  theme?: string;
  challenges?: Challenge[];
}

interface SeasonPassPanelProps {
  onClose: () => void;
}

export function SeasonPassPanel({ onClose }: SeasonPassPanelProps) {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.get('/api/world/season').then(r => setSeason(r.data?.season ?? null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleComplete = useCallback(async (challengeId: string) => {
    setCompleting(challengeId);
    try {
      await api.post('/api/world/season/complete', { challengeId });
      reload();
    } finally {
      setCompleting(null);
    }
  }, [reload]);

  const challenges = season?.challenges ?? [];
  const completed = challenges.filter(c => c.completed).length;
  const daysLeft = season
    ? Math.max(0, Math.ceil((new Date(season.endDate).getTime() - Date.now()) / 86400_000))
    : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
      <div className="bg-black/90 border border-white/10 rounded-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold">{season?.name ?? 'Season Pass'}</h2>
              {season?.theme && <div className="text-white/40 text-xs mt-0.5">{season.theme}</div>}
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white">✕</button>
          </div>

          {season && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>{completed}/{challenges.length} challenges</span>
                <span>{daysLeft} days left</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${challenges.length > 0 ? (completed / challenges.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Challenge list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-white/30 text-sm text-center py-8">Loading…</div>
          ) : challenges.length === 0 ? (
            <div className="text-white/30 text-sm text-center py-8">
              No challenges this season yet. Check back soon.
            </div>
          ) : (
            challenges.map(c => (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  c.completed
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-white/8 hover:border-white/15'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  c.completed ? 'border-green-500 bg-green-500' : 'border-white/20'
                }`}>
                  {c.completed && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${c.completed ? 'text-white/50 line-through' : 'text-white'}`}>
                    {c.title}
                  </div>
                  {c.description && (
                    <div className="text-xs text-white/30 mt-0.5">{c.description}</div>
                  )}
                </div>
                {c.xpReward && (
                  <span className="text-xs text-blue-400 font-mono flex-shrink-0">+{c.xpReward} XP</span>
                )}
                {!c.completed && (
                  <button
                    onClick={() => handleComplete(c.id)}
                    disabled={completing === c.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex-shrink-0"
                  >
                    {completing === c.id ? '…' : 'Claim'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
