-- Migration: 20261126090000_harden_uploads_bucket_limits.sql
-- Description: Harden storage bucket limits for 'uploads', revoke authenticated direct SELECT on audit_logs,
-- and clean up obsolete public-role mutation policies on core domain tables.
-- Idempotent: Can be applied multiple times safely without error.

-- 1. Storage bucket limits for 'uploads'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'uploads') THEN
    UPDATE storage.buckets
    SET file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
    WHERE id = 'uploads';
  END IF;
END $$;

-- 2. Revoke direct SELECT access on audit_logs from client roles (only service_role via backend API)
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- 3. Drop obsolete mutation policies granting public role direct mutations on core tables
-- (All mutations route strictly through the FastAPI backend via service_role)
DROP POLICY IF EXISTS "Authenticated users can apply for adoption" ON public.adoption_applications;
DROP POLICY IF EXISTS "Staff can review adoption applications" ON public.adoption_applications;

DROP POLICY IF EXISTS "Staff can insert animals" ON public.animals;
DROP POLICY IF EXISTS "Staff can update animals" ON public.animals;
DROP POLICY IF EXISTS "Staff can delete animals" ON public.animals;

DROP POLICY IF EXISTS "Service role or staff can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)" ON public.notifications;

DROP POLICY IF EXISTS "Authenticated users can report rescues" ON public.rescues;
DROP POLICY IF EXISTS "Authorized users can update rescues" ON public.rescues;
DROP POLICY IF EXISTS "Reporter or admin can delete rescues" ON public.rescues;
