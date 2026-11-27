-- Migration: 20261127110000_add_user_terms_and_id_last4.sql
-- Description: Add terms consent tracking and id_card_last4 columns to users table.
-- ID Minimization: id_card_number is deprecated; id_card_last4 is backfilled.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_version TEXT,
    ADD COLUMN IF NOT EXISTS id_card_last4 TEXT;

-- Enforce format on id_card_last4: up to 4 alphanumeric characters
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_users_id_card_last4'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT check_users_id_card_last4
            CHECK (id_card_last4 ~ '^[A-Za-z0-9]{0,4}$');
    END IF;
END $$;

-- Backfill id_card_last4 from existing id_card_number (last 4 characters)
UPDATE public.users
SET id_card_last4 = RIGHT(id_card_number, 4)
WHERE id_card_number IS NOT NULL
  AND (id_card_last4 IS NULL OR id_card_last4 = '');

-- Deprecate full ID number column without dropping it (prevents breaking running API)
COMMENT ON COLUMN public.users.id_card_number IS
    'DEPRECATED: Will be dropped in a subsequent migration after API deployment. Use id_card_last4.';
