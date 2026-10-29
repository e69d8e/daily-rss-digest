/**
 * 模块级弹窗栈：协调全局键盘快捷键与弹窗的响应优先级。
 * 纯模块状态、不触发 React 重渲染 —— 各快捷键监听在事件发生时同步读取栈。
 *
 * 约定：
 * - 全局快捷键（翻日、切频道、空格播放、主题切换等）在 isAnyModalOpen() 时让路；
 * - Esc 只由栈顶弹窗响应（isTopModal），避免多个弹窗被同时关闭。
 */

const modalStack: string[] = [];

export function pushModal(id: string): void {
  if (!modalStack.includes(id)) {
    modalStack.push(id);
  }
}

export function popModal(id: string): void {
  const idx = modalStack.lastIndexOf(id);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }
}

/** 是否有任何弹窗打开 */
export function isAnyModalOpen(): boolean {
  return modalStack.length > 0;
}

/** 指定弹窗是否位于栈顶（仅栈顶弹窗有权响应 Esc） */
export function isTopModal(id: string): boolean {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === id;
}
