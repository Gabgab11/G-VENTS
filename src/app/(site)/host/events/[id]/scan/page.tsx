import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import NextLink from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/design";
import styles from "../workspace.module.css";
import Scanner from "./Scanner";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.scan");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The door scanner page. Only roles with guests.checkIn (owner, admin, editor, check-in staff);
// everyone else gets a 404, as the API does.
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireUser(`/host/events/${id}/scan`);

  let event;
  try {
    event = data(await (await api()).GET("/v1/events/{id}", { params: { path: { id } } }));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  if (!event.permissions.includes("guests.checkIn")) notFound();
  const t = await getTranslations("dashboard.scan");

  return (
    <>
      <NextLink href={`/host/events/${id}`} className={styles.back}>
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden className={styles.backIcon} />{event.title}
      </NextLink>
      <PageHeader title={t("title")} />
      <Scanner eventId={id} title={event.title} />
    </>
  );
}
