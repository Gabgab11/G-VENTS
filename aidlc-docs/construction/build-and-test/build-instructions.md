# Build Instructions (go-live scope: U1–U6)

Two repositories:
- **gventz-api:** NestJS on Fastify, Render
- **G-VENTS:** Next.js on Vercel, plus the Supabase migrations

## Prerequisites
- **Node.js 22**: `.nvmrc` in both; locally `~/.nvm/versions/node/v22.23.3`
- **npm 10**
- **Docker:** Testcontainers (API integration tests), the local stack, the API image
- **Supabase CLI 2.121.0** (`npx supabase@2.121.0`)
- **Optional:** k6 1.3.0, or the `grafana/k6:1.3.0` image, for load tests
- **Disk:** about 4 GB for images and caches
- **Memory:** 8 GB recommended when running the full local stack

## gventz-api

```bash
cd gventz-api
npm ci
npm run lint && npm run typecheck
npm run build                 # dist/
npm run openapi:check         # openapi.json matches the code (34 paths)
docker build -t gventz-api .  # production image (node:22-slim, pinned digest)
```

- **Artifacts:** `dist/` (with `dist/telemetry/register.js` preloaded by `main.js`), `openapi.json`, the Docker image.
- **Settings:** validated at start-up (`src/platform/config/environment.ts`); see `.env.example` and `render.yaml`. Production needs, among others:
  - `DATABASE_URL`, `DATABASE_CA_FILE`, `REDIS_URL`
  - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
  - `CORS_ORIGINS`, `BFF_SHARED_SECRET`, `PUBLIC_WEB_URL`
  - the email provider keys, `REVALIDATE_URL` and `REVALIDATE_SECRET`
- **Dependency overrides** in `package.json`: `fastify` follows the direct dependency (patched 5.12.7, also inside `@nestjs/platform-fastify`); `js-yaml` 5.4.3 inside `@nestjs/swagger`.

## G-VENTS (website)

```bash
cd G-VENTS
npm ci
npm run api:types             # regenerate src/lib/api/schema.d.ts when the API changes
npm run lint && npm run typecheck
npm run build                 # .next/
```

- **Build settings:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the CSP's Supabase origin is read at build time.
- **Runtime settings (server only):** `API_URL`, `BFF_SHARED_SECRET`, `REVALIDATE_SECRET`.
- **Without `API_URL`** (CI) the static home page builds with no events and refreshes within a minute once deployed.
- **Dependency override:** `postcss` 8.5.29 inside `next`.

## Database (Supabase migrations, in G-VENTS)

```bash
node supabase/scripts/gen-signing-key.mjs   # once: local ES256 key (gitignored)
npx supabase@2.121.0 start                 # local stack (or `db start` for the database only)
npx supabase@2.121.0 test db               # pgTAP: 46 tests
```

- **Production order:** staging, then production, by the `supabase-migrations.yml` workflow, before the API release that needs them.
- **The 6 migrations added in this build stage:**
  - `20261025000100` orders
  - `…0200` registrations ↔ orders
  - `…0300` active_count
  - `…0400` outbox run_at
  - `…0500` active_count per statement
  - `…0600` API role lock_timeout

## Troubleshooting
- **`npm ci` fails in `docker build`:** usually a network timeout reaching the registry. Retry; check `docker build --progress=plain` for the npm error.
- **"lease does not exist" on the base image:** `docker pull node:22-slim@<digest from Dockerfile>`, then build again.
- **Type errors after a Fastify upgrade:** `FASTIFY_OPTIONS` is typed as `FastifyServerOptions`. `trustProxy` is a one-hop trust function, because newer Fastify refuses numeric hop counts.
- **The API refuses local tokens:** local Supabase must sign with ES256 (`supabase/signing_keys.json`; restart `supabase start`).
