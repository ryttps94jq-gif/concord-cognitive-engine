'use client';

import { useEffect, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────

type KeyHandler = (() => void) | { onDown?: () => void; onUp?: () => void };

export type KeyMap = Partial<Record<string, KeyHandler>>;

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Bind keyboard actions by KeyboardEvent.code (e.g. 'KeyW', 'Space',
 * 'ShiftLeft'). Values can be a plain callback (fires on keydown) or
 * { onDown, onUp } for held-key semantics.
 *
 * The map ref is stable — you can pass a fresh object literal each render
 * without triggering re-subscription.
 */
export function useKeyboardInput(keyMap: KeyMap, enabled = true): void {
  const mapRef = useRef<KeyMap>(keyMap);
  mapRef.current = keyMap;

  useEffect(() => {
    if (!enabled) return;

    function onDown(e: KeyboardEvent) {
      // Don't steal keyboard from text inputs / textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const handler = mapRef.current[e.code];
      if (!handler) return;
      e.preventDefault();
      if (typeof handler === 'function') {
        handler();
      } else {
        handler.onDown?.();
      }
    }

    function onUp(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const handler = mapRef.current[e.code];
      if (!handler || typeof handler === 'function') return;
      handler.onUp?.();
    }

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [enabled]);
}
