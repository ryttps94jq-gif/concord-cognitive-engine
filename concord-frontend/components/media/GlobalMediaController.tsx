'use client';

/**
 * GlobalMediaController — The global audio element.
 *
 * This component mounts exactly ONCE at the root layout level and
 * NEVER unmounts. It owns the HTMLAudioElement that plays the current
 * track, drives time/duration updates into the media store, and renders
 * the persistent MiniPlayer bar. Because it lives above the lens
 * layer, audio keeps playing as users navigate between lenses.
 *
 * The actual playback state (track, queue, isPlaying, etc.) lives in
 * `useMediaStore`, and is kept in sync with the <audio> element via
 * a ref and a few effects.
 *
 * Also wires up:
 *   • MediaSession API — lock-screen/notification media controls
 *   • volume + mute syncing
 *   • preserving playback across the <audio> element recreation
 */

import React, { useEffect, useRef } from 'react';
import { useMediaStore } from '@/store/media';
import { MiniPlayer } from './MiniPlayer';

export function GlobalMediaController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useMediaStore((s) => s.currentTrack);
  const isPlaying = useMediaStore((s) => s.isPlaying);
  const volume = useMediaStore((s) => s.volume);
  const muted = useMediaStore((s) => s.muted);
  const _setCurrentTime = useMediaStore((s) => s._setCurrentTime);
  const _setDuration = useMediaStore((s) => s._setDuration);
  const _setIsPlaying = useMediaStore((s) => s._setIsPlaying);
  const _handleTrackEnd = useMediaStore((s) => s._handleTrackEnd);
  const pause = useMediaStore((s) => s.pause);
  const resume = useMediaStore((s) => s.resume);
  const next = useMediaStore((s) => s.next);
  const prev = useMediaStore((s) => s.prev);

  // Reflect play/pause store commands onto the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      const maybe = audio.play();
      if (maybe && typeof maybe.catch === 'function') {
        maybe.catch(() => {
          // Autoplay blocked or resource failed — flip back to paused
          // so the UI stays truthful.
          _setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id, _setIsPlaying]);

  // Volume + mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // MediaSession API — OS-level media controls (lock screen, notification shade).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) {
      try {
        (navigator as unknown as { mediaSession: MediaSession }).mediaSession.metadata = null;
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MediaMeta = (globalThis as any).MediaMetadata;
      if (MediaMeta) {
        navigator.mediaSession.metadata = new MediaMeta({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Concord',
          artwork: currentTrack.albumArt
            ? [{ src: currentTrack.albumArt, sizes: '512x512' }]
            : [],
        });
      }
      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    } catch {
      /* MediaSession is best-effort */
    }
  }, [currentTrack, resume, pause, next, prev]);

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack?.src || undefined}
        preload="auto"
        onTimeUpdate={() => {
          if (audioRef.current) _setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) _setDuration(audioRef.current.duration || 0);
        }}
        onPlay={() => _setIsPlaying(true)}
        onPause={() => _setIsPlaying(false)}
        onEnded={_handleTrackEnd}
      />
      <MiniPlayer />
    </>
  );
}

export default GlobalMediaController;
