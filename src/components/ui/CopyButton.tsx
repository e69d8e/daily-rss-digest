"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

/**
 * 剪贴板写入：优先使用 Async Clipboard API，仅在非安全上下文或权限受限时
 * 回退到 `document.execCommand("copy")` 并在复制后恢复先前焦点。
 */
function legacyCopy(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null;
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

export async function writeClipboardText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return legacyCopy(text);
  } catch {
    return legacyCopy(text);
  }
}

// VoiceOver 会跳过与上一次完全相同的 live-region 文本，重复播报时追加不间断空格。
let lastAnnouncement = "";

function formatAnnouncement(message: string): string {
  const next = message === lastAnnouncement ? `${message}\u00A0` : message;
  lastAnnouncement = next;
  return next;
}

// 全局注册一次 Invoker Command (`--copy`) 监听器（带无 CommandEvent 时的单路径点击回退）
type CopyCallback = (ok: boolean) => void;
const buttonCallbacks = new WeakMap<HTMLButtonElement, CopyCallback>();
let commandListenerBound = false;

async function handleInvokerCopy(button: HTMLButtonElement, target: Element | null) {
  if (!target) return;
  const text =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : (target as HTMLElement).innerText?.trim() || target.textContent?.trim() || "";
  if (!text) return;
  const ok = await writeClipboardText(text);
  buttonCallbacks.get(button)?.(ok);
}

function ensureCopyCommandListener() {
  if (commandListenerBound || typeof document === "undefined") return;
  commandListenerBound = true;

  if ("CommandEvent" in window) {
    // `command` 事件不冒泡，需在 document 捕获阶段监听
    document.addEventListener(
      "command",
      (event: Event) => {
        const cmdEvent = event as Event & {
          command?: string;
          source?: Element | null;
        };
        if (
          cmdEvent.command === "--copy" &&
          cmdEvent.source instanceof HTMLButtonElement
        ) {
          void handleInvokerCopy(cmdEvent.source, event.target as Element | null);
        }
      },
      true
    );
  } else {
    // 浏览器不支持 Invoker Commands 时的单路径 click 回退
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      const targetEl = event.target as Element | null;
      const button = targetEl?.closest?.('button[command="--copy"]');
      if (!(button instanceof HTMLButtonElement)) return;
      const forId = button.getAttribute("commandfor");
      if (!forId) return;
      const target = document.getElementById(forId);
      if (target) {
        void handleInvokerCopy(button, target);
      }
    });
  }
}

export interface CopyButtonProps {
  /** 若提供 targetId，则使用原生 Invoker Command (`command="--copy" commandfor={targetId}`) */
  targetId?: string;
  /** 若复制内容由多段文本动态拼装（无单一目标 DOM 节点），传入文本获取函数 */
  getText?: () => string;
  /** 按钮可见文字（省略则为纯图标按钮） */
  label?: string;
  /** 成功态按钮文字 */
  copiedLabel?: string;
  /** 纯图标按钮必填无障碍名称 */
  ariaLabel?: string;
  /** 成功/失败回调（例如通知外部状态或统计） */
  onResult?: (ok: boolean) => void;
  className?: string;
  iconClassName?: string;
  /** 气泡定位方向 */
  tipAlign?: "end" | "center";
}

export default function CopyButton({
  targetId,
  getText,
  label,
  copiedLabel = "已复制",
  ariaLabel,
  onResult,
  className = "",
  iconClassName = "w-3.5 h-3.5",
  tipAlign = "end",
}: CopyButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [liveMessage, setLiveMessage] = useState("");

  const report = React.useCallback(
    (ok: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus("idle");
      setLiveMessage("");

      const message = ok ? "已复制" : "复制失败";
      requestAnimationFrame(() => {
        setStatus(ok ? "copied" : "failed");
        setLiveMessage(formatAnnouncement(message));
      });

      onResult?.(ok);

      timerRef.current = setTimeout(() => {
        setStatus("idle");
        setLiveMessage("");
      }, 2000);
    },
    [onResult]
  );

  useEffect(() => {
    if (!targetId) return;
    ensureCopyCommandListener();
    const btn = buttonRef.current;
    if (!btn) return;
    buttonCallbacks.set(btn, report);
    return () => {
      buttonCallbacks.delete(btn);
    };
  }, [targetId, report]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDirectClick = async () => {
    if (targetId || !getText) return;
    const text = getText();
    if (!text) return;
    const ok = await writeClipboardText(text);
    report(ok);
  };

  const invokerAttrs = targetId
    ? ({ command: "--copy", commandfor: targetId } as Record<string, string>)
    : {};

  return (
    <span className="mwg-copy">
      <button
        ref={buttonRef}
        type="button"
        {...invokerAttrs}
        onClick={targetId ? undefined : handleDirectClick}
        aria-label={label ? undefined : ariaLabel || "复制内容"}
        data-copied={status === "copied" ? "" : undefined}
        data-failed={status === "failed" ? "" : undefined}
        className={`mwg-copy-button min-h-[28px] min-w-[28px] inline-flex items-center justify-center gap-1.5 cursor-pointer ${className}`}
      >
        {status === "copied" ? (
          <Check className={`${iconClassName} text-success shrink-0`} aria-hidden="true" />
        ) : status === "failed" ? (
          <AlertCircle className={`${iconClassName} text-danger shrink-0`} aria-hidden="true" />
        ) : (
          <Copy className={`${iconClassName} shrink-0`} aria-hidden="true" />
        )}
        {label && (
          <span className={status === "copied" ? "text-success" : status === "failed" ? "text-danger" : ""}>
            {status === "copied" ? copiedLabel : status === "failed" ? "复制失败" : label}
          </span>
        )}
      </button>
      {/* Live region 必须置于 button 外部，且仅通过 opacity 显隐 */}
      <span
        role="status"
        className={`mwg-copy-tip ${tipAlign === "center" ? "mwg-copy-tip-center" : ""}`}
        data-visible={status !== "idle" ? "" : undefined}
        data-state={status}
      >
        {liveMessage}
      </span>
    </span>
  );
}
