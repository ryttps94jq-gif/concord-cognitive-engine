/**
 * Concordia Theme System
 *
 * Defines color palettes for the world renderer.
 * Each theme controls fog, ambient light, portal glow, and lamp colors.
 */

export type ConcordiaThemeId = 'neon-punk' | 'classic' | 'minimal';

export interface ConcordiaTheme {
  id: ConcordiaThemeId;
  label: string;
  swatch: string; // CSS color for the theme picker dot
  fog: { color: number; near: number; far: number };
  ambientLight: { color: number; intensity: number };
  sunLight: { color: number; intensity: number };
  portalGlow: number; // hex color for portal point lights
  streetLamp: number; // hex color for street lamp point lights
  skyTop: number;
  skyHorizon: number;
  /** Toon shading 3-stop gradient: [shadow, mid, highlight] */
  toonGradient: [string, string, string];
}

export const CONCORDIA_THEMES: Record<ConcordiaThemeId, ConcordiaTheme> = {
  'neon-punk': {
    id: 'neon-punk',
    label: 'Neon Punk',
    swatch: '#6366f1',
    fog:          { color: 0x0d0d1a, near: 40, far: 200 },
    ambientLight: { color: 0x1a1a3a, intensity: 0.6 },
    sunLight:     { color: 0xffd4a0, intensity: 1.2 },
    portalGlow:   0x6366f1,
    streetLamp:   0xffd580,
    skyTop:       0x050510,
    skyHorizon:   0x1a0a2e,
    toonGradient: ['#0d0d2a', '#3a3a6a', '#8888cc'],
  },
  'classic': {
    id: 'classic',
    label: 'Classic',
    swatch: '#e8c97a',
    fog:          { color: 0xd4c8a8, near: 50, far: 250 },
    ambientLight: { color: 0xfff4e0, intensity: 0.8 },
    sunLight:     { color: 0xffe8b0, intensity: 1.4 },
    portalGlow:   0xe8c97a,
    streetLamp:   0xffa040,
    skyTop:       0x87ceeb,
    skyHorizon:   0xf0e8c8,
    toonGradient: ['#4a3820', '#8a6a40', '#f0d890'],
  },
  'minimal': {
    id: 'minimal',
    label: 'Minimal',
    swatch: '#94a3b8',
    fog:          { color: 0xe8ecf0, near: 60, far: 300 },
    ambientLight: { color: 0xffffff, intensity: 1.0 },
    sunLight:     { color: 0xffffff, intensity: 1.5 },
    portalGlow:   0x60a5fa,
    streetLamp:   0xe2e8f0,
    skyTop:       0xdbeafe,
    skyHorizon:   0xf8fafc,
    toonGradient: ['#cccccc', '#e8e8e8', '#ffffff'],
  },
};

export const DEFAULT_THEME_ID: ConcordiaThemeId = 'neon-punk';
