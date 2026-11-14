"use client";

import { useRouter } from "next/navigation";

export default function BackLink({ fallback, label = "← Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back-link"
      aria-label={label.replace(/[←\s]/g, "") ? undefined : "Back"}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      {label}
    </button>
  );
}
