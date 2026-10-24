# U1 Platform Foundation — Infrastructure Design Plan

This maps the logical components to real services. What's already fixed:
- **Provider and region:** Render in Frankfurt (D2, D9).
- **Database and cache:** Render Postgres (newest major) and Render Key Value.
- **Build:** one Docker image.
- **Sizes:** start small (Q7 A).
- **Logs:** standard output only.
- **Frontend:** Vercel, pinned to `fra1`.

These questions cover what's left.

Please fill in each `[Answer]:` tag with a letter, or X plus your own text, then tell me "done".

## Plan

- [x] 1. Collect and analyze answers below
- [x] 2. `infrastructure-design.md`: service mapping per logical component and environment (compute, database, Redis, secrets, DNS, TLS, CI/CD, backups, notifications); database roles; environment variables per service
- [x] 3. `deployment-architecture.md`: diagram, `render.yaml` blueprint outline, deploy pipeline, rollback, first-time setup checklist for you (accounts, DNS, secrets)
- [x] 4. Validate against U1 NFR requirements and NFR design

## Questions

### Question 1 — How deploys happen
A) Staging deploys automatically from `main` once CI passes. Production deploys when you push a version tag (`v1.2.0`) or click "Deploy" in Render, so production never changes by surprise. (Recommended)

B) Both deploy automatically from `main`

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Data for M1 (tomorrow)
The requirements say M1 runs against a copy of staging data. The real migration tool (U6) comes in M2.

A) For M1, a quick one-off copy: a script dumps the Supabase **staging** tables and loads them into Render staging Postgres, with `auth.users` and `profiles` merged into `users`. It isn't re-runnable and has no verification. U6 replaces it properly. (Recommended, meets the M1 definition)

B) M1 runs on an empty staging database with seed data. The first copy of real staging data happens at the U6 rehearsal.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — API addresses
A) Production at `api.gventz.com`. Staging at `api-staging.gventz.com`. Until DNS is set (O3), both use their Render `*.onrender.com` addresses. (Recommended)

B) Production at `api.gventz.com`. Staging stays on its `*.onrender.com` address permanently.

X) Other (please describe after [Answer]: tag below)

[Answer]: A

Where is the DNS for `gventz.com` managed (for example Vercel, Cloudflare, Namecheap, GoDaddy)? Write it here:

[Answer]: WILL CONFIRM THIS

### Question 4 — Being told when something breaks
You chose logs only (Q22 C).

A) Render's built-in email notifications to you for failed deploys and services that crash or fail their health check. Nothing else for now. (Recommended)

B) Also a free external uptime check on `https://api.gventz.com/health/ready` every 5 minutes (for example UptimeRobot), which emails when it's down

X) Other (please describe after [Answer]: tag below)

[Answer]: A, B

### Question 5 — Render account layout
A) One Render workspace with one project, "G-ventZ", containing two environments: **staging** and **production**. Each environment has its own Postgres, Key Value and environment group. Secrets aren't shared between environments. (Recommended)

B) Separate Render workspaces for staging and production

X) Other (please describe after [Answer]: tag below)

[Answer]: A
