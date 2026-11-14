// Google Maps links a host can paste for a venue (business rule LO6). gventz-api is the authority
// and refuses anything else; this mirror only lets the form say what's wrong before sending.

const GOOGLE_DOMAIN = /^(?:www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;
const MAPS_DOMAIN = /^maps\.google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;
export const MAPS_URL_MAX = 500;
export const MAPS_URL_HINT = "Paste a Google Maps link (google.com/maps or maps.app.goo.gl).";

export function isGoogleMapsUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > MAPS_URL_MAX) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  return (
    host === "maps.app.goo.gl" ||
    (host === "goo.gl" && path.startsWith("/maps")) ||
    MAPS_DOMAIN.test(host) ||
    (GOOGLE_DOMAIN.test(host) && (path === "/maps" || path.startsWith("/maps/")))
  );
}
