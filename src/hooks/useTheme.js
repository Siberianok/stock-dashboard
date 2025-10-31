import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dashboard.theme.v1';

const THEME_PRESETS = {
  dark: {
    chart: {
      scoreHi: '#34d399',
      scoreMid: '#facc15',
      scoreLo: '#f87171',
      accent: '#22d3ee',
    },
  },
  light: {
    chart: {
      scoreHi: '#047857',
      scoreMid: '#ca8a04',
      scoreLo: '#dc2626',
      accent: '#0284c7',
    },
  },
};

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
};

const loadTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

export const useTheme = () => {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const palette = useMemo(() => THEME_PRESETS[theme] || THEME_PRESETS.dark, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    palette,
  };
};
