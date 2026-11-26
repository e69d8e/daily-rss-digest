"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ReadingTheme = "system" | "paper" | "light" | "midnight";

const STORAGE_KEY = "daily_rss_theme";
const VALID_THEMES: readonly ReadingTheme[] = [
  "system",
  "paper",
  "light",
  "midnight",
];

function isReadingTheme(val: string | null): val is ReadingTheme {
  return val !== null && (VALID_THEMES as readonly string[]).includes(val);
}

/**
 * 将阅读主题同步到 `<meta name="color-scheme">` 与 `<html data-theme>`：
 * - `system` -> `<meta content="light dark">`，移除 `data-theme`（由系统偏好驱动）
 * - `paper` / `light` -> `<meta content="light">`，设置 `data-theme`
 * - `midnight` -> `<meta content="dark">`，设置 `data-theme="midnight"`
 */
function applyThemeToDom(theme: ReadingTheme) {
  if (typeof document === "undefined") return;

  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]'
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }

  if (theme === "midnight") {
    meta.content = "dark";
    document.documentElement.setAttribute("data-theme", "midnight");
  } else if (theme === "paper" || theme === "light") {
    meta.content = "light";
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    meta.content = "light dark";
    document.documentElement.removeAttribute("data-theme");
  }
}

interface ThemeContextType {
  theme: ReadingTheme;
  /** 当 theme === "system" 时反映操作系统当前是否为深色 */
  systemPrefersDark: boolean;
  /** 当前页面实际生效的明暗方案 */
  resolvedScheme: "light" | "dark";
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
  const [theme, setThemeState] = useState<ReadingTheme>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // 初始化读取存储的主题偏好，并订阅系统配色变更（仅用于 UI 展示，绝不清除用户持久化偏好）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mq.matches);

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    mq.addEventListener("change", handleMediaChange);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const initial: ReadingTheme =
        isReadingTheme(saved) && saved !== "system" ? saved : "system";
      setThemeState(initial);
      applyThemeToDom(initial);
    } catch {
      applyThemeToDom("system");
    }

    // 跨标签页同步主题偏好
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next: ReadingTheme =
        isReadingTheme(event.newValue) && event.newValue !== "system"
          ? event.newValue
          : "system";
      setThemeState(next);
      applyThemeToDom(next);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      mq.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = useCallback((newTheme: ReadingTheme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
    try {
      if (newTheme === "system") {
        // 回到跟随系统时删除存储键，避免隐式锁定
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, newTheme);
      }
    } catch (e) {
      console.warn("保存主题失败:", e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const nextIdx = (VALID_THEMES.indexOf(current) + 1) % VALID_THEMES.length;
      const nextTheme = VALID_THEMES[nextIdx];
      applyThemeToDom(nextTheme);
      try {
        if (nextTheme === "system") {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, nextTheme);
        }
      } catch (e) {
        console.warn("保存主题失败:", e);
      }
      return nextTheme;
    });
  }, []);

  const resolvedScheme: "light" | "dark" =
    theme === "midnight"
      ? "dark"
      : theme === "paper" || theme === "light"
      ? "light"
      : systemPrefersDark
      ? "dark"
      : "light";

  const value = useMemo(
    () => ({ theme, systemPrefersDark, resolvedScheme, setTheme, toggleTheme }),
    [theme, systemPrefersDark, resolvedScheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
