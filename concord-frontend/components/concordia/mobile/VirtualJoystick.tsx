'use client';

import React, { useRef, useCallback, useEffect } from 'react';

interface JoystickVector {
  x: number;   // -1 to 1
  y: number;   // -1 to 1
}

interface VirtualJoystickProps {
  side: 'left' | 'right';
  onMove: (vec: JoystickVector) => void;
  onRelease?: () => void;
  size?: number;
}

export function VirtualJoystick({ side, onMove, onRelease, size = 96 }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);  // active touch identifier
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const radius = size / 2;
  const thumbSize = Math.round(size * 0.42);

  const updateThumb = useCallback((clientX: number, clientY: number) => {
    if (!originRef.current || !thumbRef.current) return;
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, radius * 0.6);
    const angle = Math.atan2(dy, dx);
    const tx = Math.cos(angle) * clampedDist;
    const ty = Math.sin(angle) * clampedDist;
    thumbRef.current.style.transform = `translate(${tx}px, ${ty}px)`;
    onMove({
      x: Math.round((tx / (radius * 0.6)) * 100) / 100,
      y: Math.round((ty / (radius * 0.6)) * 100) / 100,
    });
  }, [onMove, radius]);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    function onTouchStart(e: TouchEvent) {
      if (activeRef.current !== null) return;
      const touch = e.changedTouches[0];
      activeRef.current = touch.identifier;
      originRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (activeRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeRef.current) {
          e.preventDefault();
          updateThumb(t.clientX, t.clientY);
          break;
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeRef.current) {
          activeRef.current = null;
          originRef.current = null;
          if (thumbRef.current) thumbRef.current.style.transform = 'translate(0,0)';
          onMove({ x: 0, y: 0 });
          onRelease?.();
          break;
        }
      }
    }

    base.addEventListener('touchstart', onTouchStart, { passive: true });
    base.addEventListener('touchmove', onTouchMove, { passive: false });
    base.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      base.removeEventListener('touchstart', onTouchStart);
      base.removeEventListener('touchmove', onTouchMove);
      base.removeEventListener('touchend', onTouchEnd);
    };
  }, [onMove, onRelease, updateThumb]);

  return (
    <div
      ref={baseRef}
      className="absolute touch-none select-none"
      style={{
        [side === 'left' ? 'left' : 'right']: 20,
        bottom: 24,
        width: size,
        height: size,
      }}
    >
      {/* Base ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-white/20 bg-white/5"
        style={{ borderRadius: '50%' }}
      />
      {/* Thumb */}
      <div
        ref={thumbRef}
        className="absolute bg-white/30 border border-white/50 rounded-full"
        style={{
          width: thumbSize,
          height: thumbSize,
          left: '50%',
          top: '50%',
          marginLeft: -thumbSize / 2,
          marginTop: -thumbSize / 2,
          transition: 'transform 0.02s',
        }}
      />
    </div>
  );
}
