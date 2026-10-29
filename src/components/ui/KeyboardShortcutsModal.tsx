"use client";

import React, { useEffect, useRef } from "react";
import { Keyboard, X, ArrowLeft, ArrowRight, Play, SunMoon, SlidersHorizontal } from "lucide-react";
import { isTopModal, popModal, pushModal } from "@/lib/modalStack";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    pushModal("shortcuts-modal");
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal("shortcuts-modal")) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      popModal("shortcuts-modal");
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      key: "← / →",
      desc: "快速切换前一日 / 后一日晨报",
      icon: <span className="flex items-center gap-0.5"><ArrowLeft className="w-3 h-3" /><ArrowRight className="w-3 h-3" /></span>,
    },
    {
      key: "Space",
      desc: "播放 / 暂停语音早报",
      icon: <Play className="w-3 h-3" />,
    },
    {
      key: "1 ~ 9",
      desc: "按序号快速切换频道栏目",
      icon: <SlidersHorizontal className="w-3 h-3" />,
    },
    {
      key: "T",
      desc: "轮换阅读模式 (报刊纸质 / 晨曦明亮 / 暗夜静读)",
      icon: <SunMoon className="w-3 h-3" />,
    },
    {
      key: "Esc",
      desc: "关闭正文详情抽屉或弹窗",
      icon: <X className="w-3 h-3" />,
    },
    {
      key: "?",
      desc: "随时打开 / 关闭快捷键帮助面板",
      icon: <Keyboard className="w-3 h-3" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="键盘快捷操作指南"
    >
      <div
        className="bg-white rounded-2xl border border-[#eae6df] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#eae6df]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-title font-bold text-base text-stone-900">
                键盘快捷操作指南
              </h3>
              <p className="text-[11px] text-stone-500">
                极客式高效浏览，按键即达
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-[#eae6df]/70">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="py-2.5 flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-2.5 text-stone-700">
                <span className="text-stone-400">{s.icon}</span>
                <span>{s.desc}</span>
              </div>
              <kbd className="px-2 py-1 bg-stone-100 border border-stone-300 rounded font-mono text-[11px] font-semibold text-stone-800 shadow-2xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-amber-800 transition-colors cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
