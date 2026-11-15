"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEvent } from "./actions";

// The delete button stays off until the host types the event's name.
// The server checks the name again, so this is a guard against slips, not the lock.
export default function DeleteEventForm({ id, title, guests }: { id: string; title: string; guests: number }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  return (
    <form action={deleteEvent} className="form">
      <input type="hidden" name="event_id" value={id} />
      <p className="muted small">
        Deleting removes the event, its page, every ticket and registration, its questions and its flyer. This can&apos;t be undone.
      </p>
      {guests > 0 ? (
        <p className="error" role="alert">
          {guests === 1 ? "1 guest is" : `${guests} guests are`} registered. Their tickets and ticket links will stop working,
          and they won&apos;t be told automatically. If guests still need to know, cancel the event instead.
        </p>
      ) : (
        <p className="muted small">Nobody has registered yet.</p>
      )}
      <label className="field">
        <span>Type <b>{title}</b> to confirm</span>
        <input
          className="input"
          name="confirm_title"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={title}
        />
      </label>
      <DeleteButton enabled={matches} />
    </form>
  );
}

function DeleteButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-danger" type="submit" disabled={!enabled || pending} aria-disabled={!enabled || pending}>
      {pending ? "Deleting…" : "Delete event permanently"}
    </button>
  );
}
