# U1 Platform (Change 1 rework) — NFR Design Plan

**Already settled, so not asked again:**
- **Version 1 U1 NFR design answers:** BFF key with forwarded client IP; no response cache in the API; failed enqueues logged.
- **Q1 there (no circuit breaker):** replaced by the application design (AD20), which now uses breakers.
- **NFR requirements v2:** pools, outbox, timeouts, alerts, log export.

Only three choices remain. Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan

- [x] 1. Collect and analyze answers
- [x] 2. Revise `nfr-design-patterns.md`:
  - resilience: breakers, outbox, Redis-down rules
  - scalability: autoscaling, pre-scale, connection budget
  - performance: JWKS cache, pooler transaction mode
  - security: TLS, roles, audit append-only, log export
  - deploy-safe schema changes through Supabase migrations
- [x] 3. Revise `logical-components.md`: Outbox, Telemetry, Resilience, Supabase pools, log shipping; diagram; process layout
- [x] 4. Validate against NFR requirements v2 and the Security and Resiliency rules

## Questions

### Question 1 — How resiliency is tested (RESILIENCY-14, must be asked at this stage)
A) Use an existing practice (please name it).

B) **No practice exists yet.** I propose a small plan, carried out in Build and Test before go-live, then quarterly:
   - **Restore drill:** restore Supabase to a point in time on staging, timed against the 1-hour target.
   - **Redis outage:** stop Redis on staging. Ordering and scanning should refuse cleanly, everything else should keep working, and recovery should follow.
   - **Worker crash:** kill the worker mid-queue. Nothing should be lost, and the outbox should catch up.
   - **Slow provider:** a fake slow email or payment provider should trip the circuit breaker, and recovery should follow.
   - **Bad deploy:** deploy a build that fails its health check. Traffic should stay on the old version, then roll back.

   Results are recorded in `aidlc-docs/construction/build-and-test/`. (Recommended)

C) Defer everything to the Operations phase. Scenarios are written now and run later.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 2 — General per-IP limit (today 300 requests a minute)
Many buyers in Nigeria share one public IP through their mobile carrier, so 300 a minute per IP could block real people during the December rush.

A) **Raise the general limit:**
   - 1,500 a minute per IP.
   - Signed-in actions are mainly protected by limits per user (orders, check-in scans, places).
   - Unsigned public pages are mostly served from the Next.js cache anyway.
   - (Recommended)

B) Keep 300 a minute per IP.

X) Other (please give a number after [Answer]: tag below)

[Answer]: A

### Question 3 — Keeping a copy of logs for 90 days (your NFR answer Q4 B)
A) **The worker exports the previous day's logs to object storage every night:**
   - It queries Grafana Loki's API and writes compressed files to R2.
   - Simple, and it uses the R2 write-only key.
   - Gap: if the export fails for more than 14 days, those days are lost. An alert fires on any failed export.
   - (Recommended)

B) The API ships every log line twice, to Grafana and also in small batches to R2. Nothing depends on Grafana, but it adds work and network traffic to every instance.

X) Other (please describe after [Answer]: tag below)

[Answer]: A
