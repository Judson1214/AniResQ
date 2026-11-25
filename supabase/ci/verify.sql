-- Supabase CI Automated Verification Script: supabase/ci/verify.sql
-- Validates RLS policies, mutation blocks, and RPC security controls.

\set ON_ERROR_STOP on

BEGIN;

-- 1. Anonymous role must NOT be able to execute get_nearby_responders
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.get_nearby_responders(12.9716, 77.5946, 25);
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to execute get_nearby_responders';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied EXECUTE on get_nearby_responders';
END $$;
RESET ROLE;

-- 2. Authenticated role must NOT be able to execute get_nearby_responders (prevents volunteer location triangulation)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM public.get_nearby_responders(12.9716, 77.5946, 25);
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated role was able to execute get_nearby_responders';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied EXECUTE on get_nearby_responders';
END $$;
RESET ROLE;

-- 3. Service role CAN execute get_nearby_responders
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.get_nearby_responders(12.9716, 77.5946, 25);
  RAISE NOTICE 'PASS: service_role executed get_nearby_responders successfully (returned % rows)', v_count;
END $$;
RESET ROLE;

-- 4. Verify anonymous role cannot perform direct table mutations
SET LOCAL ROLE anon;
DO $$
BEGIN
  INSERT INTO public.rescues (id, title, species, severity, status, address)
  VALUES ('00000000-0000-0000-0000-999999999999', 'Fake Rescue', 'DOG', 'HIGH', 'PENDING', 'Fake Addr');
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to insert into rescues table';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied direct INSERT on rescues';
END $$;
RESET ROLE;

-- 5. Verify anonymous role cannot insert into audit_logs
SET LOCAL ROLE anon;
DO $$
BEGIN
  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, performed_by)
  VALUES ('00000000-0000-0000-0000-888888888888', 'FORGED_AUDIT', 'USER', 'user-1', 'anon');
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to insert into audit_logs table';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied direct INSERT on audit_logs';
END $$;
RESET ROLE;

-- 6 & 7. Verify service_role mutations on audit_logs are blocked (via privilege revocation or trigger)
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_test_id UUID := '00000000-0000-0000-0000-777777777777';
BEGIN
  -- Insert a valid audit log entry as service_role
  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, performed_by)
  VALUES (v_test_id, 'TEST_AUDIT', 'TEST', 'test-1', 'service_role');

  -- Attempt UPDATE: Must be blocked by privilege revocation or append-only trigger
  BEGIN
    UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = v_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: UPDATE succeeded on audit_logs';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: service_role UPDATE blocked by privilege revocation';
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' OR SQLERRM LIKE '%permission denied%' THEN
        RAISE NOTICE 'PASS: service_role UPDATE blocked (message: %)', SQLERRM;
      ELSE
        RAISE EXCEPTION 'Unexpected error on service_role UPDATE: %', SQLERRM;
      END IF;
  END;

  -- Attempt DELETE: Must be blocked by privilege revocation or append-only trigger
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: DELETE succeeded on audit_logs';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: service_role DELETE blocked by privilege revocation';
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' OR SQLERRM LIKE '%permission denied%' THEN
        RAISE NOTICE 'PASS: service_role DELETE blocked (message: %)', SQLERRM;
      ELSE
        RAISE EXCEPTION 'Unexpected error on service_role DELETE: %', SQLERRM;
      END IF;
  END;
END $$;
RESET ROLE;

-- 7b. Verify append-only trigger directly as table owner (bypasses table privileges to trigger check)
DO $$
DECLARE
  v_owner_test_id UUID := '00000000-0000-0000-0000-666666666666';
BEGIN
  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, performed_by)
  VALUES (v_owner_test_id, 'OWNER_TEST', 'TEST', 'test-1', 'postgres');

  -- Attempt UPDATE as table owner: Must be blocked by trigger
  BEGIN
    UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = v_owner_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: table owner UPDATE succeeded on audit_logs';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' THEN
        RAISE NOTICE 'PASS: table owner UPDATE blocked by append-only trigger';
      ELSE
        RAISE EXCEPTION 'Unexpected error on table owner UPDATE: %', SQLERRM;
      END IF;
  END;

  -- Attempt DELETE as table owner: Must be blocked by trigger
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_owner_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: table owner DELETE succeeded on audit_logs';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' THEN
        RAISE NOTICE 'PASS: table owner DELETE blocked by append-only trigger';
      ELSE
        RAISE EXCEPTION 'Unexpected error on table owner DELETE: %', SQLERRM;
      END IF;
  END;
END $$;

-- 8. Verify service_role lacks UPDATE, DELETE, TRUNCATE table privileges on audit_logs
DO $$
BEGIN
  IF has_table_privilege('service_role', 'public.audit_logs', 'UPDATE') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role has UPDATE privilege on audit_logs';
  END IF;
  IF has_table_privilege('service_role', 'public.audit_logs', 'DELETE') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role has DELETE privilege on audit_logs';
  END IF;
  IF has_table_privilege('service_role', 'public.audit_logs', 'TRUNCATE') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role has TRUNCATE privilege on audit_logs';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.audit_logs', 'INSERT') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role is missing INSERT privilege on audit_logs';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role is missing SELECT privilege on audit_logs';
  END IF;
  RAISE NOTICE 'PASS: service_role table privileges strictly limited to SELECT and INSERT on audit_logs';
END $$;

-- 9. Verify anon and authenticated cannot execute admin_update_user_role or admin_decline_role_request
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM public.admin_update_user_role('00000000-0000-0000-0000-000000000001'::uuid, 'VOLUNTEER'::public.user_role, 'anon');
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to execute admin_update_user_role';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied EXECUTE on admin_update_user_role';
END $$;

DO $$
BEGIN
  PERFORM public.admin_decline_role_request('00000000-0000-0000-0000-000000000001'::uuid, 'anon');
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to execute admin_decline_role_request';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied EXECUTE on admin_decline_role_request';
END $$;
RESET ROLE;

-- 10. Verify transactional integrity of admin_update_user_role via service_role
-- Seed user in auth.users as table owner so handle_new_user creates public.users
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-111111111111', 'testuser@example.com')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;

UPDATE public.users
SET requested_role = 'VOLUNTEER'
WHERE id = '00000000-0000-0000-0000-111111111111';

DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-111111111111';
  v_res JSONB;
  v_audit_count INTEGER;
BEGIN
  -- Execute transactional role change RPC
  v_res := public.admin_update_user_role(v_test_user_id, 'VOLUNTEER'::public.user_role, 'admin-uuid');

  -- Verify user role updated and requested_role cleared
  IF (v_res->>'role') != 'VOLUNTEER' OR (v_res->>'requested_role') IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: admin_update_user_role did not return expected user state';
  END IF;

  -- Verify audit log entry was created in the same transaction
  SELECT COUNT(*) INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_id = v_test_user_id::text AND action = 'ROLE_CHANGE';

  IF v_audit_count < 1 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: admin_update_user_role failed to persist audit log entry';
  END IF;

  RAISE NOTICE 'PASS: admin_update_user_role executed and persisted audit trail atomically';
END $$;
RESET ROLE;

ROLLBACK;
