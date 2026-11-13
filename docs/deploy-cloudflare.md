# Deploying the website to Cloudflare

Status: **live since 2026-11-10.** `gventz.com`, `www.gventz.com` (301 to the apex) and
`staging.gventz.com` are served by the Workers `gventz-web` and `gventz-web-staging`; DNS is on
Cloudflare. Vercel hosts only the API (`api.gventz.com`, `api-staging.gventz.com`). The website's
Vercel project `g-vents` has no custom domains and no Git integration. Phases 0 to 5 below are
done; they are kept as the record of how, and for the rollback notes.

- Pipeline: `.github/workflows/deploy.yml` (+ `.github/actions/deploy-website`, `.github/scripts/`)
- Worker config: `wrangler.jsonc`, `open-next.config.ts`

## 1. Why Workers (OpenNext) and not Cloudflare Pages

The website is a **server-rendered Next.js 15 App Router app**: Server Components that call gventz-api
with the visitor's session, Server Actions (forms, 6 MB flyer uploads), route handlers
(`/api/health`, `/api/revalidate`, `guests.csv`), middleware (session refresh, maintenance switch),
ISR (`revalidate = 60` on the home page) and `revalidatePath()` driven by signed calls from the API.
Server-only secrets (`BFF_SHARED_SECRET`, `REVALIDATE_SECRET`) must never reach the browser.

| Option | Fit | Why |
|---|---|---|
| Pages, static export (`output: "export"`) | **No** | Drops Server Actions, route handlers, middleware, ISR and every server-side API call. The site would stop working. |
| Pages + `@cloudflare/next-on-pages` | **No** | Deprecated by Cloudflare in favour of OpenNext. Every route must run on the Edge runtime; this code uses `node:crypto`, `node:net` and `server-only` modules, and ISR/`revalidatePath` aren't supported. |
| **Workers + `@opennextjs/cloudflare`** | **Yes (chosen)** | Cloudflare's supported adapter for existing Next.js apps. Node.js runtime (`nodejs_compat`), Server Actions, middleware, ISR with R2 + Durable Objects, static assets served by Workers Assets. Built and dry-run in CI. |
| Workers + vinext | Later, maybe | Cloudflare's Vite reimplementation of the Next.js API, now its default for *new* projects. Not a drop-in for an existing production app without a compatibility pass; revisit separately. |

**Decision (2026-11-07): Workers + `@opennextjs/cloudflare`; Pages dropped.** So the target is
**Cloudflare Workers**, not Pages. Workers is what Cloudflare now recommends for
full-stack frameworks (Workers Assets replaced Pages for this case). What you asked for still holds:
a staging and a production deployment per branch, custom domains and preview URLs on `workers.dev`.

**Decision (2026-11-09): no approval step.** Branches are the release control: merging into
`staging` deploys staging, and merging the `staging` → `main` pull request deploys production.

### What changed in the code for Cloudflare

- **Visitor IP** (`src/lib/api/headers.ts`): Vercel overwrites `x-forwarded-for`. Cloudflare only
  *appends* to it, so on Cloudflare the first entry is whatever the visitor sent. The API's per-IP
  limits would then trust a spoofable value. On Cloudflare, only `cf-connecting-ip` is used.
- **Visitor country** (`src/lib/platform.ts`): `cf-ipcountry` on Cloudflare and `x-vercel-ip-country`
  on Vercel. Each network's header is read only when that network is serving the request.
- Caching (`open-next.config.ts`): R2 incremental cache with a regional cache in front, a Durable
  Object queue for ISR regeneration, and a Durable Object tag cache for `revalidatePath`.

## 2. Environments and API URLs

| | Staging | Production |
|---|---|---|
| Branch | `staging` | `main` (the production branch; gventz-api's is called `prd`) |
| Worker (wrangler env) | `gventz-web-staging` (`--env staging`) | `gventz-web` (`--env production`) |
| Site | `https://staging.gventz.com` | `https://gventz.com` (`www` → 308 to apex) |
| **API** (`API_URL`) | **`https://api-staging.gventz.com`** | **`https://api.gventz.com`** |
| R2 cache bucket | `gventz-web-cache-staging` | `gventz-web-cache-production` |
| Supabase | `gvents-staging` | `gvents-prod` |

`API_URL` and `NEXT_PUBLIC_SITE_URL` live in `wrangler.jsonc` `env.<name>.vars`. That file is the
single source for them: the deploy exports the same values into `next build`
(`scripts/cloudflare/wrangler-vars.mjs`), because Next.js inlines `NEXT_PUBLIC_*` at build time. Each
environment therefore gets its **own build**. Moving an environment to a different API is a reviewed
commit, never a settings toggle. A unit test fails if staging and production ever point at each
other's API. `API_URL` is server-only: the browser never calls the API (application design AD13).

### Secrets and variables (repository level)

Everything is set at **repository** level (Settings → Secrets and variables → Actions). Values that
differ per environment carry a `STAGING_` or `PRODUCTION_` prefix; shared ones have none. Each
deploy job maps its own environment's names to the unprefixed names the deploy action reads
(`BFF_SHARED_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, …), so the Worker and the app code are unchanged.
Names only below; values never go in the repo. "Exists" is as of 2026-11-07.

| Kind | Name | Exists | Purpose | Used by (job) |
|---|---|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | **yes** | deploys the Workers ([scope](#cloudflare-api-token)) | deploy.yml `staging`, `production` |
| secret | `CLOUDFLARE_ACCOUNT_ID` | **yes** | `cae583a64c8e68a3fa05d93e36cb3f89` ("Johnabayomi6040@gmail.com's Account"). An identifier, not a secret; stored as one only to keep the deploy settings together | `staging`, `production` |
| secret | `STAGING_BFF_SHARED_SECRET` | no | Worker secret; same value as the staging API's `BFF_SHARED_SECRET` | `staging` |
| secret | `PRODUCTION_BFF_SHARED_SECRET` | no | same, production API | `production` |
| secret | `STAGING_REVALIDATE_SECRET` | no | Worker secret; same value as the staging API's `REVALIDATE_SECRET` (≥ 32 chars) | `staging` |
| secret | `PRODUCTION_REVALIDATE_SECRET` | no | same, production API | `production` |
| secret | `STAGING_MAINTENANCE_BYPASS` | no | optional; staff cookie value during maintenance (≥ 16 chars) | `staging` |
| secret | `PRODUCTION_MAINTENANCE_BYPASS` | no | optional; same for production | `production` |
| secret | `STAGING_SUPABASE_SECRET_KEY` | no | recommended; Worker secret, a staging Supabase **secret** key (`sb_secret_…`) used only for sign-in, so Auth rate limits see each visitor's IP (`sb-forwarded-for`). Needs IP Address Forwarding on in Authentication → Rate Limits. Empty: the publishable key, all visitors share one IP bucket | `staging` |
| secret | `PRODUCTION_SUPABASE_SECRET_KEY` | no | same, production project | `production` |
| secret | `STAGING_CF_ACCESS_CLIENT_ID` | no | optional; Cloudflare Access service token for smoke-testing staging behind Access | `staging` |
| secret | `STAGING_CF_ACCESS_CLIENT_SECRET` | no | optional; pair of the above | `staging` |
| secret | `GVENTZ_API_READ_TOKEN` | **yes** | fine-grained token, Contents: read on `aristokratos/gventz-api` only (that repo is private); downloads the pinned `openapi.json`. Expires; renew it before then | ci.yml `verify`; deploy.yml `promotion-gates`, `production-gates` |
| secret | `SUPABASE_ACCESS_TOKEN` | **yes** | Supabase CLI login | deploy.yml `production-gates`; migrate.yml |
| secret | `SUPABASE_PROD_REF` | **yes** | production project ref | `production-gates`; migrate.yml |
| secret | `SUPABASE_PROD_DB_PASSWORD` | **yes** | production database password (read-only dry run here) | `production-gates`; migrate.yml |
| secret | `SUPABASE_STAGING_REF` | **no** | staging project ref (migrate.yml, already required by it) | migrate.yml |
| secret | `SUPABASE_STAGING_DB_PASSWORD` | **no** | staging database password (migrate.yml) | migrate.yml |
| secret | `SLACK_WEBHOOK_URL` | no | optional; failure alerts | deploy.yml `notify` |
| secret | `VERCEL_AUTOMATION_BYPASS_SECRET` | **yes** | used only by the removed `promote.yml`; delete it after Vercel is retired | none |
| variable | `PRODUCTION_API_URL` | no | `https://api.gventz.com`, for the API contract gate (public) | `promotion-gates`, `production-gates` |
| variable | `STAGING_NEXT_PUBLIC_SUPABASE_URL` | no | required; staging Supabase URL (public, inlined in the browser bundle) | `staging` |
| variable | `PRODUCTION_NEXT_PUBLIC_SUPABASE_URL` | no | required; production Supabase URL | `production` |
| variable | `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | required; staging publishable key (public by design) | `staging` |
| variable | `PRODUCTION_NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | required; production publishable key | `production` |
| variable | `STAGING_NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | optional; Turnstile site key | `staging` |
| variable | `PRODUCTION_NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | optional | `production` |
| variable | `STAGING_NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | no | optional; referrer-restricted Maps Embed key | `staging` |
| variable | `PRODUCTION_NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | no | optional | `production` |
| variable | `STAGING_NEXT_PUBLIC_WHATSAPP_NUMBER` | no | optional; WhatsApp fallback number | `staging` |
| variable | `PRODUCTION_NEXT_PUBLIC_WHATSAPP_NUMBER` | no | optional | `production` |
| variable | `STAGING_MAINTENANCE_MODE` | no | optional; `1` = maintenance page from the next deploy | `staging` |
| variable | `PRODUCTION_MAINTENANCE_MODE` | no | optional | `production` |
| variable | `STAGING_URL` | no | optional; smoke-test this origin (e.g. `https://staging.gventz.com`) instead of `workers.dev` | `staging` |
| variable | `PRODUCTION_URL` | no | optional; `https://gventz.com` after cutover | `production`, `notify` |

Not settings: `API_URL` and `NEXT_PUBLIC_SITE_URL` (committed in `wrangler.jsonc`, see above).

Worker secrets are uploaded **with** each deployment (`wrangler deploy --secrets-file`, a 0600 temp
file deleted afterwards), so GitHub stays their source of truth and they never appear on a command
line or in a log.

### No GitHub environments

The deploy jobs use no GitHub environment and nothing waits for an approval: **merging the
`staging` → `main` pull request is the release.** "This code passed staging" is read from the Deploy
workflow's own history (`tested-on-staging.sh`: a Deploy run on `staging` whose `staging` job
succeeded, for a commit with the same tree). A CI test fails if a deploy job starts using an
environment again. The existing `Production`, `Preview` (Vercel's) and `staging` environments are
left alone.

To keep a human check on production, protect `main` with a ruleset: pull request required,
1 approval, required checks `ci / verify` and `ci / migrations`.

### Security trade-off of repository-level secrets

Repository secrets are readable by **any workflow run that a collaborator with write access
triggers**, on any branch. Someone with write access could push a branch with a new workflow that
reads `PRODUCTION_*`, without touching `main`. GitHub only protects secrets from **fork pull
requests** (they get no secrets) and from people without write access. Environment secrets plus
deployment-branch rules would close that gap; they were declined for now.

What limits the risk here:
- **Staging jobs never map production secrets**, and production jobs never read staging ones.
  `.github/scripts/workflow-secrets.test.mjs` (run in CI) fails the build if a job does, if a job
  with no branch condition reads a deploy secret, or if the deploy action reads secrets itself.
- Deploy jobs run only for `refs/heads/staging` or `refs/heads/main`. Production is reached only
  from `main`, through the staging → main pull request.
- No `pull_request_target`; PR CI uses no secrets; fork PRs never see secrets.
- Least privilege: `permissions: {}` by default, actions pinned to SHAs, `persist-credentials: false`.
  Secrets are passed by temp file, never in arguments.
- The production migration check (needs `SUPABASE_PROD_DB_PASSWORD`) runs only in `production-gates`
  on `main`. It no longer runs on staging pushes, as `promote.yml` did.

Recommended in addition: keep the number of people with write access small; add a ruleset that
requires a PR and review for `.github/**` (CODEOWNERS); scope the Cloudflare token to this account
with a TTL and rotate it.

## 3. Pipeline

```
feature ──PR──▶ staging ──────────────────────────────────▶ PR staging → main ──merge──▶ main
         CI:     push: CI ▶ deploy staging ▶ smoke ▶ gates ▶ open/update PR         push: CI ▶ tested on staging?
         ci.yml                                                                       ▶ gates ▶ deploy prod ▶ smoke
```

1. **Pull requests** (any base, including `staging`): `ci.yml` runs the API-contract drift check,
   release-script tests, lint, typecheck, unit tests, the Next.js + Worker build, a `wrangler deploy
   --dry-run` for both environments, and the migrations job. No secrets, no deploys,
   no `pull_request_target`.
2. **Push to `staging`** (a merged PR): `deploy.yml` runs CI for that exact commit (`workflow_call`),
   then
   - deploys `gventz-web-staging` and smoke-tests `/`, `/sign-in`, `/discover` and `/api/health` (200
     only when the site reaches the staging API). These run in the deploy job, so the
     `staging` job succeeds only if they pass;
   - **promotion gate**: the production API must serve the gventz-api contract pinned in
     `api-contract.ref`, so **the website is never promoted ahead of its API**. It reads the pinned contract
     with `GVENTZ_API_READ_TOKEN` (gventz-api is private) and the API's public `/openapi.json`, so no
     production secret is involved on a staging push;
   - opens, or updates the description of, the PR **`staging` → `main`**.
3. **Merge the PR into `main`.** This is the release decision. `deploy.yml` then
   runs CI again, then `production-gates`:
   - **tested on staging**: the commit's tree must equal the tree of a commit whose Deploy run on
     `staging` had a successful `staging` job. This holds for merge, squash and
     fast-forward alike, and stops anything that reached `main` some other way;
   - the API contract gate again (time passes between PR and merge), and the production
     **migration** gate: production Supabase must not be missing a migration (read-only dry run).
     Like `promote.yml`, a missing migration stops the release before anything deploys.
4. **`production`** deploys `gventz-web` and smoke-tests it.
5. Any failure: a `deploy-failure` issue (plus Slack if configured), same as before.

Security properties:
- every third-party action is pinned to a full commit SHA;
- `permissions: {}` at workflow level, with each job granted only what it uses;
- checkouts use `persist-credentials: false`;
- staging jobs never see production secrets (checked by a test; see the trade-off note above);
- concurrency: one deploy per branch, never cancelled mid-deploy; PR CI runs replace older ones.

`promote.yml` is **removed**. It fast-forwarded `main` by itself; now `main` only moves when someone
merges the staging → main pull request. Its checks live on in `.github/scripts/release-gates.sh`.

> **Transition caveat (resolved 2026-11-10).** Until Vercel's Git integration was disconnected
> (phase 5), Vercel also deployed `main` to its own production on every merge.

### Rollback

```bash
npx wrangler deployments list --env production
npx wrangler rollback <version-id> --env production -m "reason"   # instant, previous code + its secrets
```

Then revert the bad commit on `staging`, so the next release doesn't bring it back. During the DNS
transition, a full rollback is the DNS rollback in section 5.

## Setup (one time)

Every item is outside the repo. **Not done yet.** Done by the repo owner (GitHub admin) and the
Cloudflare account owner.

### Cloudflare API token

Create a **custom account token** in "Johnabayomi6040@gmail.com's Account"
(`cae583a64c8e68a3fa05d93e36cb3f89`), limited to that account (and the `gventz.com` zone once it
exists). Give it only:
- Account → **Workers Scripts: Edit** (deploy the Worker, its secrets and versions)
- Account → **Workers R2 Storage: Edit** (`populateCache remote` writes pre-rendered pages to R2)
- Account → **Account Settings: Read** (wrangler looks up the account)
- Zone `gventz.com` → **Workers Routes: Edit**: needed **only** if the custom domains are managed
  by wrangler. If they are attached once by hand in the dashboard (recommended, see phase 4), leave
  it out.

"Pages: Edit" isn't enough, because this is a Worker, not a Pages project. Cloudflare can't limit
a token to one Worker, so the shared `CLOUDFLARE_API_TOKEN` can deploy both. Set a TTL and rotate it.

## 4. DNS inventory (read-only, 2026-11-07)

Sources: `vercel dns ls gventz.com` and `vercel domains inspect gventz.com` (team
`gabriels-projects-82d456ea`), public `dig` against `ns1.vercel-dns.com`, and RDAP.

- **Registrar:** NameCheap, Inc. Registered 2026-10-22, expires 2027-10-22, `clientTransferProhibited`.
- **Nameservers:** `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (Vercel DNS).
- **DNSSEC:** off (no DS record at `.com`).
- **Vercel project `g-vents`:** `gventz.com` (production), `staging.gventz.com` (branch `staging`),
  `www.gventz.com` → 308 to `gventz.com`.
- **API (gventz-api): hosted on Vercel** (decision 2026-11-07), in the same Vercel team, projects
  `gventz-api-staging` and `gventz-api`. Their only domains today are `gventz-api-staging.vercel.app`
  and `gventz-api.vercel.app`. **`api-staging.gventz.com` and `api.gventz.com` are not attached to
  either project yet.** Vercel's recommended DNS for them (`vercel api /v6/domains/<host>/config`):

  | Host | Vercel project | Recommended CNAME (rank 1) | Fallback |
  |---|---|---|---|
  | `api.gventz.com` | `gventz-api` | `a7148229e4a21beb.vercel-dns-016.com` | `cname.vercel-dns.com` |
  | `api-staging.gventz.com` | `gventz-api-staging` | `906d99bf27a55ced.vercel-dns-016.com` | `cname.vercel-dns.com` |

  Re-read these values right before creating the records; Vercel can change them.

| # | Name | Type | Value (summary) | TTL | Source | Proposed in Cloudflare |
|---|---|---|---|---|---|---|
| 1 | `@` | MX 10 | `inbound-smtp.eu-west-1.amazonaws.com` (SES inbound) | 60 | user | MX, DNS-only |
| 2 | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@gventz.com` | 60 | user | TXT (unchanged) |
| 3 | `send` | MX 10 | `feedback-smtp.eu-west-1.amazonses.com` (Resend/SES bounce) | 60 | user | MX, DNS-only |
| 4 | `send` | TXT | `v=spf1 include:amazonses.com ~all` | 60 | user | TXT (unchanged) |
| 5 | `resend._domainkey` | TXT | DKIM public key (`p=MIGf…AQAB`) | 60 | user | TXT, copy the full value exactly |
| 6 | `rsend` | CNAME | `send.forge.rmta.net` | 60 | user | CNAME, **DNS-only** (email provider; proxying breaks it) |
| 7 | `@` | ALIAS | `6ad85fc36aab736b.vercel-dns-017.com` (Vercel site) | 1800 | Vercel default | replaced by Worker custom domain `gventz.com` (proxied) |
| 8 | `*` | ALIAS | `cname.vercel-dns-016.com` | 1800 | Vercel default | **do not import**: explicit records only (below) |
| 9 | `@` | CAA ×3 | `0 issue` `letsencrypt.org`, `pki.goog`, `sectigo.com` | – | Vercel default | don't copy as-is; see note |
| – | `www` | (via `*`) | Vercel | – | wildcard | Worker custom domain + redirect rule www → apex (308), proxied |
| – | `staging` | (via `*`) | Vercel, branch `staging` | – | wildcard | Worker custom domain for `gventz-web-staging`, proxied, behind Cloudflare Access |
| – | `api` | (via `*`) | **Vercel 404 today** (`server: Vercel`) | – | wildcard | `CNAME a7148229e4a21beb.vercel-dns-016.com`, **DNS-only** |
| – | `api-staging` | (via `*`) | **Vercel 404 today** | – | wildcard | `CNAME 906d99bf27a55ced.vercel-dns-016.com`, **DNS-only** |
| – | `_vercel` | TXT | not present today | – | – | add **only if** Vercel asks to verify the domain (value from Vercel) |

Why the API records stay DNS-only (grey cloud): Vercel terminates TLS and issues the certificate
itself (HTTP-01 / DNS-01). It also runs its own edge and firewall. A Cloudflare proxy in front would
add a second CDN hop, hide the visitor IP from Vercel, and can break certificate issuance and renewal.

Clashes and findings:
- **`api.gventz.com` and `api-staging.gventz.com` have no records of their own.** They resolve only
  because of the wildcard, and Vercel answers 404. So nothing is serving the API there yet. The
  staging smoke test (`/api/health`) and the contract gate (`PRODUCTION_API_URL`) will fail until
  the API is attached to these names. That failure is correct: it blocks a website with no API.
- The wildcard also makes `mail.`, `autodiscover.`, `_vercel.` and any typo resolve to Vercel.
  Dropping it in Cloudflare means they stop resolving. Nothing in the inventory uses them.
- There is no SPF at the apex (only on `send.`), and DMARC is `p=none`. Keep both as they are for the
  migration and change them separately afterwards.
- CAA: Cloudflare Universal SSL issues from Let's Encrypt, Google Trust Services (`pki.goog`) and
  SSL.com. Either add no CAA records (simplest) or add `letsencrypt.org`, `pki.goog` and `ssl.com`,
  plus the CA of any DNS-only host (Vercel and Render use Let's Encrypt). Copying Vercel's set alone
  would block SSL.com.

## 5. DNS cutover runbook (Vercel DNS → Cloudflare DNS)

Nothing below has been done. Do it in a quiet hour. Website downtime should be zero; the worst case
is the TTL of the record you changed.

**Phase 0: decided.**
- The API is on Vercel at `api.gventz.com` / `api-staging.gventz.com`.
- No approval step: merging into a branch deploys it.
- Cloudflare account: **"Johnabayomi6040@gmail.com's Account"** (`cae583a64c8e68a3fa05d93e36cb3f89`,
  login johnabayomi6040@gmail.com). It owns the Workers, the R2 buckets and the `gventz.com` zone.
  It has no zones yet. Log wrangler into this account (`npx wrangler login`, then
  `npx wrangler whoami`) before any manual step below. A different account in a browser or token is
  the most likely mistake here. `wrangler.jsonc` pins `account_id` to this account, so wrangler
  refuses to deploy into any other account.

**Phase 0b: attach the API domains on Vercel (can be done now, before any DNS move)**
- In Vercel, add `api.gventz.com` to project `gventz-api` and `api-staging.gventz.com` to
  `gventz-api-staging` (Project → Settings → Domains, or `vercel domains add <host> <project>`).
  `gventz.com` is in the same Vercel team and still on Vercel DNS, so they verify automatically and
  start serving straight away (the wildcard already points at Vercel).
- Check: `curl -s https://api-staging.gventz.com/health/ready` and `…/openapi.json` on both hosts.
  This unblocks the staging smoke test (`/api/health`) and the contract gate (`PRODUCTION_API_URL`).

**Phase 1: Cloudflare side, no impact on traffic**
1. Create the R2 buckets `gventz-web-cache-staging` and `gventz-web-cache-production`.
2. Create the API token ([scope](#cloudflare-api-token)). Add the repository secrets and variables, as in
   [section 2](#2-environments-and-api-urls).
3. Merge this branch through `staging`. The first staging deploy creates `gventz-web-staging` on
   `workers.dev`. Verify it there; its `/api/health` turns green once phase 0b is done.
4. Add zone `gventz.com` to Cloudflare (Free plan is enough). Skip the auto-scan result, or
   compare it against the inventory; it can't see Vercel's ALIAS/wildcard records correctly.
5. Create the records from the table, **all DNS-only (grey cloud) at first**, TTL Auto:
   MX/TXT/CNAME rows 1 to 6 exactly. Create `api` and `api-staging` as CNAMEs to the Vercel targets
   above. Leave them **DNS-only permanently**, not just at first.
   Do **not** create `*`, apex ALIAS or CAA (see the note above).
6. Before switching, compare the zone against Vercel by querying Cloudflare's assigned nameserver
   directly. Every answer must match the inventory:
   ```bash
   CF=<name>.ns.cloudflare.com
   for q in "gventz.com MX" "send.gventz.com MX" "send.gventz.com TXT" "_dmarc.gventz.com TXT" \
            "resend._domainkey.gventz.com TXT" "rsend.gventz.com CNAME"; do
     set -- $q; echo "$q: $(dig +short "$1" "$2" @$CF) | vercel: $(dig +short "$1" "$2" @ns1.vercel-dns.com)"
   done
   ```

**Phase 2: lower TTLs at Vercel (at least 2 hours, ideally 1 day, before the switch)**
7. The user records are already at 60 s. The Vercel default ALIAS records (1800 s) can't be changed,
   and the `.com` NS delegation has a 48 h TTL whatever you do. Plan on resolvers switching gradually
   over up to 48 h, with **both providers serving the same answers** throughout. That is why the
   website stays on Vercel until phase 4.

**Phase 3: switch nameservers**
8. Make sure DNSSEC is off at Namecheap (it is today).
9. Namecheap → Domain List → `gventz.com` → Nameservers → Custom DNS → the two
   `*.ns.cloudflare.com` names Cloudflare assigned. Remove `ns1/ns2.vercel-dns.com`.
10. Until Cloudflare shows the zone **Active**, also create DNS-only records in Cloudflare that point
    `@`, `www` and `staging` at Vercel. Use the values Vercel → Project → Domains shows for each
    (typically `A @ 76.76.21.21` and `CNAME www/staging cname.vercel-dns.com`).
    The site then stays on Vercel during propagation. Keep `gventz.com`, `www` and `staging` on the
    Vercel project, so Vercel can renew their certificates.
11. Check: `dig NS gventz.com +trace`, mail delivery to SES inbound, a Resend test email (DKIM
    pass), `https://gventz.com` still served by Vercel (`server: Vercel`). Also check that
    `api.gventz.com` and `api-staging.gventz.com` answer through the new CNAMEs (`dig +short` shows
    the `vercel-dns-016.com` target, and `/health/ready` is 200) and Vercel shows them as valid.

**Phase 4: move the website to the Worker (per hostname, staging first)**
12. Staging (**done 2026-11-10**): Workers → `gventz-web-staging` → Settings → Domains & Routes →
    add custom domain `staging.gventz.com`. Cloudflare refuses while a DNS record exists for the
    hostname (`100117 … externally managed DNS records`), so first delete the DNS-only
    `CNAME staging → cname.vercel-dns-016.com`, then add the domain; Cloudflare creates the proxied
    record and issues the certificate within a minute. Optional, not done yet: put a Cloudflare Access application on `staging.gventz.com` and on the staging
    `workers.dev` hostname. Create a service token and save it as the repository secrets
    `STAGING_CF_ACCESS_CLIENT_ID` / `STAGING_CF_ACCESS_CLIENT_SECRET`. Set the repository variable
    `STAGING_URL=https://staging.gventz.com` (done). Same pattern for production in step 13: the
    apex and `www` have Vercel A records that must be deleted first.
13. Production (**done 2026-11-10**): delete the DNS-only Vercel A records of `gventz.com`
    (`216.150.1.65`, `216.150.16.1`) and `www` (`216.150.1.193`, `216.150.16.129`), then add both as
    custom domains of `gventz-web`. Redirect rule (Rules → Redirect Rules): hostname equals
    `www.gventz.com` → `concat("https://gventz.com", http.request.uri.path)`, query string kept
    (a full-URL match like `https://www.gventz.com/*` never matches). Repository variable
    `PRODUCTION_URL=https://gventz.com` (done).
    **SSL/TLS → Edge Certificates → Always Use HTTPS: on.** Vercel redirected http to https and sent
    HSTS by itself; Cloudflare does neither by default. The app now sends HSTS (`src/lib/csp.ts`).
14. Commit: `workers_dev: false` for production in `wrangler.jsonc` (done). The custom domains stay
    out of `routes`, so the deploy token needs no Zone → Workers Routes: Edit.
15. Verify: `curl -sI https://gventz.com | grep -i server` shows `cloudflare`. Smoke paths are 200,
    sign-in works (add the new origins to Supabase Auth redirect URLs first), ticket QR links and
    emails use `https://gventz.com`, and `/api/revalidate` from the API succeeds.

**Phase 5: retire Vercel for the website (done 2026-11-10)**
16. Disconnect the `g-vents` project's Git integration (stops the parallel Vercel production builds;
    see the transition caveat), then remove its domains. Keep the project until rollback isn't needed.
    Done, and the wildcard `*` and `_domainconnect` records were deleted from Cloudflare DNS.

> **Warning: removing a domain from a project is not deleting it from the team.** In Vercel,
> remove `gventz.com`/`www`/`staging` under **Project → Settings → Domains** only. Deleting
> `gventz.com` under **Team → Domains** also detaches `api.gventz.com` and `api-staging.gventz.com`
> from the API projects and wipes Vercel's DNS records for the zone. Both APIs then answer
> `404 DEPLOYMENT_NOT_FOUND` until the domains are re-added. This happened on 2026-11-10: fixed by
> adding `api.gventz.com` to `gventz-api` and `api-staging.gventz.com` to `gventz-api-staging`
> (Project → Domains → Add, the full hostname). Adding them put `gventz.com` back in the team,
> verified, with no TXT record needed. Never add the bare `gventz.com` to an API project.

17. **Keep `gventz.com` in the Vercel team.** The API projects use `api.gventz.com` and
    `api-staging.gventz.com`, and keeping the apex domain in the team keeps those subdomains
    verified. Only the website's domains come off the `g-vents` project. Vercel DNS records no
    longer matter once the nameservers point at Cloudflare. **Verification while DNS is on
    Cloudflare:** if Vercel shows a domain as unverified (for example after the domain was removed
    from the team, or was claimed by another team), it gives a TXT record `_vercel.gventz.com` with a
    `vc-domain-verify=…` value. Add exactly that TXT record in Cloudflare (DNS-only by nature), then
    press Verify in Vercel. Afterwards confirm in Vercel → Domains that both API hosts show
    "Valid Configuration" and a certificate.
18. Optional hardening: DNSSEC in Cloudflare, then the DS record at Namecheap. CAA records.
    Tightening SPF/DMARC.

**Rollback**
- Website only (phase 4): remove the Worker custom domain and recreate the DNS-only Vercel record
  from step 10 (staging: `CNAME staging.gventz.com → cname.vercel-dns-016.com`, DNS only), and
  unset `STAGING_URL`. Production: the four A records in step 13, then unset `PRODUCTION_URL` and
  set `workers_dev: true` again if the Worker must be reachable without its domain. Takes effect in seconds to minutes (Cloudflare-served TTL).
- Website back to Vercel (after phase 5): reconnect the `g-vents` Git integration, deploy `main`,
  add its domains back to the project, then do the website-only steps above.
- Whole DNS (phase 3): **no longer possible as written.** Vercel DNS has no records for `gventz.com`
  since 2026-11-10 (see the warning in phase 5), so switching the nameservers back would take every
  host offline. Moving DNS away from Cloudflare now means recreating every record at the new
  provider first. The last full export is the Cloudflare zone itself (DNS → Export).
