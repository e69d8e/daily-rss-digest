"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ReadingTheme = "paper" | "light" | "midnight";

interface ThemeContextType {
  theme: ReadingTheme;
  setTheme: (theme: ReadingTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ReadingTheme>("paper");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("daily_rss_theme") as ReadingTheme;
      if (saved && (saved === "paper" || saved === "light" || saved === "midnight")) {
        setThemeState(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        document.documentElement.setAttribute("data-theme", "paper");
      }
    } catch {
      document.documentElement.setAttribute("data-theme", "paper");
    }
  }, []);

  const setTheme = useCallback((newTheme: ReadingTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("daily_rss_theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch (e) {
      console.warn("保存主题失败:", e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const sequence: ReadingTheme[] = ["paper", "light", "midnight"];
    setThemeState((current) => {
      const nextTheme = sequence[(sequence.indexOf(current) + 1) % sequence.length];
      try {
        localStorage.setItem("daily_rss_theme", nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
      } catch (e) {
        console.warn("保存主题失败:", e);
      }
      return nextTheme;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
