"use client";

import React, { useEffect, useRef } from "react";

interface ScrollFadeContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 子项数量变化时重新观察首尾元素 */
  itemCount?: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 带渐隐边缘滚动提示的横向滚动容器。
 * 遵循 modern-web-guidance `scrollability-affordance-hints` & `tabs`：
 * - 现代浏览器使用 CSS `@property --fade-start/--fade-end` + `mask` + `animation-timeline: scroll(self inline)` 驱动，零滚动监听；
 * - 隐藏滚动条时必须在不支持 `animation-timeline: scroll()` 的浏览器提供 `IntersectionObserver` 回退，通过 `.more-start` / `.more-end` 驱动渐隐遮罩。
 */
export default function ScrollFadeContainer({
  itemCount = 0,
  containerRef: externalRef,
  className = "",
  children,
  ...rest
}: ScrollFadeContainerProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = externalRef ?? internalRef;

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller || typeof window === "undefined") return;
    if (window.CSS?.supports?.("animation-timeline", "scroll(self inline)")) {
      return;
    }

    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) {
      scroller.classList.remove("more-start", "more-end");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          if (target === first) {
            scroller.classList.toggle("more-start", intersectionRatio < 1);
          }
          if (target === last) {
            scroller.classList.toggle("more-end", intersectionRatio < 1);
          }
        }
      },
      { root: scroller, threshold: 1, rootMargin: "1px" }
    );

    observer.observe(first);
    if (last !== first) {
      observer.observe(last);
    }

    return () => observer.disconnect();
  }, [itemCount, ref]);

  return (
    <div
      ref={ref}
      className={`mwg-fade-scroller no-scrollbar ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
