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

ROLLBACK;
