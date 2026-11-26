/**
 * 原生 Top-Layer 模态弹窗状态协调工具。
 *
 * 相比旧版手写模块数组栈，现由原生 `<dialog>` + `showModal()` 接管 Top-Layer 叠层、
 * 焦点围栏与 Esc 逐层关闭；本模块仅提供轻量只读查询，供全局快捷键（翻日、切台、
 * 空格播放、主题切换等）判断当前是否存在已打开的模态对话框。
 */

/** 当前是否存在任意打开中的原生模态 `<dialog>` */
export function isAnyModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.querySelector("dialog:modal") !== null;
  } catch {
    return document.querySelector("dialog[open]") !== null;
  }
}

/** 指定 `<dialog>` 元素是否为当前最顶层的打开模态框 */
export function isTopModalElement(dialog: HTMLDialogElement | null): boolean {
  if (!dialog || typeof document === "undefined") return false;
  try {
    const modals = document.querySelectorAll("dialog:modal");
    return modals.length > 0 && modals[modals.length - 1] === dialog;
  } catch {
    const openDialogs = document.querySelectorAll("dialog[open]");
    return openDialogs.length > 0 && openDialogs[openDialogs.length - 1] === dialog;
  }
}
