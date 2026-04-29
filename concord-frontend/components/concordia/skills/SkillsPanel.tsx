'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProgressionPanel, { SkillProgressionData } from './ProgressionPanel';
import { useEvent } from '@/lib/realtime/event-bus';
import { Trophy, RefreshCw } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  title: string;
  skill_level: number;
  username: string | null;
}

interface SkillsPanelProps {
  worldId: string;
  onClose?: () => void;
}

type Tab = 'my-skills' | 'leaderboard';

export function SkillsPanel({ worldId, onClose }: SkillsPanelProps) {
  const [tab, setTab] = useState<Tab>('my-skills');
  const [skills, setSkills] = useState<SkillProgressionData[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/worlds/skills/mine');
      if (!res.ok) return;
      const data = await res.json();
      setSkills(data.skills || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } finally {
      setLbLoading(false);
    }
  }, [worldId]);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { if (tab === 'leaderboard') loadLeaderboard(); }, [tab, loadLeaderboard]);

  useEvent('skill:xp-awarded', loadSkills);

  return (
    <div className="flex flex-col h-full bg-black/90 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-semibold text-white text-sm">Skills</span>
        <div className="flex gap-1">
          {(['my-skills', 'leaderboard'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition ${tab === t ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40 hover:text-white/70'}`}
            >
              {t === 'my-skills' ? 'My Skills' : 'Leaderboard'}
            </button>
          ))}
          <button onClick={loadSkills} className="ml-1 text-white/30 hover:text-white/60 transition" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="ml-1 text-white/30 hover:text-white">✕</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'my-skills' && (
          loading ? (
            <p className="text-white/30 text-xs font-mono">Loading skills…</p>
          ) : skills.length === 0 ? (
            <p className="text-white/30 text-xs font-mono">No skills yet. Use skills in the world to grow them.</p>
          ) : (
            <ProgressionPanel skills={skills} />
          )
        )}

        {tab === 'leaderboard' && (
          lbLoading ? (
            <p className="text-white/30 text-xs font-mono">Loading leaderboard…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-white/30 text-xs font-mono">No ranked skills in this world yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 text-sm">
                  <span className="w-5 text-right font-mono text-white/40 text-xs">{i + 1}</span>
                  <Trophy className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-white/80">{entry.title}</span>
                  <span className="text-xs text-white/40 font-mono">Lv {entry.skill_level?.toFixed(1)}</span>
                  <span className="text-xs text-white/30">{entry.username || 'anon'}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
