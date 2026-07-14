import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STORAGE_KEY_PREFIX, OLD_THEME_STORAGE_KEY } from "../lib/settings";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = `${STORAGE_KEY_PREFIX}theme`;

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * One-time migration from the old `-theme` key (hyphen separator) to the
 * namespaced `:theme` key (colon separator). Reads and removes the old key.
 */
function migrateOldThemeKey(): Theme | null {
  try {
    const old = localStorage.getItem(OLD_THEME_STORAGE_KEY);
    if (old !== null) {
      localStorage.removeItem(OLD_THEME_STORAGE_KEY);
      if (old === "light" || old === "dark") return old;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Theme provider that persists the user's preference to localStorage
 * and applies the theme class to the document root.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 1. Check localStorage (new key)
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "light" || stored === "dark") return stored;
    // 2. Migrate from old key (hyphen separator)
    const migrated = migrateOldThemeKey();
    if (migrated !== null) return migrated;
    // 3. Check system preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    // 4. Default to dark
    return "dark";
  });

  // Apply theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(`theme-${theme}`);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes if no stored preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return; // User has an explicit preference

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark: theme === "dark", toggle, setTheme }),
    [theme, toggle, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access the current theme and toggle function.
 * Must be used within a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
