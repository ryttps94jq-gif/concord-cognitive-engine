'use client';

import { useEffect, useRef } from 'react';

export interface MouseDelta {
  x: number;
  y: number;
}

export interface MouseInputOptions {
  onMove?: (delta: MouseDelta) => void;
  onWheel?: (delta: number) => void;
  onClick?: (button: number, position: { x: number; y: number }) => void;
  onRightClick?: (position: { x: number; y: number }) => void;
  /** Element to attach listeners to. Defaults to window. */
  targetRef?: React.RefObject<HTMLElement>;
  enabled?: boolean;
}

/**
 * Low-level mouse input hook for the 3D viewport.
 * Tracks pointer-lock delta for camera control, wheel for zoom,
 * and click positions for raycasting.
 */
export function useMouseInput(opts: MouseInputOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const enabled = optsRef.current.enabled ?? true;
    if (!enabled) return;

    const target: EventTarget = optsRef.current.targetRef?.current ?? window;

    function onMouseMove(e: Event) {
      const me = e as MouseEvent;
      optsRef.current.onMove?.({ x: me.movementX, y: me.movementY });
    }

    function onWheel(e: Event) {
      const we = e as WheelEvent;
      we.preventDefault();
      optsRef.current.onWheel?.(we.deltaY);
    }

    function onClick(e: Event) {
      const me = e as MouseEvent;
      if (me.button === 2) {
        optsRef.current.onRightClick?.({ x: me.clientX, y: me.clientY });
      } else {
        optsRef.current.onClick?.(me.button, { x: me.clientX, y: me.clientY });
      }
    }

    target.addEventListener('mousemove', onMouseMove);
    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('click', onClick);
    return () => {
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('click', onClick);
    };
  }, []);
}
