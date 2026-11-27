-- Migration: 20261126080000_allow_reporter_set_null.sql
-- Description: Allow foreign key action ON DELETE SET NULL to clear rescue reporter_id
-- while continuing to block direct updates of reporter_id from non-service roles,
-- and revoke leftover TRUNCATE, REFERENCES, TRIGGER privileges from client roles.

CREATE OR REPLACE FUNCTION public.protect_rescue_update()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (backend) bypasses trigger
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Cannot change reporter ID, but allow ON DELETE SET NULL which fires the trigger nested (pg_trigger_depth() > 1)
  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
     AND NOT (NEW.reporter_id IS NULL AND pg_trigger_depth() > 1) THEN
    RAISE EXCEPTION 'Cannot transfer rescue reporter ownership.';
  END IF;

  -- Only staff can change assigned_to
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NOT public.is_staff() THEN
      RAISE EXCEPTION 'Only staff and administrators can assign responders.';
    END IF;
  END IF;

  -- Validate status transitions for non-service_role callers
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_staff() THEN
      -- Citizen reporters can only transition their own rescue to CANCELLED or RESOLVED
      IF auth.uid() = OLD.reporter_id THEN
        IF NEW.status NOT IN ('CANCELLED'::public.rescue_status, 'RESOLVED'::public.rescue_status) THEN
          RAISE EXCEPTION 'Reporters can only mark rescues as cancelled or resolved.';
        END IF;
      ELSE
        RAISE EXCEPTION 'Not authorized to change rescue status.';
      END IF;
    END IF;
  END IF;

  -- If rescue is already dispatched or in progress, non-staff cannot alter core incident details
  IF OLD.status != 'PENDING'::public.rescue_status AND NOT public.is_staff() THEN
    IF NEW.latitude IS DISTINCT FROM OLD.latitude OR
       NEW.longitude IS DISTINCT FROM OLD.longitude OR
       NEW.severity IS DISTINCT FROM OLD.severity OR
       NEW.title IS DISTINCT FROM OLD.title OR
       NEW.description IS DISTINCT FROM OLD.description THEN
      RAISE EXCEPTION 'Cannot modify incident details once responders have been dispatched.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove leftover privileges from client roles
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
