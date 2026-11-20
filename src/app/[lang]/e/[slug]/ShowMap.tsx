import { ExternalLink } from "lucide-react";
import { Button } from "@/design";

// The venue card's map and "Open in Google Maps". The Google embed is shown by default but loads
// lazily (only as the visitor scrolls near it), so the page's main content never waits for it (NFR-13).
export default function ShowMap({
  src,
  title,
  openLabel,
  directions,
}: {
  src: string | null;
  title: string;
  openLabel: string;
  directions: string | null;
}) {
  return (
    <>
      {src && <iframe className="ev-map" src={src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
      {directions && (
        <div className="ev-venue-actions">
          <Button href={directions} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary">
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            {openLabel}
          </Button>
        </div>
      )}
    </>
  );
}
