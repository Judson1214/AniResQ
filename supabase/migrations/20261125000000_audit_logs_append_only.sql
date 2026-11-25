-- 20261125000000_audit_logs_append_only.sql
-- Enforce append-only integrity on public.audit_logs:
-- 1. Revoke direct mutations from PUBLIC, anon, and authenticated roles.
-- 2. Attach an unconditional BEFORE UPDATE OR DELETE trigger raising an exception.

-- Revoke mutation privileges
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- Unconditional trigger function blocking UPDATE and DELETE across all roles
CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS TRIGGER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is append-only: UPDATE and DELETE operations are strictly forbidden';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.block_audit_log_mutation();
