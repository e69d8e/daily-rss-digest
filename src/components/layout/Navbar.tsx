"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ArrowLeft,
  Sun,
  Moon,
  Newspaper,
  HelpCircle,
  Monitor,
} from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { useTheme, ReadingTheme } from "@/components/ui/ThemeContext";
import KeyboardShortcutsModal from "@/components/ui/KeyboardShortcutsModal";
import { isAnyModalOpen } from "@/lib/modalStack";

export default function Navbar() {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith("/settings");
  const [today, setToday] = useState("");
  const { theme, systemPrefersDark, toggleTheme } = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekdays = [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六",
      ];
      const weekday = weekdays[now.getDay()];
      setToday(`${month} 月 ${day} 日 ${weekday}`);
    } catch {
      setToday("");
    }
  }, []);

  // 全局键盘监听 T 切换主题与 ? 唤起快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // 原生模态 <dialog> 打开时让路，避免快捷键穿透
      if (isAnyModalOpen()) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;

      if (e.key === "t" || e.key === "T") {
        toggleTheme();
      } else if (e.key === "?") {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);

  const renderThemeIcon = () => {
    switch (theme) {
      case "system":
        return (
          <Monitor className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
        );
      case "paper":
        return (
          <Newspaper className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
        );
      case "light":
        return <Sun className="w-3.5 h-3.5 text-brand" aria-hidden="true" />;
      case "midnight":
        return <Moon className="w-3.5 h-3.5 text-brand" aria-hidden="true" />;
    }
  };

  const getThemeLabel = (t: ReadingTheme) => {
    switch (t) {
      case "system":
        return systemPrefersDark ? "跟随系统(深)" : "跟随系统(浅)";
      case "paper":
        return "纸质晨报";
      case "light":
        return "晨曦极简";
      case "midnight":
        return "暗夜静读";
    }
  };

  const themeAriaLabel = `切换阅读模式，当前为${getThemeLabel(theme)}（快捷键 T）`;

  return (
    <>
      <header className="site-header-sticky">
        <div className="site-header-bar">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[3.5rem] py-2 flex items-center justify-between gap-2">
            {/* Logo 与报刊版头 */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group min-w-0 rounded-lg"
            >
              <BrandLogo
                size={32}
                decorative
                className="w-8 h-8 rounded-lg shadow-2xs motion-safe:group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-serif-title text-lg font-bold text-ink tracking-tight group-hover:text-brand transition-colors truncate">
                  Daily Briefing
                </span>
                <span className="hidden md:inline text-[11px] uppercase font-mono px-1.5 py-0.5 rounded bg-subtle text-ink-2 border border-line tracking-wider shrink-0">
                  晨刊 · 智汇版
                </span>
                {today && (
                  <time
                    suppressHydrationWarning
                    className="text-xs text-ink-muted font-normal hidden sm:inline shrink-0"
                  >
                    · {today}
                  </time>
                )}
              </div>
            </Link>

            {/* 右侧动作入口：主题切换 + 快捷键 + 设置/返回 */}
            <nav
              aria-label="主导航"
              className="flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeAriaLabel}
                title={`当前模式: ${getThemeLabel(theme)} (按 T 快捷切换)`}
                className="min-h-[32px] min-w-[32px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs font-medium text-ink-2 hover:text-ink hover:border-line-strong hover:bg-subtle transition-colors shadow-2xs cursor-pointer"
              >
                {renderThemeIcon()}
                <span className="hidden sm:inline text-xs font-sans">
                  {getThemeLabel(theme)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                aria-label="查看键盘快捷键"
                title="查看键盘快捷键 (?)"
                className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-line bg-card text-ink-muted hover:text-ink hover:border-line-strong hover:bg-subtle transition-colors shadow-2xs cursor-pointer hidden sm:inline-flex items-center justify-center"
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
              </button>

              {isSettings ? (
                <Link
                  href="/"
                  className="min-h-[32px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>返回晨报</span>
                </Link>
              ) : (
                <Link
                  href="/settings"
                  aria-label="设置中心"
                  className="min-h-[32px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-medium text-ink-2 hover:text-ink hover:border-line-strong hover:bg-subtle transition-colors shadow-2xs"
                >
                  <Settings
                    className="w-3.5 h-3.5 text-ink-muted"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">设置</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}
