import { useEffect, useLayoutEffect, useState } from 'react';

import type { ThemeMode } from '../shared/schemas';

export type Theme = 'dark' | 'light';

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem('cadrora-theme');
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function initialTheme(): Theme {
  if (document.documentElement.dataset.theme === 'dark') return 'dark';
  return savedTheme() ?? systemTheme();
}

function systemTheme(): Theme {
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyTheme(theme: Theme, persist: boolean): void {
  document.documentElement.dataset.theme = theme;
  if (!persist) return;
  try {
    localStorage.setItem('cadrora-theme', theme);
  } catch {
    // A visual preference remains valid for the current page when storage is unavailable.
  }
}

/** Keeps the local preference when visitors may choose, otherwise enforces the owner setting. */
export function useTheme(mode: ThemeMode = 'both') {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [preferredSystemTheme, setPreferredSystemTheme] = useState<Theme>(systemTheme);
  const effectiveTheme = mode === 'system' ? preferredSystemTheme : mode === 'both' ? theme : mode;

  useEffect(() => {
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setPreferredSystemTheme(query.matches ? 'dark' : 'light');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [mode]);

  useLayoutEffect(() => {
    applyTheme(effectiveTheme, mode === 'both');
  }, [effectiveTheme, mode]);

  const toggleTheme = () => {
    if (mode !== 'both') return;
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      return next;
    });
  };

  return { canChooseTheme: mode === 'both', theme: effectiveTheme, toggleTheme };
}
