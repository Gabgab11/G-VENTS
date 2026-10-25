import type { MetadataRoute } from "next";

// Lets phones show the G-ventZ icon when someone adds the site to their home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G-ventZ",
    short_name: "G-ventZ",
    description: "Every celebration, one place. Create an event, share one link, and let guests register from anywhere.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#121212",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
