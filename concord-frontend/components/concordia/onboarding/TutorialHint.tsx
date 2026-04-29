'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { tutorialManager, TutorialHint as THint, TutorialStep, TUTORIAL_TOPICS } from '@/lib/concordia/onboarding/tutorial';

// ── Hint toast ───────────────────────────────────────────────────────

function HintToast({ hint, onDismiss }: { hint: THint; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, hint.duration);
    return () => clearTimeout(t);
  }, [hint.duration, onDismiss]);

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 bg-black/90 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-sm">
      <div className="flex-1">
        <div className="text-sm text-white">{hint.message}</div>
        {hint.controls && hint.controls.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {hint.controls.slice(0, 3).map((k, i) => (
              <kbd key={i} className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-xs text-white/70 font-mono">
                {k}
              </kbd>
            ))}
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="text-white/30 hover:text-white text-xs">✕</button>
    </div>
  );
}

// ── Help menu (replay any tutorial) ─────────────────────────────────

function HelpMenu({ onClose }: { onClose: () => void }) {
  const topics = Object.entries(TUTORIAL_TOPICS).filter(([, v]) => v !== '');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-black/90 border border-white/10 rounded-2xl p-5 min-w-[280px]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-white">Tutorials</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <div className="space-y-1">
          {topics.map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                tutorialManager.replay(key as TutorialStep);
                onClose();
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <button
            onClick={() => { tutorialManager.skip(); onClose(); }}
            className="w-full text-xs text-white/30 hover:text-white/60 py-1"
          >
            Skip all tutorials
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function TutorialOverlay() {
  const [hint, setHint] = useState<THint | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    tutorialManager.onHint(setHint);
    tutorialManager.start();
    return () => tutorialManager.onHint(() => undefined);
  }, []);

  const dismiss = useCallback(() => setHint(null), []);

  if (tutorialManager.isDone && !helpOpen) return null;

  return (
    <>
      {hint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <HintToast hint={hint} onDismiss={dismiss} />
        </div>
      )}

      {/* Help button — always visible */}
      <button
        onClick={() => setHelpOpen(true)}
        className="absolute bottom-4 left-4 text-xs text-white/30 hover:text-white/60 font-mono bg-black/40 px-2 py-1 rounded-lg border border-white/5"
      >
        ? Help
      </button>

      {helpOpen && <HelpMenu onClose={() => setHelpOpen(false)} />}
    </>
  );
}
