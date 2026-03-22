import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';
const THEMES = ['school', 'light'];
const THEME_EVENT = 'restaurant-saas-theme-change';

const getStoredTheme = () => {
  if (typeof window === 'undefined') {
    return 'school';
  }

  const savedTheme = localStorage.getItem(STORAGE_KEY);
  return THEMES.includes(savedTheme) ? savedTheme : 'school';
};

const applyTheme = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.remove('school', 'light');
  document.documentElement.classList.add(theme);
};

export default function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => {
      setThemeState(getStoredTheme());
    };

    window.addEventListener(THEME_EVENT, syncTheme);
    window.addEventListener('storage', syncTheme);

    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const setTheme = (nextTheme) => {
    const safeTheme = THEMES.includes(nextTheme) ? nextTheme : 'school';
    localStorage.setItem(STORAGE_KEY, safeTheme);
    applyTheme(safeTheme);
    setThemeState(safeTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return {
    theme,
    setTheme,
    themes: [
      { id: 'school', label: 'School Theme' },
      { id: 'light', label: 'Light Theme' },
    ],
  };
}
