"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Banner, Button } from "@/design";
import s from "./host.module.css";

// "Set up your profile" on host home (Change 4 chunk 4, FR-32) while the host has no handle. The API's
// checklist (GET /v1/host/home) has no profile step, so this is a banner the host can dismiss; the
// choice is kept in this browser only.
const KEY = "gventz.profileBanner.dismissed";

export default function ProfileSetupBanner({ title, body, action, dismiss }: { title: string; body: string; action: string; dismiss: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Private mode: it stays hidden until the page is reloaded.
    }
  };
  return (
    <Banner
      tone="info"
      title={title}
      className={s.profileBanner}
      action={
        <span className={s.bannerActions}>
          <Button href="/host/settings/profile" size="sm" variant="primary">{action}</Button>
          <Button type="button" size="sm" variant="ghost" icon={<X size={16} strokeWidth={1.75} aria-hidden />} aria-label={dismiss} onClick={close} />
        </span>
      }
    >
      {body}
    </Banner>
  );
}
