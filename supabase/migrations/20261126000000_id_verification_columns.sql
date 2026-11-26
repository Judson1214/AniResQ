-- Migration: 20261126000000_id_verification_columns.sql
-- Description: Add dedicated ID card columns (id_card_type, id_card_number, id_card_url)
--              Enforce CHECK constraint on requested_role
--              Restrict access to uploaded identity verification documents in storage

-- 1. Ensure columns exist on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS requested_role TEXT,
  ADD COLUMN IF NOT EXISTS id_card_type TEXT,
  ADD COLUMN IF NOT EXISTS id_card_number TEXT,
  ADD COLUMN IF NOT EXISTS id_card_url TEXT;

-- 2. Enforce CHECK constraint on requested_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_requested_role_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_requested_role_check
      CHECK (requested_role IS NULL OR requested_role IN ('VOLUNTEER', 'NGO', 'SHELTER', 'VET'));
  END IF;
END $$;

-- 3. Restrict viewing of identity documents in storage.objects
-- Normal uploads remain public, but paths under id_verification/ are restricted to owner and admins
DROP POLICY IF EXISTS "Allow public viewing of uploads" ON storage.objects;
CREATE POLICY "Allow public viewing of uploads"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'uploads' AND (
      (
        name NOT LIKE '%id_verification/%' AND
        name NOT LIKE '%id-cards/%' AND
        name NOT LIKE '%id_documents/%'
      )
      OR
      (auth.role() = 'service_role')
      OR
      (public.is_admin())
      OR
      (auth.uid()::text = (storage.foldername(name))[1])
    )
  );
