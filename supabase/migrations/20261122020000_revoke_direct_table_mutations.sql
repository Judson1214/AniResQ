-- 20261122020000_revoke_direct_table_mutations.sql
-- Enforce API-only mutations across core domain tables.
--
-- Direct mutations (INSERT, UPDATE, DELETE) through PostgREST (anon and authenticated roles)
-- bypassed backend validation, photo-URL verification, enum checks, and rate limiting.
--
-- All mutations now route strictly through the FastAPI backend using the service_role key.
--
-- Idempotent: safe to re-run.

-- 1. Adoption Applications: Revoke all direct PostgREST access (reads & writes go through /api/adoptions/)
REVOKE ALL ON public.adoption_applications FROM anon, authenticated;

-- 2. Rescues & Timelines: Revoke direct PostgREST mutations (handled by /api/rescues/)
REVOKE INSERT, UPDATE, DELETE ON public.rescues FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rescue_timeline FROM anon, authenticated;

-- 3. Lost & Found: Revoke direct PostgREST mutations (handled by /api/lostfound/)
REVOKE INSERT, UPDATE, DELETE ON public.lost_and_found FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lost_and_found_replies FROM anon, authenticated;

-- 4. Notifications: Revoke direct PostgREST mutations (handled by /api/notifications/)
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;

-- 5. Grant full permissions to service_role for backend operations
GRANT ALL ON public.adoption_applications,
             public.rescues,
             public.rescue_timeline,
             public.lost_and_found,
             public.lost_and_found_replies,
             public.notifications TO service_role;
