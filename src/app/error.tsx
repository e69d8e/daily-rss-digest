"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // 记录错误日志供排查
    console.error("Next.js Error Boundary caught exception:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white rounded-2xl border border-[#eae6df] shadow-sm p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="font-serif-title text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            晨报内容加载遇到异常
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
            可能由于网络波动或当前移动端浏览器环境差异造成。系统已隔离此异常，您可以尝试重新加载恢复。
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新尝试加载</span>
          </button>

          <Link
            href="/"
            onClick={() => reset()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#eae6df] bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
          >
            <Home className="w-3.5 h-3.5 text-stone-400" />
            <span>返回主页</span>
          </Link>
        </div>

        {/* 错误堆栈与调试信息折叠区 */}
        <div className="pt-4 border-t border-[#eae6df]/70 text-left">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-[11px] text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <span>技术诊断信息 {error?.digest ? `(错误编号: ${error.digest})` : ""}</span>
            {showDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showDetails && (
            <div className="mt-2.5 p-3 rounded-lg bg-stone-50 border border-stone-200/80 text-[11px] font-mono text-stone-600 break-all space-y-1.5 overflow-x-auto">
              <div className="text-rose-700 font-medium">
                {error?.message || "未知异常原因"}
              </div>
              {error?.stack && (
                <pre className="text-[10px] text-stone-400 leading-tight whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
