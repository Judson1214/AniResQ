# Runbook 01: Applying Production Database Migrations

This runbook guides repository owners and lead operators through safely applying database migrations on the live production Supabase instance.

---

## 1. Before You Start: Mandatory Backup

Before applying any schema modifications, always take a manual backup or snapshot of the production database:

1. Navigate to the Supabase Dashboard: `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/database/backups`
2. Confirm the latest automated backup is healthy, or generate a manual snapshot immediately:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --file="backup_pre_migration_$(date +%Y%m%d%H%M%S).dump"
   ```
3. Ensure no active deployment jobs are running.

---

## 2. Migration Execution Order

Migrations must strictly be applied in chronological sequence. If applying updates starting from `20261126020000`, the order is:

1. `supabase/migrations/20261126020000_revoke_users_table_mutations.sql`
2. `supabase/migrations/20261126030000_restrict_lost_found_reads.sql`
3. `supabase/migrations/20261126040000_harden_lost_found_policies.sql`
4. `supabase/migrations/20261126050000_adoption_guards_and_cascade_set_null.sql`
5. `supabase/migrations/20261126060000_create_system_settings.sql`
6. `supabase/migrations/20261126070000_add_user_is_disabled.sql`
7. `supabase/migrations/20261126080000_allow_reporter_set_null.sql`
8. `supabase/migrations/20261126090000_harden_uploads_bucket_limits.sql`

---

## 3. How to Apply

### Method A: Supabase CLI (Recommended)

1. Authenticate and link to the live production project:
   ```bash
   supabase login
   supabase link --project-ref <YOUR-PROJECT-REF>
   ```
2. Verify pending migrations:
   ```bash
   supabase migration list
   ```
3. Push pending migrations to the database:
   ```bash
   supabase db push
   ```

> [!TIP]
> **Automated Deployments & Audit Connection**:
> The automated deployment workflow (`.github/workflows/deploy.yml`) uses the repository secret `SUPABASE_DB_URL` to run post-migration database audits via `psql`.
> Copy this connection string from Supabase Dashboard: **Project Settings** > **Database** > **Connection string** > **URI** (choose Transaction mode / port 6543, and ensure any special characters in the database password are URL-encoded).

### Method B: Supabase Dashboard SQL Editor (Manual Fallback)

If the Supabase CLI is unavailable:
1. Open the Supabase Dashboard: `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/sql/new`
2. Open each file in `supabase/migrations/` sequentially starting with `20261126020000`.
3. Paste the contents into the SQL Editor and click **Run**.
4. Confirm successful execution (`Success. No rows returned` or notice logs) before proceeding to the next file.

---

## 4. Post-Migration Verification

Immediately following migration application:

1. Copy the contents of [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql).
2. Paste into the Supabase SQL Editor and execute.
3. Verify that **every single check** reports `PASS` in the `status` column.
4. Run the live HTTP smoke test from your workstation:
   ```bash
   WEB_URL="https://app.aniresq.com" \
   API_URL="https://api.aniresq.com" \
   SUPABASE_URL="https://<YOUR-PROJECT-REF>.supabase.co" \
   SUPABASE_ANON_KEY="<YOUR-ANON-KEY>" \
   bash scripts/verify_live.sh
   ```

> [!NOTE]
> **Cross-Origin API & CORS Verification**:
> When `WEB_URL` and `API_URL` are on separate origins (e.g. `https://app.aniresq.com` and `https://api.aniresq.com`), `scripts/verify_live.sh` automatically probes CORS preflight (`OPTIONS /api/lostfound`) to confirm:
> - `Access-Control-Allow-Origin` strictly matches the frontend origin (`https://app.aniresq.com`, not wildcard `*`).
> - Probing with unauthorized origins (`https://evil.example.com`) returns no allow-origin header.
>
> **Configuration Rules for Cross-Origin Setup**:
> - When the API is on a separate origin: (a) set the `API_URL` environment variable, (b) configure backend `CORS_ORIGINS` to the exact HTTPS web origin, and (c) run `pnpm --filter @aniresq/web run generate:headers` with `VITE_SUPABASE_URL` and `VITE_API_URL` and commit the updated deployment configs.
> - When using `/api` rewrite on the same domain, leave `API_URL` unset (simpler option; skips cross-origin preflight).
> - Note: `VITE_API_URL` must never contain secrets or credentials.

---

## 5. Backward-Compatible Migration Design & Rollback Strategy

### A. Backward-Compatible Migration Principles (Expand and Contract)

All schema changes in AniResQ must follow the **Expand and Contract** pattern so that migrations are strictly non-breaking for running services:
1. **Adding Columns**: Always add new columns as `NULL` or with a safe `DEFAULT`. Never add a `NOT NULL` column without a default in a single release.
2. **Dropping/Renaming Columns**: Never drop or rename columns in the same release as code changes.
   - *Phase 1 (Expand)*: Stop reading/writing the old column in application code; deploy API.
   - *Phase 2 (Contract)*: In a subsequent release migration, drop the deprecated column.
3. **Enum Modifications**: Use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` so older code can safely coexist.
4. **Security & Policies**: Add policies that permit required operations without invalidating current API role assumptions.

### B. Scenario: API Deploy Fails After Database Migrations Succeeded

If the database migration step succeeds in `.github/workflows/deploy.yml` but the subsequent API deployment step fails:
1. **No Panic — Previous API Remains Operational**: Because all migrations are backward-compatible, the currently active API container will continue serving traffic without schema incompatibility errors.
2. **Do Not Revert Database Migration Hastily**: Rolling back the database schema can cause downtime or data loss if new traffic arrived in the interim.
3. **Diagnose API Failure**:
   - Inspect the GitHub Actions `2. Deploy API Service` log for container build errors, missing environment variables (e.g., `SUPABASE_JWT_SECRET`), or healthcheck timeouts.
   - Verify container runtime logs on your hosting provider (e.g., Cloud Run, ECS, Fly.io).
4. **Fix Forward vs Rollback**:
   - **Fix Forward (Preferred)**: Push a corrective API commit or update the missing secret/config in GitHub Repository Secrets. Re-run `deploy.yml`.
   - **Database Rollback (If Schema Itself Caused Broken Functionality)**:
     - Check [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql).
     - If the schema change itself introduced bugs for the existing API, restore from the pre-migration Point-In-Time Restore (PITR) snapshot:
       Navigate to Supabase Dashboard > **Database** > **Backups** > **Point in Time** and select the timestamp captured before deployment began.
     - Alternatively, run `pg_restore`:
       ```bash
       pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup_pre_migration_<TIMESTAMP>.dump
       ```
5. **Incident Communication**: Follow [`docs/ops/06-incident-response.md`](file:///d:/AniResQ/docs/ops/06-incident-response.md) to log and track the incident.
