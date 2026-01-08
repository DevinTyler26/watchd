"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "error" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastContextValue = {
  addToast: (
    message: string,
    tone: ToastTone,
    durationMs?: number,
    action?: ToastAction
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, tone: ToastTone, durationMs = 2400, action?: ToastAction) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, tone, action }]);
      const timer = window.setTimeout(() => removeToast(id), durationMs);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed left-1/2 top-6 z-[1100] flex max-w-sm -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl shadow-black/30 ${
              toast.tone === "success"
                ? "border-emerald/40 bg-emerald/95 text-emerald-50"
                : toast.tone === "warning"
                ? "border-amber-400/40 bg-amber-400/95 text-amber-50"
                : "border-rose-400/40 bg-rose-400/95 text-rose-50"
            }`}
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => toast.action?.onClick()}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 transition hover:border-white/40 hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
