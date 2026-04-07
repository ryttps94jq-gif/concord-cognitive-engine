'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ScrollableRowProps {
  children: React.ReactNode;
  className?: string;
  showFade?: boolean;
}

/**
 * ScrollableRow — A horizontally scrollable container with fade indicators
 * showing when more content exists beyond the visible area.
 * Replaces bare `overflow-x-auto` divs so users know more items exist.
 */
export function ScrollableRow({ children, className, showFade = true }: ScrollableRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  return (
    <div className="relative">
      {showFade && canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-lattice-bg to-transparent z-10 pointer-events-none" />
      )}
      <div
        ref={ref}
        className={cn('flex overflow-x-auto scrollbar-hide', className)}
      >
        {children}
      </div>
      {showFade && canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-lattice-bg to-transparent z-10 pointer-events-none" />
      )}
    </div>
  );
}
