-- 20261125010000_transactional_role_audit.sql
-- Transactional administrative role mutations:
-- Executes user role update and audit log entry insertion in a single ACID transaction.
-- If the audit log insert fails, the user role update automatically rolls back.

-- 1. Ensure service_role cannot UPDATE, DELETE, or TRUNCATE audit_logs (idempotent)
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM service_role;

-- 2. Transactional admin role change RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id UUID,
  p_new_role user_role,
  p_admin_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_role user_role;
  v_old_requested TEXT;
  v_updated_user jsonb;
BEGIN
  -- Fetch and lock user row for update
  SELECT role, requested_role INTO v_old_role, v_old_requested
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  -- Update role and clear pending requested_role
  UPDATE public.users
  SET role = p_new_role,
      requested_role = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert audit log in same transaction
  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    performed_by,
    old_value,
    new_value
  ) VALUES (
    'ROLE_CHANGE',
    'USER',
    p_user_id::text,
    p_admin_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role)
  );

  -- Return updated user row as jsonb
  SELECT to_jsonb(u.*) INTO v_updated_user
  FROM public.users u
  WHERE u.id = p_user_id;

  RETURN v_updated_user;
END;
$$;

-- 3. Transactional admin decline role request RPC
CREATE OR REPLACE FUNCTION public.admin_decline_role_request(
  p_user_id UUID,
  p_admin_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role user_role;
  v_requested TEXT;
  v_updated_user jsonb;
BEGIN
  -- Fetch and lock user row for update
  SELECT role, requested_role INTO v_role, v_requested
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF v_requested IS NULL THEN
    RAISE EXCEPTION 'NO_PENDING_REQUEST';
  END IF;

  -- Clear requested_role only, preserving current role
  UPDATE public.users
  SET requested_role = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert audit log in same transaction
  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    performed_by,
    old_value,
    new_value
  ) VALUES (
    'ROLE_REQUEST_DECLINED',
    'USER',
    p_user_id::text,
    p_admin_id,
    jsonb_build_object('requested_role', v_requested, 'role', v_role),
    jsonb_build_object('requested_role', NULL, 'role', v_role)
  );

  -- Return updated user row as jsonb
  SELECT to_jsonb(u.*) INTO v_updated_user
  FROM public.users u
  WHERE u.id = p_user_id;

  RETURN v_updated_user;
END;
$$;

-- 4. Permissions: service_role ONLY. Explicitly revoke from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.admin_update_user_role(UUID, user_role, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, user_role, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.admin_decline_role_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decline_role_request(UUID, TEXT) TO service_role;
