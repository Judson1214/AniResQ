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

---

## 5. Rollback and Recovery Strategy

If a migration fails or [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql) reports any `FAIL` items:

1. **STOP IMMEDIATELY**: Do not proceed with subsequent migrations or application code deployments.
2. **Review Error**: Note the exact SQL statement and error code from the execution output.
3. **Point-In-Time Restore (PITR)**:
   - For Supabase Pro/Team plans: Navigate to **Database > Backups > Point in Time** and initiate restore to the timestamp immediately preceding the migration start.
   - For custom backups: Restore the pre-migration snapshot:
     ```bash
     pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup_pre_migration_<TIMESTAMP>.dump
     ```
4. **Notify Team**: Post an incident update following [`docs/ops/06-incident-response.md`](file:///d:/AniResQ/docs/ops/06-incident-response.md).
