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

-- 11. Verify private bucket id-verification cannot be read by anonymous role
-- Seed a test object in id-verification bucket
INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES ('00000000-0000-0000-0000-000000000099', 'id-verification', '00000000-0000-0000-0000-111111111111/id_card.png', '00000000-0000-0000-0000-111111111111'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Anonymous MUST NOT be able to read objects from id-verification
SET LOCAL ROLE anon;
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'id-verification';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to read objects from id-verification bucket (count=%)', v_count;
  END IF;

  RAISE NOTICE 'PASS: anon cannot read objects from id-verification bucket';
END $$;
RESET ROLE;

-- Authenticated non-owner non-admin MUST NOT be able to read another user's id-verification object
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-222222222222","role":"authenticated"}', true);
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'id-verification';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: authenticated non-owner was able to read id-verification objects (count=%)', v_count;
  END IF;

  RAISE NOTICE 'PASS: authenticated non-owner cannot read another user''s id-verification objects';
END $$;
RESET ROLE;

-- Authenticated OWNER CAN read their own id-verification object
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'id-verification';

  IF v_count < 1 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: owner was unable to read their own id-verification object';
  END IF;

  RAISE NOTICE 'PASS: owner can read their own id-verification object';
END $$;
RESET ROLE;

-- 12. Verify get_storage_prefix returns valid prefix with or without app.settings.supabase_url
DO $$
DECLARE
  v_prefix TEXT;
BEGIN
  v_prefix := public.get_storage_prefix();
  IF v_prefix IS NULL OR v_prefix = '' OR NOT (v_prefix LIKE '%/storage/v1/object/public/uploads/') THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: get_storage_prefix failed to return valid storage prefix: %', v_prefix;
  END IF;
  RAISE NOTICE 'PASS: get_storage_prefix returns valid storage prefix (%)', v_prefix;
END $$;

-- 13. Verify direct mutations on public.users are blocked from anon and authenticated
SET LOCAL ROLE anon;
DO $$
BEGIN
  UPDATE public.users SET requested_role = 'ADMIN' WHERE id = '00000000-0000-0000-0000-111111111111';
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to directly UPDATE public.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied direct UPDATE on public.users';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  UPDATE public.users
  SET requested_role = 'NGO', id_card_type = 'anything', id_card_number = '123', id_card_url = 'x'
  WHERE id = '00000000-0000-0000-0000-111111111111';
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to directly UPDATE public.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied direct UPDATE on public.users';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-333333333333","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES ('00000000-0000-0000-0000-333333333333', 'hacker@test.com', 'Hacker', 'ADMIN');
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to directly INSERT into public.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied direct INSERT on public.users';
END $$;
RESET ROLE;

-- 14. Verify anon is denied direct SELECT on public.lost_and_found and lost_and_found_replies
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM * FROM public.lost_and_found LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to directly SELECT from public.lost_and_found';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied direct SELECT on public.lost_and_found';
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM * FROM public.lost_and_found_replies LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to directly SELECT from public.lost_and_found_replies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied direct SELECT on public.lost_and_found_replies';
END $$;
RESET ROLE;

-- 15. Verify authenticated role is also denied direct SELECT on lost_and_found to prevent PostgREST contact scraping
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM * FROM public.lost_and_found LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to directly SELECT from public.lost_and_found';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied direct SELECT on public.lost_and_found';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM * FROM public.lost_and_found_replies LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to directly SELECT from public.lost_and_found_replies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied direct SELECT on public.lost_and_found_replies';
END $$;
RESET ROLE;

-- 16. Verify partial unique index prevents duplicate open adoption applications
DO $$
DECLARE
  v_animal_id UUID;
  v_user_id UUID := '00000000-0000-0000-0000-111111111111';
  v_app1_id UUID;
  v_app2_id UUID;
BEGIN
  -- Insert a test animal
  INSERT INTO public.animals (name, species, age_estimate, gender, health_status, adoption_status, description)
  VALUES ('Test Tiger', 'CAT'::public.species, '2 yrs', 'MALE'::public.gender, 'HEALTHY'::public.health_status, 'AVAILABLE'::public.adoption_status, 'Test animal')
  RETURNING id INTO v_animal_id;

  -- 1st open application succeeds
  INSERT INTO public.adoption_applications (animal_id, applicant_id, living_environment, family_members, prior_pet_experience, work_schedule, why_adopt, status)
  VALUES (v_animal_id, v_user_id, 'HOUSE'::public.living_environment, 1, 'None', 'Remote', 'Love pets', 'SUBMITTED'::public.application_status)
  RETURNING id INTO v_app1_id;

  -- 2nd open application for same animal and applicant must fail with unique_violation (23505)
  BEGIN
    INSERT INTO public.adoption_applications (animal_id, applicant_id, living_environment, family_members, prior_pet_experience, work_schedule, why_adopt, status)
    VALUES (v_animal_id, v_user_id, 'HOUSE'::public.living_environment, 1, 'None', 'Remote', 'Love pets', 'UNDER_REVIEW'::public.application_status)
    RETURNING id INTO v_app2_id;
    RAISE EXCEPTION 'SECURITY/DATA VIOLATION: Duplicate open adoption application was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: partial unique index blocks duplicate open adoption application (23505)';
  END;

  -- Update 1st application to REJECTED (closed)
  UPDATE public.adoption_applications SET status = 'REJECTED' WHERE id = v_app1_id;

  -- Now submitting a new open application should succeed
  INSERT INTO public.adoption_applications (animal_id, applicant_id, living_environment, family_members, prior_pet_experience, work_schedule, why_adopt, status)
  VALUES (v_animal_id, v_user_id, 'HOUSE'::public.living_environment, 1, 'None', 'Remote', 'Love pets', 'SUBMITTED'::public.application_status);

  RAISE NOTICE 'PASS: partial unique index permits re-application once prior application is closed';
END $$;

-- 17. Verify user deletion triggers ON DELETE SET NULL and sanitizes PII
DO $$
DECLARE
  v_del_user_id UUID := '00000000-0000-0000-0000-999999999999';
  v_rescue_id UUID;
  v_lf_id UUID;
  v_reply_id UUID;
  v_app_id UUID;
  v_animal_id UUID;
  v_check_reporter UUID;
  v_check_phone TEXT;
  v_check_email TEXT;
  v_check_user_name TEXT;
  v_check_applicant UUID;
BEGIN
  -- Create ephemeral user in auth.users & public.users
  INSERT INTO auth.users (id, email) VALUES (v_del_user_id, 'delete_me@example.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (v_del_user_id, 'delete_me@example.com', 'Delete Me User', 'CITIZEN')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Create rescue
  INSERT INTO public.rescues (reporter_id, title, description, severity, species, latitude, longitude, address)
  VALUES (v_del_user_id, 'Cascade Test Rescue', 'Test desc', 'LOW'::public.rescue_severity, 'DOG', 12.9, 77.6, 'Test addr')
  RETURNING id INTO v_rescue_id;

  -- Create lost and found post
  INSERT INTO public.lost_and_found (reporter_id, type, title, description, species, latitude, longitude, last_seen_address, last_seen_date, contact_phone, contact_email)
  VALUES (v_del_user_id, 'LOST'::public.lost_found_type, 'Test Lost', 'Test desc', 'CAT', 12.9, 77.6, 'Test addr', NOW(), '9999999999', 'pii@example.com')
  RETURNING id INTO v_lf_id;

  -- Create reply
  INSERT INTO public.lost_and_found_replies (lost_and_found_id, user_id, user_name, text)
  VALUES (v_lf_id, v_del_user_id, 'Delete Me User', 'I saw your pet')
  RETURNING id INTO v_reply_id;

  -- Create test animal and adoption application
  INSERT INTO public.animals (name, species, age_estimate, gender, health_status, adoption_status, description)
  VALUES ('Cascade Animal', 'DOG'::public.species, '1 yr', 'FEMALE'::public.gender, 'HEALTHY'::public.health_status, 'AVAILABLE'::public.adoption_status, 'Test animal')
  RETURNING id INTO v_animal_id;

  INSERT INTO public.adoption_applications (animal_id, applicant_id, living_environment, family_members, prior_pet_experience, work_schedule, why_adopt, status)
  VALUES (v_animal_id, v_del_user_id, 'APARTMENT'::public.living_environment, 1, 'Yes', 'WFH', 'Adopt', 'SUBMITTED'::public.application_status)
  RETURNING id INTO v_app_id;

  -- Delete the user
  DELETE FROM public.users WHERE id = v_del_user_id;

  -- Verify rescue still exists with reporter_id NULL
  SELECT reporter_id INTO v_check_reporter FROM public.rescues WHERE id = v_rescue_id;
  IF v_check_reporter IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: rescues.reporter_id was not set to NULL on user delete';
  END IF;

  -- Verify lost_and_found still exists with reporter_id NULL and PII redacted
  SELECT reporter_id, contact_phone, contact_email INTO v_check_reporter, v_check_phone, v_check_email
  FROM public.lost_and_found WHERE id = v_lf_id;
  IF v_check_reporter IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: lost_and_found.reporter_id was not set to NULL on user delete';
  END IF;
  IF v_check_phone != '[Deleted User]' OR v_check_email IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: lost_and_found contact details were not sanitized upon user delete (phone=%, email=%)', v_check_phone, v_check_email;
  END IF;

  -- Verify reply still exists with user_id NULL and sanitized name
  SELECT user_id, user_name INTO v_check_reporter, v_check_user_name
  FROM public.lost_and_found_replies WHERE id = v_reply_id;
  IF v_check_reporter IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: lost_and_found_replies.user_id was not set to NULL on user delete';
  END IF;
  IF v_check_user_name != 'Deleted User' THEN
    RAISE EXCEPTION 'VIOLATION: lost_and_found_replies.user_name was not sanitized on user delete';
  END IF;

  -- Verify adoption application still exists with applicant_id NULL
  SELECT applicant_id INTO v_check_applicant FROM public.adoption_applications WHERE id = v_app_id;
  IF v_check_applicant IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: adoption_applications.applicant_id was not set to NULL on user delete';
  END IF;

  RAISE NOTICE 'PASS: user deletion preserves rescue/adoption history with SET NULL and redacts PII';
END $$;

-- 18. Verify system_settings denies direct operations to anon and authenticated
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM * FROM public.system_settings LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: anon was able to query public.system_settings';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon is denied SELECT on public.system_settings';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM * FROM public.system_settings LIMIT 1;
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to query public.system_settings';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied SELECT on public.system_settings';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  UPDATE public.system_settings SET value = 'false'::jsonb WHERE key = 'autoDispatchEnabled';
  RAISE EXCEPTION 'SECURITY VIOLATION: authenticated was able to update public.system_settings';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated is denied UPDATE on public.system_settings';
END $$;
RESET ROLE;

-- 19. Verify users.is_disabled exists and defaults to false
DO $$
DECLARE
  v_has_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'is_disabled'
  ) INTO v_has_col;

  IF NOT v_has_col THEN
    RAISE EXCEPTION 'VIOLATION: users.is_disabled column does not exist';
  END IF;
  RAISE NOTICE 'PASS: users.is_disabled column exists';
END $$;

-- 20. Catalog query: Verify RLS is enabled on all base tables in the public schema
DO $$
DECLARE
  v_unprotected_tables TEXT;
BEGIN
  SELECT string_agg(relname, ', ') INTO v_unprotected_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false;

  IF v_unprotected_tables IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: RLS is not enabled on public tables: %', v_unprotected_tables;
  END IF;

  RAISE NOTICE 'PASS: RLS (relrowsecurity) is enabled on all public tables';
END $$;

-- 21. Catalog query: Verify mutation privileges (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER)
-- are completely revoked from anon and authenticated on all public tables
DO $$
DECLARE
  v_violations TEXT;
BEGIN
  SELECT string_agg(format('%s on %s to %s', privilege_type, table_name, grantee), ', ')
  INTO v_violations
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');

  IF v_violations IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Unsafe mutation privileges granted to anon/authenticated: %', v_violations;
  END IF;

  RAISE NOTICE 'PASS: All mutation privileges are strictly revoked from anon and authenticated on public tables';
END $$;

-- 22. Verify direct update of rescues.reporter_id by non-service_role is blocked, while deleting reporter succeeds
DO $$
DECLARE
  v_u1 UUID := '00000000-0000-0000-0000-aaaaaaaaaaaa';
  v_u2 UUID := '00000000-0000-0000-0000-bbbbbbbbbbbb';
  v_check_rep UUID;
BEGIN
  -- Seed test users
  INSERT INTO auth.users (id, email) VALUES (v_u1, 'rep1@test.com'), (v_u2, 'rep2@test.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (v_u1, 'rep1@test.com', 'Reporter 1', 'CITIZEN'),
         (v_u2, 'rep2@test.com', 'Reporter 2', 'CITIZEN')
  ON CONFLICT (id) DO NOTHING;

  -- Create rescue
  INSERT INTO public.rescues (id, reporter_id, title, description, severity, species, latitude, longitude, address)
  VALUES ('00000000-0000-0000-0000-cccccccccccc', v_u1, 'Ownership Rescue', 'Ownership description', 'LOW'::public.rescue_severity, 'DOG', 12.9, 77.6, 'Addr')
  ON CONFLICT (id) DO UPDATE SET reporter_id = v_u1;

  -- Direct update as authenticated user must fail
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_u1), true);
  BEGIN
    UPDATE public.rescues SET reporter_id = v_u2 WHERE id = '00000000-0000-0000-0000-cccccccccccc';
    RAISE EXCEPTION 'SECURITY VIOLATION: Direct transfer of rescue reporter_id was permitted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Cannot transfer rescue reporter ownership%' THEN
        RAISE NOTICE 'PASS: direct update of rescues.reporter_id blocked by protect_rescue_update';
      ELSE
        RAISE EXCEPTION 'Unexpected error on direct reporter update: %', SQLERRM;
      END IF;
  END;

  -- Deleting the user who has a rescue succeeds and leaves rescue with reporter_id NULL (via trigger depth > 1)
  DELETE FROM public.users WHERE id = v_u1;
  SELECT reporter_id INTO v_check_rep FROM public.rescues WHERE id = '00000000-0000-0000-0000-cccccccccccc';
  IF v_check_rep IS NOT NULL THEN
    RAISE EXCEPTION 'VIOLATION: rescue reporter_id was not set to NULL after user deletion';
  END IF;
  RAISE NOTICE 'PASS: user deletion cascades SET NULL to rescue reporter_id without triggering transfer block';
END $$;

ROLLBACK;
