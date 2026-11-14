import type { ReactNode } from "react";
import { SOCIALS, type SocialNetwork } from "@/lib/socials";

// Simple outline icons (not the official logos) so they sit quietly in the footer.
const ICONS: Record<SocialNetwork, ReactNode> = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></>,
  x: <path d="M4 4l16 16M20 4L4 20" />,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.7" />,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V17M8 7v.01M12 17v-6.5M12 13.2c0-1.7 1-2.7 2.4-2.7S16.5 11.4 16.5 13v4" /></>,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.5 9.5v5l4.2-2.5z" fill="currentColor" /></>,
  facebook: <path d="M14.5 21v-8h2.7l.4-3.2h-3.1V7.9c0-.9.3-1.6 1.6-1.6h1.6V3.5a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.3H8.6V13h2.7v8" />,
};

export default function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`socials ${className}`} aria-label="G-ventZ on social media">
      {SOCIALS.map(({ network, label, href }) => {
        const icon = (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[network]}
          </svg>
        );
        return (
          <li key={network}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>{icon}</a>
            ) : (
              <span className="socials-soon" role="img" aria-label={`${label} (coming soon)`} title={`${label} · coming soon`}>{icon}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
