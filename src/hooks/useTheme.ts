import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'formatforge-theme';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

function applyTheme(next: Theme) {
  document.documentElement.classList.toggle('light', next === 'light');
  localStorage.setItem(STORAGE_KEY, next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#f5f7fa' : '#0f1724');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}