'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────── */

type DistrictName =
  | 'forge'
  | 'academy'
  | 'docks'
  | 'commons'
  | 'exchange'
  | 'observatory'
  | 'grid'
  | 'arena'
  | 'nexus'
  | 'frontier'
  | 'silent';

type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

type WeatherType = 'clear' | 'rain' | 'storm' | 'wind' | 'snow';

interface AmbientBed {
  label: string;
  layers: string[];
  timeVariants: Record<TimeOfDay, { volumeScale: number; pitchShift: number; extraLayers: string[] }>;
}

interface WeatherLayer {
  label: string;
  layers: string[];
  intensityRange: [number, number];
}

interface SoundscapeState {
  currentDistrict: DistrictName;
  previousDistrict: DistrictName | null;
  timeOfDay: TimeOfDay;
  isInterior: boolean;
  weather: WeatherType;
  weatherIntensity: number;
  crossfading: boolean;
}

interface SoundscapeAPI {
  setDistrict: (district: string) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  setInterior: (interior: boolean) => void;
  setWeather: (weather: WeatherType, intensity?: number) => void;
}

/* ── Ambient beds per district ────────────────────────────────── */

const AMBIENT_BEDS: Record<DistrictName, AmbientBed> = {
  forge: {
    label: 'The Forge',
    layers: ['hammering-rhythmic', 'furnace-roar', 'metal-clang', 'steam-hiss'],
    timeVariants: {
      dawn: { volumeScale: 0.4, pitchShift: 0, extraLayers: ['morning-bell'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['busy-chatter'] },
      dusk: { volumeScale: 0.7, pitchShift: -0.1, extraLayers: ['cooling-metal'] },
      night: { volumeScale: 0.2, pitchShift: -0.2, extraLayers: ['ember-crackle', 'night-guard'] },
    },
  },
  academy: {
    label: 'The Academy',
    layers: ['pages-turning', 'murmuring-scholars', 'chalk-writing', 'songbird'],
    timeVariants: {
      dawn: { volumeScale: 0.3, pitchShift: 0, extraLayers: ['dawn-chorus'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['lecture-distant'] },
      dusk: { volumeScale: 0.6, pitchShift: 0, extraLayers: ['evening-bells'] },
      night: { volumeScale: 0.15, pitchShift: -0.1, extraLayers: ['owl-hoot', 'candle-flicker'] },
    },
  },
  docks: {
    label: 'The Docks',
    layers: ['waves-lapping', 'wood-creaking', 'seagulls-cry', 'pulleys-chain'],
    timeVariants: {
      dawn: { volumeScale: 0.5, pitchShift: 0, extraLayers: ['foghorn-distant'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['dock-workers', 'cargo-loading'] },
      dusk: { volumeScale: 0.7, pitchShift: 0, extraLayers: ['sunset-gulls'] },
      night: { volumeScale: 0.3, pitchShift: -0.15, extraLayers: ['buoy-bell', 'gentle-waves'] },
    },
  },
  commons: {
    label: 'The Commons',
    layers: ['gentle-wind', 'children-playing', 'fountain-splash', 'conversation-murmur'],
    timeVariants: {
      dawn: { volumeScale: 0.4, pitchShift: 0, extraLayers: ['rooster-crow', 'dew-drip'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['market-bustle'] },
      dusk: { volumeScale: 0.6, pitchShift: 0, extraLayers: ['cricket-chirp'] },
      night: { volumeScale: 0.15, pitchShift: -0.1, extraLayers: ['night-insects', 'distant-music'] },
    },
  },
  exchange: {
    label: 'The Exchange',
    layers: ['crowd-chatter', 'coins-clinking', 'paper-shuffle', 'footsteps-marble'],
    timeVariants: {
      dawn: { volumeScale: 0.3, pitchShift: 0, extraLayers: ['opening-bell'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['shouting-traders', 'abacus-clicks'] },
      dusk: { volumeScale: 0.5, pitchShift: 0, extraLayers: ['closing-bell'] },
      night: { volumeScale: 0.1, pitchShift: -0.1, extraLayers: ['guard-patrol', 'vault-hum'] },
    },
  },
  observatory: {
    label: 'The Observatory',
    layers: ['high-wind', 'equipment-hum', 'owl-distant', 'telescope-gears'],
    timeVariants: {
      dawn: { volumeScale: 0.5, pitchShift: 0, extraLayers: ['sunrise-chime'] },
      day: { volumeScale: 0.6, pitchShift: 0, extraLayers: ['calibration-clicks'] },
      dusk: { volumeScale: 0.8, pitchShift: 0, extraLayers: ['dome-opening'] },
      night: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['star-tracker-whir', 'night-sky-ambience'] },
    },
  },
  grid: {
    label: 'The Grid',
    layers: ['electrical-hum', 'machinery-rhythm', 'water-flow-pipes', 'transformer-buzz'],
    timeVariants: {
      dawn: { volumeScale: 0.7, pitchShift: 0, extraLayers: ['generator-startup'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['maintenance-crew'] },
      dusk: { volumeScale: 0.9, pitchShift: 0, extraLayers: ['load-shift-hum'] },
      night: { volumeScale: 0.6, pitchShift: -0.05, extraLayers: ['night-cycle-low'] },
    },
  },
  arena: {
    label: 'The Arena',
    layers: ['crowd-murmur', 'metal-clash-distant', 'banner-flap', 'horn-blast'],
    timeVariants: {
      dawn: { volumeScale: 0.2, pitchShift: 0, extraLayers: ['groundskeeper'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['cheering', 'announcer'] },
      dusk: { volumeScale: 0.7, pitchShift: 0, extraLayers: ['torch-lighting'] },
      night: { volumeScale: 0.3, pitchShift: -0.1, extraLayers: ['echo-empty-arena'] },
    },
  },
  nexus: {
    label: 'The Nexus',
    layers: ['discussion-murmur', 'gavel-tap', 'paper-rustle', 'pen-scratch'],
    timeVariants: {
      dawn: { volumeScale: 0.3, pitchShift: 0, extraLayers: ['morning-tea'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['heated-debate', 'vote-call'] },
      dusk: { volumeScale: 0.5, pitchShift: 0, extraLayers: ['session-closing'] },
      night: { volumeScale: 0.1, pitchShift: -0.1, extraLayers: ['archive-silence'] },
    },
  },
  frontier: {
    label: 'The Frontier',
    layers: ['open-wind', 'construction-distant', 'frontier-birds', 'gravel-crunch'],
    timeVariants: {
      dawn: { volumeScale: 0.5, pitchShift: 0, extraLayers: ['camp-wakeup'] },
      day: { volumeScale: 1.0, pitchShift: 0, extraLayers: ['surveyor-calls', 'scaffold-hammer'] },
      dusk: { volumeScale: 0.6, pitchShift: 0, extraLayers: ['campfire-crackle'] },
      night: { volumeScale: 0.2, pitchShift: -0.15, extraLayers: ['coyote-howl', 'tent-rustle'] },
    },
  },
  silent: {
    label: 'Silent',
    layers: [],
    timeVariants: {
      dawn: { volumeScale: 0, pitchShift: 0, extraLayers: [] },
      day: { volumeScale: 0, pitchShift: 0, extraLayers: [] },
      dusk: { volumeScale: 0, pitchShift: 0, extraLayers: [] },
      night: { volumeScale: 0, pitchShift: 0, extraLayers: [] },
    },
  },
};

const WEATHER_LAYERS: Record<WeatherType, WeatherLayer> = {
  clear: { label: 'Clear', layers: [], intensityRange: [0, 0] },
  rain: { label: 'Rain', layers: ['rain-light', 'rain-medium', 'rain-heavy', 'rain-on-roof'], intensityRange: [0.1, 1.0] },
  storm: { label: 'Storm', layers: ['rain-heavy', 'thunder-rumble', 'thunder-crack', 'wind-howl'], intensityRange: [0.5, 1.0] },
  wind: { label: 'Wind', layers: ['wind-gentle', 'wind-strong', 'wind-gust', 'leaves-rustle'], intensityRange: [0.2, 0.9] },
  snow: { label: 'Snow', layers: ['snow-quiet', 'muffled-ambience', 'icicle-drip'], intensityRange: [0.1, 0.5] },
};

const DISTRICT_ALIAS: Record<string, DistrictName> = {
  forge: 'forge',
  'the-forge': 'forge',
  academy: 'academy',
  'the-academy': 'academy',
  docks: 'docks',
  'the-docks': 'docks',
  commons: 'commons',
  'the-commons': 'commons',
  exchange: 'exchange',
  'the-exchange': 'exchange',
  observatory: 'observatory',
  'the-observatory': 'observatory',
  grid: 'grid',
  'the-grid': 'grid',
  arena: 'arena',
  'the-arena': 'arena',
  nexus: 'nexus',
  'the-nexus': 'nexus',
  frontier: 'frontier',
  'the-frontier': 'frontier',
};

const CROSSFADE_MS = 200;

/* ── Context & Hook ───────────────────────────────────────────── */

const SoundscapeContext = createContext<SoundscapeAPI>({
  setDistrict: () => {},
  setTimeOfDay: () => {},
  setInterior: () => {},
  setWeather: () => {},
});

export function useSoundscape(): SoundscapeAPI {
  return useContext(SoundscapeContext);
}

/* ── Component (renders nothing visible) ──────────────────────── */

interface SoundscapeEngineProps {
  children?: React.ReactNode;
  initialDistrict?: string;
  initialTime?: TimeOfDay;
}

export default function SoundscapeEngine({
  children,
  initialDistrict = 'silent',
  initialTime = 'day',
}: SoundscapeEngineProps) {
  const [state, setState] = useState<SoundscapeState>({
    currentDistrict: DISTRICT_ALIAS[initialDistrict.toLowerCase()] ?? 'silent',
    previousDistrict: null,
    timeOfDay: initialTime,
    isInterior: false,
    weather: 'clear',
    weatherIntensity: 0,
    crossfading: false,
  });

  const crossfadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDistrict = useCallback((district: string) => {
    const target = DISTRICT_ALIAS[district.toLowerCase()] ?? 'silent';

    setState((prev) => {
      if (target === prev.currentDistrict) return prev;

      // Begin crossfade
      if (crossfadeTimer.current) clearTimeout(crossfadeTimer.current);

      const transitioning = { ...prev, previousDistrict: prev.currentDistrict, crossfading: true };

      crossfadeTimer.current = setTimeout(() => {
        setState((p) => ({
          ...p,
          currentDistrict: target,
          previousDistrict: null,
          crossfading: false,
        }));
      }, CROSSFADE_MS);

      return transitioning;
    });
  }, []);

  const setTimeOfDay = useCallback((time: TimeOfDay) => {
    setState((prev) => ({ ...prev, timeOfDay: time }));
  }, []);

  const setInterior = useCallback((interior: boolean) => {
    // In production: applies low-pass filter + reverb for interior spaces
    // and crossfades ambient volume down by ~40%
    setState((prev) => ({ ...prev, isInterior: interior }));
  }, []);

  const setWeather = useCallback((weather: WeatherType, intensity?: number) => {
    const layer = WEATHER_LAYERS[weather];
    const clampedIntensity = intensity !== undefined
      ? Math.max(layer.intensityRange[0], Math.min(layer.intensityRange[1], intensity))
      : layer.intensityRange[1] * 0.5;

    setState((prev) => ({ ...prev, weather, weatherIntensity: clampedIntensity }));
  }, []);

  const api: SoundscapeAPI = { setDistrict, setTimeOfDay, setInterior, setWeather };

  // Compute active layers for debugging / potential future UI
  const _bed = AMBIENT_BEDS[state.currentDistrict];
  const _timeVariant = _bed.timeVariants[state.timeOfDay];
  const _weatherLayer = WEATHER_LAYERS[state.weather];
  const _activeLayers = [
    ..._bed.layers.map((l) => ({ layer: l, volume: _timeVariant.volumeScale * (state.isInterior ? 0.6 : 1.0) })),
    ..._timeVariant.extraLayers.map((l) => ({ layer: l, volume: _timeVariant.volumeScale * 0.5 })),
    ..._weatherLayer.layers.map((l) => ({ layer: l, volume: state.weatherIntensity * (state.isInterior ? 0.3 : 1.0) })),
  ];

  // Store active layers on a ref for external consumption if needed
  const layersRef = useRef(_activeLayers);
  layersRef.current = _activeLayers;

  return (
    <SoundscapeContext.Provider value={api}>
      {children}
      {/* This component renders nothing visible -- it manages audio state.
          In production, active layers would be:
          District: {_bed.label} ({state.timeOfDay})
          Layers: {_activeLayers.map(l => l.layer).join(', ')}
          Weather: {_weatherLayer.label} @ {state.weatherIntensity.toFixed(2)}
          Interior: {state.isInterior ? 'yes' : 'no'}
          Crossfading: {state.crossfading ? 'yes' : 'no'}
      */}
    </SoundscapeContext.Provider>
  );
}
