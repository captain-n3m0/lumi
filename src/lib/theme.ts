import { useSyncExternalStore, useCallback } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "lumi_theme";

// Default to dark mode for crypto/NFT sniper aesthetic
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage may be unavailable in private browsing
  }
  return "dark";
}

let currentTheme: Theme = "dark";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function applyTheme(theme: Theme) {
  currentTheme = theme;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, theme);
    }
  } catch {
    // ignore storage error
  }
  notify();
}

export function initializeTheme() {
  if (typeof window === "undefined") return;
  const theme = getInitialTheme();
  applyTheme(theme);
}

export function useTheme() {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }, []);

  const getSnapshot = () => currentTheme;
  const getServerSnapshot = () => "dark" as Theme;

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    applyTheme(newTheme);
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    isLight: theme === "light",
    toggleTheme,
    setTheme,
  };
}
