"use client";

import { useState } from "react";
import LocationFields from "@/app/events/new/LocationFields";
import { updateVenue } from "./actions";

// Replaces the venue as a whole (the API keeps nothing from the old one unless sent again).
export default function VenueForm({ eventId, current, detectedCountry }: { eventId: string; current: string; detectedCountry: string | null }) {
  const [online, setOnline] = useState(current === "Online");
  return (
    <form action={updateVenue} className="form">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="muted small">Now: {current || "No venue yet"}</p>
      <div className="option">
        <div>
          <div className="option-title">Online event</div>
          <div className="muted small">No venue; guests get the details from you.</div>
        </div>
        <label className="switch"><input type="checkbox" name="is_online" checked={online} onChange={(e) => setOnline(e.target.checked)} /><span /></label>
      </div>
      {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled />}
      <button className="btn-white" type="submit">Save venue</button>
    </form>
  );
}
