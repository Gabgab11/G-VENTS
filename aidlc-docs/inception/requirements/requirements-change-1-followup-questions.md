# Requirements Change 1 — Follow-up Questions

Thank you for the answers in `requirements-change-1-questions.md`. A few points need one more answer before the requirements can be written:
- Two answers need confirming (F1, F2).
- Turning on the Resiliency extension (Q15 A) requires some decisions that only you can make (F3–F9).
- Turning on the Security extension (Q14 A) requires the rest (F10, F11).

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Recorded from your answers
- **Q1–Q3 A:**
  - Supabase stays for the database, sign-in (with Google added there) and storage.
  - NestJS connects directly to Supabase Postgres, with row-level security left on.
  - The browser uses Supabase for sign-in only.
- **Q4 A:**
  - U1 is reused. The U2 sign-in code goes to a branch for later.
  - **Going live before the December event comes first.**
- **Q7 A:** 99.9% availability, data loss of a few minutes at most.
- **Q8–Q12 A:**
  - Paystack or Stripe chosen by event currency.
  - Wallets through the providers' checkout.
  - Marketplace payouts to hosts.
  - Fee added on top for the buyer. The rate isn't set yet, so it will be a setting.
  - Full refunds by the host, and automatic refunds when an event is cancelled.
- **Q13 A:** split first, then load test, Paystack, then Stripe, with a target of 2026-11-15.
- **Q14, Q15 A:** the Security and Resiliency extensions are on.
- **Seat reservation** (from your Q6 note) is the next feature after this change: guests check in ahead of time and reserve a seat 30–60 minutes before arriving. It's out of scope now, but the ticket design will leave room for it.

---

## F1 — Holding paid tickets during checkout (your Q6 answer)
You said each event can have free and paid tickets, so ticket handling must cope with both. This is how I'd handle each:
- **Free ticket:** issued at once, as today.
- **Paid ticket:** the open question is what happens while the buyer is paying.

A) **Hold for 10 minutes:**
   - The ticket is held while the buyer pays on Paystack or Stripe, and counts against capacity during the hold.
   - If payment isn't confirmed in time, the hold expires and the ticket goes back on sale.
   - This prevents selling the same last ticket to two people. (Recommended)

B) Same as A, but with a hold time the host sets per event (5–30 minutes).

C) No hold. Allocate only when payment succeeds, and refund automatically if the event sold out in the meantime.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## F2 — Peak within the day (your Q5 answer: 20,000 in a day)
A day's tickets usually arrive in bursts, such as when sales open or after an announcement. I'd plan for these targets:
- **Sustained:** 20,000 tickets in a day.
- **Peak hour:** up to half of them (10,000) in a single hour.
- **Burst:** up to 50 purchases a second for short spikes.
- **Proof:** a load test at those rates before go-live.

A) Use these targets. (Recommended)

B) Plan higher: all 20,000 within one hour, with bursts of 100 a second.

X) Other (please give your numbers after [Answer]: tag below)

[Answer]: A

---

## F3 — Recovery targets and disaster recovery strategy (RESILIENCY-02)
You chose 99.9% availability with no more than a few minutes of data lost (Q7 A). Supabase Pro with point-in-time recovery gives a recovery point of about 2 minutes within one region. This question covers how quickly service must come back, and what happens if a whole region fails.

A) Hours. Backup and restore: redeploy and restore from backups. Lowest cost.

B) Tens of minutes. Pilot light: data live in a second region, services idle until needed.

C) Minutes. Warm standby: data and reduced services running in a second region.

D) Near real-time. Active/active in several regions. Highest cost.

E) **Single region:** no cross-region disaster recovery.
   - **Recovery time:** service back within **1 hour**.
   - **Data loss:** no more than about **2 minutes**, using Supabase point-in-time recovery.
   - **Coverage:** handles instance failures and bad deploys, but not the loss of a whole region.
   - (Recommended for launch: it matches Q7 and keeps cost in line with the business today.)

X) Other (please describe after [Answer]: tag below)

[Answer]: E

## F4 — Regional topology (RESILIENCY-08)
A) **Single region, with several instances:**
   - At least 2 API instances and a separate worker on Render, plus the Supabase project, in the same region.
   - Survives an instance failure, not a region failure.
   - Note: Render and Supabase Pro don't let us choose availability zones, so zone spread is up to them. This will be recorded as an accepted limit. (Recommended)

B) Multi-region active-passive.

C) Multi-region active-active.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

Supabase project region for production (shown in the Supabase dashboard under Project Settings, for example "eu-central-1 Frankfurt"). The API will be placed in the same region:

## F5 — Change management (RESILIENCY-03)
A) Use an existing organizational process. Name it, for example Jira change records or an approval board.

B) **No formal process exists.** AI-DLC proposes a lightweight one:
   - Every production change is a GitHub pull request with one approval.
   - The pull request includes a rollback note.
   - Production releases are tagged.
   - The history is the pull requests and tags. (Recommended)

C) Exempt (please give the reason).

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## F6 — CI/CD tooling (RESILIENCY-04)
A) **GitHub Actions**, already set up for the API (lint, types, tests, build), with Render deploying when checks pass. The frontend keeps Vercel's GitHub integration. (Recommended)

B) Propose a different pipeline.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## F7 — Rollback mechanism (RESILIENCY-04)
A) **Roll back to the previous version:**
   - Render's rollback for the API, and Vercel's instant rollback for the frontend.
   - Database changes are written so the previous version still works with them: add first, remove in a later release. Rolling back the code never needs a database rollback. (Recommended)

B) Blue/green swap back.

C) Canary with automatic rollback.

D) Database-aware rollback (migration reversal designed explicitly).

E) Existing organizational procedure (please give the reference).

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## F8 — Deployment style (RESILIENCY-04)
A) Direct / in-place.

B) **Rolling:**
   - Render starts the new instances.
   - Traffic moves to them only after their health check passes.
   - The old instances are drained.
   - (Recommended: zero downtime at no extra cost.)

C) Blue/green.

D) Canary.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## F9 — Incident response (RESILIENCY-15)
A) Use an existing process (please give the reference, for example PagerDuty or an on-call rota).

B) **No formal process exists.** AI-DLC proposes a lightweight one:
   - Alerts go to a named on-call person by email and Slack.
   - A short runbook for each alert.
   - A written post-incident review, with action items tracked as GitHub issues. (Recommended)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

On-call contact(s) (name and channel):

---

## F10 — Monitoring and alerting (SECURITY-03, SECURITY-14, RESILIENCY-05)
Earlier the project had logs only (D28). With the extensions on, it now needs:
- logs in one central place, kept at least 90 days
- metrics (latency, errors, throughput)
- a dashboard
- alerts, including for security events such as repeated failed sign-ins and permission denials
- uptime checks from outside

A) **Grafana Cloud:**
   - Logs, metrics, traces and alerts in one place, through OpenTelemetry.
   - Its free tier covers launch, with paid retention for 90 days.
   - Add **Sentry** for error tracking. (Recommended)

B) Better Stack (logs, uptime checks, on-call alerts) plus Sentry.

C) Datadog. Most complete, highest cost.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## F11 — Two-step sign-in (MFA) (SECURITY-12)
Hosts who connect a payout account control where money goes, so their accounts need stronger protection. Supabase Auth supports authenticator-app codes (TOTP).

A) **MFA rules:**
   - **Hosts with a payout account:** must use MFA to change payout details or issue refunds.
   - **Everyone else:** MFA is optional.
   - **Platform staff:** MFA is always required.
   - (Recommended)

B) MFA optional for everyone.

C) MFA required for every host.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## F12 — The December event (free text)
Please give the date, the expected number of guests, and whether it has paid tickets. This sets the real go-live deadline and decides whether Paystack must be live before it.

[Answer]: FIRST WEEK, SO WE MUST BE GOOD BY MID NOVEMBER 

---

# Round 2 — Four Short Confirmations

Most answers are clear. These four need one more line each, because the Resiliency rules don't let me fill them in for you.

## R2.1 — Deployment style (your F8 answer: A, direct / in-place)
"Direct" means a deploy replaces the running version straight away, so ticket purchases and payment webhooks fail for the few seconds of the switch. On a payment workload that is a blocking finding (RESILIENCY-04: the deployment style must match how critical the workload is). Render's normal deploy already starts the new version and switches traffic only once its health check passes, at no extra cost. That is option B.

A) Keep direct / in-place. I'll record that you accept the risk.

B) **Rolling:** Render's zero-downtime deploy with a health check. (Recommended)

X) Other (please describe after [Answer]: tag below)

[Answer]: B - WE SHOULD HAVE A DEDICATED BRANCH FOR THIS SPLIT EVEN ON THE FRONTEND AS WELL

## R2.2 — Incident response (your F9 answer: A, existing process)
A means you already have a process, but no reference or contact was given, and RESILIENCY-15 needs one.

A) Existing process. Write its name or tool and the on-call person or people and channel below.

B) **No formal process yet.** I propose a lightweight one:
   - Alerts by email and Slack to the person named below.
   - A runbook for each alert.
   - A post-incident review, with GitHub issues for follow-ups. (Recommended if nothing exists)

[Answer]: B

On-call person or people and channel (needed for either option):

## R2.3 — Supabase production region (F4)
The API must run in the same region as the database, otherwise every query crosses continents. Check `gvents-prod` in the Supabase dashboard under Project Settings → General → Region, for example "eu-central-1 (Frankfurt)" or "eu-west-2 (London)".

[Answer]: OKAY I WILL DO

## R2.4 — The December event (F12)
Recorded: first week of December, ready by mid-November.

How many guests are expected, and will it sell paid tickets? If it does, Paystack must be live by mid-November, not after it.

[Answer]: 20K
