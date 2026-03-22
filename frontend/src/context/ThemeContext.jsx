import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'restaurant-saas-theme';

const THEMES = {
  default: {
    id: 'default',
    label: 'Default',
    description: 'Indigo dashboard',
  },
  school: {
    id: 'school',
    label: 'School SaaS',
    description: 'Academic blue workspace',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    description: 'Low-light operator mode',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'default';
    }

    return localStorage.getItem(STORAGE_KEY) || 'default';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: Object.values(THEMES),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
