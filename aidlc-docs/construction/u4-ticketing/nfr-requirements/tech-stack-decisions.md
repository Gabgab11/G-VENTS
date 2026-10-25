# U4 Ticketing — Tech Stack Decisions

| Concern | Choice | Reason |
|---|---|---|
| QR codes | Port the current app's own encoder (`src/lib/qr.ts`, `src/lib/qr-png.ts`: byte mode, level M, PNG via `node:zlib`) | No dependency; already proven on today's tickets, with its decoder test ported too |
| Calendar file | Own small ICS writer (RFC 5545: folding, escaping, UTC times) | No dependency needed; covered by a round-trip PBT |
| CSV | Own small RFC 4180 writer, streamed, with an injection prefix | Small; covered by a round-trip PBT |
| Email providers | **Resend** (`fetch` to the REST API) and **ZeptoMail** (`fetch` to `/v1.1/email`), each behind `Mailer` | Q1a C: no vendor lock-in for the December peak |
| Send pacing | BullMQ queue limiter (`limiter: { max: EMAIL_RATE_PER_SECOND, duration: 1000 }`), shared by every worker; `worker.rateLimit` on 429 | Stays under each provider's limit across instances, with no extra code (changed in NFR Design) |
| Templates | Plain TypeScript functions for HTML and text, escaping every value (as today) | No template engine needed |
| Load tests | k6 scripts in `test/load/` | U1 Q6 A |

**New settings:**
- `EMAIL_PROVIDER` (`resend` | `zeptomail`), `EMAIL_FALLBACK_PROVIDER` (optional), `EMAIL_RATE_PER_SECOND` (default 9)
- `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_API_URL` (default `https://api.zeptomail.com`; EU or India regions available)
- `PUBLIC_WEB_URL` (for ticket links, for example `https://gventz.com`)

**Owner items:**
- **O20:** a raised Resend limit, and/or a ZeptoMail account with domain verification and confirmed throughput, before 8 November.
- **O5:** the Resend domain, as already listed.
