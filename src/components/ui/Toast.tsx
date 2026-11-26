"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * 通知屏幕阅读器：优先使用原生 `document.ariaNotify()`，在不支持的浏览器回退至预挂载 live region。
 */
function announceToast(message: string, fallbackEl: HTMLElement | null) {
  if (typeof document === "undefined") return;
  const docWithNotify = document as Document & {
    ariaNotify?: (text: string, options?: { priority?: string }) => void;
  };
  if (typeof docWithNotify.ariaNotify === "function") {
    try {
      docWithNotify.ariaNotify(message, { priority: "normal" });
      return;
    } catch {
      // 回退到 live region
    }
  }
  if (fallbackEl) {
    fallbackEl.textContent = "";
    requestAnimationFrame(() => {
      fallbackEl.textContent = message;
    });
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const regionRef = useRef<HTMLDivElement>(null);
  const liveFallbackRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const pausedIdsRef = useRef<Set<string>>(new Set());
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 条件按需加载 Popover Polyfill（仅当原生不支持时）
  useEffect(() => {
    if (
      typeof HTMLElement !== "undefined" &&
      !Object.hasOwn(HTMLElement.prototype, "popover")
    ) {
      void import("@oddbird/popover-polyfill").catch(() => {
        // ignore
      });
    }
  }, []);

  // 根据是否存在通知同步顶层 popover="manual" 的开启/关闭状态
  useEffect(() => {
    const el = regionRef.current as
      | (HTMLDivElement & {
          showPopover?: () => void;
          hidePopover?: () => void;
        })
      | null;
    if (!el) return;

    if (toasts.length > 0) {
      try {
        if (!el.matches(":popover-open")) {
          el.showPopover?.();
        }
      } catch {
        // polyfill 尚未就绪或已打开
        try {
          el.showPopover?.();
        } catch {
          // ignore
        }
      }
    } else {
      try {
        el.hidePopover?.();
      } catch {
        // ignore
      }
    }
  }, [toasts.length]);

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: string, restoreFocus = false) => {
      clearTimer(id);
      pausedIdsRef.current.delete(id);

      setToasts((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);

        if (restoreFocus) {
          requestAnimationFrame(() => {
            if (next.length > 0) {
              const targetIdx = Math.min(idx, next.length - 1);
              const nextBtn = regionRef.current?.querySelector<HTMLButtonElement>(
                `button[data-toast-close="${next[targetIdx]?.id}"]`
              );
              nextBtn?.focus();
            } else if (previousFocusRef.current?.isConnected) {
              previousFocusRef.current.focus();
              previousFocusRef.current = null;
            }
          });
        }

        return next;
      });
    },
    [clearTimer]
  );

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return;
      clearTimer(id);
      const timer = setTimeout(() => {
        if (!pausedIdsRef.current.has(id)) {
          removeToast(id);
        }
      }, duration);
      timersRef.current.set(id, timer);
    },
    [clearTimer, removeToast]
  );

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newToast: ToastItem = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
      scheduleDismiss(id, duration);
      announceToast(message, liveFallbackRef.current);
    },
    [scheduleDismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const success = useCallback(
    (msg: string, d?: number) => showToast(msg, "success", d),
    [showToast]
  );
  const error = useCallback(
    (msg: string, d?: number) => showToast(msg, "error", d ?? 5500),
    [showToast]
  );
  const info = useCallback(
    (msg: string, d?: number) => showToast(msg, "info", d),
    [showToast]
  );

  const value = useMemo(
    () => ({ toast: { success, error, info }, showToast }),
    [success, error, info, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* 无 ariaNotify() 时的预挂载无障碍播报区，附带前置上下文说明 */}
      <p className="visually-hidden" id="mwg-toast-announcer-label">
        系统通知播报
      </p>
      <div
        ref={liveFallbackRef}
        aria-live="polite"
        aria-atomic="true"
        aria-labelledby="mwg-toast-announcer-label"
        className="visually-hidden"
      />

      {/* Top-Layer popover="manual" 通知区域：不轻触消失，兼容多条堆叠 */}
      <div
        ref={regionRef}
        popover="manual"
        role="region"
        aria-label="系统通知"
        className="mwg-toast-region"
        onFocusCapture={() => {
          if (
            document.activeElement instanceof HTMLElement &&
            !regionRef.current?.contains(document.activeElement)
          ) {
            previousFocusRef.current = document.activeElement;
          }
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            onMouseEnter={() => {
              pausedIdsRef.current.add(t.id);
              clearTimer(t.id);
            }}
            onMouseLeave={() => {
              pausedIdsRef.current.delete(t.id);
              scheduleDismiss(t.id, 2000);
            }}
            onFocus={() => {
              pausedIdsRef.current.add(t.id);
              clearTimer(t.id);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                pausedIdsRef.current.delete(t.id);
                scheduleDismiss(t.id, 2000);
              }
            }}
            className={`mwg-toast-item flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${
              t.type === "success"
                ? "bg-emerald-950/95 border-emerald-700 text-emerald-50"
                : t.type === "error"
                ? "bg-rose-950/95 border-rose-700 text-rose-50"
                : "bg-inverted/95 border-inverted-line text-inverted-fg"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {t.type === "success" && (
                <CheckCircle2
                  className="w-4 h-4 text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              {t.type === "error" && (
                <AlertCircle
                  className="w-4 h-4 text-rose-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              {t.type === "info" && (
                <Info
                  className="w-4 h-4 text-amber-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="text-xs font-medium leading-relaxed break-words">
                {t.message}
              </span>
            </div>
            <button
              type="button"
              data-toast-close={t.id}
              onClick={() => removeToast(t.id, true)}
              aria-label="关闭通知"
              className="min-h-[28px] min-w-[28px] p-1 rounded-md hover:bg-white/15 text-white/75 hover:text-white transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
