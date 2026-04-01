/**
 * Lens Theme Configuration
 * Domain-specific visual identity for each lens view.
 */

export interface LensTheme {
  id: string;
  accent: string;         // primary Tailwind color class
  accentBg: string;       // bg- variant
  accentBorder: string;   // border- variant
  accentText: string;     // text- variant
  fontFamily?: string;    // optional override font class
  darkMode: boolean;
}

export const lensThemes: Record<string, LensTheme> = {
  code: {
    id: 'code',
    accent: 'green-400',
    accentBg: 'bg-green-500/20',
    accentBorder: 'border-green-500/30',
    accentText: 'text-green-400',
    fontFamily: 'font-mono',
    darkMode: true,
  },
  graph: {
    id: 'graph',
    accent: 'cyan-400',
    accentBg: 'bg-cyan-500/20',
    accentBorder: 'border-cyan-500/30',
    accentText: 'text-cyan-400',
    darkMode: true,
  },
  healthcare: {
    id: 'healthcare',
    accent: 'blue-500',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-200/20',
    accentText: 'text-blue-400',
    darkMode: false,
  },
  finance: {
    id: 'finance',
    accent: 'emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/20',
    accentText: 'text-emerald-400',
    fontFamily: 'font-mono',
    darkMode: true,
  },
  education: {
    id: 'education',
    accent: 'amber-400',
    accentBg: 'bg-amber-500/15',
    accentBorder: 'border-amber-400/30',
    accentText: 'text-amber-400',
    darkMode: true,
  },
  art: {
    id: 'art',
    accent: 'rose-400',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-400/20',
    accentText: 'text-rose-400',
    darkMode: true,
  },
  dashboard: {
    id: 'dashboard',
    accent: 'cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/20',
    accentText: 'text-cyan-400',
    darkMode: true,
  },
};
