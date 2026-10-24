# Personas — Change 1

These personas are used by `stories.md`.

**Permissions:**
- **Event roles** (owner, admin, editor, checkin, finance, viewer) follow the U3 permission matrix and requirements FR-11. They apply per event.
- **Platform staff** is a G-ventZ role, separate from event roles.

## P1 — Buyer / Guest ("Amaka")
- **Who:** someone attending an event, anywhere in the world. Often buys for friends or family.
- **Goals:**
  - Find the event and sign in fast, ideally with Google.
  - Get tickets in under a minute and pay with what's on their phone (card, Apple Pay, Google Pay, bank).
  - Receive every ticket by email and forward them to friends.
  - Get through the door quickly.
- **Frustrations:**
  - Paying and not getting a ticket.
  - Being charged twice.
  - Tickets selling out while they pay.
  - Hidden fees.
  - Unclear refund terms.
- **Devices:** mostly a mobile browser, later the mobile app.
- **Permissions:** buyer of their own orders. Reads any ticket they hold a code for.
- **Appears in:** epics E1, E3, E4, E6, E8.

## P2 — Host / Event Owner ("Tunde")
- **Who:** runs events, from small meetups to the 20,000-guest December event. Creates the event and owns it.
- **Goals:**
  - Publish quickly and decide who pays the fees.
  - Get paid on every sale.
  - See sales and guests at a glance.
  - Issue refunds when needed.
  - Cancel safely if things go wrong.
- **Frustrations:**
  - Payout delays.
  - Unclear deductions.
  - Fraudulent refund requests.
  - Losing access to the account that controls the money.
- **Devices:** laptop for setup, phone on the day.
- **Permissions:** owner of their events (everything). The only person who can connect or change the payout account, with MFA.
- **Appears in:** E1, E2, E3, E5, E6, E7, E8.

## P3 — Host Team Member ("Ngozi")
One person per event role:

| Role | Can |
|---|---|
| admin | Almost everything the owner can: publish, cancel, manage guests and check-in, refund with MFA. Not delete, not payout account. |
| editor | Edit details, settings, questions, flyer, guests, check-in. Not publish or cancel. |
| finance | See orders and sales; refund with MFA. |
| viewer | Read only. |

- **Goals:** do their part without needing the owner's login.
- **Frustrations:** being blocked from tasks they're responsible for, or being given more power than they need.
- **Appears in:** E2, E5, E6, E7.

## P4 — Door Staff ("Musa", event role `checkin`)
- **Who:** volunteers and staff at the entrance. Several of them scan at once for the 20,000-guest event, about 5 scans a second in total.
- **Goals:**
  - Scan a QR code and get a clear green or red result in under a second.
  - Never let a refunded or already-used ticket through.
- **Frustrations:**
  - Slow or unclear screens.
  - Signing in again mid-shift.
  - Arguments about forwarded tickets.
- **Devices:** phones, on venue Wi-Fi or mobile data (online only, D57).
- **Permissions:** read tickets and check in guests for their event only.
- **Appears in:** E8.

## P5 — G-ventZ Platform Staff ("Kemi")
- **Who:** runs the platform: support, finance and trust.
- **Goals:**
  - Set the fee rates.
  - See that money in matches money out (reconciliation).
  - Spot disputes and failed refunds early.
  - Help hosts and buyers.
- **Frustrations:**
  - Finding out about problems from users instead of alerts.
  - Unaudited changes to money settings.
- **Permissions:** platform staff role, with MFA always required. No access to event data beyond what support needs (settled in design).
- **Appears in:** E9.

## P6 — On-call Engineer ("Dayo")
- **Who:** the person named in O10 who receives alerts.
- **Goals:**
  - Be told quickly and specifically when something important breaks.
  - Have a runbook for each alert.
  - Roll back or restore safely.
- **Frustrations:**
  - Noisy alerts.
  - Missing context.
  - Deploys that can't be undone.
- **Appears in:** E9.

## Persona-to-Epic Map

| Epic | P1 Buyer | P2 Host | P3 Team | P4 Door | P5 Staff | P6 On-call |
|---|---|---|---|---|---|---|
| E1 Sign-in and security | ✓ | ✓ | ✓ | ✓ | ✓ | |
| E2 Events | | ✓ | ✓ | | | |
| E3 Getting tickets (free) | ✓ | ✓ | | | | |
| E4 Paid checkout | ✓ | ✓ | | | | |
| E5 Payout account and fees | | ✓ | | | ✓ | |
| E6 Refunds and disputes | ✓ | ✓ | ✓ | | ✓ | |
| E7 Sales and orders | | ✓ | ✓ | | | |
| E8 Door check-in | ✓ | ✓ | ✓ | ✓ | | |
| E9 Platform and operations | | | | | ✓ | ✓ |
