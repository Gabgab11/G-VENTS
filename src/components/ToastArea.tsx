"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ToastProvider } from "@/design/client";

/** A page's toasts (no ToastProvider is mounted site-wide yet): wrap the page content in it. */
export default function ToastArea({ children }: { children: ReactNode }) {
  const t = useTranslations("shared.share");
  return <ToastProvider closeLabel={t("close")}>{children}</ToastProvider>;
}
