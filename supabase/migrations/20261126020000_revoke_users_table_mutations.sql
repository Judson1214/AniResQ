-- 20261126020000_revoke_users_table_mutations.sql
-- Security Hardening: Revoke direct PostgREST mutations on public.users and decouple signup trigger from requested_role
--
-- Direct mutations (INSERT, UPDATE, DELETE, TRUNCATE) through PostgREST (anon and authenticated roles)
-- allowed users to bypass API clearance validation, path format checks, length limits, and duplicate guards.
--
-- All user mutations must route strictly through the FastAPI backend using the service_role key.
--
-- Idempotent: safe to re-run.

-- 1. Revoke direct table mutations on public.users from client roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.users FROM anon, authenticated;

-- 2. Clean up legacy direct-update RLS policies for defense-in-depth
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- 3. Ensure service_role maintains full access for backend API operations
GRANT ALL ON public.users TO service_role;

-- 4. Decouple handle_new_user() trigger from signup metadata requested_role
-- Guarantees that accounts created through Auth signup (web or direct Supabase client)
-- start strictly as CITIZEN with requested_role = NULL, eliminating unverified role requests.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, phone, role, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unknown User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'CITIZEN'::public.user_role,
    NULL -- All accounts start as standard CITIZEN with NO pending clearance request
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE WHEN public.users.display_name = 'Unknown User' THEN EXCLUDED.display_name ELSE public.users.display_name END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
