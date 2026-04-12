'use client';

/**
 * useLensState — Auto-save & auto-restore hook for lens pages.
 *
 * Attach `scrollRef` to your lens's scrollable container and call
 * `save(partial)` whenever a user-visible piece of state changes.
 * On re-mount, `restored` carries back the previous snapshot so the
 * user lands exactly where they left off.
 *
 * The hook:
 *   1. Restores scroll position on mount (via rAF so layout settles first).
 *   2. Persists scroll position on unmount and on `beforeunload`.
 *   3. Exposes a stable `save()` function that shallow-merges updates
 *      into the zustand store.
 *   4. Returns `isReturning` so lenses can show a "welcome back" hint
 *      or differ initial animation behavior.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLensStateStore, type LensDomainState } from '@/store/lens-state';

export interface UseLensStateReturn {
  restored: LensDomainState | null;
  save: (partial: Partial<LensDomainState>) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  isReturning: boolean;
}

export function useLensState(domain: string): UseLensStateReturn {
  const saveLensState = useLensStateStore((s) => s.saveLensState);
  // Snapshot the restored state once per mount so downstream state
  // initialization sees a stable reference (not one that updates
  // mid-render as the store changes).
  const restoredRef = useRef<LensDomainState | null>(null);
  if (restoredRef.current === null) {
    restoredRef.current = useLensStateStore.getState().lensStates[domain] || null;
  }
  const restored = restoredRef.current;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore scroll position after layout settles.
  useEffect(() => {
    if (!restored?.scrollPosition || !scrollRef.current) return;
    const el = scrollRef.current;
    const target = restored.scrollPosition;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = target;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  // Persist scroll position on unmount.
  useEffect(() => {
    const el = scrollRef.current;
    return () => {
      if (el) {
        saveLensState(domain, { scrollPosition: el.scrollTop });
      }
    };
  }, [domain, saveLensState]);

  // Persist on hard refresh / tab close.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (scrollRef.current) {
        saveLensState(domain, { scrollPosition: scrollRef.current.scrollTop });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [domain, saveLensState]);

  const save = useCallback(
    (partial: Partial<LensDomainState>) => {
      saveLensState(domain, partial);
    },
    [domain, saveLensState],
  );

  return {
    restored,
    save,
    scrollRef,
    isReturning: !!restored,
  };
}
