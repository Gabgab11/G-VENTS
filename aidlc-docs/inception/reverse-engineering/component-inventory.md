# Component Inventory

## Application Packages
- `gvents-app` (repo root) - The single Next.js application: pages, Server Actions, Route Handlers, middleware.

## Infrastructure Packages
- None (no CDK, Terraform or CloudFormation). Vercel and Supabase are configured in their dashboards.
- `supabase/` - Supabase CLI project - Migrations (8), local stack config, pgTAP tests. Not infrastructure-as-code for the hosted projects, but the schema source of truth.

## Shared Packages
- `src/lib` - Utilities / clients - Supabase client factories, auth guards, domain helpers, email, QR, Google Places and outside-listing clients.
- `src/components` - UI - Shared React components.
- `src/lib/supabase/database.types.ts` - Models - Generated database types.

## Test Packages
- `src/lib/*.test.ts` - Unit (Vitest) - dates, locations, redirect, tilt physics, validation (5 files).
- `supabase/tests/registration_and_quota.test.sql` - Integration (pgTAP) - registration rules and Places quota.
- No end-to-end tests, no load tests.

## Total Count
- **Total Packages**: 1 deployable application (with 3 internal source areas and 1 database project)
- **Application**: 1
- **Infrastructure**: 0
- **Shared**: 3 (`src/lib`, `src/components`, generated types)
- **Test**: 2 (Vitest unit, pgTAP database)
