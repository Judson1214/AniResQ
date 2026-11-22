-- 20261122000000_restrict_rescue_reads.sql
-- Restrict direct (PostgREST / anon-key) reads of rescue data.
--
-- Before: public.rescues and public.rescue_timeline had SELECT USING (true), so anyone
-- holding the public anon key could read every report (exact coordinates, address,
-- description, photos, reporter_id) straight from /rest/v1/, bypassing the API checks.
--
-- After: only the reporter, the assigned volunteer, staff (is_staff()) and the backend
-- service role can read rows. The FastAPI backend uses the service-role key, so its own
-- authorization (and GET /api/rescues/public, which anonymizes data) is unaffected.
-- Idempotent: safe to re-run.

-- 1. rescues: SELECT ------------------------------------------------------------------
DROP POLICY IF EXISTS "Rescues viewable by everyone" ON public.rescues;
DROP POLICY IF EXISTS "Rescues readable by reporter, assignee or staff" ON public.rescues;

CREATE POLICY "Rescues readable by reporter, assignee or staff"
  ON public.rescues FOR SELECT
  USING (
    auth.uid() = reporter_id
    OR auth.uid() = assigned_to
    OR public.is_staff()
    OR auth.role() = 'service_role'
  );

-- 2. rescue_timeline: SELECT ----------------------------------------------------------
-- Visible only if the parent rescue is visible to the caller on the same terms.
DROP POLICY IF EXISTS "Rescue timelines are viewable by everyone" ON public.rescue_timeline;
DROP POLICY IF EXISTS "Rescue timelines readable by involved parties" ON public.rescue_timeline;

CREATE POLICY "Rescue timelines readable by involved parties"
  ON public.rescue_timeline FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.rescues r
      WHERE r.id = rescue_timeline.rescue_id
        AND (r.reporter_id = auth.uid() OR r.assigned_to = auth.uid())
    )
  );

-- 3. Index to keep the new policy cheap ----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rescues_assigned_to ON public.rescues (assigned_to);

-- 4. Make sure the anon role cannot read these tables at all ---------------------------
-- RLS already returns zero rows for anon; revoking the grant also removes the tables
-- from anonymous schema introspection and gives defence in depth.
REVOKE SELECT ON public.rescues FROM anon;
REVOKE SELECT ON public.rescue_timeline FROM anon;

-- NOTE (product decision, not changed here): public.lost_and_found and its replies are
-- still world-readable and include contact_phone / contact_email. If posters' contact
-- details should not be scrapeable, expose them only to authenticated users (e.g. a
-- view without contact columns for anon) in a follow-up migration.
