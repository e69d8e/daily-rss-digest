"use client";

import React, { useId } from "react";
import {
  Keyboard,
  X,
  ArrowLeft,
  ArrowRight,
  Play,
  SunMoon,
  SlidersHorizontal,
} from "lucide-react";
import ModalDialog from "@/components/ui/ModalDialog";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  const titleId = useId();

  const shortcuts = [
    {
      key: "← / →",
      desc: "快速切换前一日 / 后一日晨报",
      icon: (
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <ArrowLeft className="w-3 h-3" />
          <ArrowRight className="w-3 h-3" />
        </span>
      ),
    },
    {
      key: "Space",
      desc: "播放 / 暂停语音早报",
      icon: <Play className="w-3 h-3" aria-hidden="true" />,
    },
    {
      key: "1 ~ 9",
      desc: "按序号快速切换频道栏目",
      icon: <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />,
    },
    {
      key: "T",
      desc: "轮换阅读模式（跟随系统 / 报刊纸质 / 晨曦明亮 / 暗夜静读）",
      icon: <SunMoon className="w-3 h-3" aria-hidden="true" />,
    },
    {
      key: "Esc",
      desc: "关闭正文详情抽屉或弹窗",
      icon: <X className="w-3 h-3" aria-hidden="true" />,
    },
    {
      key: "?",
      desc: "随时打开 / 关闭快捷键帮助面板",
      icon: <Keyboard className="w-3 h-3" aria-hidden="true" />,
    },
  ];

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      closedBy="any"
      ariaLabelledBy={titleId}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl shadow-2xl"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h1
                id={titleId}
                className="font-serif-title font-bold text-base text-ink"
              >
                键盘快捷操作指南
              </h1>
              <p className="text-xs text-ink-muted">
                极客式高效浏览，按键即达
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭快捷键指南"
            className="min-h-[28px] min-w-[28px] p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-muted-surface transition-colors cursor-pointer inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="divide-y divide-line/70">
          {shortcuts.map((s) => (
            <li
              key={s.key}
              className="py-2.5 flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-2.5 text-ink-2">
                <span className="text-ink-muted shrink-0">{s.icon}</span>
                <span>{s.desc}</span>
              </div>
              <kbd className="px-2 py-1 bg-subtle border border-line-strong/60 rounded font-mono text-[11px] font-semibold text-ink shadow-2xs shrink-0">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-4 py-2 bg-action text-action-fg rounded-lg text-xs font-semibold hover:bg-action-hover transition-colors cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
