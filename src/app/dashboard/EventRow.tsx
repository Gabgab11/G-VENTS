"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateEventSetting } from "./actions";

export type DashEvent = {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  show_attendee_count: boolean;
  starts_at: string;
  going: number;
};

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

  const when = new Date(event.starts_at).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });

  return (
    <div className="dash-row">
      <div className="dash-main">
        <Link href={`/e/${event.slug}`} className="dash-title">{event.title}</Link>
        <div className="muted small">{when} (Lagos) · {status === "draft" ? "Draft" : "Published"} · {event.going} registered</div>
      </div>

      <div className="dash-controls">
        <div className="seg" role="group" aria-label="Visibility">
          <button type="button" className={vis === "public" ? "on" : ""} disabled={pending}
            onClick={() => change("visibility", "public", () => setVis("public"))}>Public</button>
          <button type="button" className={vis === "private" ? "on" : ""} disabled={pending}
            onClick={() => change("visibility", "private", () => setVis("private"))}>Private</button>
        </div>

        <label className="check">
          <input type="checkbox" checked={show} disabled={pending}
            onChange={(e) => change("show_attendee_count", String(e.target.checked), () => setShow(e.target.checked))} />
          <span>Show attendee count</span>
        </label>

        {status === "draft" && (
          <button type="button" className="btn-small" disabled={pending}
            onClick={() => change("status", "published", () => setStatus("published"))}>Publish</button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
