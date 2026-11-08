import type { MetadataRoute } from "next";

// The installable app (PWA): home-screen icon, standalone window, shortcuts. The service worker is public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "G-ventZ",
    short_name: "G-ventZ",
    description: "Every celebration, one place. Create an event, share one link, and let guests register from anywhere.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141414",
    theme_color: "#141414",
    categories: ["events", "entertainment", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My tickets", url: "/my-tickets", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Create an event", url: "/events/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Discover", url: "/discover", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
