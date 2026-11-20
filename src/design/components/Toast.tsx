"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Toast.module.css";

export type ToastTone = "info" | "success" | "warning" | "danger";
export type ToastOptions = { title: ReactNode; description?: ReactNode; tone?: ToastTone; duration?: number };
type ToastItem = ToastOptions & { id: number; open: boolean };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert } as const;

export type ToastProviderProps = {
  children: ReactNode;
  /** Accessible name of each toast's close button (translated by the caller). */
  closeLabel?: string;
  /** Accessible name of the toast region, e.g. "Notifications ({hotkey})". */
  label?: string;
  duration?: number;
};

/** Mount once near the root; then call `useToast().toast({ title })` anywhere below it. */
export function ToastProvider({ children, closeLabel = "Close", label, duration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((options: ToastOptions) => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { ...options, id, open: true }]);
  }, []);

  const close = (id: number) => (open: boolean) => {
    if (open) return;
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, open: false } : t)));
    // Remove after the exit animation.
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 300);
  };

  return (
    <ToastContext.Provider value={toast}>
      <RadixToast.Provider duration={duration} label={label}>
        {children}
        {toasts.map(({ id, open, title, description, tone = "info", duration: own }) => {
          const Icon = ICONS[tone];
          return (
            <RadixToast.Root
              key={id}
              open={open}
              onOpenChange={close(id)}
              duration={own}
              type={tone === "danger" ? "foreground" : "background"}
              className={cx(styles.toast, styles[tone])}
            >
              <Icon className={styles.icon} size={20} strokeWidth={1.75} aria-hidden />
              <div className={styles.body}>
                <RadixToast.Title className={styles.title}>{title}</RadixToast.Title>
                {description ? <RadixToast.Description className={styles.description}>{description}</RadixToast.Description> : null}
              </div>
              <RadixToast.Close className={styles.close} aria-label={closeLabel}>
                <X size={16} strokeWidth={1.75} aria-hidden />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

/** Returns `{ toast }`; must be used under `ToastProvider`. */
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>.");
  return useMemo(() => ({ toast }), [toast]);
}
