import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { api } from "@/lib/api/server";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "G-ventZ", robots: { index: false, follow: false } }; // neutral: not-found pages here must not reveal the admin area

// G-ventZ staff only (FR-21). Each page asks the API, which answers 404 to anyone who isn't staff
// and 403 auth.mfa_required until the session is confirmed with two-step sign-in (src/lib/admin.ts).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUser("/admin");
  // Only staff see the admin heading and sections; anyone else (an invitee, or someone who was
  // removed) gets the plain page, so the admin area isn't revealed. The API still guards the data.
  const me = await (await api()).GET("/v1/me").then((r) => r.data ?? null).catch(() => null);
  if (!me?.isStaff) {
    return (
      <main className="wrap page ad">
        <SiteHeader back="/dashboard" />
        {children}
      </main>
    );
  }
  return (
    <main className="wrap page ad ad-viz">
      <SiteHeader back="/dashboard" />
      <div className="ad-head">
        <div>
          <div className="ad-eyebrow">G-ventZ admin</div>
          <h1>Platform</h1>
        </div>
      </div>
      <AdminNav />
      {children}
    </main>
  );
}
