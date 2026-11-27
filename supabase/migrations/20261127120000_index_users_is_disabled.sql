-- Migration: 20261127120000_index_users_is_disabled.sql
-- Description: Ensure users.is_disabled exists and index it for fast lookup during authentication.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_disabled
    ON public.users (is_disabled);
