"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error Boundary caught exception:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
      <div className="bg-card rounded-2xl border border-line shadow-sm p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand-border/60 text-brand-ink flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif-title text-xl sm:text-2xl font-bold text-ink tracking-tight">
            晨报内容加载遇到异常
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
            可能由于网络波动或当前移动端浏览器环境差异造成。系统已隔离此异常，您可以尝试重新加载恢复。
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>重新尝试加载</span>
          </button>

          <Link
            href="/"
            onClick={() => reset()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-line bg-card text-ink-2 text-xs font-medium hover:bg-subtle transition-colors"
          >
            <Home className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
            <span>返回主页</span>
          </Link>
        </div>

        {/* 原生 <details>/<summary> 折叠诊断区（支持 interpolate-size 过渡） */}
        <details className="mwg-details pt-4 border-t border-line/70 text-start">
          <summary className="flex items-center justify-between w-full text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer py-1">
            <span>
              技术诊断信息 {error?.digest ? `(错误编号: ${error.digest})` : ""}
            </span>
            <ChevronDown
              className="mwg-details-chevron w-3.5 h-3.5 transition-transform duration-200"
              aria-hidden="true"
            />
          </summary>

          <div className="mt-2.5 p-3 rounded-lg bg-subtle border border-line text-xs font-mono text-ink-2 break-all space-y-1.5 overflow-x-auto">
            <div className="text-danger font-medium">
              {error?.message || "未知异常原因"}
            </div>
            {error?.stack && (
              <pre
                tabIndex={0}
                role="region"
                aria-label="错误调用栈"
                className="text-[11px] text-ink-muted leading-snug whitespace-pre-wrap max-h-40 overflow-y-auto"
              >
                <code>{error.stack}</code>
              </pre>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
