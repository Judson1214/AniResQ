-- 20261122010000_restrict_animals_direct_reads.sql
-- Restrict direct PostgREST reads and writes on public.animals.
--
-- Before: public.animals was readable by anyone with the anon key via /rest/v1/animals.
-- Even though RLS filtered NOT_READY rows, RLS does not filter columns, allowing anyone
-- to query surrendered_by and see who surrendered each animal.
--
-- After: All animal queries and mutations route strictly through the FastAPI backend,
-- which applies role-aware visibility and column-level redaction using the service_role key.
--
-- Idempotent: safe to re-run.

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.animals FROM anon, authenticated;

-- Ensure service_role maintains full access
GRANT ALL ON public.animals TO service_role;
