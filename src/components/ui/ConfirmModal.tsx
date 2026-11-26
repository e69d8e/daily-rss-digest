"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useId,
} from "react";
import { Trash2, AlertTriangle, X, Info } from "lucide-react";
import ModalDialog from "@/components/ui/ModalDialog";

export type ConfirmVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title?: string;
  content: React.ReactNode;
  targetName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
  targetName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = "请确认操作",
  content,
  targetName,
  confirmText = "确认",
  cancelText = "取消",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const titleId = useId();
  const isDestructive = variant === "danger" || variant === "warning";

  const renderIcon = () => {
    switch (variant) {
      case "danger":
        return (
          <div className="w-10 h-10 rounded-xl bg-danger-soft border border-danger-border text-danger flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </div>
        );
      case "warning":
        return (
          <div className="w-10 h-10 rounded-xl bg-warning-soft border border-warning-border text-warning flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
        );
      case "info":
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-muted-surface border border-line text-ink-2 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" aria-hidden="true" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case "danger":
        return "bg-danger hover:opacity-90 text-white shadow-xs";
      case "warning":
        return "bg-brand hover:bg-brand-hover text-white shadow-xs";
      case "info":
      default:
        return "bg-action hover:bg-action-hover text-action-fg shadow-xs";
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onCancel}
      closedBy={isLoading ? "none" : "any"}
      preventClose={isLoading}
      ariaLabelledBy={titleId}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl shadow-2xl overflow-hidden bg-subtle"
    >
      <div className="p-5 sm:p-6 relative">
        {/* 可见关闭按钮 */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="关闭确认窗口"
          className="absolute top-4 end-4 min-h-[28px] min-w-[28px] p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-muted-surface transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center justify-center"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3.5">
          {renderIcon()}

          <div className="flex-1 pt-0.5 pe-6 min-w-0">
            <h1
              id={titleId}
              className="font-serif-title text-base sm:text-lg font-bold text-ink tracking-tight"
            >
              {title}
            </h1>

            {content && (
              <div className="text-xs sm:text-sm text-ink-2 leading-relaxed mt-2">
                {content}
              </div>
            )}

            {targetName && (
              <div className="mt-3 p-2.5 bg-card border border-line rounded-xl text-xs font-medium text-ink break-all flex items-center gap-2 shadow-2xs">
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    variant === "danger"
                      ? "bg-danger"
                      : variant === "warning"
                      ? "bg-warning"
                      : "bg-ink-muted"
                  }`}
                />
                <span className="truncate">{targetName}</span>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作按钮：高风险操作将 autofocus 置于安全操作“取消”上 */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            autoFocus={isDestructive}
            className="px-4 py-2 rounded-lg text-xs font-medium text-ink-2 hover:text-ink bg-card border border-line hover:bg-muted-surface transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus={!isDestructive}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${getConfirmButtonClasses()}`}
          >
            {isLoading ? "处理中..." : confirmText}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
  }>({
    isOpen: false,
    options: { content: "" },
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    // 若上一个确认框仍在等待结果，先以 false 结算，避免 Promise 悬挂
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        options,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.options.title}
        content={modalState.options.content}
        targetName={modalState.options.targetName}
        confirmText={modalState.options.confirmText}
        cancelText={modalState.options.cancelText}
        variant={modalState.options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}
