import BackLink from "@/components/BackLink";

export const metadata = { title: "Privacy · G-vents" };

export default function Page() {
  return (
    <main className="wrap page">
      <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
      <h1>Privacy</h1>
      <p className="muted">How G-vents collects and uses your information. The full policy will be published before paid tickets launch.</p>
    </main>
  );
}
