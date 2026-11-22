-- Run in the Supabase SQL editor AFTER applying the migration. Expected results in comments.
-- (a) Anonymous: must return 0 rows or a permission error
SET LOCAL ROLE anon;
SELECT count(*) FROM public.rescues;           -- expect: permission denied (or 0)
SELECT count(*) FROM public.rescue_timeline;   -- expect: permission denied (or 0)
RESET ROLE;

-- (b) A citizen who is not the reporter: must see 0 other users' rows
--   replace <citizen-uuid> with a CITIZEN user id that has reported nothing
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<citizen-uuid>","role":"authenticated"}', true);
SELECT count(*) FROM public.rescues;           -- expect: 0
SELECT count(*) FROM public.rescue_timeline;   -- expect: 0
RESET ROLE;

-- (c) A reporter: sees only their own rescues
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<reporter-uuid>","role":"authenticated"}', true);
SELECT count(*) = count(*) FILTER (WHERE reporter_id = '<reporter-uuid>') AS only_own FROM public.rescues;  -- expect: true
RESET ROLE;

-- (d) A staff user (ADMIN/NGO/SHELTER/VOLUNTEER/VET): sees all
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<staff-uuid>","role":"authenticated"}', true);
SELECT count(*) FROM public.rescues;           -- expect: total row count
RESET ROLE;

-- (e) From outside, with only the anon key (should be 401/empty):
--   curl "https://<project>.supabase.co/rest/v1/rescues?select=*" -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
