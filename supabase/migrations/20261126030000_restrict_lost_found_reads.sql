-- 20261126030000_restrict_lost_found_reads.sql
-- Security Hardening: Revoke direct anon SELECT on lost_and_found and lost_and_found_replies
--
-- Direct SELECT permissions to the 'anon' role allowed unauthenticated scrapers
-- holding the client anon key to bypass API rate limits and harvest contact_phone and contact_email
-- directly via PostgREST.
--
-- All public browsing must route through the FastAPI backend (service_role) which redacts
-- contact details for unauthenticated visitors, while authenticated users maintain read access.
--
-- Idempotent: safe to re-run.

-- 1. Revoke direct anon SELECT permissions
REVOKE SELECT ON public.lost_and_found FROM anon;
REVOKE SELECT ON public.lost_and_found_replies FROM anon;

-- 2. Drop overly permissive public read policies
DROP POLICY IF EXISTS "Lost and found viewable by everyone" ON public.lost_and_found;
DROP POLICY IF EXISTS "Lost and found replies viewable by everyone" ON public.lost_and_found_replies;

-- 3. Ensure authenticated users have RLS SELECT access
DROP POLICY IF EXISTS "Lost and found viewable by authenticated users" ON public.lost_and_found;
CREATE POLICY "Lost and found viewable by authenticated users" 
  ON public.lost_and_found FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Lost and found replies viewable by authenticated users" ON public.lost_and_found_replies;
CREATE POLICY "Lost and found replies viewable by authenticated users" 
  ON public.lost_and_found_replies FOR SELECT 
  TO authenticated 
  USING (true);

-- 4. Maintain service_role and authenticated permissions
GRANT SELECT ON public.lost_and_found TO authenticated;
GRANT SELECT ON public.lost_and_found_replies TO authenticated;
GRANT ALL ON public.lost_and_found TO service_role;
GRANT ALL ON public.lost_and_found_replies TO service_role;
