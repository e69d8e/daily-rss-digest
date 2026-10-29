"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ArrowLeft, Sun, Moon, Newspaper, HelpCircle } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { useTheme, ReadingTheme } from "@/components/ui/ThemeContext";
import KeyboardShortcutsModal from "@/components/ui/KeyboardShortcutsModal";
import { isAnyModalOpen } from "@/lib/modalStack";

export default function Navbar() {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith("/settings");
  const [today, setToday] = useState("");
  const { theme, toggleTheme } = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      const weekday = weekdays[now.getDay()];
      setToday(`${month} 月 ${day} 日 ${weekday}`);
    } catch {
      setToday("");
    }
  }, []);

  // 全局键盘监听 T 切换主题与 ? 唤起快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 弹窗（阅读器/确认框/帮助面板等）打开时让路，避免快捷键穿透到背景页面
      if (isAnyModalOpen()) return;
      // 不响应组合键与长按连发（如 Alt+T、按住 T 连续轮换主题）
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
      case "paper":
        return <Newspaper className="w-3.5 h-3.5 text-amber-800" />;
      case "light":
        return <Sun className="w-3.5 h-3.5 text-blue-600" />;
      case "midnight":
        return <Moon className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getThemeLabel = (t: ReadingTheme) => {
    switch (t) {
      case "paper":
        return "纸质晨报";
      case "light":
        return "晨曦极简";
      case "midnight":
        return "暗夜静读";
    }
  };

  return (
    <>
      <header className="border-b border-[#eae6df] bg-white/95 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo 与报刊版头 */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo
              size={32}
              className="w-8 h-8 rounded-lg shadow-2xs group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="flex items-baseline gap-2">
              <span className="font-serif-title text-lg font-bold text-stone-900 tracking-tight group-hover:text-amber-900 transition-colors">
                Daily Briefing
              </span>
              <span className="hidden md:inline text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200/60 tracking-wider">
                晨刊 · 智汇版
              </span>
              {today && (
                <span
                  suppressHydrationWarning
                  className="text-xs text-stone-400 font-normal hidden sm:inline"
                >
                  · {today}
                </span>
              )}
            </div>
          </Link>

          {/* 右侧动作入口：主题切换 + 快捷键 + 设置/返回 */}
          <div className="flex items-center gap-2">
            {/* 主题切换按钮 */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-2xs cursor-pointer"
              title={`当前模式: ${getThemeLabel(theme)} (按 T 快捷切换)`}
            >
              {renderThemeIcon()}
              <span className="hidden sm:inline text-[11px] font-sans">
                {getThemeLabel(theme)}
              </span>
            </button>

            {/* 快捷键帮助按钮 */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 rounded-lg border border-[#eae6df] bg-white text-stone-500 hover:text-stone-900 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-2xs cursor-pointer hidden sm:flex items-center justify-center"
              title="查看键盘快捷键 (?)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {/* 设置或返回主页 */}
            {isSettings ? (
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-amber-800 transition-colors shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回晨报</span>
              </Link>
            ) : (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-medium text-stone-700 hover:text-stone-950 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-2xs"
                title="设置"
              >
                <Settings className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline">设置</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 快捷键弹窗 */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
}
