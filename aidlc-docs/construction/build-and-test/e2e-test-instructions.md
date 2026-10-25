# End-to-End (Smoke) Test Instructions

**Scripts:** `G-VENTS/scripts/smoke/` (README there). They run the built website (`next start`) against gventz-api and local Supabase. They sign in like the browser does (Supabase cookie helper), call the real Server Actions (encoded with React's `encodeReply`), and read the rendered pages.

| Script | Checks | Result (2026-10-25, after the dependency upgrades) |
|---|---|---|
| `smoke-u6a.mjs` | sign in → create and publish → order form → 3 tickets → limit message → order page with QR codes → ticket page with staff check-in → scan green → scan again red → my tickets → signed-out view | 12/12 |
| `smoke-u6b.mjs` | dashboard list → edit → question add, error code and remove → flyer to Storage → capacity and waiting list → promote → search and filter → CSV → outsider 404 → approve and decline → overview → cancel → delete → venue search → Discover → CSP and camera headers → `/api/revalidate` signed and forged → home refresh | 33/33 (two runs) |

**Also run on the API in earlier units:** API smoke runs of the built server for each unit (U3–U5), and of the Docker image (U4).

## On staging, by hand (not automatable here)
- Google sign-in (needs O17).
- The door scanner on a real iPhone (Safari) and a real Android (Chrome): camera permission, decoding a printed ticket and a ticket on another phone's screen, then green, red and "already used".
- The tickets email arriving with QR codes and the calendar file (after O20, provider limits).
