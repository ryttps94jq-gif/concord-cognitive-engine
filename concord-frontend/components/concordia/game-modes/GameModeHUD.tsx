'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ChevronRight } from 'lucide-react';
import { useGameMode } from '@/hooks/useGameMode';

const LENS_LABELS: Record<string, string> = {
  studio: 'Studio',
  code: 'Code',
  graph: 'Graph',
  research: 'Research',
  marketplace: 'Market',
  standards: 'Standards',
};

export function GameModeHUD() {
  const { active, stage, stageIndex, activeLensId, progress, abort } = useGameMode();

  return (
    <AnimatePresence>
      {active && stage && (
        <motion.div
          key="game-mode-hud"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[900] pointer-events-auto"
        >
          <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-3 min-w-[320px] shadow-xl">
            {/* Mode icon + name */}
            <span className="text-lg">{active.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white/60 text-xs font-medium">{active.name}</span>
                <ChevronRight className="w-3 h-3 text-white/30" />
                <span className="text-white text-xs font-semibold truncate">{stage.name}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden w-full">
                <motion.div
                  className="h-full bg-indigo-500 rounded-full"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>

              {/* Stage dots */}
              <div className="flex items-center gap-1 mt-1.5">
                {active.stages.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i < stageIndex
                        ? 'bg-indigo-400 w-3'
                        : i === stageIndex
                        ? 'bg-white w-4'
                        : 'bg-white/20 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Cycling lens indicator */}
            {activeLensId && (
              <div className="flex items-center gap-1 bg-indigo-500/20 border border-indigo-400/30 rounded-lg px-2 py-1">
                <Zap className="w-3 h-3 text-indigo-400" />
                <span className="text-indigo-300 text-xs font-mono">
                  {LENS_LABELS[activeLensId] ?? activeLensId}
                </span>
              </div>
            )}

            {/* Abort */}
            <button
              onClick={abort}
              className="text-white/40 hover:text-white/80 transition-colors ml-1"
              aria-label="Abort game mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
