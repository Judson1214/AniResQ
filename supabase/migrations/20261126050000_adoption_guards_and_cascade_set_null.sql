-- Migration: 20261126050000_adoption_guards_and_cascade_set_null.sql
-- Description:
-- 1. De-duplicates existing open adoption applications and creates a partial unique index on (animal_id, applicant_id) for open statuses.
-- 2. Changes ON DELETE CASCADE to ON DELETE SET NULL for citizen records (rescues, lost_and_found, lost_and_found_replies, adoption_applications).
-- 3. Redacts personal contact data on lost_and_found and lost_and_found_replies when the reporter/user is deleted.

-- ============================================================================
-- 1. Adoption Applications: De-duplicate and Partial Unique Index
-- ============================================================================

-- De-duplicate any existing open applications (keep the newest one, reject older ones)
WITH ranked_apps AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY animal_id, applicant_id
    ORDER BY created_at DESC
  ) as rn
  FROM public.adoption_applications
  WHERE status IN ('SUBMITTED', 'UNDER_REVIEW') AND applicant_id IS NOT NULL
)
UPDATE public.adoption_applications
SET status = 'REJECTED'::public.application_status
WHERE id IN (SELECT id FROM ranked_apps WHERE rn > 1);

-- Create partial unique index covering open applications
CREATE UNIQUE INDEX IF NOT EXISTS uq_adoption_apps_open
  ON public.adoption_applications (animal_id, applicant_id)
  WHERE status IN ('SUBMITTED', 'UNDER_REVIEW') AND applicant_id IS NOT NULL;

-- ============================================================================
-- 2. Change Foreign Key Constraints from CASCADE to SET NULL
-- ============================================================================

-- A. Rescues (reporter_id)
ALTER TABLE public.rescues
  ALTER COLUMN reporter_id DROP NOT NULL;

ALTER TABLE public.rescues
  DROP CONSTRAINT IF EXISTS rescues_reporter_id_fkey;

ALTER TABLE public.rescues
  ADD CONSTRAINT rescues_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- B. Lost and Found (reporter_id & PII redaction)
ALTER TABLE public.lost_and_found
  ALTER COLUMN reporter_id DROP NOT NULL;

-- Allow contact_phone to be nullable or redacted when reporter is deleted
ALTER TABLE public.lost_and_found
  ALTER COLUMN contact_phone DROP NOT NULL;

ALTER TABLE public.lost_and_found
  DROP CONSTRAINT IF EXISTS lost_and_found_reporter_id_fkey;

ALTER TABLE public.lost_and_found
  ADD CONSTRAINT lost_and_found_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Trigger to redact PII when reporter_id is set to NULL on user deletion
CREATE OR REPLACE FUNCTION public.handle_lost_found_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reporter_id IS NULL THEN
    NEW.contact_phone := '[Deleted User]';
    NEW.contact_email := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_redact_lost_found_pii ON public.lost_and_found;
CREATE TRIGGER trg_redact_lost_found_pii
  BEFORE UPDATE OF reporter_id ON public.lost_and_found
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lost_found_user_deletion();

-- C. Lost and Found Replies (user_id)
ALTER TABLE public.lost_and_found_replies
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.lost_and_found_replies
  DROP CONSTRAINT IF EXISTS lost_and_found_replies_user_id_fkey;

ALTER TABLE public.lost_and_found_replies
  ADD CONSTRAINT lost_and_found_replies_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Trigger to sanitize user_name when user_id is set to NULL
CREATE OR REPLACE FUNCTION public.handle_lost_found_reply_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_name := 'Deleted User';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_redact_lost_found_reply_pii ON public.lost_and_found_replies;
CREATE TRIGGER trg_redact_lost_found_reply_pii
  BEFORE UPDATE OF user_id ON public.lost_and_found_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lost_found_reply_user_deletion();

-- D. Adoption Applications (applicant_id)
ALTER TABLE public.adoption_applications
  ALTER COLUMN applicant_id DROP NOT NULL;

ALTER TABLE public.adoption_applications
  DROP CONSTRAINT IF EXISTS adoption_applications_applicant_id_fkey;

ALTER TABLE public.adoption_applications
  ADD CONSTRAINT adoption_applications_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.users(id) ON DELETE SET NULL;
