import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';
const THEMES = ['midnight', 'light'];
const THEME_EVENT = 'restaurant-saas-theme-change';

const getStoredTheme = () => {
  if (typeof window === 'undefined') {
    return 'midnight';
  }

  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'midnight';
  return THEMES.includes(savedTheme) ? savedTheme : 'midnight';
};

const applyTheme = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.remove('light');
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  }
};

export default function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    console.log('Current theme:', theme);
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
    const safeTheme = THEMES.includes(nextTheme) ? nextTheme : 'midnight';
    localStorage.setItem(STORAGE_KEY, safeTheme);
    applyTheme(safeTheme);
    setThemeState(safeTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return {
    theme,
    setTheme,
    themes: [
      { id: 'midnight', label: 'Midnight' },
      { id: 'light', label: 'Light Theme' },
    ],
  };
}
