-- Migration: 20261126000000_id_verification_columns.sql
-- Description: Add dedicated ID card columns (id_card_type, id_card_number, id_card_url)
--              Enforce CHECK constraint on requested_role
--              Create private 'id-verification' storage bucket with strict RLS
--              Migrate existing [ID: ...] bio tags to columns and clean bio

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

-- 3. Restore standard public uploads viewing policy (leave original policy alone)
DROP POLICY IF EXISTS "Allow public viewing of uploads" ON storage.objects;
CREATE POLICY "Allow public viewing of uploads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'uploads');

-- 4. Create separate private storage bucket for ID verification documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-verification',
  'id-verification',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- 5. Strict RLS Policies on 'id-verification' bucket
DROP POLICY IF EXISTS "Allow users to upload own id verification" ON storage.objects;
CREATE POLICY "Allow users to upload own id verification"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-verification' AND
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (name LIKE (auth.uid()::text || '/%')) OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Allow owner and admin to view id verification" ON storage.objects;
CREATE POLICY "Allow owner and admin to view id verification"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-verification' AND
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (auth.uid() = owner) OR
      public.is_admin() OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Allow owner to update own id verification" ON storage.objects;
CREATE POLICY "Allow owner to update own id verification"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'id-verification' AND
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (auth.uid() = owner) OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Allow owner to delete own id verification" ON storage.objects;
CREATE POLICY "Allow owner to delete own id verification"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-verification' AND
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (auth.uid() = owner) OR
      auth.role() = 'service_role'
    )
  );

-- 6. One-off cleanup: migrate legacy [ID: ...] tags from bio into dedicated columns and clean bio
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_type TEXT;
  v_num TEXT;
  v_url TEXT;
  v_clean_bio TEXT;
  v_parts TEXT[];
BEGIN
  FOR r IN SELECT id, bio, id_card_type, id_card_number, id_card_url FROM public.users WHERE bio LIKE '%[ID:%' LOOP
    v_raw := split_part(split_part(r.bio, '[ID:', 2), ']', 1);
    v_type := NULL;
    v_num := NULL;
    v_url := NULL;

    IF v_raw LIKE '% | %' THEN
      v_parts := string_to_array(v_raw, ' | ');
      v_type := trim(v_parts[1]);
      IF array_length(v_parts, 1) >= 2 THEN
        v_num := trim(v_parts[2]);
      END IF;
      IF array_length(v_parts, 1) >= 3 THEN
        v_url := trim(v_parts[3]);
      END IF;
    ELSIF v_raw LIKE '% - %' THEN
      v_parts := string_to_array(v_raw, ' - ');
      v_type := trim(v_parts[1]);
      IF array_length(v_parts, 1) >= 2 THEN
        v_num := trim(v_parts[2]);
      END IF;
    ELSE
      v_type := 'ID Document';
      v_num := trim(v_raw);
    END IF;

    -- Clean the bio text
    v_clean_bio := trim(regexp_replace(r.bio, '\[ID:[^\]]*\]\s*', ''));

    UPDATE public.users
    SET
      id_card_type = COALESCE(r.id_card_type, NULLIF(v_type, '')),
      id_card_number = COALESCE(r.id_card_number, NULLIF(v_num, '')),
      id_card_url = COALESCE(r.id_card_url, NULLIF(v_url, '')),
      bio = v_clean_bio
    WHERE id = r.id;
  END LOOP;
END $$;
