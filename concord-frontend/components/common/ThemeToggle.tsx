'use client';

import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';
const THEME_KEY = 'concord_theme';

export function useThemeMode() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null;
      if (stored && ['dark', 'light', 'system'].includes(stored)) {
        setThemeState(stored);
        applyTheme(stored);
      }
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    applyTheme(t);
  }, []);

  return { theme, setTheme };
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('light', !prefersDark);
  } else if (theme === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

export function ThemeToggle() {
  const { theme, setTheme } = useThemeMode();

  const cycle = () => {
    const next: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  };

  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
      title={`Theme: ${label}. Click to cycle.`}
      aria-label={`Switch theme. Currently ${label}`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
