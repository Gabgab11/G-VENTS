"use client";

import { useState } from "react";
import { ExternalLink, Map as MapIcon } from "lucide-react";
import { Button } from "@/design";

// The venue card's actions (NFR-13): "Open in Google Maps", and "Show map", which swaps in the live
// Google embed only when the visitor asks for it.
export default function ShowMap({
  src,
  title,
  showLabel,
  openLabel,
  directions,
}: {
  src: string | null;
  title: string;
  showLabel: string;
  openLabel: string;
  directions: string | null;
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      {shown && src && (
        <iframe className="ev-map" src={src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      )}
      <div className="ev-venue-actions">
        {directions && (
          <Button href={directions} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary">
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            {openLabel}
          </Button>
        )}
        {src && !shown && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShown(true)}>
            <MapIcon size={16} strokeWidth={1.75} aria-hidden />
            {showLabel}
          </Button>
        )}
      </div>
    </>
  );
}
