"use client";

import { useEffect } from "react";

function upgradeSwitchInput(input: HTMLInputElement) {
  if (input.classList.contains("switch")) return;
  input.classList.add("switch");
  input.setAttribute("role", "switch");
}

/**
 * 按需条件加载现代 Web 平台 Polyfill：
 * 严格遵循 modern-web-guidance 规范——仅在特性探测失败时动态导入，
 * 原生支持的浏览器零加载成本。
 */
export default function PolyfillLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let switchObserver: MutationObserver | null = null;

    // 1. <input type="checkbox" switch>（Safari 17.4+ 原生支持）
    //    Next.js Turbopack 尚未实现 import.meta.resolve，直接加载 polyfill CSS 并增强语义与样式，避免运行时异常
    if (
      typeof HTMLInputElement !== "undefined" &&
      !("switch" in HTMLInputElement.prototype)
    ) {
      void import("input-switch-polyfill/input-switch-polyfill.css").catch(
        () => {
          // 降级为标准复选框
        }
      );

      const scan = (root: ParentNode) => {
        root
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"][switch]')
          .forEach(upgradeSwitchInput);
      };

      scan(document);

      switchObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (
              node instanceof HTMLInputElement &&
              node.matches('input[type="checkbox"][switch]')
            ) {
              upgradeSwitchInput(node);
            } else {
              scan(node);
            }
          }
        }
      });

      if (document.body) {
        switchObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    }

    // 2. focusgroup 属性（tablist 漫游焦点；Chromium 150+ 原生支持）
    if (
      typeof HTMLElement !== "undefined" &&
      !Object.hasOwn(HTMLElement.prototype, "focusGroup")
    ) {
      void import("@microsoft/focusgroup-polyfill")
        .then(({ polyfillBodyAndObserve, polyfill }) => {
          if (typeof polyfillBodyAndObserve === "function") {
            polyfillBodyAndObserve();
          } else if (typeof polyfill === "function" && document.body) {
            polyfill(document.body);
          }
        })
        .catch(() => {
          // 降级到组件内置键盘方向键处理
        });
    }

    return () => {
      switchObserver?.disconnect();
    };
  }, []);

  return null;
}
