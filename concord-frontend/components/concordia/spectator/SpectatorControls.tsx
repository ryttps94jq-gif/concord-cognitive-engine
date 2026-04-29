'use client';

import React, { useState, useCallback } from 'react';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';
import { useMouseInput } from '@/hooks/useMouseInput';
import { modeManager } from '@/lib/concordia/mode-manager';

// ── Types ────────────────────────────────────────────────────────────

interface SpectatorCamera {
  moveForward:  () => void;
  moveBack:     () => void;
  moveLeft:     () => void;
  moveRight:    () => void;
  moveUp:       () => void;
  moveDown:     () => void;
  rotate:       (dx: number, dy: number) => void;
  zoom:         (delta: number) => void;
}

interface SpectatorControlsProps {
  camera: SpectatorCamera;
  onFollowPlayer: (playerId: string | null) => void;
  onTimeScrub: (offsetSeconds: number) => void;
  availablePlayers?: Array<{ id: string; name: string }>;
  timeRange?: number;    // max seconds to scrub back (default 3600)
  enabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────

export function SpectatorControls({
  camera,
  onFollowPlayer,
  onTimeScrub,
  availablePlayers = [],
  timeRange = 3600,
  enabled = true,
}: SpectatorControlsProps) {
  const [followId, setFollowId] = useState<string | null>(null);
  const [scrubOpen, setScrubOpen] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const handleFollow = useCallback((id: string | null) => {
    setFollowId(id);
    onFollowPlayer(id);
  }, [onFollowPlayer]);

  const handleScrub = useCallback((seconds: number) => {
    setScrubValue(seconds);
    onTimeScrub(seconds);
  }, [onTimeScrub]);

  useKeyboardInput(
    {
      KeyW: camera.moveForward,
      KeyS: camera.moveBack,
      KeyA: camera.moveLeft,
      KeyD: camera.moveRight,
      Space: camera.moveUp,
      ShiftLeft: camera.moveDown,
      KeyF: () => {
        if (followId) {
          handleFollow(null);
        } else if (availablePlayers[0]) {
          handleFollow(availablePlayers[0].id);
        }
      },
      KeyT: () => setScrubOpen(s => !s),
      Escape: () => {
        modeManager.pop();
      },
    },
    enabled,
  );

  useMouseInput({ onMove: (delta) => camera.rotate(delta.x, delta.y), onWheel: camera.zoom, enabled });

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Top-right spectator badge */}
      <div className="absolute top-4 right-4 bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white/60 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        SPECTATOR
        <button
          onClick={() => modeManager.pop()}
          className="ml-2 text-white/30 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 border border-white/10 rounded-xl px-3 py-2">
        {/* Follow player */}
        {availablePlayers.length > 0 && (
          <select
            value={followId ?? ''}
            onChange={e => handleFollow(e.target.value || null)}
            className="bg-transparent text-white/70 text-xs border-none outline-none cursor-pointer"
          >
            <option value="">Free camera [F]</option>
            {availablePlayers.map(p => (
              <option key={p.id} value={p.id}>Follow: {p.name}</option>
            ))}
          </select>
        )}

        <div className="w-px h-4 bg-white/10" />

        {/* Time scrub toggle */}
        <button
          onClick={() => setScrubOpen(s => !s)}
          className="text-xs text-white/60 hover:text-white font-mono px-2 py-0.5 rounded border border-white/10 hover:border-white/30"
        >
          ⏱ Time [T]
        </button>
      </div>

      {/* Time scrub panel */}
      {scrubOpen && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-xl px-4 py-3 w-80">
          <div className="text-xs text-white/60 font-mono mb-2">
            World history — scrub to past state
          </div>
          <input
            type="range"
            min={0}
            max={timeRange}
            value={scrubValue}
            onChange={e => handleScrub(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-1">
            <span>−{formatTime(timeRange)} ago</span>
            <span className="text-cyan-400">−{formatTime(scrubValue)} ago</span>
            <span>now</span>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-16 right-4 text-[10px] text-white/20 font-mono text-right">
        WASD move · Space up · Shift down<br />
        F follow · T time scrub · Esc exit
      </div>
    </>
  );
}
