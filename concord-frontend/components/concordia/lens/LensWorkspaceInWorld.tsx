'use client';

import React, { useState, useCallback } from 'react';
import { api } from '@/lib/api/client';
import { modeManager } from '@/lib/concordia/mode-manager';

// Renders as a floating panel anchored in 3D space via @react-three/drei Html.
// When not inside a Three.js canvas (e.g. tests, stories), falls back to a
// fixed-position overlay so it still renders correctly.

interface LensMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  dtuRefs?: string[];
}

interface LensWorkspaceInWorldProps {
  lensId: string;
  lensName?: string;
  playerPosition: { x: number; y: number; z: number };
  onClose?: () => void;
  /** When true renders as a canvas Html element (needs @react-three/drei Html wrapper in parent) */
  inCanvas?: boolean;
}

export function LensWorkspaceInWorld({
  lensId,
  lensName,
  onClose,
}: LensWorkspaceInWorldProps) {
  const [messages, setMessages] = useState<LensMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentDTUs, setRecentDTUs] = useState<Array<{ id: string; title: string }>>([]);

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg: LensMessage = { id: `${Date.now()}-u`, role: 'user', text: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/chat', {
        message: input,
        lensContext: { lens: lensId, intent: 'lens-work-in-world' },
        brainOverride: 'conscious',
      });
      const text: string = res.data?.response ?? res.data?.text ?? '';
      const dtuRefs: string[] = res.data?.dtuContributors?.map((d: { dtuId: string }) => d.dtuId) ?? [];
      setMessages(m => [...m, { id: `${Date.now()}-a`, role: 'assistant', text, dtuRefs }]);
    } catch (err) {
      setMessages(m => [...m, { id: `${Date.now()}-e`, role: 'assistant', text: `Error: ${String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, lensId]);

  const loadDTUs = useCallback(async () => {
    try {
      const res = await api.get(`/api/personal-locker/dtus?lens=${lensId}`);
      const dtus = res.data?.dtus ?? [];
      setRecentDTUs(dtus.slice(0, 5).map((d: { id: string; title?: string }) => ({ id: d.id, title: d.title ?? d.id })));
    } catch { /* silent */ }
  }, [lensId]);

  React.useEffect(() => { loadDTUs(); }, [loadDTUs]);

  const handleClose = useCallback(() => {
    modeManager.pop();
    onClose?.();
  }, [onClose]);

  return (
    <div
      className="bg-black/90 border border-white/20 rounded-xl shadow-2xl flex flex-col"
      style={{ width: 340, maxHeight: 480 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-sm font-semibold text-white capitalize">{lensName ?? lensId} Lens</span>
        <button onClick={handleClose} className="text-white/40 hover:text-white text-xs">✕ Exit</button>
      </div>

      {/* Recent DTUs */}
      {recentDTUs.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b border-white/5">
          <div className="text-[10px] text-white/30 font-mono mb-1">RECENT DTUS</div>
          <div className="flex flex-wrap gap-1">
            {recentDTUs.map(d => (
              <button
                key={d.id}
                onClick={() => setInput(s => s + ` @${d.id}`)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20 font-mono truncate max-w-[100px]"
                title={d.title}
              >
                {d.title.slice(0, 12)}…
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 text-sm">
        {messages.length === 0 && (
          <p className="text-white/30 text-xs">Ask anything about {lensName ?? lensId}…</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className={`inline-block px-2 py-1 rounded-lg max-w-[90%] text-xs
              ${m.role === 'user' ? 'bg-blue-600/40 text-white' : 'bg-white/10 text-white/90'}`}>
              {m.text}
            </span>
            {m.dtuRefs && m.dtuRefs.length > 0 && (
              <div className="text-[9px] text-white/20 font-mono mt-0.5">
                refs: {m.dtuRefs.slice(0, 3).join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-white/30 text-xs animate-pulse">Thinking…</div>}
      </div>

      {/* Input */}
      <div className="flex gap-1 px-3 pb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask or create a DTU…"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white
            placeholder-white/20 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-white text-xs font-semibold"
        >
          →
        </button>
      </div>
    </div>
  );
}
