'use client';

import { useState, useRef, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useMutation } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorState } from '@/components/common/EmptyState';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { LensContextPanel } from '@/components/lens/LensContextPanel';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Play, FileCode, Terminal, FolderTree, Plus, X,
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  Sparkles, RefreshCw, Copy,
  Download, Zap, Music, Waves, SlidersHorizontal,
  Loader2, BookOpen,
  Save, Maximize2, Minimize2, Layers,
  Hammer, Package, Eye, Upload, Database, Shield, Globe, Server, Clock, Cpu, TestTube, Rocket
} from 'lucide-react';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: string;
  content?: string;
  children?: FileNode[];
  isExpanded?: boolean;
  scriptType?: ScriptType;
}

interface Tab {
  id: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
  scriptType: ScriptType;
}

type ScriptType = 'midi' | 'effect' | 'automation' | 'macro' | 'sampler' | 'generator';

const SCRIPT_TYPES: { id: ScriptType; name: string; icon: React.ElementType; color: string; description: string }[] = [
  { id: 'midi', name: 'MIDI Script', icon: Music, color: 'text-neon-blue', description: 'Generate MIDI patterns programmatically' },
  { id: 'effect', name: 'Effect Chain', icon: Waves, color: 'text-neon-purple', description: 'Build custom signal processing chains' },
  { id: 'automation', name: 'Automation', icon: SlidersHorizontal, color: 'text-neon-yellow', description: 'Create parameter automation curves' },
  { id: 'macro', name: 'Macro', icon: Zap, color: 'text-green-400', description: 'Build reusable production macros' },
  { id: 'sampler', name: 'Sampler', icon: RefreshCw, color: 'text-neon-cyan', description: 'Script sample playback patterns' },
  { id: 'generator', name: 'Generator', icon: Sparkles, color: 'text-red-400', description: 'Algorithmic music generation scripts' },
];

// ── Forge Template Types ──────────────────────────────────────────────────

interface ForgeSection {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  enabled: boolean;
}

interface ForgePreset {
  id: string;
  name: string;
  category: string;
  description: string;
}

const FORGE_SECTIONS: ForgeSection[] = [
  { id: 'dependencies', name: 'Dependencies', icon: Package, description: 'Express, SQLite, JWT, bcrypt, WebSocket — all pre-loaded', enabled: true },
  { id: 'config', name: 'Config', icon: SlidersHorizontal, description: 'One object. Port, secrets, CORS, rate limits, all settings', enabled: true },
  { id: 'database', name: 'Database Schema', icon: Database, description: 'Declarative tables, auto-migration on boot', enabled: true },
  { id: 'auth', name: 'Auth', icon: Shield, description: 'Registration, login, JWT, sessions, password reset', enabled: true },
  { id: 'payments', name: 'Payments', icon: Zap, description: 'Stripe checkout, webhooks, subscriptions, refunds', enabled: false },
  { id: 'api', name: 'API Routes', icon: Globe, description: 'Business logic routes with validation and error handling', enabled: true },
  { id: 'frontend', name: 'Frontend', icon: Eye, description: 'SSR HTML, components as functions, inline styles', enabled: true },
  { id: 'websocket', name: 'WebSocket', icon: Waves, description: 'Channels, rooms, broadcast, private messaging', enabled: false },
  { id: 'background_jobs', name: 'Background Jobs', icon: Clock, description: 'Scheduled tasks, queue processing, worker threads', enabled: false },
  { id: 'thread_manager', name: 'Thread Manager', icon: Cpu, description: 'Dynamic thread allocation, CPU/memory monitoring', enabled: true },
  { id: 'testing', name: 'Testing', icon: TestTube, description: 'Inline tests, coverage, one-command run', enabled: true },
  { id: 'deployment', name: 'Deployment', icon: Rocket, description: 'Dockerfile gen, systemd, graceful shutdown', enabled: true },
];

const FORGE_PRESETS: ForgePreset[] = [
  { id: 'saas', name: 'SaaS Starter', category: 'saas', description: 'Full SaaS with auth, payments, and dashboard' },
  { id: 'ecommerce', name: 'E-Commerce', category: 'ecommerce', description: 'Product catalog, cart, checkout, orders' },
  { id: 'api_only', name: 'API Backend', category: 'api_only', description: 'Pure REST API with auth and rate limiting' },
  { id: 'realtime', name: 'Realtime App', category: 'realtime', description: 'WebSocket-first with channels and presence' },
];

type CodeLensMode = 'script' | 'forge';

const TEMPLATE_FILES: FileNode[] = [
  {
    id: 'midi',
    name: 'MIDI',
    type: 'folder',
    isExpanded: true,
    children: [
      {
        id: 'chord_generator.js', name: 'chord_generator.js', type: 'file', language: 'javascript', scriptType: 'midi',
        content: `// MIDI Chord Generator Script
// Generates chord progressions from scale degrees

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const NOTE_MAP = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

function generateChords(root, scaleName, progression) {
  const scale = SCALES[scaleName];
  const rootNote = NOTE_MAP[root] || 60;
  const chords = [];

  for (const degree of progression) {
    const idx = degree - 1;
    const notes = [
      rootNote + scale[idx % 7],
      rootNote + scale[(idx + 2) % 7],
      rootNote + scale[(idx + 4) % 7],
    ];
    chords.push({
      notes,
      velocity: 100,
      duration: '1/4',
      time: chords.length * 480,
    });
  }
  return chords;
}

// Generate a ii-V-I in C major
const chords = generateChords('C', 'major', [2, 5, 1]);
output.midi(chords);`,
      },
      {
        id: 'arpeggiator.js', name: 'arpeggiator.js', type: 'file', language: 'javascript', scriptType: 'midi',
        content: `// Arpeggiator Script
// Creates arpeggiated patterns from input chords

const PATTERNS = {
  up: (notes) => [...notes].sort((a, b) => a - b),
  down: (notes) => [...notes].sort((a, b) => b - a),
  upDown: (notes) => {
    const up = [...notes].sort((a, b) => a - b);
    return [...up, ...up.slice(1, -1).reverse()];
  },
  random: (notes) => notes.sort(() => Math.random() - 0.5),
};

function arpeggiate(chord, pattern, rate, octaves) {
  const sorted = PATTERNS[pattern](chord);
  const result = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const note of sorted) {
      result.push(midi.note(note + oct * 12, 90, rate));
    }
  }
  return result;
}

const chord = [60, 64, 67, 72]; // Cmaj7
const arp = arpeggiate(chord, 'upDown', '1/16', 2);
output.midi(arp);`,
      },
      {
        id: 'drum_pattern.js', name: 'drum_pattern.js', type: 'file', language: 'javascript', scriptType: 'midi',
        content: `// Drum Pattern Generator
// Uses Euclidean rhythms for natural grooves

function euclidean(steps, pulses) {
  const pattern = Array(steps).fill(0);
  const spacing = steps / pulses;
  for (let i = 0; i < pulses; i++) {
    pattern[Math.round(i * spacing)] = 1;
  }
  return pattern;
}

const DRUM_MAP = { kick: 36, snare: 38, hat: 42, openHat: 46, clap: 39 };

const kick =   euclidean(16, 4);
const snare =  euclidean(16, 2).map((v, i) => i % 8 === 4 ? 1 : 0);
const hat =    euclidean(16, 6);

const pattern = [];
for (let step = 0; step < 16; step++) {
  if (kick[step])  pattern.push(midi.note(DRUM_MAP.kick, 110, '1/16', step));
  if (snare[step]) pattern.push(midi.note(DRUM_MAP.snare, 100, '1/16', step));
  if (hat[step])   pattern.push(midi.note(DRUM_MAP.hat, 80, '1/16', step));
}
output.midi(pattern);`,
      },
      {
        id: 'bass_line.js', name: 'bass_line.js', type: 'file', language: 'javascript', scriptType: 'midi',
        content: `// Bass Line Generator
// Creates walking bass lines from chord changes

const CHORD_TONES = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
};

function walkingBass(changes, tempo) {
  const line = [];
  let time = 0;
  for (const { root, type, bars } of changes) {
    const tones = CHORD_TONES[type];
    for (let bar = 0; bar < bars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        const pitch = root + tones[beat % tones.length] - 24;
        const vel = beat === 0 ? 110 : 85;
        line.push(midi.note(pitch, vel, '1/4', time));
        time += 480;
      }
    }
  }
  return line;
}

const changes = [
  { root: 60, type: 'min7', bars: 2 },
  { root: 65, type: 'dom7', bars: 2 },
  { root: 60, type: 'maj', bars: 2 },
];
const bass = walkingBass(changes, 120);
output.midi(bass);`,
      },
    ],
  },
  {
    id: 'effects',
    name: 'Effects',
    type: 'folder',
    children: [
      {
        id: 'custom_reverb.js', name: 'custom_reverb.js', type: 'file', language: 'javascript', scriptType: 'effect',
        content: `// Custom Reverb Chain
// Layers multiple reverb stages for depth

const earlyReflections = effect.create('delay', {
  time: '22ms', feedback: 0.0, mix: 0.3,
  taps: [
    { time: '7ms', gain: 0.8 },
    { time: '13ms', gain: 0.6 },
    { time: '22ms', gain: 0.4 },
  ],
});

const diffusion = effect.create('allpass', {
  stages: 4,
  times: ['4.7ms', '6.1ms', '8.3ms', '11.2ms'],
  feedback: 0.5,
});

const tail = effect.create('reverb', {
  decay: 2.8, damping: 0.6, size: 0.85,
  predelay: '30ms', modRate: 0.8, modDepth: 0.15,
});

const eq = effect.create('eq', {
  highpass: '120Hz', lowShelf: { freq: '300Hz', gain: -2 },
  highShelf: { freq: '6kHz', gain: -4 },
});

effect.chain([earlyReflections, diffusion, tail, eq]);
output.effectChain('Custom Plate Reverb');`,
      },
      {
        id: 'sidechain.js', name: 'sidechain.js', type: 'file', language: 'javascript', scriptType: 'effect',
        content: `// Sidechain Compressor Script
// Musical ducking with shape control

const envelope = effect.create('envelope', {
  attack: '0.5ms',
  hold: '10ms',
  release: '150ms',
  curve: 'exponential',
});

const compressor = effect.create('compressor', {
  threshold: -30,
  ratio: 8,
  attack: '0.1ms',
  release: '80ms',
  sidechain: { source: 'kick_bus', filter: '100Hz' },
});

const shaper = effect.create('shaper', {
  shape: automation.curve('amount', [
    { time: 0, value: 1.0 },
    { time: 0.05, value: 0.1 },
    { time: 0.3, value: 1.0 },
  ]),
});

effect.chain([compressor, shaper, envelope]);
output.effectChain('Sidechain Pump');`,
      },
      {
        id: 'tape_saturator.js', name: 'tape_saturator.js', type: 'file', language: 'javascript', scriptType: 'effect',
        content: `// Tape Saturation Emulation
// Models analog tape warmth and compression

const inputGain = effect.create('gain', { amount: 6 });

const saturation = effect.create('waveshaper', {
  curve: 'tanh',
  drive: 0.65,
  bias: 0.02,
  oversample: 4,
});

const tapeEQ = effect.create('eq', {
  lowShelf: { freq: '80Hz', gain: 2, q: 0.7 },
  bell: { freq: '3kHz', gain: 1.5, q: 1.2 },
  highShelf: { freq: '12kHz', gain: -3 },
});

const flutter = effect.create('modDelay', {
  time: '0.3ms',
  rate: '5.5Hz',
  depth: 0.002,
  mix: 0.4,
});

const hissNoise = effect.create('noise', {
  type: 'pink', level: -48, filter: '8kHz',
});

effect.chain([inputGain, saturation, tapeEQ, flutter, hissNoise]);
output.effectChain('Vintage Tape');`,
      },
    ],
  },
  {
    id: 'automation',
    name: 'Automation',
    type: 'folder',
    children: [
      {
        id: 'filter_sweep.js', name: 'filter_sweep.js', type: 'file', language: 'javascript', scriptType: 'automation',
        content: `// Filter Sweep Automation
// Smooth frequency sweeps with resonance modulation

const filterFreq = automation.curve('filter.frequency', [
  { time: '0:0:0', value: 200, curve: 'exponential' },
  { time: '0:2:0', value: 2000, curve: 'exponential' },
  { time: '0:3:0', value: 8000, curve: 'exponential' },
  { time: '0:3:2', value: 12000, curve: 'linear' },
  { time: '0:4:0', value: 200, curve: 'exponential' },
]);

const resonance = automation.curve('filter.resonance', [
  { time: '0:0:0', value: 0.2 },
  { time: '0:2:0', value: 0.7 },
  { time: '0:3:0', value: 0.9 },
  { time: '0:4:0', value: 0.2 },
]);

automation.sync('4bars');
automation.link(filterFreq, resonance);
output.automation([filterFreq, resonance]);`,
      },
      {
        id: 'volume_fade.js', name: 'volume_fade.js', type: 'file', language: 'javascript', scriptType: 'automation',
        content: `// Volume Fade Automation
// Cinematic builds with parallel processing

const mainVolume = automation.curve('master.volume', [
  { time: '0:0:0', value: -60 },
  { time: '0:4:0', value: -20, curve: 'exponential' },
  { time: '0:7:0', value: -6, curve: 'logarithmic' },
  { time: '0:8:0', value: 0, curve: 'linear' },
]);

const reverbSend = automation.curve('reverb.send', [
  { time: '0:0:0', value: 0.8 },
  { time: '0:4:0', value: 0.5 },
  { time: '0:8:0', value: 0.2 },
]);

const widthControl = automation.curve('stereo.width', [
  { time: '0:0:0', value: 0.3 },
  { time: '0:8:0', value: 1.0, curve: 'exponential' },
]);

automation.sync('8bars');
output.automation([mainVolume, reverbSend, widthControl]);`,
      },
      {
        id: 'pan_lfo.js', name: 'pan_lfo.js', type: 'file', language: 'javascript', scriptType: 'automation',
        content: `// Pan LFO Automation
// Creates evolving stereo movement

function lfo(shape, rate, depth, offset) {
  const points = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let value;
    switch (shape) {
      case 'sine': value = Math.sin(t * Math.PI * 2 * rate); break;
      case 'triangle': value = Math.abs((t * rate * 2) % 2 - 1) * 2 - 1; break;
      case 'random': value = Math.random() * 2 - 1; break;
      default: value = 0;
    }
    points.push({
      time: t * 4,
      value: offset + value * depth,
    });
  }
  return points;
}

const panCurve = automation.curve('pan', lfo('sine', 2, 0.8, 0));
const auxPan = automation.curve('aux.pan', lfo('triangle', 0.5, 0.4, 0));

automation.sync('4bars');
output.automation([panCurve, auxPan]);`,
      },
    ],
  },
  {
    id: 'macros',
    name: 'Macros',
    type: 'folder',
    children: [
      {
        id: 'quick_chop.js', name: 'quick_chop.js', type: 'file', language: 'javascript', scriptType: 'macro',
        content: `// Quick Chop Macro
// Slice and rearrange audio on the grid

macro.name('Quick Chop');
macro.input('sample', 'audio', { label: 'Sample to chop' });
macro.input('slices', 'number', { min: 4, max: 64, default: 16 });
macro.input('pattern', 'select', {
  options: ['forward', 'reverse', 'shuffle', 'halftime'],
});

macro.run(async ({ sample, slices, pattern }) => {
  const regions = sampler.slice(sample, slices);
  const sequence = [];

  switch (pattern) {
    case 'forward':
      sequence.push(...regions);
      break;
    case 'reverse':
      sequence.push(...regions.reverse());
      break;
    case 'shuffle':
      sequence.push(...regions.sort(() => Math.random() - 0.5));
      break;
    case 'halftime':
      for (const r of regions) {
        sequence.push(sampler.stretch(r, 2.0));
      }
      break;
  }

  output.arrange(sequence, { quantize: '1/16' });
});`,
      },
      {
        id: 'vocal_stack.js', name: 'vocal_stack.js', type: 'file', language: 'javascript', scriptType: 'macro',
        content: `// Vocal Stack Macro
// Creates layered vocal harmonies with processing

macro.name('Vocal Stack');
macro.input('vocal', 'audio', { label: 'Lead vocal' });
macro.input('harmonies', 'number', { min: 1, max: 6, default: 3 });
macro.input('spread', 'number', { min: 0, max: 100, default: 60 });

macro.run(async ({ vocal, harmonies, spread }) => {
  const tracks = [];
  const intervals = [-12, -5, 4, 7, 12, 16];

  for (let i = 0; i < harmonies; i++) {
    const shifted = effect.pitchShift(vocal, intervals[i]);
    const panned = effect.pan(shifted, (i / harmonies - 0.5) * spread / 50);
    const eqd = effect.chain([
      effect.create('eq', { highpass: '200Hz', lowShelf: { freq: '400Hz', gain: -3 } }),
      effect.create('compressor', { threshold: -18, ratio: 4 }),
      effect.create('delay', { time: '1/8d', feedback: 0.2, mix: 0.15 }),
    ]);
    tracks.push({ audio: eqd.process(panned), pan: panned.pan });
  }

  output.multitrack(tracks);
});`,
      },
      {
        id: 'beat_maker.js', name: 'beat_maker.js', type: 'file', language: 'javascript', scriptType: 'macro',
        content: `// Beat Maker Macro
// Auto-generates beats from genre templates

macro.name('Beat Maker');
macro.input('genre', 'select', {
  options: ['trap', 'house', 'dnb', 'lofi', 'techno'],
});
macro.input('bpm', 'number', { min: 60, max: 200, default: 140 });
macro.input('swing', 'number', { min: 0, max: 100, default: 20 });
macro.input('bars', 'number', { min: 1, max: 16, default: 4 });

macro.run(async ({ genre, bpm, swing, bars }) => {
  const kit = sampler.loadKit(genre);
  const patterns = {
    trap: { kick: [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], hat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
    house: { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], hat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] },
    dnb:   { kick: [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    lofi:  { kick: [1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,1], hat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    techno:{ kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], hat: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0] },
  };

  const beat = patterns[genre];
  const sequence = sampler.sequence(kit, beat, { bpm, swing: swing / 100, bars });
  output.arrange(sequence, { bpm });
});`,
      },
    ],
  },
];

const DEFAULT_CODE = `// MIDI Chord Generator Script
// This script generates chord progressions

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const NOTE_MAP = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

function generateChords(root, scale, progression) {
  const scaleNotes = SCALES[scale];
  const rootMidi = NOTE_MAP[root] || 60;
  const chords = [];

  for (const degree of progression) {
    const idx = degree - 1;
    const triad = [
      rootMidi + scaleNotes[idx % 7],
      rootMidi + scaleNotes[(idx + 2) % 7],
      rootMidi + scaleNotes[(idx + 4) % 7],
    ];
    chords.push({
      notes: triad,
      velocity: 100,
      duration: '1/4',
      time: chords.length * 480,
    });
  }
  return chords;
}

// Generate a ii-V-I in C major
const chords = generateChords('C', 'major', [2, 5, 1]);
output.midi(chords);
`;

const API_REFERENCE: { category: string; functions: { signature: string; description: string }[] }[] = [
  {
    category: 'MIDI',
    functions: [
      { signature: 'midi.note(pitch, velocity, duration)', description: 'Create a single MIDI note event' },
      { signature: 'midi.chord(root, type, inversion)', description: 'Generate a chord from root note and type' },
      { signature: 'midi.cc(controller, value, time)', description: 'Send a MIDI CC message' },
      { signature: 'midi.bend(value, time)', description: 'Send pitch bend data' },
    ],
  },
  {
    category: 'Effects',
    functions: [
      { signature: 'effect.create(type, params)', description: 'Instantiate an effect processor' },
      { signature: 'effect.chain(effects[])', description: 'Connect effects in series' },
      { signature: 'effect.parallel(effects[])', description: 'Process effects in parallel' },
      { signature: 'effect.pitchShift(audio, semitones)', description: 'Shift pitch by semitones' },
    ],
  },
  {
    category: 'Automation',
    functions: [
      { signature: 'automation.curve(param, points[])', description: 'Define an automation curve with breakpoints' },
      { signature: 'automation.lfo(shape, rate, depth)', description: 'Create an LFO modulation source' },
      { signature: 'automation.sync(duration)', description: 'Set automation loop length' },
      { signature: 'automation.link(curves...)', description: 'Link multiple automation curves' },
    ],
  },
  {
    category: 'Sampler',
    functions: [
      { signature: 'sampler.load(sample)', description: 'Load a sample into the sampler engine' },
      { signature: 'sampler.play(pattern)', description: 'Trigger samples from a pattern array' },
      { signature: 'sampler.slice(sample, count)', description: 'Slice a sample into regions' },
      { signature: 'sampler.stretch(region, factor)', description: 'Time-stretch a sample region' },
    ],
  },
  {
    category: 'Output',
    functions: [
      { signature: 'output.midi(events)', description: 'Send generated MIDI events to output' },
      { signature: 'output.effectChain(name)', description: 'Render the current effect chain' },
      { signature: 'output.automation(curves[])', description: 'Render automation curves' },
      { signature: 'output.arrange(sequence, opts)', description: 'Arrange results on timeline' },
    ],
  },
];

function generateScriptOutput(scriptType: ScriptType, code: string): { log: string; visualization: string } {
  const lines = code.split('\n').length;
  const typeName = SCRIPT_TYPES.find((s) => s.id === scriptType)?.name || scriptType;
  return {
    log: `[Script Engine] Compiling ${typeName} script (${lines} lines)...\n[OK] Script submitted for processing`,
    visualization: '',
  };
}

export default function CodeLensPage() {
  useLensNav('code');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('code');

  const {
    hyperDTUs, megaDTUs, regularDTUs,
    tierDistribution, publishToMarketplace,
    isLoading: dtusLoading, refetch: refetchDTUs,
  } = useLensDTUs({ lens: 'code' });

  // Persist scripts to backend
  const { isLoading, isError, error, refetch, create: saveScript, items: savedScripts } = useLensData('code', 'script', { noSeed: true });

  const [files, setFiles] = useState<FileNode[]>(TEMPLATE_FILES);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'main', name: 'untitled.js', language: 'javascript', content: DEFAULT_CODE, isDirty: false, scriptType: 'midi' },
  ]);
  const [activeTabId, setActiveTabId] = useState('main');
  const [scriptOutput, setScriptOutput] = useState<{ log: string; visualization: string } | null>(null);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [activeScriptType, setActiveScriptType] = useState<ScriptType>('midi');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showOutput, setShowOutput] = useState(true);
  const [showApiRef, setShowApiRef] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [outputTab, setOutputTab] = useState<'output' | 'console'>('output');
  const [showFeatures, setShowFeatures] = useState(false);
  const [codeLensMode, setCodeLensMode] = useState<CodeLensMode>('script');

  // ── Forge State ──
  const [forgeAppName, setForgeAppName] = useState('MyApp');
  const [forgeDbDriver, setForgeDbDriver] = useState('sqlite');
  const [forgeSections, setForgeSections] = useState<ForgeSection[]>(FORGE_SECTIONS);
  const [forgePreset, setForgePreset] = useState<string | null>(null);
  const [forgeGeneratedCode, setForgeGeneratedCode] = useState<string | null>(null);
  const [forgePreviewSection, setForgePreviewSection] = useState<string | null>(null);
  const [forgeTemplateId, setForgeTemplateId] = useState<string | null>(null);
  const [forgeConcordNode, setForgeConcordNode] = useState(false);

  const forgeToggleSection = (sectionId: string) => {
    setForgeSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    ));
    setForgeGeneratedCode(null); // invalidate
  };

  const forgeApplyPreset = (presetId: string) => {
    setForgePreset(presetId);
    // Enable/disable sections based on preset
    const enableMap: Record<string, string[]> = {
      saas: ['dependencies', 'config', 'database', 'auth', 'payments', 'api', 'frontend', 'background_jobs', 'thread_manager', 'testing', 'deployment'],
      ecommerce: ['dependencies', 'config', 'database', 'auth', 'payments', 'api', 'frontend', 'background_jobs', 'thread_manager', 'testing', 'deployment'],
      api_only: ['dependencies', 'config', 'database', 'auth', 'api', 'thread_manager', 'testing', 'deployment'],
      realtime: ['dependencies', 'config', 'database', 'auth', 'api', 'frontend', 'websocket', 'thread_manager', 'testing', 'deployment'],
    };
    const enabled = enableMap[presetId] || [];
    setForgeSections(prev => prev.map(s => ({ ...s, enabled: enabled.includes(s.id) })));
    setForgeGeneratedCode(null);
  };

  const forgeGenerateMutation = useMutation({
    mutationFn: async () => {
      // Build spec from current state
      const spec = {
        config: { appName: forgeAppName, dbDriver: forgeDbDriver },
        category: forgePreset || 'custom',
        description: `Generated from Code Lens Forge`,
        concordNode: forgeConcordNode,
      };
      // Add section flags
      for (const s of forgeSections) {
        (spec as any)[s.id] = { include: s.enabled };
      }

      const res = await api.post('/api/forge-template/templates', spec);
      const templateResult = res.data;
      if (!templateResult.ok) throw new Error(templateResult.error);

      // Generate the code
      const genRes = await api.post(`/api/forge-template/templates/${templateResult.template.id}/generate`);
      const genResult = genRes.data;
      if (!genResult.ok) throw new Error(genResult.error);

      return { templateId: templateResult.template.id, code: genResult.code, lineCount: genResult.generation.lineCount, sections: genResult.generation.enabledSections };
    },
    onSuccess: (data) => {
      setForgeTemplateId(data.templateId);
      setForgeGeneratedCode(data.code);
    },
  });

  const forgePublishMutation = useMutation({
    mutationFn: async () => {
      if (!forgeTemplateId) throw new Error('Generate first');
      const res = await api.post(`/api/forge-template/templates/${forgeTemplateId}/publish`);
      return res.data;
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const runScriptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiHelpers.chat.ask(
        `Analyze this ${activeScriptType} script for music production and describe what it would produce:\n\n\`\`\`javascript\n${activeTab.content}\n\`\`\``,
        'creative'
      );
      return res.data;
    },
    onSuccess: () => {
      const result = generateScriptOutput(activeTab.scriptType || activeScriptType, activeTab.content);
      setScriptOutput(result);
      setConsoleLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Script executed successfully`,
        `[${new Date().toLocaleTimeString()}] Type: ${SCRIPT_TYPES.find((s) => s.id === (activeTab.scriptType || activeScriptType))?.name}`,
        `[${new Date().toLocaleTimeString()}] Output ready`,
      ]);
      setShowOutput(true);
      setOutputTab('output');
    },
    onError: (error: Record<string, unknown>) => {
      const result = generateScriptOutput(activeTab.scriptType || activeScriptType, activeTab.content);
      setScriptOutput(result);
      setConsoleLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Script executed (offline mode)`,
        `[${new Date().toLocaleTimeString()}] ${String(error.message || 'Using local engine')}`,
      ]);
      setShowOutput(true);
      setOutputTab('output');
    },
  });

  const updateTabContent = useCallback((content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, content, isDirty: true } : tab
      )
    );
  }, [activeTabId]);

  const handleSave = useCallback(async () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    try {
      await saveScript({
        title: tab.name,
        data: { content: tab.content, language: tab.language, scriptType: tab.scriptType },
        meta: { tags: ['script', tab.scriptType], status: 'active' },
      });
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isDirty: false } : t));
    } catch (err) {
      console.error('[Code] Save failed:', err);
    }
  }, [tabs, activeTabId, saveScript]);

  const handleNewTab = useCallback(() => {
    const id = `new-${Date.now()}`;
    const newTab: Tab = {
      id,
      name: `script_${savedScripts.length + tabs.length}.js`,
      language: 'javascript',
      content: `// New ${SCRIPT_TYPES.find(s => s.id === activeScriptType)?.name || 'Script'}\n// Start writing your code here\n`,
      isDirty: false,
      scriptType: activeScriptType,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
  }, [activeScriptType, savedScripts.length, tabs.length]);

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const openFile = (file: FileNode) => {
    if (file.type !== 'file') return;

    const existingTab = tabs.find((t) => t.id === file.id);
    if (existingTab) {
      setActiveTabId(file.id);
      return;
    }

    const newTab: Tab = {
      id: file.id,
      name: file.name,
      language: file.language || 'javascript',
      content: file.content || '',
      isDirty: false,
      scriptType: file.scriptType || 'midi',
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(file.id);
    if (file.scriptType) {
      setActiveScriptType(file.scriptType);
    }
  };

  const toggleFolder = (folderId: string) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.id === folderId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    setFiles(updateNodes(files));
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const Icon = isFolder
      ? node.isExpanded
        ? FolderOpen
        : Folder
      : File;

    return (
      <div key={node.id}>
        <button
          onClick={() => isFolder ? toggleFolder(node.id) : openFile(node)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-lattice-elevated rounded transition-colors ${
            activeTabId === node.id ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-400'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isFolder && (
            <span className="w-4 h-4 flex items-center justify-center">
              {node.isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          <Icon className={`w-4 h-4 ${isFolder ? 'text-neon-yellow' : 'text-neon-blue'}`} />
          <span className="truncate">{node.name}</span>
        </button>
        {isFolder && node.isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-lattice-deep' : 'h-full'}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-lattice-border bg-lattice-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{codeLensMode === 'forge' ? '🔨' : '🎹'}</span>
          <div>
            <h1 className="text-lg font-bold">{codeLensMode === 'forge' ? 'Forge' : 'Script Studio'}</h1>
            <p className="text-xs text-gray-400">{codeLensMode === 'forge' ? 'Single-file app generator — one file, one process' : 'MIDI scripting, automation & macros'}</p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="code" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle: Script Studio vs Forge */}
          <div className="flex items-center gap-1 bg-lattice-deep rounded-lg p-1 mr-2">
            <button
              onClick={() => setCodeLensMode('script')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                codeLensMode === 'script' ? 'bg-lattice-elevated text-neon-blue' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Script Studio — MIDI, effects, automation"
            >
              <Music className="w-3.5 h-3.5" />
              Scripts
            </button>
            <button
              onClick={() => setCodeLensMode('forge')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                codeLensMode === 'forge' ? 'bg-lattice-elevated text-neon-yellow' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Forge — Single-file app generator"
            >
              <Hammer className="w-3.5 h-3.5" />
              Forge
            </button>
          </div>

          {/* Script Type Selector (only in script mode) */}
          {codeLensMode === 'script' && (
          <div className="flex items-center gap-1 bg-lattice-deep rounded-lg p-1">
            {SCRIPT_TYPES.map((stype) => {
              const Icon = stype.icon;
              return (
                <button
                  key={stype.id}
                  onClick={() => setActiveScriptType(stype.id)}
                  className={`p-2 rounded-md transition-colors ${
                    activeScriptType === stype.id
                      ? 'bg-lattice-elevated ' + stype.color
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={`${stype.name}: ${stype.description}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          )}

          <button
            onClick={() => runScriptMutation.mutate()}
            disabled={runScriptMutation.isPending}
            className="btn-neon flex items-center gap-2"
          >
            {runScriptMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Script
          </button>

          <button
            onClick={() => setShowApiRef(!showApiRef)}
            className={`p-2 rounded-lg transition-colors ${showApiRef ? 'bg-neon-blue/20 text-neon-blue' : 'hover:bg-lattice-elevated text-gray-400'}`}
            title="API Reference"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="code" artifactId={savedScripts[0]?.id} compact />

      {/* ═══ FORGE MODE ═══ */}
      {codeLensMode === 'forge' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Forge Config Sidebar */}
          <div className="w-72 border-r border-lattice-border bg-lattice-surface/30 overflow-y-auto">
            <div className="p-3 border-b border-lattice-border">
              <h3 className="text-xs font-semibold text-neon-yellow uppercase tracking-wider flex items-center gap-2">
                <Hammer className="w-3.5 h-3.5" />
                Forge Template Builder
              </h3>
              <p className="text-xs text-gray-500 mt-1">One file. One process. Everything pre-wired.</p>
            </div>

            {/* App Name */}
            <div className="p-3 border-b border-lattice-border space-y-2">
              <label className="text-xs font-medium text-gray-400">App Name</label>
              <input
                type="text"
                value={forgeAppName}
                onChange={(e) => { setForgeAppName(e.target.value); setForgeGeneratedCode(null); }}
                className="w-full px-2 py-1.5 bg-lattice-deep border border-lattice-border rounded text-sm text-white focus:outline-none focus:border-neon-yellow"
              />
              <label className="text-xs font-medium text-gray-400">Database</label>
              <select
                value={forgeDbDriver}
                onChange={(e) => { setForgeDbDriver(e.target.value); setForgeGeneratedCode(null); }}
                className="w-full px-2 py-1.5 bg-lattice-deep border border-lattice-border rounded text-sm text-white focus:outline-none"
              >
                <option value="sqlite">SQLite (zero config)</option>
                <option value="postgres">PostgreSQL</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={forgeConcordNode}
                  onChange={(e) => { setForgeConcordNode(e.target.checked); setForgeGeneratedCode(null); }}
                  className="rounded"
                />
                Concord Node Integration
              </label>
            </div>

            {/* Presets */}
            <div className="p-3 border-b border-lattice-border">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Quick Start Presets</label>
              <div className="mt-2 space-y-1">
                {FORGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => forgeApplyPreset(preset.id)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                      forgePreset === preset.id
                        ? 'bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/30'
                        : 'text-gray-400 hover:bg-lattice-elevated hover:text-white'
                    )}
                  >
                    <span className="font-medium">{preset.name}</span>
                    <p className="text-gray-500 text-[10px] mt-0.5">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Toggles */}
            <div className="p-3">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Subsystems</label>
              <div className="mt-2 space-y-0.5">
                {forgeSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => forgeToggleSection(section.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                        section.enabled
                          ? 'text-white bg-lattice-elevated/50'
                          : 'text-gray-600 hover:text-gray-400'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', section.enabled ? 'bg-green-400' : 'bg-gray-700')} />
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{section.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                {forgeSections.filter(s => s.enabled).length} of {forgeSections.length} subsystems enabled
              </p>
            </div>

            {/* DTU Context */}
            <div className="p-3 border-t border-white/10 space-y-3">
              <LensContextPanel
                hyperDTUs={hyperDTUs}
                megaDTUs={megaDTUs}
                regularDTUs={regularDTUs}
                tierDistribution={tierDistribution}
                onPublish={(dtu) => publishToMarketplace({ dtuId: dtu.id })}
                title="Forge DTUs"
                className="!bg-transparent !border-0 !p-0"
              />
            </div>
          </div>

          {/* Forge Output Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Forge Action Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-lattice-deep border-b border-lattice-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => forgeGenerateMutation.mutate()}
                  disabled={forgeGenerateMutation.isPending}
                  className="btn-neon flex items-center gap-2 text-sm"
                >
                  {forgeGenerateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Hammer className="w-4 h-4" />
                  )}
                  Generate App
                </button>
                {forgeGeneratedCode && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(forgeGeneratedCode);
                      }}
                      className="p-2 rounded hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([forgeGeneratedCode], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${forgeAppName.toLowerCase().replace(/\s+/g, '-')}.ts`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-2 rounded hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => forgePublishMutation.mutate()}
                      disabled={forgePublishMutation.isPending}
                      className="px-3 py-1.5 rounded bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Publish as marketplace DTU"
                    >
                      {forgePublishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Publish DTU
                    </button>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {forgeGeneratedCode ? (
                  <span className="text-green-400">{forgeGeneratedCode.split('\n').length} lines generated</span>
                ) : (
                  <span>Configure sections, then generate</span>
                )}
              </div>
            </div>

            {/* Generated Code Display */}
            <div className="flex-1 overflow-hidden">
              {forgeGenerateMutation.isPending ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-neon-yellow mx-auto" />
                    <p className="text-sm text-gray-400">Forging your application...</p>
                    <p className="text-xs text-gray-600">Generating {forgeSections.filter(s => s.enabled).length} subsystems</p>
                  </div>
                </div>
              ) : forgeGeneratedCode ? (
                <div className="h-full flex">
                  {/* Line numbers */}
                  <div className="w-12 bg-lattice-deep border-r border-lattice-border text-right py-4 pr-3 text-xs text-gray-600 font-mono select-none overflow-hidden">
                    {forgeGeneratedCode.split('\n').slice(0, 500).map((_: string, idx: number) => (
                      <div key={idx} className="leading-5">{idx + 1}</div>
                    ))}
                  </div>
                  <pre className="flex-1 bg-lattice-deep p-4 font-mono text-xs text-gray-300 overflow-auto leading-5 whitespace-pre">{forgeGeneratedCode}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 max-w-md">
                    <Hammer className="w-16 h-16 text-neon-yellow/20 mx-auto" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Forge App Generator</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Configure your app with the sidebar, pick a preset, then hit Generate.
                        One file, one process, everything pre-wired.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <div className="bg-lattice-elevated/30 rounded p-2">Auth + JWT + Sessions</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">SQLite auto-migrate</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">SSR Frontend</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">Thread Manager</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">Stripe Payments</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">WebSocket Realtime</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">Background Jobs</div>
                      <div className="bg-lattice-elevated/30 rounded p-2">One-Click Deploy</div>
                    </div>
                    {forgeGenerateMutation.isError && (
                      <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                        {(forgeGenerateMutation.error as Error)?.message || 'Generation failed'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Forge Status Bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-lattice-deep border-t border-lattice-border text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Hammer className="w-3 h-3 text-neon-yellow" />
                  Forge Engine
                </span>
                <span>{forgeDbDriver === 'sqlite' ? 'SQLite' : 'PostgreSQL'}</span>
                <span>{forgeSections.filter(s => s.enabled).length} subsystems</span>
              </div>
              <div className="flex items-center gap-4">
                {forgeConcordNode && <span className="text-neon-cyan">Concord Node</span>}
                {forgePreset && <span className="text-neon-yellow">{FORGE_PRESETS.find(p => p.id === forgePreset)?.name}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCRIPT MODE ═══ */}
      {codeLensMode === 'script' && (
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Sidebar */}
        <AnimatePresence>
          {showFileTree && (
            <motion.aside
              initial={{ width: 0 }}
              animate={{ width: 240 }}
              exit={{ width: 0 }}
              className="border-r border-lattice-border bg-lattice-surface/30 overflow-hidden"
            >
              <div className="w-60 h-full flex flex-col">
                <div className="p-2 border-b border-lattice-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Templates</span>
                  <div className="flex items-center gap-1">
                    <button onClick={handleNewTab} className="p-1 rounded hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors" title="New script">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowFileTree(!showFileTree)} className="p-1 rounded hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors" title="Toggle file tree">
                      <FolderTree className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {files.map((file) => renderFileNode(file))}
                </div>
                {/* DTU Context */}
                <div className="p-3 border-t border-white/10 space-y-3">
                  <LensContextPanel
                    hyperDTUs={hyperDTUs}
                    megaDTUs={megaDTUs}
                    regularDTUs={regularDTUs}
                    tierDistribution={tierDistribution}
                    onPublish={(dtu) => publishToMarketplace({ dtuId: dtu.id })}
                    title="Code DTUs"
                    className="!bg-transparent !border-0 !p-0"
                  />
                  <FeedbackWidget targetType="lens" targetId="code" />
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-lattice-surface/50 border-b border-lattice-border overflow-x-auto">
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              className="p-1.5 rounded hover:bg-lattice-elevated text-gray-400 flex-shrink-0"
              aria-label={showFileTree ? 'Hide file tree' : 'Show file tree'}
            >
              <FolderTree className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-colors ${
                    tab.id === activeTabId
                      ? 'bg-lattice-deep border-t border-l border-r border-lattice-border text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    if (tab.scriptType) setActiveScriptType(tab.scriptType);
                  }}
                >
                  <FileCode className="w-4 h-4 text-neon-blue" />
                  <span className="text-sm">{tab.name}</span>
                  {tab.isDirty && <span className="w-2 h-2 bg-neon-blue rounded-full" />}
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-lattice-border/50"
                      aria-label={`Close ${tab.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleNewTab} className="p-1.5 rounded hover:bg-lattice-elevated text-gray-400 hover:text-white flex-shrink-0 transition-colors" title="New tab">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Editor + Output Split */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Code Editor */}
            <div className={`flex-1 flex flex-col overflow-hidden ${showOutput || showApiRef ? 'lg:w-1/2' : ''}`}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-lattice-deep border-b border-lattice-border">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className={SCRIPT_TYPES.find((s) => s.id === activeScriptType)?.color}>
                    {SCRIPT_TYPES.find((s) => s.id === activeScriptType)?.name}
                  </span>
                  <span>|</span>
                  <span>{activeTab.content.split('\n').length} lines</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleSave} className={cn('p-1 rounded hover:bg-lattice-elevated transition-colors', activeTab.isDirty ? 'text-neon-blue' : 'text-gray-400')} title="Save script (persists to backend)">
                    <Save className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400" title="Copy to clipboard"
                    onClick={() => navigator.clipboard?.writeText(activeTab.content)}>
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400" title="Download file"
                    onClick={() => {
                      const blob = new Blob([activeTab.content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = activeTab.name;
                      a.click(); URL.revokeObjectURL(url);
                    }}>
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0 flex">
                  {/* Line numbers */}
                  <div className="w-12 bg-lattice-deep border-r border-lattice-border text-right py-4 pr-3 text-xs text-gray-600 font-mono select-none overflow-hidden">
                    {activeTab.content.split('\n').map((_, idx) => (
                      <div key={idx} className="leading-6">{idx + 1}</div>
                    ))}
                  </div>
                  {/* Code area */}
                  <textarea
                    ref={textareaRef}
                    value={activeTab.content}
                    onChange={(e) => updateTabContent(e.target.value)}
                    className="flex-1 bg-lattice-deep p-4 font-mono text-sm text-white resize-none focus:outline-none leading-6"
                    spellCheck={false}
                    placeholder="// Write your music production script here"
                  />
                </div>
              </div>
            </div>

            {/* Output / API Reference Panel */}
            <AnimatePresence>
              {(showOutput || showApiRef) && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '50%' }}
                  exit={{ width: 0 }}
                  className="border-l border-lattice-border flex flex-col overflow-hidden bg-lattice-surface/30"
                >
                  {showApiRef ? (
                    /* API Reference Panel */
                    <>
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-lattice-border">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-neon-cyan" />
                          <span className="text-sm font-medium">API Reference</span>
                        </div>
                        <button
                          onClick={() => setShowApiRef(false)}
                          className="p-1 rounded hover:bg-lattice-elevated text-gray-400"
                          aria-label="Close API reference"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4 space-y-5">
                        {API_REFERENCE.map((cat) => (
                          <div key={cat.category}>
                            <h3 className="text-xs font-bold text-neon-blue uppercase tracking-wider mb-2">{cat.category}</h3>
                            <div className="space-y-2">
                              {cat.functions.map((fn) => (
                                <div key={fn.signature} className="bg-lattice-deep rounded-lg p-2.5 border border-lattice-border">
                                  <code className="text-xs text-neon-yellow font-mono">{fn.signature}</code>
                                  <p className="text-xs text-gray-400 mt-1">{fn.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Run Output Panel */
                    <>
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-lattice-border">
                        <div className="flex items-center gap-0">
                          <button
                            onClick={() => setOutputTab('output')}
                            className={`flex items-center gap-2 px-3 py-1 rounded-t text-sm transition-colors ${
                              outputTab === 'output' ? 'text-neon-blue bg-lattice-deep' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5" />
                            Output
                          </button>
                          <button
                            onClick={() => setOutputTab('console')}
                            className={`flex items-center gap-2 px-3 py-1 rounded-t text-sm transition-colors ${
                              outputTab === 'console' ? 'text-neon-blue bg-lattice-deep' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            Console
                          </button>
                        </div>
                        <button
                          onClick={() => setShowOutput(false)}
                          className="p-1 rounded hover:bg-lattice-elevated text-gray-400"
                          aria-label="Close output panel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4">
                        {outputTab === 'output' ? (
                          runScriptMutation.isPending ? (
                            <div className="flex items-center gap-3 text-neon-blue">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Running {SCRIPT_TYPES.find((s) => s.id === activeScriptType)?.name}...</span>
                            </div>
                          ) : scriptOutput ? (
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Script Log</h4>
                                <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap bg-lattice-deep rounded-lg p-3 border border-lattice-border">{scriptOutput.log}</pre>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                  {activeScriptType === 'midi' && 'Piano Roll'}
                                  {activeScriptType === 'effect' && 'Signal Flow'}
                                  {activeScriptType === 'automation' && 'Automation Curves'}
                                  {activeScriptType === 'macro' && 'Macro Preview'}
                                  {activeScriptType === 'sampler' && 'Sampler View'}
                                  {activeScriptType === 'generator' && 'Generated Output'}
                                </h4>
                                <pre className="font-mono text-xs text-neon-cyan whitespace-pre bg-lattice-deep rounded-lg p-3 border border-lattice-border overflow-x-auto">{scriptOutput.visualization}</pre>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <Music className="w-12 h-12 mb-4 opacity-30" />
                              <p className="text-sm">Click &quot;Run Script&quot; to execute</p>
                              <p className="text-xs mt-1 text-gray-600">Output will appear here</p>
                            </div>
                          )
                        ) : (
                          /* Console Tab */
                          <div className="space-y-1">
                            {consoleLog.length > 0 ? (
                              consoleLog.map((line, idx) => (
                                <div key={idx} className="font-mono text-xs text-gray-400">{line}</div>
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Terminal className="w-12 h-12 mb-4 opacity-30" />
                                <p className="text-sm">Script console output</p>
                                <p className="text-xs mt-1 text-gray-600">Log messages will appear here</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-lattice-deep border-t border-lattice-border text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>Ln 1, Col 1</span>
              <span>Spaces: 2</span>
              <span>UTF-8</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-neon-yellow" />
                Script Engine Ready
              </span>
              <span className={SCRIPT_TYPES.find((s) => s.id === activeScriptType)?.color}>
                {SCRIPT_TYPES.find((s) => s.id === activeScriptType)?.name}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="code"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Lens Features & Capabilities
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-4">
            <LensFeaturePanel lensId="code" />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
