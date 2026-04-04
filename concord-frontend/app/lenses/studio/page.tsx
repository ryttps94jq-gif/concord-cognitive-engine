'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Plus,
  Sliders,
  Mic2,
  Piano,
  Waves,
  X,
  Headphones,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Brain,
  BookOpen,
  Target,
  Radio,
  BarChart3,
  PlayCircle,
  StopCircle,
  Upload,
} from 'lucide-react';

import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

// DAW engine
import {
  TransportEngine,
  SynthEngine,
  DrumMachineEngine,
  MixerEngine,
  AudioRecorder,
  DEFAULT_SYNTH_PRESETS,
  DEFAULT_EFFECT_PRESETS,
  resumeAudioContext,
  getAudioContext,
} from '@/lib/daw/engine';
import type {
  StudioViewType,
  TransportState,
  DAWTrack,
  DAWProject,
  MIDINote,
  EffectInstance,
  SynthPreset,
  DrumPattern,
  DrumPad,
  AutomationPoint,
  MasteringChain,
  MasteringAnalysis,
  ExportSettings,
  SnapMode,
  AudioBuffer as DAWAudioBuffer,
} from '@/lib/daw/types';
import {
  dtuHooks,
  emitSessionDTU,
  emitInstrumentDTU,
  emitEffectChainDTU,
  emitTrackCreated,
  emitPatternDTU,
  type DTUEvent,
} from '@/lib/daw/dtu-hooks';

// Studio UI components
import { TransportBar } from '@/components/studio/TransportBar';
import { ArrangementView } from '@/components/studio/ArrangementView';
import { PianoRoll } from '@/components/studio/PianoRoll';
import { MixerView } from '@/components/studio/MixerView';
import { DrumMachine } from '@/components/studio/DrumMachine';
import { SynthPanel } from '@/components/studio/SynthPanel';
import { EffectsPanel } from '@/components/studio/EffectsPanel';
import { AudioEditor } from '@/components/studio/AudioEditor';
import { AutomationView } from '@/components/studio/AutomationView';
import { MasteringPanel } from '@/components/studio/MasteringPanel';
import { Soundboard } from '@/components/studio/Soundboard';

// ============================================================================
// Constants & Defaults
// ============================================================================

const TRACK_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#3b82f6', '#f43f5e'];

function createDefaultProject(title: string, bpm: number, key: string, genre: string | null): DAWProject {
  return {
    id: `proj_${Date.now()}`,
    title,
    bpm,
    key,
    scale: 'major',
    timeSignature: [4, 4],
    genre,
    tracks: [],
    masterBus: {
      volume: 0,
      inserts: [
        { id: 'master-eq', type: 'eq3', name: 'Master EQ', enabled: true, wet: 1, params: { lowGain: 0, midGain: 0, highGain: 0 } },
        { id: 'master-comp', type: 'compressor', name: 'Master Comp', enabled: true, wet: 1, params: { threshold: -12, ratio: 2, attack: 0.01, release: 0.1 } },
        { id: 'master-lim', type: 'limiter', name: 'Master Limiter', enabled: true, wet: 1, params: { ceiling: -1, release: 0.1 } },
      ],
      metering: { peakL: -60, peakR: -60, rmsL: -60, rmsR: -60, lufs: -14 },
    },
    masteringChain: {
      eq: { id: 'mc-eq', type: 'eq3', name: 'EQ', enabled: true, wet: 1, params: { lowGain: 0, midGain: 0, highGain: 0 } },
      multibandCompressor: { id: 'mc-comp', type: 'multibandCompressor', name: 'MB Comp', enabled: true, wet: 1, params: { threshold: -18, ratio: 3, attack: 0.01, release: 0.15 } },
      stereoWidener: { id: 'mc-stereo', type: 'stereoWidener', name: 'Stereo', enabled: true, wet: 1, params: { width: 1 } },
      limiter: { id: 'mc-lim', type: 'limiter', name: 'Limiter', enabled: true, wet: 1, params: { ceiling: -1, release: 0.1 } },
      loudnessTarget: -14,
      enabled: true,
    },
    arrangement: { lengthBars: 64, sections: [], markers: [], tempo: [] },
    transport: { bpm, timeSignature: [4, 4], swing: 0, loopEnabled: false, loopStart: 0, loopEnd: 16, metronome: false, preRoll: 0 },
    audioBuffers: {},
    synthPresets: {},
    drumPatterns: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sessionDTUIds: [],
  };
}

function createDefaultTrack(name: string, type: 'audio' | 'midi', index: number, instrumentId?: string): DAWTrack {
  return {
    id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    type,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    volume: 0,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    frozen: false,
    height: 56,
    instrumentId: instrumentId || null,
    effectChain: [],
    sendLevels: {},
    clips: [],
    automationLanes: [],
    inputSource: null,
    outputTarget: 'master',
  };
}

function createDefaultDrumPattern(): DrumPattern {
  const padNames = ['Kick', 'Snare', 'Hi-Hat C', 'Hi-Hat O', 'Clap', 'Tom H', 'Tom L', 'Perc'];
  return {
    id: `pat_${Date.now()}`,
    name: 'New Pattern',
    steps: 16,
    resolution: 0.25,
    tracks: padNames.map((_, i) => ({
      padId: `pad_${i}`,
      steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 100, probability: 1, flam: false })),
    })),
  };
}

function createDefaultDrumPads(): DrumPad[] {
  const names = ['Kick', 'Snare', 'Hi-Hat C', 'Hi-Hat O', 'Clap', 'Tom High', 'Tom Low', 'Perc', 'Crash', 'Ride', 'Shaker', 'Cowbell', 'Rim', 'Snap', 'Click', 'FX'];
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#fb923c', '#84cc16', '#2dd4bf', '#38bdf8', '#c084fc'];
  return names.map((name, i) => ({
    id: `pad_${i}`,
    name,
    audioBufferId: null,
    synthPresetId: null,
    volume: 0,
    pan: 0,
    pitch: 0,
    mute: false,
    solo: false,
    chokeGroup: null,
    effects: [],
    color: colors[i],
  }));
}

// ============================================================================
// Main Studio Page Component
// ============================================================================

export default function StudioLensPage() {
  useLensNav('studio');
  const { latestData: realtimeData, alerts: _realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('studio');
  const { isLoading: _isLoading, isError: _isError, error: _error, refetch: _refetch, create: createLensItem, update: updateLensItem } = useLensData('studio', 'project', { noSeed: true });
  const queryClient = useQueryClient();

  // ---- State ----
  const [studioView, setStudioView] = useState<StudioViewType>('arrange');
  const [project, setProject] = useState<DAWProject | null>(null);
  const [transportState, setTransportState] = useState<TransportState>('stopped');
  const [currentBeat, setCurrentBeat] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SnapMode>('1/4');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showFeatures, setShowFeatures] = useState(true);

  // New project form
  const [newTitle, setNewTitle] = useState('');
  const [newBpm, setNewBpm] = useState('120');
  const [newKey, setNewKey] = useState('C');
  const [newGenre, setNewGenre] = useState('');

  // Audio engines (refs to avoid re-renders)
  const transportRef = useRef<TransportEngine | null>(null);
  const mixerRef = useRef<MixerEngine | null>(null);
  const drumEngineRef = useRef<DrumMachineEngine | null>(null);
  const synthEnginesRef = useRef<Map<string, SynthEngine>>(new Map());
  const recorderRef = useRef<AudioRecorder | null>(null);

  // DTU events
  const [dtuEvents, setDtuEvents] = useState<DTUEvent[]>([]);

  // Drum machine state
  const [drumPattern, setDrumPattern] = useState<DrumPattern>(createDefaultDrumPattern);
  const [drumPads, setDrumPads] = useState<DrumPad[]>(createDefaultDrumPads);
  const [drumStep, setDrumStep] = useState(0);

  // Synth state
  const [activeSynthPreset, setActiveSynthPreset] = useState<SynthPreset | null>(null);

  // Audio editor
  const [audioEditorBuffer, _setAudioEditorBuffer] = useState<DAWAudioBuffer | null>(null);
  const [audioSelection, setAudioSelection] = useState<{ start: number; end: number } | null>(null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Live recording state (mic capture)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mastering
  const [masteringAnalysis, setMasteringAnalysis] = useState<MasteringAnalysis | null>(null);
  const [spectrumData, setSpectrumData] = useState<Uint8Array | null>(null);

  // ---- Initialize engines ----
  useEffect(() => {
    transportRef.current = new TransportEngine();
    mixerRef.current = new MixerEngine();
    drumEngineRef.current = new DrumMachineEngine();
    recorderRef.current = new AudioRecorder();

    const unsub = transportRef.current.on('beatChange', (data) => {
      setCurrentBeat(data.beat as number);
      // Update drum step for sequencer
      const beat = data.beat as number;
      const step = Math.floor((beat % 4) * 4) % (drumPattern?.steps || 16);
      setDrumStep(step);
    });

    const unsubDTU = dtuHooks.subscribe((event) => {
      setDtuEvents(prev => [...prev.slice(-200), event]);
    });

    // Spectrum analyzer update
    const spectrumInterval = setInterval(() => {
      if (mixerRef.current && transportState === 'playing') {
        setSpectrumData(mixerRef.current.getMasterAnalyserData());
      }
    }, 50);

    const synthEngines = synthEnginesRef.current;
    return () => {
      unsub();
      unsubDTU();
      clearInterval(spectrumInterval);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      transportRef.current?.dispose();
      mixerRef.current?.dispose();
      drumEngineRef.current?.dispose();
      recorderRef.current?.dispose();
      synthEngines.forEach(s => s.dispose());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Project operations ----
  const selectedTrack = useMemo(
    () => project?.tracks.find(t => t.id === selectedTrackId) ?? null,
    [project, selectedTrackId]
  );

  const selectedClip = useMemo(() => {
    if (!project || !selectedClipId) return null;
    for (const track of project.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [project, selectedClipId]);

  const updateProject = useCallback((updater: (p: DAWProject) => DAWProject) => {
    setProject(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      updated.updatedAt = Date.now();
      return updated;
    });
  }, []);

  const handleCreateProject = useCallback(() => {
    const proj = createDefaultProject(
      newTitle || 'Untitled Project',
      parseInt(newBpm, 10) || 120,
      newKey,
      newGenre || null
    );
    setProject(proj);
    setShowNewProject(false);
    setNewTitle('');
    transportRef.current?.updateConfig({ bpm: proj.bpm, timeSignature: proj.timeSignature });
    emitSessionDTU(proj, 'Project created');
    createLensItem({
      title: proj.title,
      data: proj as unknown as Record<string, unknown>,
      meta: { status: 'active', tags: [proj.key, `${proj.bpm}bpm`, proj.genre].filter(Boolean) as string[] },
    }).catch(err => console.error('Failed to persist project:', err instanceof Error ? err.message : err));
  }, [newTitle, newBpm, newKey, newGenre, createLensItem]);

  // ---- Transport controls ----
  const handlePlay = useCallback(() => {
    resumeAudioContext();
    transportRef.current?.play();
    setTransportState('playing');
  }, []);

  const handlePause = useCallback(() => {
    transportRef.current?.pause();
    setTransportState('paused');
  }, []);

  const handleStop = useCallback(() => {
    // Stop mic recording if active
    if (isRecording) {
      recorderRef.current?.stopRecording();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
    }
    transportRef.current?.stop();
    setTransportState('stopped');
    setCurrentBeat(0);
  }, [isRecording]);

  const handleRecord = useCallback(async () => {
    resumeAudioContext();
    // Request mic access and start MediaRecorder via the AudioRecorder engine
    const recorder = recorderRef.current;
    if (!recorder) return;

    const hasAccess = await recorder.requestAccess();
    if (!hasAccess) {
      console.warn('[Studio] Microphone access denied');
      return;
    }

    // Clear previous recording
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    setSaveStatus('idle');

    const started = recorder.startRecording((blob: Blob) => {
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    });

    if (started) {
      transportRef.current?.record();
      setTransportState('recording');
      setIsRecording(true);
      setRecordingTimer(0);
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
      }, 1000);
    }
  }, [recordedUrl]);

  const handleSeek = useCallback((beat: number) => {
    transportRef.current?.seekTo(beat);
    setCurrentBeat(beat);
  }, []);

  // ---- Playback of recorded audio ----
  const handlePlayback = useCallback(() => {
    if (!recordedUrl) return;
    // Stop any existing playback
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }
    const audio = new Audio(recordedUrl);
    playbackAudioRef.current = audio;
    setIsPlayingBack(true);
    audio.onended = () => {
      setIsPlayingBack(false);
      playbackAudioRef.current = null;
    };
    audio.play().catch(() => setIsPlayingBack(false));
  }, [recordedUrl]);

  const handleStopPlayback = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      playbackAudioRef.current = null;
    }
    setIsPlayingBack(false);
  }, []);

  // ---- Save recording to backend ----
  const handleSaveRecording = useCallback(async () => {
    if (!recordedBlob || !project) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      // Convert recorded blob to base64 for upload
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const base64Data = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Upload with actual audio data via the /api/media/upload endpoint
      const response = await api.post('/api/media/upload', {
        title: `${project.title} - Recording ${new Date().toLocaleTimeString()}`,
        description: `Studio recording from project "${project.title}" (${project.bpm} BPM, key ${project.key})`,
        mediaType: 'audio',
        mimeType: recordedBlob.type || 'audio/webm',
        fileSize: recordedBlob.size,
        originalFilename: `studio-recording-${Date.now()}.webm`,
        tags: ['studio', 'recording', project.key, `${project.bpm}bpm`].filter(Boolean),
        privacy: 'private',
        data: base64Data,
      });

      if (response.data?.ok || response.status === 200 || response.status === 201) {
        setSaveStatus('success');
        // Also create a lens item for the track list
        try {
          await createLensItem({
            title: `Recording - ${new Date().toLocaleTimeString()}`,
            data: {
              type: 'recording',
              projectId: project.id,
              bpm: project.bpm,
              key: project.key,
              duration: recordingTimer,
              mimeType: recordedBlob.type || 'audio/webm',
              size: recordedBlob.size,
              createdAt: new Date().toISOString(),
            },
            meta: { tags: ['studio', 'recording'], status: 'active' },
          });
        } catch {
          // Lens item creation is secondary - upload already succeeded
        }
        // Invalidate queries so the track list updates without page refresh
        queryClient.invalidateQueries({ queryKey: ['lens', 'studio'] });
        // Add an audio track to the project for the recording
        updateProject(p => {
          const track = createDefaultTrack(
            `Rec ${new Date().toLocaleTimeString()}`,
            'audio',
            p.tracks.length,
          );
          emitTrackCreated(track, p.id);
          return { ...p, tracks: [...p.tracks, track] };
        });
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('[Studio] Save recording failed:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [recordedBlob, project, recordingTimer, createLensItem, queryClient, updateProject]);

  // ---- Beat pad with OscillatorNode frequencies ----
  const BEAT_PAD_FREQUENCIES = useMemo(() => [
    { note: 'C4', freq: 261.63 },
    { note: 'D4', freq: 293.66 },
    { note: 'E4', freq: 329.63 },
    { note: 'F4', freq: 349.23 },
    { note: 'G4', freq: 392.00 },
    { note: 'A4', freq: 440.00 },
    { note: 'B4', freq: 493.88 },
    { note: 'C5', freq: 523.25 },
  ], []);

  const handleBeatPadTrigger = useCallback((index: number) => {
    if (index < 0 || index >= BEAT_PAD_FREQUENCIES.length) return;
    const { freq } = BEAT_PAD_FREQUENCIES[index];
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gainNode).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio context may not be ready
    }
  }, [BEAT_PAD_FREQUENCIES]);

  const handleBpmChange = useCallback((bpm: number) => {
    updateProject(p => ({ ...p, bpm }));
    transportRef.current?.updateConfig({ bpm });
  }, [updateProject]);

  // ---- Track operations ----
  const handleAddTrack = useCallback((type: 'audio' | 'midi' = 'midi', instrumentId?: string) => {
    updateProject(p => {
      const name = type === 'audio' ? `Audio ${p.tracks.length + 1}` : `Track ${p.tracks.length + 1}`;
      const track = createDefaultTrack(name, type, p.tracks.length, instrumentId);
      emitTrackCreated(track, p.id);
      return { ...p, tracks: [...p.tracks, track] };
    });
    setShowAddTrack(false);
  }, [updateProject]);

  const handleUpdateTrack = useCallback((trackId: string, data: Partial<DAWTrack>) => {
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === trackId ? { ...t, ...data } : t),
    }));
  }, [updateProject]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    updateProject(p => ({ ...p, tracks: p.tracks.filter(t => t.id !== trackId) }));
    if (selectedTrackId === trackId) setSelectedTrackId(null);
  }, [updateProject, selectedTrackId]);

  // ---- MIDI / Piano Roll ----
  const handleAddNote = useCallback((note: MIDINote) => {
    if (!selectedClipId) return;
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id === selectedClipId
            ? { ...c, midiNotes: [...(c.midiNotes || []), note] }
            : c
        ),
      })),
    }));
  }, [updateProject, selectedClipId]);

  const handleUpdateNote = useCallback((noteId: string, data: Partial<MIDINote>) => {
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => ({
          ...c,
          midiNotes: c.midiNotes?.map(n => n.id === noteId ? { ...n, ...data } : n),
        })),
      })),
    }));
  }, [updateProject]);

  const handleDeleteNote = useCallback((noteId: string) => {
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => ({
          ...c,
          midiNotes: c.midiNotes?.filter(n => n.id !== noteId),
        })),
      })),
    }));
  }, [updateProject]);

  // ---- Effect chain operations ----
  const handleUpdateEffects = useCallback((trackId: string, effects: EffectInstance[]) => {
    handleUpdateTrack(trackId, { effectChain: effects });
  }, [handleUpdateTrack]);

  // ---- Drum machine ----
  const handleToggleDrumStep = useCallback((padId: string, stepIndex: number) => {
    setDrumPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.padId === padId
          ? { ...t, steps: t.steps.map((s, i) => i === stepIndex ? { ...s, active: !s.active } : s) }
          : t
      ),
    }));
  }, []);

  const handleUpdateDrumStepVelocity = useCallback((padId: string, stepIndex: number, velocity: number) => {
    setDrumPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.padId === padId
          ? { ...t, steps: t.steps.map((s, i) => i === stepIndex ? { ...s, velocity } : s) }
          : t
      ),
    }));
  }, []);

  const handleTriggerPad = useCallback((padId: string, velocity?: number) => {
    drumEngineRef.current?.triggerPad(padId, velocity);
  }, []);

  const handleRandomizeDrums = useCallback(() => {
    setDrumPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        steps: t.steps.map(() => ({
          active: Math.random() > 0.65,
          velocity: Math.floor(60 + Math.random() * 67),
          probability: 1,
          flam: false,
        })),
      })),
    }));
  }, []);

  const handleClearDrums = useCallback(() => {
    setDrumPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        steps: t.steps.map(() => ({ active: false, velocity: 100, probability: 1, flam: false })),
      })),
    }));
  }, []);

  // ---- Automation ----
  const handleAddAutomationLane = useCallback((trackId: string, parameterPath: string, parameterName: string) => {
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              automationLanes: [...t.automationLanes, {
                id: `lane_${Date.now()}`,
                parameterPath,
                parameterName,
                points: [],
                visible: true,
                color: ['#00fff7', '#a855f7', '#ec4899', '#22c55e', '#f59e0b'][t.automationLanes.length % 5],
                min: 0,
                max: 1,
              }],
            }
          : t
      ),
    }));
  }, [updateProject]);

  const handleAddAutomationPoint = useCallback((trackId: string, laneId: string, point: AutomationPoint) => {
    updateProject(p => ({
      ...p,
      tracks: p.tracks.map(t =>
        t.id === trackId
          ? { ...t, automationLanes: t.automationLanes.map(l => l.id === laneId ? { ...l, points: [...l.points, point] } : l) }
          : t
      ),
    }));
  }, [updateProject]);

  // ---- Mastering ----
  const handleUpdateMasteringChain = useCallback((chain: MasteringChain) => {
    updateProject(p => ({ ...p, masteringChain: chain }));
  }, [updateProject]);

  const handleAnalyze = useCallback(() => {
    // Placeholder — real implementation needs Web Audio AnalyserNode
    setTimeout(() => {
      setMasteringAnalysis({
        integratedLUFS: 0,
        shortTermLUFS: 0,
        momentaryLUFS: 0,
        truePeak: 0,
        dynamicRange: 0,
        stereoCorrelation: 0,
        spectralBalance: Array.from({ length: 8 }, () => 0),
      });
    }, 500);
  }, []);

  const handleExport = useCallback((settings: ExportSettings) => {
    if (!project) return;
    const exportData = {
      title: project.title,
      bpm: project.bpm,
      key: project.key,
      scale: project.scale,
      genre: project.genre,
      tracks: project.tracks,
      masterBus: project.masterBus,
      masteringChain: project.masteringChain,
      arrangement: project.arrangement,
      format: settings.format,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${settings.format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  // ---- Save / Session DTU ----
  const handleSave = useCallback(() => {
    if (!project) return;
    emitSessionDTU(project, 'Manual save');
    updateLensItem(project.id, {
      title: project.title,
      data: project as unknown as Record<string, unknown>,
    }).catch(err => console.error('Failed to save project:', err instanceof Error ? err.message : err));
  }, [project, updateLensItem]);

  // ---- Synth operations ----
  const handleSelectSynthPreset = useCallback((preset: SynthPreset) => {
    setActiveSynthPreset(preset);
  }, []);

  const handleUpdateSynthPreset = useCallback((preset: SynthPreset) => {
    setActiveSynthPreset(preset);
  }, []);

  const handleSaveSynthPreset = useCallback((preset: SynthPreset) => {
    emitInstrumentDTU(preset, 'create');
  }, []);

  const handleAddSynthToTrack = useCallback((preset: SynthPreset) => {
    handleAddTrack('midi', preset.id);
    emitInstrumentDTU(preset, 'create');
  }, [handleAddTrack]);

  // ---- Render: No project ----
  if (!project) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-violet-950/20 via-black to-black" data-lens-theme="studio">
        <div className="flex items-center justify-between border-b border-violet-500/10 px-6 py-3">
          <div className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-neon-cyan" />
            <h1 className="text-xl font-bold">Studio</h1>
            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">DAW</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
            <DTUExportButton domain="studio" data={realtimeData || {}} compact />
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg text-sm hover:bg-neon-cyan/30"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-lg">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center">
              <Headphones className="w-10 h-10 text-neon-cyan" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Concord Studio</h2>
            <p className="text-gray-400 text-sm mb-6">
              A full DAW in your browser. Every sound, synth preset, effect chain, and arrangement becomes a DTU —
              citeable, consolidatable, compounding knowledge atoms.
            </p>
            <div className="grid grid-cols-3 gap-3 text-left mb-8">
              {[
                { icon: Waves, label: 'Synthesizers', desc: 'Subtractive, FM, sampler' },
                { icon: Sliders, label: 'Full Mixer', desc: 'Faders, sends, master' },
                { icon: Piano, label: 'Piano Roll', desc: 'FL Studio-class editing' },
                { icon: Activity, label: 'Automation', desc: 'Draw curves over time' },
                { icon: Zap, label: 'Mastering', desc: 'EQ, comp, limiter, LUFS' },
                { icon: Sparkles, label: 'DTU Engine', desc: 'Every action = knowledge' },
              ].map((f, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <f.icon className="w-5 h-5 text-neon-cyan mb-1" />
                  <p className="text-xs font-medium">{f.label}</p>
                  <p className="text-[10px] text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-8 py-3 bg-neon-cyan text-black rounded-lg font-semibold hover:bg-neon-cyan/80 transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>

        {/* DTU activity ticker */}
        {dtuEvents.length > 0 && (
          <div className="border-t border-white/10 px-4 py-2 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-neon-purple flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <span className="text-[10px] text-gray-500">
                {dtuEvents.length} DTU events captured &middot; Last: {dtuEvents.at(-1)?.type} ({dtuEvents.at(-1)?.action})
              </span>
            </div>
          </div>
        )}

        {/* New Project Modal */}
        <AnimatePresence>
          {showNewProject && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">New Project</h3>
                  <button onClick={() => setShowNewProject(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-cyan/50" placeholder="Project title" />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">BPM</label>
                      <input type="number" value={newBpm} onChange={e => setNewBpm(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Key</label>
                      <select value={newKey} onChange={e => setNewKey(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
                        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k} value={k} className="bg-lattice-surface">{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Genre</label>
                      <input type="text" value={newGenre} onChange={e => setNewGenre(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" placeholder="e.g. electronic" />
                    </div>
                  </div>
                  <button onClick={handleCreateProject} className="w-full py-2.5 bg-neon-cyan text-black rounded-lg font-medium hover:bg-neon-cyan/80">
                    Create Project
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---- Render: Active project ----
  return (
    <div className="lens-studio h-full flex flex-col bg-gradient-to-b from-violet-950/20 via-black to-black" data-lens-theme="studio">
      {/* Transport Bar */}
      <TransportBar
        transportState={transportState}
        bpm={project.bpm}
        currentBeat={currentBeat}
        timeSignature={project.timeSignature}
        projectKey={project.key}
        projectScale={project.scale}
        genre={project.genre}
        loopEnabled={project.transport.loopEnabled}
        metronome={project.transport.metronome}
        activeView={studioView}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecord={handleRecord}
        onBpmChange={handleBpmChange}
        onViewChange={setStudioView}
        onToggleLoop={() => updateProject(p => ({ ...p, transport: { ...p.transport, loopEnabled: !p.transport.loopEnabled } }))}
        onToggleMetronome={() => updateProject(p => ({ ...p, transport: { ...p.transport, metronome: !p.transport.metronome } }))}
        onSave={handleSave}
        onExport={() => handleExport({ format: 'wav', sampleRate: 44100, bitDepth: 24, normalize: true, dithering: true, stems: false, startBeat: 0, endBeat: -1 })}
        onMaster={handleAnalyze}
      />

      {/* Recording Controls & Beat Pads Strip */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/40 px-3 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-400 font-mono font-semibold">REC</span>
              <span className="text-xs text-red-300 font-mono">
                {Math.floor(recordingTimer / 60).toString().padStart(2, '0')}:{(recordingTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Playback controls for recorded audio */}
          {recordedUrl && !isRecording && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">Recorded</span>
              {!isPlayingBack ? (
                <button
                  onClick={handlePlayback}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-green/15 text-neon-green rounded-lg text-xs hover:bg-neon-green/25 transition-colors"
                  title="Play recorded audio"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Play
                </button>
              ) : (
                <button
                  onClick={handleStopPlayback}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/15 text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/25 transition-colors"
                  title="Stop playback"
                >
                  <StopCircle className="w-3.5 h-3.5" /> Stop
                </button>
              )}
              <button
                onClick={handleSaveRecording}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-cyan/15 text-neon-cyan rounded-lg text-xs hover:bg-neon-cyan/25 transition-colors disabled:opacity-50"
                title="Save recording to project"
              >
                <Upload className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              {saveStatus === 'success' && (
                <span className="text-[10px] text-neon-green">Saved to tracks</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[10px] text-red-400">Save failed</span>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Beat Pads */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 mr-1">PADS</span>
            {BEAT_PAD_FREQUENCIES.map((pad, i) => (
              <button
                key={pad.note}
                onMouseDown={() => handleBeatPadTrigger(i)}
                className="w-9 h-9 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-90 active:brightness-125 border border-white/10 hover:border-white/30"
                style={{
                  background: `hsl(${(i * 45) % 360}, 70%, 25%)`,
                  color: `hsl(${(i * 45) % 360}, 80%, 75%)`,
                }}
                title={`${pad.note} (${pad.freq} Hz)`}
              >
                {pad.note}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Primary view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {studioView === 'arrange' && (
            <ArrangementView
              tracks={project.tracks}
              sections={project.arrangement.sections}
              markers={project.arrangement.markers}
              currentBeat={currentBeat}
              bpm={project.bpm}
              lengthBars={project.arrangement.lengthBars}
              timeSignature={project.timeSignature}
              selectedTrackId={selectedTrackId}
              selectedClipId={selectedClipId}
              zoomLevel={zoomLevel}
              snap={snap}
              onSelectTrack={setSelectedTrackId}
              onSelectClip={setSelectedClipId}
              onUpdateTrack={handleUpdateTrack}
              onDeleteTrack={handleDeleteTrack}
              onAddTrack={() => setShowAddTrack(true)}
              onMoveClip={() => {}}
              onResizeClip={() => {}}
              onSeek={handleSeek}
              onZoomChange={setZoomLevel}
              onSnapChange={setSnap}
            />
          )}

          {studioView === 'mixer' && (
            <MixerView
              tracks={project.tracks}
              masterBus={project.masterBus}
              selectedTrackId={selectedTrackId}
              spectrumData={spectrumData}
              onSelectTrack={setSelectedTrackId}
              onUpdateTrack={handleUpdateTrack}
              onToggleEffect={(trackId, effectId) => {
                updateProject(p => ({
                  ...p,
                  tracks: p.tracks.map(t =>
                    t.id === trackId
                      ? { ...t, effectChain: t.effectChain.map(e => e.id === effectId ? { ...e, enabled: !e.enabled } : e) }
                      : t
                  ),
                }));
              }}
              onAddEffect={(trackId) => { setSelectedTrackId(trackId); setStudioView('effects'); }}
              onRemoveEffect={(trackId, effectId) => {
                updateProject(p => ({
                  ...p,
                  tracks: p.tracks.map(t =>
                    t.id === trackId
                      ? { ...t, effectChain: t.effectChain.filter(e => e.id !== effectId) }
                      : t
                  ),
                }));
              }}
              onMasterVolumeChange={(vol) => updateProject(p => ({ ...p, masterBus: { ...p.masterBus, volume: vol } }))}
            />
          )}

          {studioView === 'pianoRoll' && (
            <PianoRoll
              clip={selectedClip}
              notes={selectedClip?.midiNotes || []}
              currentBeat={currentBeat}
              clipStartBeat={selectedClip?.startBeat || 0}
              clipLengthBeats={selectedClip?.lengthBeats || 16}
              snap={snap}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onSnapChange={setSnap}
            />
          )}

          {studioView === 'drumMachine' && (
            <DrumMachine
              pattern={drumPattern}
              pads={drumPads}
              currentStep={drumStep}
              isPlaying={transportState === 'playing'}
              bpm={project.bpm}
              genre={project.genre || 'electronic'}
              onToggleStep={handleToggleDrumStep}
              onUpdateStepVelocity={handleUpdateDrumStepVelocity}
              onUpdatePad={(padId, data) => setDrumPads(prev => prev.map(p => p.id === padId ? { ...p, ...data } : p))}
              onTriggerPad={handleTriggerPad}
              onSetSteps={(steps) => setDrumPattern(prev => ({
                ...prev,
                steps,
                tracks: prev.tracks.map(t => ({
                  ...t,
                  steps: Array.from({ length: steps }, (_, i) => t.steps[i] || { active: false, velocity: 100, probability: 1, flam: false }),
                })),
              }))}
              onClearPattern={handleClearDrums}
              onRandomize={handleRandomizeDrums}
              onSavePattern={() => emitPatternDTU(drumPattern, project.bpm, project.genre || 'electronic')}
            />
          )}

          {studioView === 'sampler' && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sampler</p>
                <p className="text-xs text-gray-600 mt-1">Load audio files, map across keys, set loop points and velocity zones</p>
                <p className="text-xs text-gray-500 mt-2">No audio DTUs loaded yet. Drag audio DTUs from the soundboard to begin.</p>
              </div>
            </div>
          )}

          {studioView === 'audioEditor' && (
            <AudioEditor
              audioBuffer={audioEditorBuffer}
              waveformPeaks={audioEditorBuffer?.waveformPeaks || []}
              currentPosition={audioPosition}
              selection={audioSelection}
              isRecording={isRecording}
              onOperation={() => {}}
              onSeek={setAudioPosition}
              onSelect={(start, end) => setAudioSelection({ start, end })}
              onStartRecording={handleRecord}
              onStopRecording={handleStop}
            />
          )}

          {studioView === 'automation' && (
            <AutomationView
              track={selectedTrack}
              lanes={selectedTrack?.automationLanes || []}
              currentBeat={currentBeat}
              lengthBeats={project.arrangement.lengthBars * project.timeSignature[0]}
              zoomLevel={zoomLevel}
              projectId={project.id}
              onAddLane={handleAddAutomationLane}
              onRemoveLane={(trackId, laneId) => updateProject(p => ({
                ...p,
                tracks: p.tracks.map(t => t.id === trackId ? { ...t, automationLanes: t.automationLanes.filter(l => l.id !== laneId) } : t),
              }))}
              onToggleLane={(trackId, laneId) => updateProject(p => ({
                ...p,
                tracks: p.tracks.map(t => t.id === trackId ? { ...t, automationLanes: t.automationLanes.map(l => l.id === laneId ? { ...l, visible: !l.visible } : l) } : t),
              }))}
              onAddPoint={handleAddAutomationPoint}
              onUpdatePoint={(trackId, laneId, pointId, data) => updateProject(p => ({
                ...p,
                tracks: p.tracks.map(t => t.id === trackId ? {
                  ...t,
                  automationLanes: t.automationLanes.map(l => l.id === laneId ? {
                    ...l,
                    points: l.points.map(pt => pt.id === pointId ? { ...pt, ...data } : pt),
                  } : l),
                } : t),
              }))}
              onDeletePoint={(trackId, laneId, pointId) => updateProject(p => ({
                ...p,
                tracks: p.tracks.map(t => t.id === trackId ? {
                  ...t,
                  automationLanes: t.automationLanes.map(l => l.id === laneId ? {
                    ...l,
                    points: l.points.filter(pt => pt.id !== pointId),
                  } : l),
                } : t),
              }))}
            />
          )}

          {studioView === 'mastering' && (
            <MasteringPanel
              chain={project.masteringChain}
              analysis={masteringAnalysis}
              projectId={project.id}
              projectTitle={project.title}
              spectrumData={spectrumData}
              onUpdateChain={handleUpdateMasteringChain}
              onAnalyze={handleAnalyze}
              onExport={handleExport}
            />
          )}

          {studioView === 'soundboard' && (
            <Soundboard
              dtuEvents={dtuEvents}
              synthPresets={DEFAULT_SYNTH_PRESETS}
              effectPresets={DEFAULT_EFFECT_PRESETS}
              drumPatterns={[drumPattern]}
              currentKey={project.key}
              currentBpm={project.bpm}
              currentGenre={project.genre}
              onLoadPreset={handleSelectSynthPreset}
              onLoadEffectChain={() => {}}
              onLoadPattern={(pattern) => setDrumPattern(pattern)}
              onDragToTrack={() => {}}
            />
          )}

          {studioView === 'instruments' && (
            <SynthPanel
              presets={DEFAULT_SYNTH_PRESETS}
              activePreset={activeSynthPreset}
              onSelectPreset={handleSelectSynthPreset}
              onUpdatePreset={handleUpdateSynthPreset}
              onSavePreset={handleSaveSynthPreset}
              onAddToTrack={handleAddSynthToTrack}
            />
          )}

          {studioView === 'effects' && (
            <EffectsPanel
              track={selectedTrack}
              onUpdateEffects={handleUpdateEffects}
              onSaveChainAsDTU={(effects, name) => emitEffectChainDTU(effects, 'insert', name)}
            />
          )}

          {studioView === 'aiAssistant' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-neon-purple" />
                <h2 className="text-xl font-bold">AI Production Assistant</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: BarChart3, color: 'neon-purple', title: 'Analyze Mix', desc: 'Get mix score and suggestions' },
                  { icon: Music, color: 'neon-cyan', title: 'Suggest Chords', desc: `AI progressions in ${project.key}` },
                  { icon: Activity, color: 'neon-green', title: 'Generate Drums', desc: `${project.bpm} BPM ${project.genre || ''} patterns` },
                  { icon: Waves, color: 'neon-pink', title: 'Sound Design', desc: 'AI synth preset generation' },
                  { icon: Target, color: 'neon-orange', title: 'Auto-Arrange', desc: 'AI arrangement suggestions' },
                  { icon: Radio, color: 'neon-blue', title: 'Reference Match', desc: 'Match reference track tone' },
                ].map((item, i) => (
                  <button key={i} className={`p-4 rounded-xl bg-${item.color}/10 border border-${item.color}/20 text-left hover:bg-${item.color}/20`}>
                    <item.icon className={`w-6 h-6 text-${item.color} mb-2`} />
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {studioView === 'learn' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-neon-green" />
                <h2 className="text-xl font-bold">Learning Center</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: 'Fundamentals', desc: 'Rhythm, melody, harmony', lessons: 12, color: 'neon-cyan' },
                  { title: 'Sound Design', desc: 'Synthesis, sampling, layering', lessons: 10, color: 'neon-purple' },
                  { title: 'Mixing', desc: 'EQ, compression, reverb', lessons: 15, color: 'neon-pink' },
                  { title: 'Arrangement', desc: 'Song structure, transitions', lessons: 8, color: 'neon-green' },
                  { title: 'Mastering', desc: 'Loudness, EQ, limiting', lessons: 6, color: 'neon-cyan' },
                  { title: 'Genre Studies', desc: 'Genre-specific techniques', lessons: 14, color: 'neon-purple' },
                ].map((mod, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer">
                    <h3 className="font-semibold">{mod.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{mod.desc}</p>
                    <p className="text-[10px] text-gray-500 mt-2">{mod.lessons} lessons</p>
                    <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-${mod.color} rounded-full`} style={{ width: '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Track Modal */}
      <AnimatePresence>
        {showAddTrack && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Add Track</h3>
                <button onClick={() => setShowAddTrack(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => handleAddTrack('audio')} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-left hover:border-neon-cyan/30 flex items-center gap-3">
                  <Mic2 className="w-5 h-5 text-neon-cyan" />
                  <div><p className="font-medium text-sm">Audio Track</p><p className="text-xs text-gray-400">Record or import audio</p></div>
                </button>
                {DEFAULT_SYNTH_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => handleAddSynthToTrack(preset)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-left hover:border-neon-purple/30 flex items-center gap-3">
                    <Waves className="w-5 h-5 text-neon-purple" />
                    <div><p className="font-medium text-sm">{preset.name}</p><p className="text-xs text-gray-400 capitalize">{preset.category} &middot; {preset.type}</p></div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DTU Activity Bar */}
      <div className="h-6 bg-black/60 border-t border-white/10 flex items-center px-3 gap-3 flex-shrink-0">
        <Sparkles className="w-3 h-3 text-neon-purple" />
        <span className="text-[9px] text-gray-500">{dtuEvents.length} DTU events</span>
        {dtuEvents.length > 0 && (
          <span className="text-[9px] text-gray-600 truncate">
            Latest: {dtuEvents.at(-1)?.type} &middot; {dtuEvents.at(-1)?.action} &middot; {new Date(dtuEvents.at(-1)?.timestamp || 0).toLocaleTimeString()}
          </span>
        )}
        <div className="flex-1" />
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />

        {/* Lens Features toggle */}
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-white"
        >
          <Layers className="w-3 h-3" />
          {showFeatures ? 'Hide' : 'Features'}
        </button>
      </div>

      {/* Lens Features Panel */}
      {showFeatures && (
        <div className="border-t border-white/10 px-4 pb-3 bg-black/40">
          <LensFeaturePanel lensId="studio" />
        </div>
      )}

      {/* Realtime Data */}
      {realtimeData && (
        <RealtimeDataPanel
      <UniversalActions domain="studio" artifactId={null} compact />
          domain="studio"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
    </div>
  );
}
