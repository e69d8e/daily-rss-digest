"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";

export default function Navbar() {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith("/settings");

  const today = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <header className="border-b border-[#eae6df] bg-[#ffffff] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo 与主标题 */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <BrandLogo
            size={32}
            className="w-8 h-8 rounded-lg shadow-2xs group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="flex items-baseline gap-2">
            <span className="font-serif-title text-lg font-bold text-stone-900 tracking-tight group-hover:text-amber-900 transition-colors">
              Daily Briefing
            </span>
            <span className="text-xs text-stone-400 font-normal hidden sm:inline">
              · {today}
            </span>
          </div>
        </Link>

        {/* 右侧动作入口 */}
        <div>
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
              <span>设置</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
