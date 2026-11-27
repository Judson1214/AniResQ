-- Migration: 20261126060000_create_system_settings.sql
-- Description: Creates the public.system_settings table, applies RLS, restricts access to service_role, and seeds default settings.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Deny all direct operations to anon and authenticated clients
REVOKE ALL ON public.system_settings FROM anon, authenticated;

-- Grant access solely to the backend service_role
GRANT ALL ON public.system_settings TO service_role;

-- Seed default configuration
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('defaultDispatchRadiusKm', '15'::jsonb, 'Default dispatch radius in km for nearby responders'),
  ('maxBroadcastCeilingKm', '100'::jsonb, 'Maximum geographic broadcast ceiling in km'),
  ('autoAlertHighSeverity', 'true'::jsonb, 'Automatically alert responders on CRITICAL and HIGH rescues'),
  ('autoDispatchEnabled', 'true'::jsonb, 'Allow verified volunteers to self-assign unassigned rescues')
ON CONFLICT (key) DO NOTHING;
