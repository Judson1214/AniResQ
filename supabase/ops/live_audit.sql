-- ==============================================================================
-- AniResQ: Production Live Database Security & Integrity Audit Script
-- Location: supabase/ops/live_audit.sql
-- Instructions: Paste into the Supabase SQL Editor and execute.
-- Guarantees: 100% READ-ONLY (SELECT only). Never alters data or schema.
-- Output: Returns result sets with check_name, status (PASS/FAIL), and details.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CHECK 1: Migration Completeness Check
-- Compares migrations recorded in supabase_migrations.schema_migrations with expected list.
-- ------------------------------------------------------------------------------
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
  SELECT version, name
  FROM supabase_migrations.schema_migrations
)
SELECT 
  'Check 1: Applied Migrations' AS check_category,
  em.filename AS migration_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM applied_migrations am 
      WHERE am.version = em.version 
         OR am.version = em.filename 
         OR am.name = em.filename 
         OR am.name = em.version
    ) THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM applied_migrations am 
      WHERE am.version = em.version 
         OR am.version = em.filename 
         OR am.name = em.filename 
         OR am.name = em.version
    ) THEN 'Applied successfully'
    ELSE 'MISSING from supabase_migrations.schema_migrations'
  END AS details
FROM expected_migrations em
ORDER BY em.version;

-- ------------------------------------------------------------------------------
-- CHECK 2: Row Level Security (RLS) on all public tables
-- Verifies every table in public schema has relrowsecurity = true.
-- ------------------------------------------------------------------------------
SELECT 
  'Check 2: Table Row Level Security' AS check_category,
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END AS status,
  CASE WHEN c.relrowsecurity THEN 'RLS enabled' ELSE 'CRITICAL: RLS is disabled' END AS details
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
ORDER BY c.relname;

-- ------------------------------------------------------------------------------
-- CHECK 3: Mutation Privilege Grants to anon and authenticated
-- Verifies no table in public grants INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.
-- ------------------------------------------------------------------------------
WITH public_tables AS (
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
illegal_grants AS (
  SELECT 
    table_name,
    string_agg(grantee || ':' || privilege_type, ', ') AS granted_privileges
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  GROUP BY table_name
)
SELECT 
  'Check 3: Public Table Mutation Revocations' AS check_category,
  pt.table_name,
  CASE WHEN ig.table_name IS NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  COALESCE('CRITICAL: Granted ' || ig.granted_privileges, 'Safe: Mutation privileges fully revoked') AS details
FROM public_tables pt
LEFT JOIN illegal_grants ig ON pt.table_name = ig.table_name
ORDER BY pt.table_name;

-- ------------------------------------------------------------------------------
-- CHECK 4: SELECT Grants on Sensitive Tables
-- Verifies anon and authenticated have NO SELECT on sensitive public tables.
-- ------------------------------------------------------------------------------
WITH sensitive_tables AS (
  SELECT unnest(ARRAY[
    'lost_and_found', 
    'lost_and_found_replies', 
    'audit_logs', 
    'system_settings',
    'content_reports'
  ]) AS table_name
),
active_select_grants AS (
  SELECT 
    table_name,
    string_agg(grantee, ', ') AS leaked_to
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'SELECT'
  GROUP BY table_name
)
SELECT 
  'Check 4: Sensitive Table SELECT Revocations' AS check_category,
  st.table_name,
  CASE WHEN asg.table_name IS NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  COALESCE('CRITICAL: SELECT granted to ' || asg.leaked_to, 'Safe: SELECT revoked from anon & authenticated') AS details
FROM sensitive_tables st
LEFT JOIN active_select_grants asg ON st.table_name = asg.table_name
ORDER BY st.table_name;

-- ------------------------------------------------------------------------------
-- CHECK 5: Execution Permissions on Critical Security Functions
-- Verifies sensitive functions are executable ONLY by service_role.
-- ------------------------------------------------------------------------------
SELECT 
  'Check 5: Sensitive Function Execution' AS check_category,
  p.proname AS function_name,
  CASE 
    WHEN NOT has_function_privilege('anon', p.oid, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND has_function_privilege('service_role', p.oid, 'EXECUTE')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || 
  ', auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || 
  ', service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text AS details
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_update_user_role', 'admin_decline_role_request', 'get_nearby_responders')
ORDER BY p.proname;

-- ------------------------------------------------------------------------------
-- CHECK 6: Public Mutation Policies on Core Entities
-- Verifies no policy exists with roles {public} for INSERT/UPDATE/DELETE.
-- ------------------------------------------------------------------------------
WITH target_tables AS (
  SELECT unnest(ARRAY[
    'rescues', 
    'animals', 
    'users', 
    'adoption_applications', 
    'notifications'
  ]) AS table_name
),
offending_policies AS (
  SELECT 
    tablename,
    string_agg(policyname || ' (' || cmd || ')', '; ') AS policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (SELECT table_name FROM target_tables)
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND ('public' = ANY(roles) OR (array_length(roles, 1) = 1 AND roles[1] = 'public'))
  GROUP BY tablename
)
SELECT 
  'Check 6: Public Role Mutation Policy Guard' AS check_category,
  tt.table_name,
  CASE WHEN op.tablename IS NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  COALESCE('CRITICAL: Public policies exist: ' || op.policies, 'Safe: No public mutation policies found') AS details
FROM target_tables tt
LEFT JOIN offending_policies op ON tt.table_name = op.tablename
ORDER BY tt.table_name;

-- ------------------------------------------------------------------------------
-- CHECK 7: Storage Bucket Configuration
-- Verifies id-verification is private; uploads has size limit and MIME allow-list.
-- ------------------------------------------------------------------------------
SELECT 
  'Check 7: Storage Bucket Configuration' AS check_category,
  id AS bucket_name,
  CASE 
    WHEN id = 'id-verification' AND public = false THEN 'PASS'
    WHEN id = 'uploads' AND file_size_limit IS NOT NULL AND allowed_mime_types IS NOT NULL 
                        AND file_size_limit <= 5242880 AND array_length(allowed_mime_types, 1) > 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  'public=' || public::text || 
  ', file_size_limit=' || COALESCE(file_size_limit::text, 'UNSET') || 
  ', allowed_mime_types=' || COALESCE(array_to_string(allowed_mime_types, ','), 'UNSET') AS details
FROM storage.buckets
WHERE id IN ('id-verification', 'uploads')
ORDER BY id;

-- ------------------------------------------------------------------------------
-- CHECK 8: Critical Columns & Administrator Account Audit
-- Verifies users.is_disabled, system_settings, and lists admin accounts.
-- ------------------------------------------------------------------------------
WITH schema_check AS (
  SELECT 
    EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_disabled'
    ) AS has_is_disabled,
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) AS has_system_settings
),
admin_accounts AS (
  SELECT 
    COUNT(*) AS admin_count,
    COALESCE(string_agg(email, ', '), 'NONE') AS admin_emails
  FROM public.users
  WHERE role = 'ADMIN'
)
SELECT 
  'Check 8: Schema Guard (is_disabled & system_settings)' AS check_category,
  'users.is_disabled & system_settings' AS item_name,
  CASE WHEN sc.has_is_disabled AND sc.has_system_settings THEN 'PASS' ELSE 'FAIL' END AS status,
  'is_disabled_exists=' || sc.has_is_disabled::text || ', system_settings_exists=' || sc.has_system_settings::text AS details
FROM schema_check sc
UNION ALL
SELECT 
  'Check 8: Administrator Account Audit' AS check_category,
  'Admin Presence' AS item_name,
  CASE WHEN aa.admin_count > 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  'Total Admins: ' || aa.admin_count::text || ' (Emails: ' || aa.admin_emails || ')' AS details
FROM admin_accounts aa;
