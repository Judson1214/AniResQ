-- Verification Script: verify_nearby_alerts.sql
-- Run in the Supabase SQL Editor after applying 20261123000000_nearby_responder_alerts.sql

-- 1. Test Haversine spatial lookup function
-- Call get_nearby_responders with test coordinates (e.g. Bangalore center: 12.9716, 77.5946)
SELECT * FROM public.get_nearby_responders(12.9716, 77.5946, 25);
-- Expect: Returns active VOLUNTEER / NGO / STAFF records whose service radius covers the target coordinates, sorted by distance_km.

-- 2. Verify that non-responders (CITIZEN role) or responders with alerts_enabled = FALSE are excluded
SELECT count(*) AS should_be_zero
FROM public.get_nearby_responders(12.9716, 77.5946, 50) r
JOIN public.users u ON u.id = r.id
WHERE u.role = 'CITIZEN' OR u.alerts_enabled = FALSE;
-- Expect: 0 rows

-- 3. Privacy check: Anonymous role cannot read responder coordinates directly
SET LOCAL ROLE anon;
SELECT count(*) FROM public.users WHERE latitude IS NOT NULL;
-- Expect: 0 or permission denied
RESET ROLE;

-- 4. Privacy check: A citizen user can only view their own coordinates via RLS
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT id, latitude, longitude FROM public.users WHERE id != '00000000-0000-0000-0000-000000000001';
-- Expect: 0 rows (users policy only permits reading own row or service_role access)
RESET ROLE;
