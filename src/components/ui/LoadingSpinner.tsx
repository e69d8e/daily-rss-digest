"use client";

import React from "react";

interface LoadingSpinnerProps {
  /** 无障碍名称，供屏幕阅读器播报当前加载语义 */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "1rem",
  md: "1.75rem",
  lg: "2.5rem",
};

const THICKNESS_MAP: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "2px",
  md: "2.5px",
  lg: "3px",
};

/**
 * 基于原生不确定态 `<progress>` 的无障碍加载指示器。
 * 遵循 modern-web-guidance `spinner` 规范：
 * - 省略 `value` 属性以暴露原生 indeterminate progressbar 语义；
 * - 使用 `conic-gradient` + `background-clip: border-area`（带 `mask-image` 回退）；
 * - 遵循 `prefers-reduced-motion` 降速与 `forced-colors` 系统色适配。
 */
export default function LoadingSpinner({
  label = "正在加载",
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <progress
      aria-label={label}
      className={`mwg-spinner ${className}`}
      style={
        {
          "--size": SIZE_MAP[size],
          "--thickness": THICKNESS_MAP[size],
        } as React.CSSProperties
      }
    />
  );
}
