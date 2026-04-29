'use client';

import React, { useState } from 'react';
import { useEvent } from '@/lib/realtime/event-bus';
import { motion, AnimatePresence } from 'framer-motion';

interface LegendaryEvent {
  playerName: string;
  skillTitle: string;
  masteryTitle: string;
  worldId: string;
}

export function LegendaryAnnouncement() {
  const [event, setEvent] = useState<(LegendaryEvent & { id: number }) | null>(null);
  let _counter = 0;

  useEvent<LegendaryEvent>('world:legendary-achievement', (data) => {
    setEvent({ ...data, id: ++_counter });
    setTimeout(() => setEvent(null), 5000);
  });

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed inset-x-0 bottom-32 z-[9998] flex justify-center pointer-events-none"
        >
          <div className="relative bg-gradient-to-r from-yellow-900/90 via-amber-900/90 to-yellow-900/90 border border-yellow-500/50 rounded-2xl px-10 py-5 text-center shadow-2xl shadow-yellow-900/40 max-w-lg overflow-hidden">
            {/* Glow edge */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-yellow-400/20 pointer-events-none" />
            <div className="text-yellow-400 text-[10px] font-mono uppercase tracking-[0.25em] mb-1">
              ✦ Legendary Achievement ✦
            </div>
            <div className="text-white font-bold text-lg leading-tight">
              {event.playerName}
            </div>
            <div className="text-yellow-200 text-sm mt-0.5">
              achieved <span className="font-semibold text-yellow-300">{event.masteryTitle}</span>
            </div>
            <div className="text-yellow-500/70 text-xs mt-1 font-mono">
              {event.skillTitle} · {event.worldId}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
