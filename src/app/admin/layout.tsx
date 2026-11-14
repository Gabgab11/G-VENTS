import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "Admin · G-ventZ", robots: { index: false, follow: false } };

// G-ventZ staff only (FR-21). Each page asks the API, which answers 404 to anyone who isn't staff
// and 403 auth.mfa_required until the session is confirmed with two-step sign-in (src/lib/admin.ts).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUser("/admin");
  return (
    <main className="wrap page ad">
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
