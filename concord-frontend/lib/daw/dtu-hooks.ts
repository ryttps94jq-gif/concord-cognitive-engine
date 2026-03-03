/**
 * DAW DTU Hooks — Substrate integration layer
 *
 * Every audio action produces DTUs natively. This module wraps engine operations
 * and translates them into substrate events without changing core audio logic.
 *
 * Pattern follows existential system hooks:
 *   Engine does its thing → DTU hooks capture the event → Substrate receives structured atoms
 *
 * DTU subtypes:
 *   - AudioDTU: audio samples with spectral metadata
 *   - InstrumentDTU: synth presets (oscillator settings, filter curves, envelopes)
 *   - ProcessDTU: mixing chains, mastering chains, arrangement patterns
 *   - SessionDTU: full project state snapshots (git commits for music)
 *   - EffectDTU: effect chain presets
 *   - PatternDTU: drum/midi patterns
 */

import type {
  SynthPreset,
  EffectInstance,
  DrumPattern,
  DAWProject,
  DAWTrack,
  DAWClip,
  MasteringChain,
  ExportSettings,
  StudioDTUType,
  SpectralProfile,
} from './types';

// ============================================================================
// DTU Event Types
// ============================================================================

export interface DTUEvent {
  type: StudioDTUType;
  action: 'create' | 'update' | 'delete' | 'snapshot';
  timestamp: number;
  data: Record<string, unknown>;
  parentIds?: string[];
  tags: string[];
  meta: Record<string, unknown>;
}

export type DTUEventCallback = (event: DTUEvent) => void;

// ============================================================================
// DTU Hook Registry — Central event bus for all studio DTU events
// ============================================================================

class DTUHookRegistry {
  private listeners: Set<DTUEventCallback> = new Set();
  private eventHistory: DTUEvent[] = [];
  private maxHistory: number = 500;
  private batchQueue: DTUEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private batchDelay: number = 1000; // Batch events within 1s to avoid flooding

  subscribe(callback: DTUEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event: DTUEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }
    // Direct emit for critical events (snapshots, exports)
    if (event.action === 'snapshot' || event.type === 'session') {
      this.flush();
      this.listeners.forEach(cb => cb(event));
      return;
    }
    // Batch non-critical events
    this.batchQueue.push(event);
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  private flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    const events = [...this.batchQueue];
    this.batchQueue = [];
    events.forEach(event => {
      this.listeners.forEach(cb => cb(event));
    });
  }

  getHistory(): DTUEvent[] {
    return [...this.eventHistory];
  }

  getHistoryByType(type: StudioDTUType): DTUEvent[] {
    return this.eventHistory.filter(e => e.type === type);
  }

  clear(): void {
    this.eventHistory = [];
    this.batchQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

// Singleton registry
export const dtuHooks = new DTUHookRegistry();

// ============================================================================
// Instrument DTU Hooks — Capture synth preset changes
// ============================================================================

export function emitInstrumentDTU(
  preset: SynthPreset,
  action: 'create' | 'update' = 'create',
  parentIds?: string[]
): void {
  const event: DTUEvent = {
    type: 'instrument',
    action,
    timestamp: Date.now(),
    data: {
      synthType: preset.type,
      preset: { ...preset },
      category: preset.category,
      timbreTags: preset.tags || [],
      oscillatorCount: preset.oscillators.length,
      filterType: preset.filter?.type,
      hasLFO: (preset.lfo?.length ?? 0) > 0,
    } satisfies Record<string, unknown>,
    parentIds,
    tags: ['instrument', preset.type, preset.category, ...preset.tags],
    meta: {
      presetId: preset.id,
      presetName: preset.name,
      polyphony: preset.polyphony,
    },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Effect Chain DTU Hooks — Capture effect chain configurations
// ============================================================================

export function emitEffectChainDTU(
  effects: EffectInstance[],
  context: 'insert' | 'send' | 'master',
  trackName?: string,
  parentIds?: string[]
): void {
  const enabledEffects = effects.filter(e => e.enabled);
  if (enabledEffects.length === 0) return;

  const event: DTUEvent = {
    type: 'effect',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'effectChain',
      chain: enabledEffects.map(e => ({
        type: e.type,
        name: e.name,
        enabled: e.enabled,
        wet: e.wet,
        params: { ...e.params },
      })),
      context,
      trackName,
      effectTypes: enabledEffects.map(e => e.type),
      effectCount: enabledEffects.length,
    },
    parentIds,
    tags: ['effect', context, ...enabledEffects.map(e => e.type)],
    meta: { context, trackName },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Process DTU Hooks — Capture mixing/mastering/arrangement decisions
// ============================================================================

export function emitMixingProcessDTU(
  tracks: DAWTrack[],
  description: string,
  genre?: string,
  parentIds?: string[]
): void {
  const event: DTUEvent = {
    type: 'process',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'mixChain',
      trackCount: tracks.length,
      tracks: tracks.map(t => ({
        name: t.name,
        type: t.type,
        volume: t.volume,
        pan: t.pan,
        mute: t.mute,
        solo: t.solo,
        effectCount: t.effectChain.length,
        effects: t.effectChain.filter(e => e.enabled).map(e => e.type),
      })),
      description,
      genre,
    },
    parentIds,
    tags: ['process', 'mix', ...(genre ? [genre] : [])],
    meta: { description, genre },
  };
  dtuHooks.emit(event);
}

export function emitMasteringProcessDTU(
  chain: MasteringChain,
  analysis: { integratedLUFS?: number; truePeak?: number; dynamicRange?: number } | null,
  parentIds?: string[]
): void {
  const event: DTUEvent = {
    type: 'process',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'masterChain',
      chain: {
        eq: chain.eq ? { type: chain.eq.type, params: chain.eq.params } : null,
        compressor: chain.multibandCompressor ? { type: chain.multibandCompressor.type, params: chain.multibandCompressor.params } : null,
        widener: chain.stereoWidener ? { type: chain.stereoWidener.type, params: chain.stereoWidener.params } : null,
        limiter: chain.limiter ? { type: chain.limiter.type, params: chain.limiter.params } : null,
      },
      loudnessTarget: chain.loudnessTarget,
      analysis,
    },
    parentIds,
    tags: ['process', 'mastering'],
    meta: { loudnessTarget: chain.loudnessTarget },
  };
  dtuHooks.emit(event);
}

export function emitArrangementPatternDTU(
  sections: Array<{ name: string; startBar: number; endBar: number }>,
  bpm: number,
  key: string,
  genre?: string,
  parentIds?: string[]
): void {
  const event: DTUEvent = {
    type: 'process',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'arrangementPattern',
      sections,
      bpm,
      key,
      genre,
      sectionNames: sections.map(s => s.name),
      totalBars: sections.reduce((max, s) => Math.max(max, s.endBar), 0),
    },
    parentIds,
    tags: ['process', 'arrangement', ...(genre ? [genre] : [])],
    meta: { bpm, key, genre },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Audio DTU Hooks — Capture audio recordings and samples
// ============================================================================

export function emitAudioDTU(
  audioData: {
    bufferId: string;
    name: string;
    duration: number;
    sampleRate: number;
    bpm?: number;
    key?: string;
    spectralProfile?: SpectralProfile;
  },
  action: 'create' | 'update' = 'create',
  parentIds?: string[]
): void {
  const event: DTUEvent = {
    type: 'audio',
    action,
    timestamp: Date.now(),
    data: {
      audioBufferId: audioData.bufferId,
      name: audioData.name,
      duration: audioData.duration,
      sampleRate: audioData.sampleRate,
      bpm: audioData.bpm,
      key: audioData.key,
      spectralProfile: audioData.spectralProfile,
      timbreTags: inferTimbreTags(audioData.spectralProfile),
    },
    parentIds,
    tags: [
      'audio',
      ...(audioData.bpm ? [`${audioData.bpm}bpm`] : []),
      ...(audioData.key ? [audioData.key] : []),
      ...inferTimbreTags(audioData.spectralProfile),
    ],
    meta: {
      bufferId: audioData.bufferId,
      duration: audioData.duration,
    },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Pattern DTU Hooks — Capture drum/MIDI patterns
// ============================================================================

export function emitPatternDTU(
  pattern: DrumPattern,
  bpm: number,
  genre: string,
  parentIds?: string[]
): void {
  const activeStepCount = pattern.tracks.reduce(
    (sum, t) => sum + t.steps.filter(s => s.active).length,
    0
  );

  const event: DTUEvent = {
    type: 'pattern',
    action: 'create',
    timestamp: Date.now(),
    data: {
      pattern: { ...pattern },
      bpm,
      genre,
      steps: pattern.steps,
      trackCount: pattern.tracks.length,
      activeStepCount,
      density: activeStepCount / (pattern.steps * pattern.tracks.length),
    },
    parentIds,
    tags: ['pattern', 'drums', genre, `${bpm}bpm`],
    meta: { bpm, genre, density: activeStepCount / (pattern.steps * pattern.tracks.length) },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Session DTU Hooks — Capture full project state (git commits for music)
// ============================================================================

export function emitSessionDTU(
  project: DAWProject,
  changeDescription: string,
  parentSessionId?: string
): void {
  const event: DTUEvent = {
    type: 'session',
    action: 'snapshot',
    timestamp: Date.now(),
    data: {
      projectId: project.id,
      projectTitle: project.title,
      projectState: {
        bpm: project.bpm,
        key: project.key,
        scale: project.scale,
        timeSignature: project.timeSignature,
        genre: project.genre,
        trackCount: project.tracks.length,
        tracks: project.tracks.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          volume: t.volume,
          pan: t.pan,
          mute: t.mute,
          solo: t.solo,
          clipCount: t.clips.length,
          effectCount: t.effectChain.length,
        })),
        totalClips: project.tracks.reduce((sum, t) => sum + t.clips.length, 0),
        arrangementLength: project.arrangement.lengthBars,
        sectionCount: project.arrangement.sections.length,
      },
      changeDescription,
      parentSessionId,
      snapshotAt: Date.now(),
    },
    parentIds: parentSessionId ? [parentSessionId] : undefined,
    tags: [
      'session',
      project.key,
      `${project.bpm}bpm`,
      ...(project.genre ? [project.genre] : []),
    ],
    meta: {
      projectId: project.id,
      changeDescription,
      trackCount: project.tracks.length,
    },
  };
  dtuHooks.emit(event);
}

// ============================================================================
// Track Operation Hooks — Wrap common track operations
// ============================================================================

export function emitTrackCreated(track: DAWTrack, projectId: string): void {
  dtuHooks.emit({
    type: 'process',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'trackCreated',
      trackId: track.id,
      trackName: track.name,
      trackType: track.type,
      instrumentId: track.instrumentId,
      projectId,
    },
    tags: ['track', 'create', track.type],
    meta: { projectId, trackId: track.id },
  });
}

export function emitClipCreated(clip: DAWClip, trackId: string, projectId: string): void {
  dtuHooks.emit({
    type: clip.type === 'audio' ? 'audio' : 'pattern',
    action: 'create',
    timestamp: Date.now(),
    data: {
      clipId: clip.id,
      clipName: clip.name,
      clipType: clip.type,
      trackId,
      startBeat: clip.startBeat,
      lengthBeats: clip.lengthBeats,
      noteCount: clip.midiNotes?.length ?? 0,
      projectId,
    },
    tags: ['clip', clip.type],
    meta: { projectId, trackId, clipId: clip.id },
  });
}

export function emitAutomationDrawn(
  lane: { parameterPath: string; parameterName: string },
  pointCount: number,
  trackId: string,
  projectId: string
): void {
  dtuHooks.emit({
    type: 'process',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'automationCurve',
      parameterPath: lane.parameterPath,
      parameterName: lane.parameterName,
      pointCount,
      trackId,
      projectId,
    },
    tags: ['automation', lane.parameterName],
    meta: { projectId, trackId },
  });
}

export function emitExportDTU(
  settings: ExportSettings,
  projectId: string,
  projectTitle: string
): void {
  dtuHooks.emit({
    type: 'audio',
    action: 'create',
    timestamp: Date.now(),
    data: {
      processType: 'export',
      format: settings.format,
      sampleRate: settings.sampleRate,
      bitDepth: settings.bitDepth,
      stems: settings.stems,
      normalize: settings.normalize,
      projectId,
      projectTitle,
    },
    tags: ['export', settings.format, ...(settings.stems ? ['stems'] : [])],
    meta: { projectId, format: settings.format },
  });
}

// ============================================================================
// Inference Helpers
// ============================================================================

function inferTimbreTags(spectralProfile?: SpectralProfile | null): string[] {
  if (!spectralProfile) return [];
  const tags: string[] = [];
  if (spectralProfile.brightness > 0.7) tags.push('bright');
  if (spectralProfile.brightness < 0.3) tags.push('dark');
  if (spectralProfile.warmth > 0.7) tags.push('warm');
  if (spectralProfile.warmth < 0.3) tags.push('cold');
  if (spectralProfile.centroid > 4000) tags.push('high');
  if (spectralProfile.centroid < 500) tags.push('low');
  if (spectralProfile.centroid >= 500 && spectralProfile.centroid <= 4000) tags.push('mid');
  return tags;
}

// ============================================================================
// Convenience: Wrap an engine action with DTU capture
// ============================================================================

export function withDTUCapture<T extends (...args: unknown[]) => unknown>(
  fn: T,
  emitter: (...args: Parameters<T>) => void
): T {
  return ((...args: Parameters<T>) => {
    const result = fn(...args);
    try { emitter(...args); } catch (e) { console.warn('[DTU Hook] Capture error:', e); }
    return result;
  }) as T;
}
