-- 20261103000000_security_fixes.sql
-- Security Hardening: Avatar URL Trigger, Scoped Storage Upload Policy, Audit Logs, and Disallowing Admin via Signup Metadata

-- 1. Disallow requesting ADMIN role via signup metadata in handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
  req_role TEXT;
BEGIN
  req_role := UPPER(NEW.raw_user_meta_data->>'requested_role');
  -- Strictly disallow requesting ADMIN role or invalid roles via signup metadata
  IF req_role = 'ADMIN' OR req_role NOT IN ('VOLUNTEER', 'NGO', 'SHELTER', 'VET') THEN
    req_role := NULL;
  END IF;

  INSERT INTO public.users (id, email, display_name, phone, role, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unknown User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'CITIZEN'::public.user_role, -- Force CITIZEN regardless of user input
    req_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE WHEN public.users.display_name = 'Unknown User' THEN EXCLUDED.display_name ELSE public.users.display_name END,
    requested_role = COALESCE(EXCLUDED.requested_role, public.users.requested_role);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enforce official Supabase uploads bucket prefix on public.users.avatar_url
CREATE OR REPLACE FUNCTION public.validate_user_avatar_url()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    IF NOT (NEW.avatar_url ~ '^https://[a-zA-Z0-9.-]+\.supabase\.co/storage/v1/object/public/uploads/.*$') THEN
      RAISE EXCEPTION 'Invalid avatar URL. Avatars must be uploaded to the official AniResQ uploads storage bucket.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_user_avatar_url ON public.users;
CREATE TRIGGER tr_validate_user_avatar_url
  BEFORE INSERT OR UPDATE OF avatar_url ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_user_avatar_url();

-- 3. Scope storage uploads insert policy to {auth.uid()}/... path prefix
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uploads' AND 
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (name LIKE (auth.uid()::text || '/%')) OR
      auth.role() = 'service_role'
    )
  );

-- 4. Audit Log Table and Trigger for Role Changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to read audit logs" ON public.audit_logs;
CREATE POLICY "Allow admins to read audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role or admin to insert audit logs" ON public.audit_logs;
CREATE POLICY "Allow service role or admin to insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, old_value, new_value)
    VALUES (
      'ROLE_CHANGE',
      'USER',
      NEW.id,
      COALESCE(auth.uid()::text, 'service_role'),
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_user_role_change ON public.users;
CREATE TRIGGER tr_audit_user_role_change
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.audit_user_role_change();
