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

-- 6 & 7. Verify audit_logs is append-only: UPDATE and DELETE are blocked by trigger
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_test_id UUID := '00000000-0000-0000-0000-777777777777';
BEGIN
  -- Insert a valid audit log entry as service_role
  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, performed_by)
  VALUES (v_test_id, 'TEST_AUDIT', 'TEST', 'test-1', 'service_role');

  -- Attempt UPDATE: Must be blocked by trigger
  BEGIN
    UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = v_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: UPDATE succeeded on audit_logs';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' THEN
        RAISE NOTICE 'PASS: UPDATE on audit_logs blocked by append-only trigger';
      ELSE
        RAISE EXCEPTION 'Unexpected error on UPDATE: %', SQLERRM;
      END IF;
  END;

  -- Attempt DELETE: Must be blocked by trigger
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_test_id;
    RAISE EXCEPTION 'SECURITY VIOLATION: DELETE succeeded on audit_logs';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%audit_logs table is append-only%' THEN
        RAISE NOTICE 'PASS: DELETE on audit_logs blocked by append-only trigger';
      ELSE
        RAISE EXCEPTION 'Unexpected error on DELETE: %', SQLERRM;
      END IF;
  END;
END $$;
RESET ROLE;

ROLLBACK;
