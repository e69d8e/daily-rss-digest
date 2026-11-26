"use client";

import React, { useEffect, useRef, useState } from "react";

let supportsDisplayTransitionCache: boolean | undefined;

/**
 * 探测浏览器是否真正支持离散 `display` 过渡（Firefox 129+ 解析
 * `transition-behavior: allow-discrete` 但不实际过渡 `display`，需真实探测）。
 */
function canTransitionDisplay(): boolean {
  if (supportsDisplayTransitionCache !== undefined) {
    return supportsDisplayTransitionCache;
  }
  if (
    typeof window === "undefined" ||
    !window.CSS?.supports?.("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = "none";
  supportsDisplayTransitionCache = getComputedStyle(probe).display === "block";
  probe.remove();
  return supportsDisplayTransitionCache;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.CSS?.supports?.("overlay", "auto")) &&
    canTransitionDisplay()
  );
}

function isPointerOutsideDialog(
  e: PointerEvent,
  dialog: HTMLDialogElement
): boolean {
  const r = dialog.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
}

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** `any`: 支持点击遮罩轻触关闭与 Esc；`closerequest`: 仅 Esc/返回手势；`none`: 仅代码关闭 */
  closedBy?: "any" | "closerequest" | "none";
  /** 例如提交/保存中阻止关闭 */
  preventClose?: boolean;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  /** 对话框自身容器样式（切勿传入无条件 display 类如 `flex` / `block`，请使用 `open:flex`） */
  className?: string;
  /** 对话框容器 ref（供外部查询顶层状态或滚动控制） */
  dialogRef?: React.RefObject<HTMLDialogElement | null>;
  children: React.ReactNode;
}

/**
 * 统一原生 `<dialog>` 模态框基础设施：
 * - 通过 `showModal()` 进入原生 Top Layer、自动焦点围栏、背景 inert、关闭时自动归还焦点；
 * - 不附加冗余 `role="dialog"` / `aria-modal` 与手写 Esc 监听器；
 * - 使用 `closedby` 实现声明式轻触关闭，并为无 `closedBy` 的浏览器提供指针按下+抬起外侧回退；
 * - CSS `overscroll-behavior: contain` + `::backdrop { overflow: hidden; overscroll-behavior: contain }` 阻止背景滚动穿透；
 * - 使用 `@starting-style` + `overlay` + `transition-behavior: allow-discrete` 实现进出场过渡，并为 Firefox/Safari 提供 `data-closing` + `getAnimations()` 退场回退。
 */
export default function ModalDialog({
  isOpen,
  onClose,
  closedBy = "any",
  preventClose = false,
  ariaLabelledBy,
  ariaLabel,
  className = "",
  dialogRef: externalRef,
  children,
}: ModalDialogProps) {
  const internalRef = useRef<HTMLDialogElement>(null);
  const ref = externalRef ?? internalRef;
  const [rendered, setRendered] = useState(isOpen);
  const onCloseRef = useRef(onClose);
  const preventCloseRef = useRef(preventClose);
  const closingRef = useRef(false);

  if (isOpen && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    onCloseRef.current = onClose;
    preventCloseRef.current = preventClose;
  }, [onClose, preventClose]);

  const effectiveClosedBy = preventClose ? "none" : closedBy;

  const animateClose = async (dialog: HTMLDialogElement) => {
    if (!dialog.open || closingRef.current) return;
    closingRef.current = true;

    try {
      if (!supportsTopLayerExit()) {
        dialog.setAttribute("data-closing", "");
        const animations = dialog.getAnimations({ subtree: true });
        if (animations.length > 0) {
          await Promise.race([
            Promise.allSettled(animations.map((a) => a.finished)),
            new Promise<void>((resolve) => setTimeout(resolve, 400)),
          ]);
        }
        if (!dialog.hasAttribute("data-closing")) {
          closingRef.current = false;
          return;
        }
        dialog.removeAttribute("data-closing");
      }
      if (dialog.open) {
        dialog.close();
      }
    } finally {
      closingRef.current = false;
    }
  };

  // 同步 isOpen 到原生 dialog.showModal() / dialog.close()
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (isOpen && rendered) {
      dialog.removeAttribute("data-closing");
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // 防御极端情况下节点尚未接入 DOM
        }
      }
    } else if (!isOpen && dialog.open) {
      void animateClose(dialog);
    }
  }, [isOpen, rendered, ref]);

  // 监听原生 close / cancel 事件，并注册无 closedby 浏览器（Safari）的轻触关闭回退
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !rendered) return;

    const handleClose = () => {
      // 清空 returnValue，避免跨次打开残留旧值
      dialog.returnValue = "";
      dialog.removeAttribute("data-closing");

      // 在支持原生 top-layer 退场过渡的浏览器中，等过渡结束后再卸载子节点
      const finishUnmount = () => {
        if (!dialog.open) {
          setRendered(false);
        }
      };

      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0 && supportsTopLayerExit()) {
        void Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise<void>((resolve) => setTimeout(resolve, 350)),
        ]).then(finishUnmount);
      } else {
        finishUnmount();
      }

      onCloseRef.current();
    };

    const handleCancel = (event: Event) => {
      if (preventCloseRef.current || effectiveClosedBy === "none") {
        event.preventDefault();
        return;
      }
      if (!supportsTopLayerExit()) {
        event.preventDefault();
        void animateClose(dialog);
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    // Safari 等尚不支持 closedby 的浏览器轻触关闭回退：
    // 必须同时检查 pointerdown 与 pointerup 均在对话框矩形外，避免框选文字拖到遮罩时误关
    const needsLightDismissFallback =
      effectiveClosedBy === "any" &&
      typeof HTMLDialogElement !== "undefined" &&
      !("closedBy" in HTMLDialogElement.prototype);

    let pressedOutside = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isPointerOutsideDialog(e, dialog);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (
        !preventCloseRef.current &&
        pressedOutside &&
        isPointerOutsideDialog(e, dialog)
      ) {
        void animateClose(dialog);
      }
      pressedOutside = false;
    };

    if (needsLightDismissFallback) {
      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      if (needsLightDismissFallback) {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      }
    };
  }, [rendered, effectiveClosedBy, ref]);

  if (!rendered) return null;

  const closedByAttr = { closedby: effectiveClosedBy } as Record<string, string>;

  return (
    <dialog
      ref={ref}
      {...closedByAttr}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      className={`mwg-dialog ${className}`}
    >
      {children}
    </dialog>
  );
}
