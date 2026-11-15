"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const t = useTranslations("dashboard.copyLink");
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <span className="copy-url">{url}</span>
      <button type="button" className="btn-small" onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>{t(copied ? "copied" : "copy")}</button>
    </div>
  );
}
