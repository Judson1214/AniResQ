-- 20261126040000_harden_lost_found_policies.sql
-- Security Hardening: Revoke direct client SELECT on lost_and_found from authenticated role
-- and drop lingering "Replies are viewable by everyone" policy.
--
-- Defense-in-depth:
-- 1. Direct SELECT permissions to 'authenticated' role on lost_and_found allowed any user
--    with a free citizen signup to bypass the API's rate limits and bulk-scrape contact_phone
--    and contact_email via PostgREST.
-- 2. Clean up legacy "Replies are viewable by everyone" policy.
--
-- All lost and found access must route strictly through the rate-limited FastAPI backend (service_role).
--
-- Idempotent: safe to re-run.

-- 1. Revoke direct SELECT permissions on lost_and_found and replies from authenticated
REVOKE SELECT ON public.lost_and_found FROM authenticated;
REVOKE SELECT ON public.lost_and_found_replies FROM authenticated;

-- 2. Drop lingering legacy policies on lost_and_found and lost_and_found_replies
DROP POLICY IF EXISTS "Replies are viewable by everyone" ON public.lost_and_found_replies;
DROP POLICY IF EXISTS "Lost and found replies viewable by everyone" ON public.lost_and_found_replies;
DROP POLICY IF EXISTS "Lost and found replies viewable by authenticated users" ON public.lost_and_found_replies;
DROP POLICY IF EXISTS "Lost and found viewable by everyone" ON public.lost_and_found;
DROP POLICY IF EXISTS "Lost and found viewable by authenticated users" ON public.lost_and_found;

-- 3. Ensure service_role maintains full access for backend API operations
GRANT ALL ON public.lost_and_found TO service_role;
GRANT ALL ON public.lost_and_found_replies TO service_role;
