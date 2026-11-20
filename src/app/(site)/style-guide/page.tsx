import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { api } from "@/lib/api/server";
import StyleGuide from "./StyleGuide";

export const metadata: Metadata = { title: "G-ventZ", robots: { index: false, follow: false } };

// The design system's style guide (Change 4, DS5): every token and component in both themes and both
// directions. G-ventZ staff only; anyone else gets the plain not-found page. Written in English (D69).
export default async function StyleGuidePage() {
  await requireUser("/style-guide");
  const me = await (await api()).GET("/v1/me").then((r) => r.data ?? null).catch(() => null);
  if (!me?.isStaff) notFound();
  return (
    <main className="wrap">
      <SiteHeader back="/admin" />
      <div lang="en">
        <StyleGuide />
      </div>
    </main>
  );
}
