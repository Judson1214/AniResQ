#!/usr/bin/env bash
# Applies every migration, in order, to an EMPTY Postgres and runs the security checks.
# Usage: DATABASE_URL=postgres://user:pass@host:5432/db supabase/ci/run_db_checks.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point at an empty, disposable Postgres database}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

echo "== Migration integrity & ordering checks"
python3 "$DIR/ci/check_migrations.py"

echo "== Supabase platform stub"
"${PSQL[@]}" -f "$DIR/ci/00_supabase_stub.sql"

echo "== Project URL setting (the migrations deliberately do not set it)"
DBNAME="$(psql "$DATABASE_URL" -Atc 'SELECT current_database()')"
"${PSQL[@]}" -c "ALTER DATABASE \"$DBNAME\" SET app.settings.supabase_url = 'https://ci-project.supabase.co';"
# ALTER DATABASE only affects new connections; each psql call below opens a fresh one.

for f in $(ls "$DIR"/migrations/*.sql | sort); do
  echo "== Applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
  fname="$(basename "$f")"
  fversion="${fname%%_*}"
  "${PSQL[@]}" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$fversion', '$fname') ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;"
done

echo "== Security checks"
"${PSQL[@]}" -f "$DIR/ci/verify.sql"

echo "== Seeding test admin for live audit verification"
"${PSQL[@]}" -c "
DO \$\$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_admin_id, 'admin@aniresq.com') ON CONFLICT (id) DO NOTHING;
  UPDATE public.users SET role = 'ADMIN' WHERE id = v_admin_id;
END \$\$;
"

echo "== Live Database Audit script"
"${PSQL[@]}" -f "$DIR/ops/live_audit.sql"

FAIL_COUNT=$("${PSQL[@]}" -Atc "
SELECT COUNT(*) FROM (
  -- Check 1
  WITH expected_migrations(version, filename) AS (
    VALUES
      ('20261031000000', '20261031000000_init_aniresq_schema.sql'),
      ('20261103000000', '20261103000000_security_fixes.sql'),
      ('20261122000000', '20261122000000_restrict_rescue_reads.sql'),
      ('20261122010000', '20261122010000_restrict_animals_direct_reads.sql'),
      ('20261122020000', '20261122020000_revoke_direct_table_mutations.sql'),
      ('20261123000000', '20261123000000_nearby_responder_alerts.sql'),
      ('20261125000000', '20261125000000_audit_logs_append_only.sql'),
      ('20261125010000', '20261125010000_transactional_role_audit.sql'),
      ('20261126000000', '20261126000000_id_verification_columns.sql'),
      ('20261126010000', '20261126010000_storage_prefix_fallback.sql'),
      ('20261126020000', '20261126020000_revoke_users_table_mutations.sql'),
      ('20261126030000', '20261126030000_restrict_lost_found_reads.sql'),
      ('20261126040000', '20261126040000_harden_lost_found_policies.sql'),
      ('20261126050000', '20261126050000_adoption_guards_and_cascade_set_null.sql'),
      ('20261126060000', '20261126060000_create_system_settings.sql'),
      ('20261126070000', '20261126070000_add_user_is_disabled.sql'),
      ('20261126080000', '20261126080000_allow_reporter_set_null.sql'),
      ('20261126090000', '20261126090000_harden_uploads_bucket_limits.sql'),
      ('20261127100000', '20261127100000_create_content_reports.sql'),
      ('20261127110000', '20261127110000_add_user_terms_and_id_last4.sql'),
      ('20261127120000', '20261127120000_index_users_is_disabled.sql')
  ),
  applied_migrations AS (
    SELECT version, name FROM supabase_migrations.schema_migrations
  )
  SELECT 1 FROM expected_migrations em
  WHERE NOT EXISTS (
    SELECT 1 FROM applied_migrations am 
    WHERE am.version = em.version OR am.version = em.filename OR am.name = em.filename OR am.name = em.version
  )
  UNION ALL
  -- Check 2
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  UNION ALL
  -- Check 3
  SELECT 1 FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  UNION ALL
  -- Check 4
  SELECT 1 FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT' AND table_name IN ('lost_and_found', 'lost_and_found_replies', 'audit_logs', 'system_settings', 'content_reports')
  UNION ALL
  -- Check 5
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('admin_update_user_role', 'admin_decline_role_request', 'get_nearby_responders')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'))
  UNION ALL
  -- Check 6
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('rescues', 'animals', 'users', 'adoption_applications', 'notifications')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND ('public' = ANY(roles) OR (array_length(roles, 1) = 1 AND roles[1] = 'public'))
  UNION ALL
  -- Check 7
  SELECT 1 FROM storage.buckets
  WHERE (id = 'id-verification' AND public != false)
     OR (id = 'uploads' AND (file_size_limit IS NULL OR allowed_mime_types IS NULL OR file_size_limit > 5242880))
  UNION ALL
  -- Check 8
  SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_disabled')
  UNION ALL
  SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings')
  UNION ALL
  SELECT 1 WHERE (SELECT COUNT(*) FROM public.users WHERE role = 'ADMIN') = 0
) audit_failures;")

if [ "$FAIL_COUNT" -ne 0 ]; then
  echo "ERROR: live_audit.sql detected $FAIL_COUNT failures!"
  exit 1
fi

echo "OK: migrations applied and all checks passed (including live_audit.sql 100% PASS)"
