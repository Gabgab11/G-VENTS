"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/design";
import styles from "./workspace.module.css";

export default function CopyLink({ url }: { url: string }) {
  const t = useTranslations("dashboard.copyLink");
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.copy}>
      <span className={styles.copyUrl}>{url}</span>
      <Button size="sm" onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>{t(copied ? "copied" : "copy")}</Button>
      <span className="sr-only" role="status">{copied ? t("copied") : ""}</span>
    </div>
  );
}
