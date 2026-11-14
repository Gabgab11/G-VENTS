// G-ventZ social media accounts, shown in the home page footer.
// Placeholders until the handles are registered: fill in `href` (full https URL) and the icon
// becomes a link. An empty `href` renders a dimmed "coming soon" icon, never a dead link.

export type SocialNetwork = "instagram" | "x" | "tiktok" | "linkedin" | "youtube" | "facebook";

export type Social = { network: SocialNetwork; label: string; href: string };

export const SOCIALS: Social[] = [
  { network: "instagram", label: "Instagram", href: "" },
  { network: "x", label: "X (Twitter)", href: "" },
  { network: "tiktok", label: "TikTok", href: "" },
  { network: "linkedin", label: "LinkedIn", href: "" },
  { network: "youtube", label: "YouTube", href: "" },
  { network: "facebook", label: "Facebook", href: "" },
];
