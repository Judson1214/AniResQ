-- 20261103000000_security_fixes.sql
-- Security Hardening: Restrict Users SELECT RLS, Project URL Avatar Validation, Scoped Storage Uploads, Service Role Audit Logs, Address/Bio Columns

-- 1. Add missing address and bio columns to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

-- 2. Restrict public.users SELECT policy strictly to own profile, administrators, or backend service role
-- Prevents VET, NGO, and SHELTER roles from dumping every user's email and phone with client anon key
DROP POLICY IF EXISTS "Users can view own profile or organization staff can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile or admins can view profiles" ON public.users;
CREATE POLICY "Users can view own profile or admins can view profiles" 
  ON public.users FOR SELECT 
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR auth.role() = 'service_role'
  );

-- 3. Disallow requesting ADMIN role via signup metadata in handle_new_user()
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

-- 4. Enforce official configured Supabase project uploads bucket prefix on public.users.avatar_url
-- Compares against configured project URL instead of any regex matching random attacker Supabase projects
CREATE OR REPLACE FUNCTION public.get_storage_prefix()
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  config_url TEXT;
BEGIN
  config_url := current_setting('app.settings.supabase_url', true);
  IF config_url IS NULL OR config_url = '' THEN
    config_url := 'https://cspnzitnvzdwwyxpnluw.supabase.co';
  END IF;
  RETURN rtrim(config_url, '/') || '/storage/v1/object/public/uploads/';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_avatar_url()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  valid_prefix TEXT;
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    valid_prefix := public.get_storage_prefix();
    IF NOT (NEW.avatar_url LIKE (valid_prefix || '%')) THEN
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

-- 5. Scope storage uploads insert policy to {auth.uid()}/... path prefix
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

-- 6. Audit Log Table and Trigger for Role Changes
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

-- Strictly allow ONLY service_role to insert audit logs (prevents forged audit entries from client)
DROP POLICY IF EXISTS "Allow service role or admin to insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow service role to insert audit logs" ON public.audit_logs;
CREATE POLICY "Allow service role to insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Skip trigger when updated via service_role to avoid duplicate audit logs with the backend API
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, old_value, new_value)
    VALUES (
      'ROLE_CHANGE',
      'USER',
      NEW.id,
      COALESCE(auth.uid()::text, 'unknown'),
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
