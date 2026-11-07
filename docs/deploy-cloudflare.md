# Deploying the website to Cloudflare

Status: **prepared, not live.** The pipeline, Worker config and runbook are in the repo. Nothing has
been created in Cloudflare, GitHub settings or DNS yet; the checklist in [Setup](#setup-one-time)
lists every outside step, and who does it.

- Pipeline: `.github/workflows/deploy.yml` (+ `.github/actions/deploy-website`, `.github/scripts/`)
- Worker config: `wrangler.jsonc`, `open-next.config.ts`
- Today's production is still Vercel (`gventz.com`). This document also covers moving DNS off Vercel.

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

So the target is **Cloudflare Workers**, not Pages. Workers is what Cloudflare now recommends for
full-stack frameworks (Workers Assets replaced Pages for this case). What you asked for still holds:
a staging and a production deployment per branch, custom domains, preview URLs on `workers.dev`, and
an approval gate on production.

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
| GitHub environment | `website-staging` | `website-production` (required reviewers) |
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

GitHub environment settings (names only; values never go in the repo):

| Kind | Name | Notes |
|---|---|---|
| secret | `CLOUDFLARE_API_TOKEN` | see [token scope](#cloudflare-api-token) |
| secret | `CLOUDFLARE_ACCOUNT_ID` | |
| secret | `BFF_SHARED_SECRET` | same value as the API of *that* environment |
| secret | `REVALIDATE_SECRET` | same value as the API of that environment, ≥ 32 chars |
| secret | `MAINTENANCE_BYPASS` | optional |
| secret | `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | staging only: Access service token for smoke tests |
| variable | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required |
| variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | optional |
| variable | `MAINTENANCE_MODE` | `1` = maintenance page (takes effect on the next deploy) |
| variable | `STAGING_URL` / `PRODUCTION_URL` | optional: smoke-test the custom domain instead of `workers.dev` |

Repository level (unchanged from before): secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`,
`SUPABASE_PROD_DB_PASSWORD`, `SLACK_WEBHOOK_URL` (optional); variable `PRODUCTION_API_URL` =
`https://api.gventz.com` (for the contract gate).

Worker secrets are uploaded **with** each deployment (`wrangler deploy --secrets-file`, a 0600 temp
file deleted afterwards), so GitHub stays their source of truth and they never appear on a command
line or in a log.

## 3. Pipeline

```
feature ──PR──▶ staging ──────────────────────────────────▶ PR staging → main ──merge──▶ main
         CI:     push: CI ▶ deploy staging ▶ smoke ▶ gates ▶ open/update PR         push: CI ▶ tested on staging?
         ci.yml                                                                       ▶ gates ▶ APPROVAL ▶ deploy prod ▶ smoke
```

1. **Pull requests** (any base, including `staging`): `ci.yml` runs the API-contract drift check,
   release-script tests, lint, typecheck, unit tests, the Next.js + Worker build, a `wrangler deploy
   --dry-run` for both environments, and the migrations job. No secrets, no deploys,
   no `pull_request_target`.
2. **Push to `staging`** (a merged PR): `deploy.yml` runs CI for that exact commit (`workflow_call`),
   then
   - deploys `gventz-web-staging` and smoke-tests `/`, `/sign-in`, `/discover` and `/api/health` (200
     only when the site reaches the staging API). These run in the deploy job, so the
     `website-staging` deployment is marked successful only if they pass;
   - **promotion gates**, same as the old `promote.yml`: the production API must serve the
     gventz-api contract pinned in `api-contract.ref` (**the website is never promoted ahead of its
     API**), and production Supabase must not be missing a migration (read-only dry run);
   - opens, or updates the description of, the PR **`staging` → `main`**.
3. **Merge the PR into `main`** (needs an approving review: ruleset on `main`). `deploy.yml` then
   runs CI again, then `production-gates`:
   - **tested on staging**: the commit's tree must equal the tree of a commit with a successful
     `website-staging` deployment made by this pipeline. This holds for merge, squash and
     fast-forward alike, and stops anything that reached `main` some other way;
   - the API contract and migration gates again (time passes between PR and merge).
4. **`production` waits for approval** in the `website-production` environment (required
   reviewers, self-review blocked). Then it deploys `gventz-web` and smoke-tests it.
5. Any failure: a `deploy-failure` issue (plus Slack if configured), same as before.

Security properties:
- every third-party action is pinned to a full commit SHA;
- `permissions: {}` at workflow level, with each job granted only what it uses;
- checkouts use `persist-credentials: false`;
- deploy secrets exist only in environments limited to `staging` / `main`;
- concurrency: one deploy per branch, never cancelled mid-deploy; PR CI runs replace older ones.

`promote.yml` is **removed**. It fast-forwarded `main` with no human approval, which conflicts with
the approval gate. Its checks live on in `.github/scripts/release-gates.sh`.

> **Transition caveat.** Until Vercel's Git integration is disconnected (phase 5), Vercel still
> deploys `main` to its own production as soon as the PR merges. The environment approval gates only
> the Cloudflare deploy. The PR review and the gates before the PR still protect both.

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

Create a **custom account token**, limited to the G-ventZ account (and the `gventz.com` zone once it
exists). Give it only:
- Account → **Workers Scripts: Edit** (deploy the Worker, its secrets and versions)
- Account → **Workers R2 Storage: Edit** (`populateCache remote` writes pre-rendered pages to R2)
- Account → **Account Settings: Read** (wrangler looks up the account)
- Zone `gventz.com` → **Workers Routes: Edit**: needed **only** if the custom domains are managed
  by wrangler. If they are attached once by hand in the dashboard (recommended, see phase 4), leave
  it out.

"Pages: Edit" isn't enough, because this is a Worker, not a Pages project. Use one token per
environment (two tokens) if you want staging's token to be unable to touch production. Set a TTL
and rotate it.

## 4. DNS inventory (read-only, 2026-11-07)

Sources: `vercel dns ls gventz.com` and `vercel domains inspect gventz.com` (team
`gabriels-projects-82d456ea`), public `dig` against `ns1.vercel-dns.com`, and RDAP.

- **Registrar:** NameCheap, Inc. Registered 2026-10-22, expires 2027-10-22, `clientTransferProhibited`.
- **Nameservers:** `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (Vercel DNS).
- **DNSSEC:** off (no DS record at `.com`).
- **Vercel project `g-vents`:** `gventz.com` (production), `staging.gventz.com` (branch `staging`),
  `www.gventz.com` → 308 to `gventz.com`.
- **API (gventz-api):** gventz-api `main` documents Render (`gventz-api-staging.onrender.com`). Its
  branch `feature/vercel-hosting` moves it to Vercel projects `gventz-api-staging`/`gventz-api` with
  `api-staging.gventz.com`/`api.gventz.com`. **Neither name is attached anywhere yet.**

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
| – | `api` | (via `*`) | **Vercel 404 today** (`server: Vercel`) | – | wildcard | CNAME to the production API host, **DNS-only** (decision D3) |
| – | `api-staging` | (via `*`) | **Vercel 404 today** | – | wildcard | CNAME to the staging API host, **DNS-only** (decision D3) |

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

**Phase 0: decide** (see the decisions in the report): who hosts the API and at which hostnames
(D3); the Cloudflare account that will own the zone (D1); the production approvers (D2).

**Phase 1: Cloudflare side, no impact on traffic**
1. Create the R2 buckets `gventz-web-cache-staging` and `gventz-web-cache-production`.
2. Create the API token ([scope](#cloudflare-api-token)) and the GitHub environments, secrets and
   variables ([section 2](#2-environments-and-api-urls)).
3. Merge this branch through `staging`. The first staging deploy creates `gventz-web-staging` on
   `workers.dev`. Verify it there; its `/api/health` turns green once D3 is done.
4. Add zone `gventz.com` to Cloudflare (Free plan is enough). Skip the auto-scan result, or
   compare it against the inventory; it can't see Vercel's ALIAS/wildcard records correctly.
5. Create the records from the table, **all DNS-only (grey cloud) at first**, TTL Auto:
   MX/TXT/CNAME rows 1 to 6 exactly. For `api` and `api-staging`, use the CNAME targets from D3.
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
    pass), `https://gventz.com` still served by Vercel (`server: Vercel`).

**Phase 4: move the website to the Worker (per hostname, staging first)**
12. Staging: Workers → `gventz-web-staging` → Settings → Domains & Routes → add custom domain
    `staging.gventz.com`. Cloudflare replaces the DNS-only record with a proxied one and issues the
    certificate. Put a Cloudflare Access application on `staging.gventz.com` and on the staging
    `workers.dev` hostname. Create a service token and save it as `CF_ACCESS_CLIENT_ID/SECRET` in
    `website-staging`. Set `STAGING_URL=https://staging.gventz.com`.
13. Production, after a staging release has gone through the full flow: add custom domains
    `gventz.com` and `www.gventz.com` to `gventz-web`. Add a redirect rule: `www.gventz.com/*` →
    `https://gventz.com/${1}` with 308. Set `PRODUCTION_URL=https://gventz.com`.
14. Commit: `workers_dev: false` for production in `wrangler.jsonc`, optionally also the custom
    domains as `routes` (then the token needs Zone → Workers Routes: Edit).
15. Verify: `curl -sI https://gventz.com | grep -i server` shows `cloudflare`. Smoke paths are 200,
    sign-in works (add the new origins to Supabase Auth redirect URLs first), ticket QR links and
    emails use `https://gventz.com`, and `/api/revalidate` from the API succeeds.

**Phase 5: retire Vercel for the website (after a week without issues)**
16. Disconnect the `g-vents` project's Git integration (stops the parallel Vercel production builds;
    see the transition caveat), then remove its domains. Keep the project until rollback isn't needed.
17. Remove the domain from Vercel DNS, and from the Vercel account if no Vercel project uses it.
    **If the API stays on Vercel (D3)**, keep `api.gventz.com`/`api-staging.gventz.com` attached to
    the API projects and keep their CNAMEs DNS-only to `cname.vercel-dns.com`.
18. Optional hardening: DNSSEC in Cloudflare, then the DS record at Namecheap. CAA records.
    Tightening SPF/DMARC.

**Rollback**
- Website only (phase 4): remove the Worker custom domain and recreate the DNS-only Vercel record
  from step 10. Takes effect in seconds to minutes (Cloudflare-served TTL).
- Whole DNS (phase 3): at Namecheap, put back `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
  Vercel DNS still has every record until step 17, so the old answers come back as resolvers
  pick up the change (up to 48 h). **Don't delete anything at Vercel before phase 5.**
