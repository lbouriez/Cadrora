import { useEffect, useState } from 'react';

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
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return savedTheme() ?? (prefersDark ? 'dark' : 'light');
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('cadrora-theme', theme);
  } catch {
    // A visual preference remains valid for the current page when storage is unavailable.
  }
}

/** Keeps the local preference when visitors may choose, otherwise enforces the owner setting. */
export function useTheme(mode: ThemeMode = 'both') {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const effectiveTheme = mode === 'both' ? theme : mode;

  useEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  const toggleTheme = () => {
    if (mode !== 'both') return;
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  };

  return { canChooseTheme: mode === 'both', theme: effectiveTheme, toggleTheme };
}
