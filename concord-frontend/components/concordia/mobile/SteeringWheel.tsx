'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface SteeringWheelProps {
  onChange: (value: number) => void;   // -1 to 1
  size?: number;
}

export function SteeringWheel({ onChange, size = 100 }: SteeringWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef<number | null>(null);
  const currentAngleRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);

  const getAngle = useCallback((cx: number, cy: number, x: number, y: number) => {
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = () => el.getBoundingClientRect();

    function onTouchStart(e: TouchEvent) {
      if (activeIdRef.current !== null) return;
      const t = e.changedTouches[0];
      const r = rect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      activeIdRef.current = t.identifier;
      startAngleRef.current = getAngle(cx, cy, t.clientX, t.clientY) - currentAngleRef.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (activeIdRef.current === null || startAngleRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== activeIdRef.current) continue;
        e.preventDefault();
        const r = rect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const angle = getAngle(cx, cy, t.clientX, t.clientY) - startAngleRef.current;
        currentAngleRef.current = Math.max(-90, Math.min(90, angle));
        if (el) el.style.transform = `rotate(${currentAngleRef.current}deg)`;
        onChange(currentAngleRef.current / 90);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeIdRef.current) {
          activeIdRef.current = null;
          // Spring back to center
          currentAngleRef.current = 0;
          if (el) el.style.transform = 'rotate(0deg)';
          onChange(0);
          break;
        }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onChange, getAngle]);

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 touch-none select-none">
      <div
        ref={ref}
        className="rounded-full border-4 border-white/30 bg-white/5"
        style={{ width: size, height: size, transition: 'transform 0.05s ease-out' }}
      >
        {/* Spoke indicator */}
        <div
          className="absolute top-1/2 left-1/2 bg-white/40 rounded-full"
          style={{ width: 4, height: size / 2 - 8, marginLeft: -2, marginTop: -(size / 2 - 8) }}
        />
      </div>
    </div>
  );
}
