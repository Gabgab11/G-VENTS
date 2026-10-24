# U1 Platform (Change 1 rework) — NFR Requirements Plan

The version 1 U1 NFR answers in `u1-platform-foundation-nfr-requirements-plan.md` still stand where they don't conflict:
- Fastify
- Vitest
- class-validator
- npm
- logs as JSON

This revision covers what Change 1 adds:
- Supabase instead of Render Postgres
- 20,000 tickets a day, with bursts of 50 a second
- 99.9% availability, recovery in 1 hour, at most 2 minutes of data lost
- the Security and Resiliency rules
- Grafana and Sentry

Several questions are about **paid plans**. Prices are approximate list prices in USD, so check them before you buy.

Put your choice after each `[Answer]:` tag, and save the file before replying.

## Plan

- [x] 1. Collect and analyze answers; ask follow-ups if needed
- [x] 2. Revise `u1-platform-foundation/nfr-requirements/nfr-requirements.md`:
  - performance and capacity, scalability and limits (RESILIENCY-09)
  - availability and recovery (RESILIENCY-02, 08, 11, 12)
  - security (SECURITY-01 to 15, where they apply to the platform)
  - reliability (RESILIENCY-10)
  - observability and alerting (RESILIENCY-05, 07; SECURITY-03, 14)
  - change and deploy (RESILIENCY-03, 04)
  - testing
- [x] 3. Revise `tech-stack-decisions.md`: Supabase connection, OpenTelemetry, Grafana and Sentry libraries, circuit breaker, load-test tool, SBOM and vulnerability scanning
- [x] 4. Validate against requirements v2.1 (NFR-1 to NFR-8) and the Security and Resiliency compliance summary

## Questions

### Question 1 — Supabase production plan and size
The database must take bursts of 50 ticket purchases a second, keep point-in-time recovery (at most 2 minutes of data lost), and allow enough pooled connections for at least 2 API instances plus a worker.

A) **Pro plan ($25/month) with:**
   - **Small compute** (about $15/month) for normal use
   - temporarily raised to **Medium** (about $60/month, prorated) for the December event and the load test
   - **point-in-time recovery** add-on (7 days, about $100/month)
   - (Recommended: right-sized now, scaled up for the peak.)

B) Pro plan with Medium compute all the time, plus point-in-time recovery.

C) Team plan ($599/month, adds SOC 2 reports and longer log retention), with the same compute choice as A.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - Not sure we should bother about that, we will start with small compute

### Question 2 — Supabase staging
The load test must run against staging sized like production (NFR-2.4). Free projects pause when idle and have no point-in-time recovery.

A) **Pro plan with Micro compute** (included). It is raised to the production size only on load-test days, and then lowered again. (Recommended)

B) Keep staging on the Free plan, and load-test against a temporary Pro project restored from a backup.

X) Other (please describe after [Answer]: tag below)

[Answer]: main branch should be where backend runs it

### Question 3 — Render plan and sizes
Autoscaling needs a Render **Professional workspace** (about $19 per member a month).

A) **Professional workspace, with these services:**

   | Service | Size | Cost |
   |---|---|---|
   | Production API | **Standard** (1 CPU, 2 GB), autoscaling **2 to 6 instances** on CPU and memory | about $25 each a month |
   | Production worker | 1 Standard instance | about $25 a month |
   | Production Key Value | **Standard** (1 GB, persistence) | about $32 a month |
   | Staging | 1 Starter instance running API and worker, plus Key Value Starter | — |

   (Recommended)

B) The same, but production API on **Starter** (0.5 CPU, 512 MB, about $7) with 2 to 10 instances. Cheaper at rest, but there's less headroom per instance at peak.

X) Other (please describe after [Answer]: tag below)

[Answer]: X - don't bother about any od this, let's just build

### Question 4 — Log retention (SECURITY-14 needs at least 90 days)
Grafana Cloud's free tier keeps logs for 14 days.

A) **Grafana Cloud Pro, pay as you go:**
   - 90-day log retention
   - starts at about $19/month plus usage
   - expected to be low at 20,000 tickets a day
   - (Recommended: one place for everything)

B) Grafana Cloud free tier for 14 days of searchable logs. A daily export to an object store (for example Cloudflare R2) keeps 90 days. Cheaper, but older logs aren't searchable in Grafana.

X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 5 — Alert thresholds (RESILIENCY-05, 07; SECURITY-14)
A) **Use these starting thresholds**, tuned after go-live:

   | Area | Alert when |
   |---|---|
   | API errors | 5xx above 1% of requests for 5 minutes |
   | API latency | p95 above 500 ms for 10 minutes (any route) |
   | Readiness | Failing on any instance for 2 minutes |
   | Queues | Oldest waiting job older than 5 minutes; outbox backlog above 1,000 |
   | Capacity | Database connections above 80% of the pooler limit; CPU above 80% at the maximum instance count |
   | Backups | Supabase backup failure (daily check) |
   | Security | More than 20 failed token checks a minute from one IP; permission denials 5 times the normal rate; any webhook with a bad signature (M4) |
   | Uptime | External check on `/health/ready` and the home page every minute from 2 locations |

   (Recommended)

B) I'll give my own thresholds (please list them after [Answer]: tag below).

[Answer]: A

### Question 6 — Load-test tool
A) **k6:**
   - Scripted scenarios: getting tickets in bursts on one ticket type, scanning at the door, and browsing.
   - Runs from a laptop or CI.
   - Results can go to Grafana.
   - (Recommended; free, open source.)

B) autocannon (already in the version 1 stack). Simpler, but no multi-step scenarios.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 7 — Supabase production region (open item O9)
The API, worker and Redis will run in the Render region closest to it. Check in the Supabase dashboard → `gvents-prod` → Project Settings → General → Region, for example "eu-central-1 (Frankfurt)" or "eu-west-2 (London)".

[Answer]: Okay i will validate that. Let's just start building please!
