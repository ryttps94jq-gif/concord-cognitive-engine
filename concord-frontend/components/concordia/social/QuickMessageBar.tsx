'use client';

import React from 'react';

export const QUICK_MESSAGES = [
  'Hello!',
  'Need help?',
  'Watch out!',
  'Follow me.',
  'Nice work!',
  'Thanks!',
  'Good game.',
  'Be right back.',
] as const;

interface QuickMessageBarProps {
  onSend: (msg: string) => void;
  visible?: boolean;
}

export function QuickMessageBar({ onSend, visible = true }: QuickMessageBarProps) {
  if (!visible) return null;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 flex-wrap justify-center max-w-lg pointer-events-auto">
      {QUICK_MESSAGES.map(msg => (
        <button
          key={msg}
          onClick={() => onSend(msg)}
          className="px-2.5 py-1 rounded-full bg-black/70 border border-white/10 text-white/70
            text-xs hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-sm"
        >
          {msg}
        </button>
      ))}
    </div>
  );
}
