-- 20261126010000_storage_prefix_fallback.sql
-- Fix get_storage_prefix() to gracefully fall back to the project Supabase URL
-- when app.settings.supabase_url is not configured via ALTER DATABASE (which is
-- disallowed on managed Supabase Cloud without superuser privileges).

CREATE OR REPLACE FUNCTION public.get_storage_prefix()
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  config_url TEXT;
BEGIN
  -- Read app.settings.supabase_url if configured (missing_ok = true)
  -- Fallback to the live project URL if unset
  config_url := COALESCE(
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    'https://cspnzitnvzdwwyxpnluw.supabase.co'
  );

  RETURN rtrim(config_url, '/') || '/storage/v1/object/public/uploads/';
END;
$$;
