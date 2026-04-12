'use client';

/**
 * LensStateProvider — Wraps every lens so that scroll position, tab
 * selection, search query, filters, drafts, and any other UI state are
 * automatically preserved across lens navigation.
 *
 * This provider mounts inside the lens layout and connects a single
 * scrollable container to the lens state persistence store. Any
 * descendant component can read or mutate the state via `useLensContext`.
 *
 * Usage:
 *   <LensStateProvider domain="music">
 *     {children}
 *   </LensStateProvider>
 *
 * Without a provider, descendants still work — `useLensContext()` returns
 * null and components should fall back to ephemeral local state.
 */

import React, { createContext, useContext } from 'react';
import { useLensState } from '@/hooks/useLensState';
import type { LensDomainState } from '@/store/lens-state';

export interface LensStateContextValue {
  domain: string;
  restored: LensDomainState | null;
  save: (partial: Partial<LensDomainState>) => void;
  isReturning: boolean;
}

const LensStateContext = createContext<LensStateContextValue | null>(null);

interface LensStateProviderProps {
  domain: string;
  children: React.ReactNode;
  /** Optional extra class for the scroll container. */
  className?: string;
  /**
   * When true, the provider does NOT render its own scroll container.
   * Use this for lenses that manage their own scroll (e.g. virtualized
   * lists). They can still read `useLensContext()` to persist state
   * manually via `save()`.
   */
  unstyledContainer?: boolean;
}

export function LensStateProvider({
  domain,
  children,
  className = '',
  unstyledContainer = false,
}: LensStateProviderProps) {
  const { restored, save, scrollRef, isReturning } = useLensState(domain);

  const value: LensStateContextValue = {
    domain,
    restored,
    save,
    isReturning,
  };

  if (unstyledContainer) {
    return <LensStateContext.Provider value={value}>{children}</LensStateContext.Provider>;
  }

  // Default: full-height scrollable container. Callers can override
  // sizing via className (e.g. `flex-1 min-h-0` inside a flex column).
  const containerClass = className.trim() ? `overflow-y-auto ${className}`.trim() : 'overflow-y-auto h-full';

  return (
    <LensStateContext.Provider value={value}>
      <div ref={scrollRef} className={containerClass}>
        {children}
      </div>
    </LensStateContext.Provider>
  );
}

/** Access the current lens state context (null outside a provider). */
export function useLensContext(): LensStateContextValue | null {
  return useContext(LensStateContext);
}

/**
 * Strict variant — throws if used outside a provider. Use this when
 * the component is guaranteed to live inside a lens layout.
 */
export function useLensContextStrict(): LensStateContextValue {
  const ctx = useContext(LensStateContext);
  if (!ctx) {
    throw new Error('useLensContextStrict must be used inside a LensStateProvider');
  }
  return ctx;
}

export default LensStateProvider;
