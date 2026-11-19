"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/design";

export default function CopyLink({ url }: { url: string }) {
  const t = useTranslations("dashboard.copyLink");
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <span className="copy-url">{url}</span>
      <Button size="sm" onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>{t(copied ? "copied" : "copy")}</Button>
    </div>
  );
}
