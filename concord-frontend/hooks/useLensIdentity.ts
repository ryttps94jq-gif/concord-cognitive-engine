'use client';

/**
 * useLensIdentity — Apply per-lens visual identity via CSS variables.
 *
 * Sets --lens-accent, --lens-secondary, --lens-gradient on :root
 * scoped to the current lens. Cleans up on unmount or lens change.
 */

import { useEffect, useMemo } from 'react';
import { getLensIdentity, type LensIdentity } from '@/lib/lens-identities';

export function useLensIdentity(domain: string): LensIdentity {
  const identity = useMemo(() => getLensIdentity(domain), [domain]);

  useEffect(() => {
    if (!domain) return;

    const root = document.documentElement;
    root.style.setProperty('--lens-accent', identity.accent);
    root.style.setProperty('--lens-secondary', identity.secondaryAccent);
    root.style.setProperty('--lens-gradient', identity.gradient);

    return () => {
      root.style.removeProperty('--lens-accent');
      root.style.removeProperty('--lens-secondary');
      root.style.removeProperty('--lens-gradient');
    };
  }, [domain, identity]);

  return identity;
}
