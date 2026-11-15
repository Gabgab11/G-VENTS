import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import BackLink from "@/components/BackLink";
import Scanner from "./Scanner";

export const metadata: Metadata = { title: "Scan tickets · G-ventZ", robots: { index: false, follow: false } };

// The door scanner page. Only roles with guests.checkIn (owner, admin, editor, check-in staff);
// everyone else gets a 404, as the API does.
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireUser(`/dashboard/${id}/scan`);

  let event;
  try {
    event = data(await (await api()).GET("/v1/events/{id}", { params: { path: { id } } }));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  if (!event.permissions.includes("guests.checkIn")) notFound();

  return (
    <main className="wrap page">
      <BackLink fallback={`/dashboard/${id}`} label="← Event" />
      <h1>Scan tickets</h1>
      <Scanner eventId={id} title={event.title} />
    </main>
  );
}
