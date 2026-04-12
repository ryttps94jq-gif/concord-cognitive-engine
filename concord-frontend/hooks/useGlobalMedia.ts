'use client';

/**
 * useGlobalMedia — Read and control the global media layer from any lens.
 *
 * The actual audio element lives in <GlobalMediaController /> at the
 * root layout. This hook just exposes the store in a shape that's
 * convenient for lens pages to consume.
 *
 * Usage:
 *   const media = useGlobalMedia();
 *   media.play({ id, title, artist, src, lens: 'music' });
 *   media.pause();
 *   if (media.isPlaying && media.sourceLens === 'music') { ... }
 */

import { useMediaStore, type Track, type RepeatMode } from '@/store/media';

export interface UseGlobalMediaReturn {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Lens slug that originated the currently playing track. */
  sourceLens: string | null;

  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  addToQueue: (tracks: Track[]) => void;
  clearQueue: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
}

export function useGlobalMedia(): UseGlobalMediaReturn {
  const currentTrack = useMediaStore((s) => s.currentTrack);
  const queue = useMediaStore((s) => s.queue);
  const isPlaying = useMediaStore((s) => s.isPlaying);
  const currentTime = useMediaStore((s) => s.currentTime);
  const duration = useMediaStore((s) => s.duration);
  const volume = useMediaStore((s) => s.volume);
  const muted = useMediaStore((s) => s.muted);
  const repeat = useMediaStore((s) => s.repeat);
  const shuffle = useMediaStore((s) => s.shuffle);

  const play = useMediaStore((s) => s.play);
  const pause = useMediaStore((s) => s.pause);
  const resume = useMediaStore((s) => s.resume);
  const stop = useMediaStore((s) => s.stop);
  const next = useMediaStore((s) => s.next);
  const prev = useMediaStore((s) => s.prev);
  const addToQueue = useMediaStore((s) => s.enqueue);
  const clearQueue = useMediaStore((s) => s.clearQueue);
  const setVolume = useMediaStore((s) => s.setVolume);
  const toggleMute = useMediaStore((s) => s.toggleMute);
  const setRepeat = useMediaStore((s) => s.setRepeat);
  const toggleShuffle = useMediaStore((s) => s.toggleShuffle);

  return {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    sourceLens: currentTrack?.lens || null,
    play,
    pause,
    resume,
    stop,
    next,
    prev,
    addToQueue,
    clearQueue,
    setVolume,
    toggleMute,
    setRepeat,
    toggleShuffle,
  };
}
