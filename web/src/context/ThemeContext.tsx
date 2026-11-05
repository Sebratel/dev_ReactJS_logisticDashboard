import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { chartColorsFor, type ChartColors } from '../utils/chartColors';
import { getPreferredTheme, setTheme as persistTheme, type Theme } from '../utils/theme';

interface ThemeValue {
  theme: Theme;
  toggleTheme: () => void;
  colors: ChartColors;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme, colors: chartColorsFor(theme) }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme fora do ThemeProvider');
  return ctx;
}
