-- Migration: 20261123000000_nearby_responder_alerts.sql
-- Description: Adds location and service radius fields to users and a Haversine RPC function
-- for dispatching alerts to nearby volunteer and NGO responders.

-- 1. Add alert preference and location columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS service_radius_km INTEGER DEFAULT 15 NOT NULL,
  ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT TRUE NOT NULL;

-- 2. Add partial index for fast spatial candidate lookups on active responders
CREATE INDEX IF NOT EXISTS idx_users_responder_location
  ON public.users (latitude, longitude)
  WHERE role IN ('VOLUNTEER', 'NGO')
    AND alerts_enabled = TRUE
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

-- 3. Database function to calculate distance using Haversine formula and return nearby responders
CREATE OR REPLACE FUNCTION public.get_nearby_responders(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_max_radius_km INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  role user_role,
  distance_km NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.role,
    ROUND(
      (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(u.latitude)) *
            cos(radians(u.longitude) - radians(p_lon)) +
            sin(radians(p_lat)) * sin(radians(u.latitude))
          ))
        )
      )::numeric,
      2
    ) AS distance_km
  FROM public.users u
  WHERE u.role IN ('VOLUNTEER', 'NGO')
    AND u.alerts_enabled = TRUE
    AND u.latitude IS NOT NULL
    AND u.longitude IS NOT NULL
    AND (
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(u.latitude)) *
          cos(radians(u.longitude) - radians(p_lon)) +
          sin(radians(p_lat)) * sin(radians(u.latitude))
        ))
      )
    ) <= LEAST(COALESCE(u.service_radius_km, 15), p_max_radius_km)
  ORDER BY distance_km ASC;
END;
$$;

-- 4. Permissions: service_role (API backend) ONLY. Explicitly revoke from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.get_nearby_responders(NUMERIC, NUMERIC, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_responders(NUMERIC, NUMERIC, INTEGER) TO service_role;

COMMENT ON FUNCTION public.get_nearby_responders IS 'Calculates great-circle distance to find active volunteer and NGO responders whose service radius covers the rescue coordinates.';
