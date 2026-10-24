# Unit of Work — Story Map (version 2, Change 1)

Version 1 is in `v1/unit-of-work-story-map.md`. Stories are in `inception/user-stories/stories.md`.

- **Primary unit:** where the story is finished and accepted.
- **Also touches:** other units that deliver part of it.
- **B&T:** Build and Test, where load, restore and gate criteria are proven.

## Map

| Story | Title | Priority | Primary unit | Also touches |
|---|---|---|---|---|
| US-1.1 | Sign in with an email code (parity) | Must | U2 | U6a (sign-in page stays on Supabase Auth); Supabase SMTP setup (O5) |
| US-1.2 | Sign in with Google | Must | U6a | U2 (token check); Supabase Google provider (O17) |
| US-1.3 | Every API request is checked | Must | U2 | U3 (event guard returns 404) |
| US-1.4 | Turn on two-step sign-in | Should (M4) | U7 | U2 (`aal` claim read) |
| US-1.5 | Step-up before sensitive money actions | Should (M4) | U7 | U2 (`@RequireMfa` guard) |
| US-2.1 | Create and publish an event | Must | U3 pass 1 | U6a |
| US-2.2 | Manage an event | Must | U3 pass 2 | U5 (flyer), U6b |
| US-2.3 | Paid ticket types need a payout account | Should (M4) | U7 | U3 (`PayoutReadiness` stub) |
| US-2.4 | Per-buyer ticket limit | Must | U4 core (enforced, default 10) | U3 pass 2 (setting), U6b |
| US-2.5 | Cancel an event | Must (free) / Should (refunds) | U3 pass 2 | U7 (AC2 refunds), U6b |
| US-2.6 | Delete an event | Must | U3 pass 2 | U5 (flyer clean-up), U4 (`TicketingStats`), U6b |
| US-2.7 | Discover events and event page | Must | U5 | U3 pass 1 (public page), U6a/U6b |
| US-2.8 | Announcement drafts and dashboard theme | Must | U3 pass 2 | U2 (theme on profile), U6b |
| US-3.1 | Several free tickets in one go | Must | U4 core | U6a |
| US-3.2 | Receive all my tickets by email | Must | U4 core | U1 (outbox, queue) |
| US-3.3 | Approval events | Must (free) / Should (paid) | U4 rest | U7 (AC2 paid), U6b |
| US-3.4 | Waiting list (groups) | Must | U4 rest | U6b |
| US-3.5 | No overselling at the busiest moment | Must | U4 | B&T (load test at 100/s) |
| US-4.1 | Checkout with tickets held | Should (M4) | U7 | U4 (inventory holds) |
| US-4.2 | Pay on the provider's page (Apple Pay, Google Pay) | Should (M4/M5) | U7 (Paystack) | U8 (Stripe) |
| US-4.3 | Tickets only after confirmed payment | Should (M4) | U7 | U4 (`applyPayment`) |
| US-4.4 | Hold expiry and late payment | Should (M4) | U7 | U4 |
| US-4.5 | Provider outage doesn't stop free tickets | Should (M4) | U7 | U1 (breakers) |
| US-4.6 | Order receipt | Should (M4) | U7 | — |
| US-5.1 | Connect a payout account | Should (M4/M5) | U7 (Paystack) | U8 (Stripe Connect) |
| US-5.2 | Change payout details safely | Should (M4) | U7 | — |
| US-5.3 | Choose who pays the fees | Should (M4) | U7 | U3 (fee choice column from pass 2) |
| US-5.4 | Get paid on every sale | Should (M4/M5) | U7 | U8 |
| US-6.1 | Refund a ticket | Should (M4) | U7 | U4 (void tickets), U8 (Stripe reversal) |
| US-6.2 | Refunds when an event is cancelled | Should (M4) | U7 | U3 (`EventCancelled`) |
| US-6.3 | Refund status | Should (M4) | U7 | — |
| US-6.4 | Disputes and chargebacks | Should (M4) | U7 | U8 |
| US-7.1 | Sales per event | Should (M4) | U7 | — |
| US-7.2 | Orders list | Should (M4) | U7 | — |
| US-7.3 | Guest list with groups | Must | U4 rest | U6b |
| US-8.1 | Scan tickets fast | Must | U4 core | U6a (scanner page), B&T (latency) |
| US-8.2 | Stop used, refunded or invalid tickets | Must | U4 core | U6a |
| US-8.3 | Forwarded tickets work once | Must | U4 core | U6a |
| US-9.1 | Set fee rates | Should (M4) | U7 | U2 (staff guard) |
| US-9.2 | Daily reconciliation | Should (M4) | U7 | — |
| US-9.3 | Support view for a payment | Could | U7 | — |
| US-9.4 | Alerts when something important breaks | Must | U1 | U7 (AC3 money alerts) |
| US-9.5 | Deploy and roll back without downtime | Must | U1 | U6 (Vercel rollback) |
| US-9.6 | Recover data after a mistake | Must | U1 (runbook) | B&T (restore drill) |
| US-9.7 | Handle the December rush | Must | U1 (autoscaling, pre-scale) | B&T (load test) |

## Count by Primary Unit

| Unit | Stories | Must | Should | Could |
|---|---|---|---|---|
| U1 Platform | 4 | 4 | 0 | 0 |
| U2 Identity | 2 | 2 | 0 | 0 |
| U3 Events and Engagement | 5 | 5 | 0 | 0 |
| U4 Ticketing | 10 | 10 | 0 | 0 |
| U5 Media, Discovery, Revalidation | 1 | 1 | 0 | 0 |
| U6 Frontend (U6a) | 1 | 1 | 0 | 0 |
| U7 Paystack | 22 | 0 | 21 | 1 |
| U8 Stripe | 0 (contributes to 5 stories) | 0 | 0 | 0 |
| **Total** | **45** | **23** | **21** | **1** |

Story counts per unit:
- **U1:** 9.4–9.7
- **U2:** 1.1, 1.3
- **U3:** 2.1, 2.2, 2.5, 2.6, 2.8
- **U4:** 2.4, 3.1–3.5, 7.3, 8.1–8.3
- **U5:** 2.7
- **U6a:** 1.2
- **U7:** 1.4, 1.5, 2.3, 4.1–4.6, 5.1–5.4, 6.1–6.4, 7.1, 7.2, 9.1–9.3

## Checks
- **Every story is assigned:** 45 of 45.
- **Must stories by M3:** all 23 have a primary unit in U1–U6, all finished by M2, with B&T at M3. The payment parts of US-2.5 and US-3.3 are M4 and sit in U7.
- **U6 coverage:** U6 has only one primary story but contributes the screens to 16 others (see "Also touches"). U6a covers the M1 flows; U6b covers the rest.
- **U8 coverage:** no primary story, because its stories are accepted when Paystack works in U7. U8 completes the Stripe acceptance criteria of US-4.2, 5.1, 5.4, 6.1 and 6.4.
