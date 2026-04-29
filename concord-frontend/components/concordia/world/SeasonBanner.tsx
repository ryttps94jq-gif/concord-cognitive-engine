'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api/client';

interface Season {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  theme?: string;
  challenges?: Array<{ id: string; title: string; completed: boolean }>;
}

interface SeasonBannerProps {
  onOpenPassPanel: () => void;
}

export function SeasonBanner({ onOpenPassPanel }: SeasonBannerProps) {
  const [season, setSeason] = useState<Season | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    api.get('/api/world/season').then(r => {
      const s: Season = r.data?.season;
      if (!s) return;
      setSeason(s);
      const msLeft = new Date(s.endDate).getTime() - Date.now();
      setDaysLeft(Math.max(0, Math.ceil(msLeft / 86400_000)));
    }).catch(() => {});
  }, []);

  if (!season) return null;

  const completed = season.challenges?.filter(c => c.completed).length ?? 0;
  const total = season.challenges?.length ?? 0;
  const progress = total > 0 ? completed / total : 0;

  return (
    <button
      onClick={onOpenPassPanel}
      className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 hover:border-white/20 transition-all text-left"
    >
      <div className="text-xs">
        <span className="text-white/40">Season </span>
        <span className="text-white font-semibold">{season.number}</span>
        {season.theme && <span className="text-white/40 ml-1">· {season.theme}</span>}
      </div>

      {/* Progress bar */}
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {total > 0 && (
        <span className="text-[10px] text-white/40 font-mono">{completed}/{total}</span>
      )}

      {daysLeft !== null && (
        <span className={`text-[10px] font-mono ${daysLeft <= 7 ? 'text-red-400' : 'text-white/30'}`}>
          {daysLeft}d left
        </span>
      )}
    </button>
  );
}
