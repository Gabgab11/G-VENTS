"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateEventSetting } from "./actions";
import { formatEventDate, timezoneLabel } from "@/lib/dates";

export type DashEvent = {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  show_attendee_count: boolean;
  starts_at: string;
  timezone: string;
  going: number;
  /** The caller's role: quick toggles show only for roles that can use them. */
  role: string;
};

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published", cancelled: "Cancelled" };

export default function EventRow({ event }: { event: DashEvent }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vis, setVis] = useState(event.visibility);
  const [show, setShow] = useState(event.show_attendee_count);
  const [status, setStatus] = useState(event.status);

  function change(field: string, value: string, apply: () => void) {
    setError(null);
    start(async () => {
      const res = await updateEventSetting(event.id, field, value);
      if (res.error) setError(res.error);
      else apply();
    });
  }

  const when = formatEventDate(event.starts_at, event.timezone, "compact");

  return (
    <div className="dash-row">
      <div className="dash-main">
        <Link href={`/dashboard/${event.id}`} className="dash-title">{event.title}</Link>
        <div className="muted small">{when} ({timezoneLabel(event.timezone)}) · {STATUS_LABEL[status] ?? status} · {event.going} registered</div>
      </div>

      <div className="dash-controls">
        {["owner", "admin", "editor"].includes(event.role) && <>
        <div className="seg" role="group" aria-label={`Visibility of ${event.title}`}>
          <button type="button" className={vis === "public" ? "on" : ""} aria-pressed={vis === "public"} disabled={pending}
            onClick={() => change("visibility", "public", () => setVis("public"))}>Public</button>
          <button type="button" className={vis === "private" ? "on" : ""} aria-pressed={vis === "private"} disabled={pending}
            onClick={() => change("visibility", "private", () => setVis("private"))}>Private</button>
        </div>

        <label className="check">
          <input type="checkbox" checked={show} disabled={pending}
            onChange={(e) => change("show_attendee_count", String(e.target.checked), () => setShow(e.target.checked))} />
          <span>Show attendee count</span>
        </label>

        </>}
        {status === "draft" && ["owner", "admin"].includes(event.role) && (
          <button type="button" className="btn-small" disabled={pending}
            onClick={() => change("status", "published", () => setStatus("published"))}>Publish</button>
        )}
        <Link href={`/dashboard/${event.id}`} className="btn-small">Manage</Link>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
