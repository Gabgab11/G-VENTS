"use client";

import { useRouter } from "next/navigation";
import { backWouldLeaveSession, readAuthFloor } from "@/lib/auth-floor";

export default function BackLink({ fallback, label = "← Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back-link"
      aria-label={label.replace(/[←\s]/g, "") ? undefined : "Back"}
      onClick={() => {
        // Never back into the sign-in or Google pages after signing in: go to the page's parent instead.
        if (typeof window !== "undefined" && !backWouldLeaveSession(window.history.length, readAuthFloor())) router.back();
        else router.push(fallback);
      }}
    >
      {label}
    </button>
  );
}
