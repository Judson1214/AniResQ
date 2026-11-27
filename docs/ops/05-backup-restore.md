# Runbook 05: Database Backup, Restore, and Disaster Recovery

This runbook defines backup policies, manual export procedures, disaster recovery targets, and quarterly restore verification drills for AniResQ.

---

## 1. Disaster Recovery Targets (SLAs)

The following operational targets are configured for AniResQ production operations:

| Metric | Target | Description |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **24 hours** (Daily Backups) / **2 minutes** (with PITR) | Maximum tolerable data loss duration in the event of catastrophic failure. |
| **RTO (Recovery Time Objective)** | **4 hours** | Maximum tolerable downtime required to restore services following an outage. |

*(Note: Adjust these values in your organizational SLA documentation if upgrading to PITR).*

---

## 2. Automated Backups & Point-In-Time Recovery (PITR)

- **Supabase Pro / Enterprise Plans**: Enable Point-in-Time Recovery under **Database > Backups > Point in Time** (`https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/database/backups`). This provides continuous WAL archiving allowing restoration to any second within the retention window.
- **Supabase Free / Pro Daily Backups**: Daily automated snapshots are taken by Supabase at 00:00 UTC and retained for 7 days (or 30 days on Pro).

---

## 3. Manual Backup Export Procedure (`pg_dump`)

To create an ad-hoc, off-site backup before major releases or schema changes:

1. Obtain the direct database connection string from **Project Settings > Database > Connection string > URI**:
   `postgresql://postgres.<YOUR-PROJECT-REF>:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
2. Export the full database schema and data using `pg_dump`:
   ```bash
   # Set the database URL securely in the current shell session
   export DATABASE_URL="postgresql://postgres.<YOUR-PROJECT-REF>:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

   # Export custom-format compressed backup
   pg_dump "$DATABASE_URL" \
     --format=custom \
     --no-owner \
     --no-privileges \
     --file="aniresq_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. Store the exported `.dump` archive in encrypted off-site cloud storage (e.g. AWS S3 with KMS encryption and 90-day retention lifecycle).

---

## 4. Quarterly Restore Drill (Testing in a Scratch Project)

Backups that have not been tested for restoration cannot be considered reliable. The operations team must execute a restore verification test **every quarter**:

1. Create a temporary scratch project in the Supabase Dashboard: `aniresq-restore-test-YYYYQ#`.
2. Retrieve the latest off-site backup file: `aniresq_backup_<DATE>.dump`.
3. Restore the dump into the scratch project:
   ```bash
   export SCRATCH_DB_URL="postgresql://postgres.<SCRATCH-PROJECT-REF>:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

   pg_restore \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --dbname="$SCRATCH_DB_URL" \
     aniresq_backup_<DATE>.dump
   ```
4. Run the security audit script [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql) against the restored scratch database.
5. Verify record counts for core entities:
   ```sql
   SELECT 'users' AS entity, COUNT(*) FROM public.users
   UNION ALL
   SELECT 'rescues', COUNT(*) FROM public.rescues
   UNION ALL
   SELECT 'animals', COUNT(*) FROM public.animals
   UNION ALL
   SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;
   ```
6. Record the test results in your team's compliance log, then delete the scratch project.
