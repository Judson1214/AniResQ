-- 20261126070000_add_user_is_disabled.sql
-- Add account status flag (is_disabled) to public.users to support account suspension/ban enforcement.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_disabled IS 'Account status flag. When true, authenticated API requests are rejected with 403 Forbidden.';
