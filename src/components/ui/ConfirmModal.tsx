"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Trash2, AlertTriangle, X, Info } from "lucide-react";

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
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (variant) {
      case "danger":
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        );
      case "warning":
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case "info":
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus:ring-2 focus:ring-rose-400/40";
      case "warning":
        return "bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white shadow-xs focus:ring-2 focus:ring-amber-400/40";
      case "info":
      default:
        return "bg-stone-900 hover:bg-stone-800 active:bg-black text-white shadow-xs focus:ring-2 focus:ring-stone-400/40";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[#fcfbf9] w-full max-w-md rounded-2xl border border-[#eae6df] shadow-2xl overflow-hidden p-5 sm:p-6 animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 右上角关闭按钮 */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          {renderIcon()}

          <div className="flex-1 pt-0.5 pr-4">
            <h3 className="font-serif-title text-base sm:text-lg font-bold text-stone-900 tracking-tight">
              {title}
            </h3>

            {content && (
              <div className="text-xs sm:text-[13px] text-stone-600 leading-relaxed mt-2">
                {content}
              </div>
            )}

            {targetName && (
              <div className="mt-3 p-2.5 bg-white border border-[#eae6df] rounded-xl text-xs font-medium text-stone-800 break-all flex items-center gap-2 shadow-2xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    variant === "danger"
                      ? "bg-rose-500"
                      : variant === "warning"
                      ? "bg-amber-500"
                      : "bg-stone-500"
                  }`}
                />
                <span className="truncate">{targetName}</span>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-[#eae6df]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${getConfirmButtonClasses()}`}
          >
            {isLoading ? "处理中..." : confirmText}
          </button>
        </div>
      </div>
    </div>
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
