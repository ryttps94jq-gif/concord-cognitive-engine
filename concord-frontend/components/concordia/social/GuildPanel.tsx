'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface Guild {
  id: string;
  name: string;
  type: string;
  description: string;
  leaderId?: string;
  bankSparks?: number;
  memberCount?: number;
}

interface GuildPanelProps {
  playerId: string;
  onClose: () => void;
}

export function GuildPanel({ playerId, onClose }: GuildPanelProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'browse'>('mine');

  const reload = useCallback(() => {
    setLoading(true);
    api.get('/api/world/orgs').then(r => {
      const all: Guild[] = r.data?.organizations ?? [];
      setGuilds(all);
      setMyGuild(all.find(g => g.leaderId === playerId) ?? null);
    }).finally(() => setLoading(false));
  }, [playerId]);

  useEffect(() => { reload(); }, [reload]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/world/orgs', { name: newName.trim(), description: newDesc.trim(), type: 'guild', leaderId: playerId });
      setNewName('');
      setNewDesc('');
      reload();
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, playerId, reload]);

  const handleJoin = useCallback(async (guildId: string) => {
    setJoining(guildId);
    try {
      await api.post(`/api/world/orgs/${guildId}/join`, { userId: playerId });
      reload();
    } finally {
      setJoining(null);
    }
  }, [playerId, reload]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
      <div className="bg-black/90 border border-white/10 rounded-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header + tabs */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">Guilds</h2>
            <button onClick={onClose} className="text-white/30 hover:text-white">✕</button>
          </div>
          <div className="flex gap-3">
            {(['mine', 'browse'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs font-semibold pb-1.5 border-b-2 transition-all capitalize ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-white/40'}`}
              >
                {t === 'mine' ? 'My Guild' : 'Browse'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-white/30 text-sm text-center py-8">Loading…</div>
          ) : tab === 'mine' ? (
            myGuild ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="text-white font-bold">{myGuild.name}</div>
                  <div className="text-white/40 text-xs mt-1">{myGuild.description}</div>
                  {myGuild.bankSparks !== undefined && (
                    <div className="text-yellow-400 text-xs font-mono mt-2">⚡ Bank: {myGuild.bankSparks.toLocaleString()} Sparks</div>
                  )}
                  {myGuild.memberCount !== undefined && (
                    <div className="text-white/30 text-xs mt-1">{myGuild.memberCount} member{myGuild.memberCount !== 1 ? 's' : ''}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-white/40 text-sm text-center">You're not in a guild.</div>
                <div className="p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="text-white text-xs font-semibold">Create a Guild</div>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Guild name…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                  />
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Description (optional)…"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/30"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold"
                  >
                    {creating ? 'Creating…' : 'Create Guild'}
                  </button>
                </div>
              </div>
            )
          ) : (
            // Browse guilds
            guilds.length === 0 ? (
              <div className="text-white/30 text-sm text-center py-8">No guilds yet. Be the first to create one.</div>
            ) : (
              guilds.map(g => (
                <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 hover:border-white/15 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{g.name}</div>
                    <div className="text-white/40 text-xs">{g.description?.slice(0, 60)}</div>
                    {g.memberCount !== undefined && <div className="text-white/20 text-[10px] mt-0.5">{g.memberCount} members</div>}
                  </div>
                  <button
                    onClick={() => handleJoin(g.id)}
                    disabled={joining === g.id || g.leaderId === playerId}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white flex-shrink-0"
                  >
                    {joining === g.id ? '…' : g.leaderId === playerId ? 'Yours' : 'Join'}
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
