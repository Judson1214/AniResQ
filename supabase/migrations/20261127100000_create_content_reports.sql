-- Migration: 20261127100000_create_content_reports.sql
-- Description: Create content_reports table for community pilot moderation.
-- Access: RLS enabled, strictly service_role only (no anon or authenticated privileges).

CREATE TABLE IF NOT EXISTS public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('RESCUE', 'LOST_FOUND', 'LOST_FOUND_REPLY', 'USER', 'ANIMAL')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('SPAM', 'FAKE', 'ABUSE', 'PRIVACY', 'OTHER')),
    details TEXT CHECK (char_length(details) <= 1000),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED')),
    handled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: A user cannot file multiple OPEN reports on the same target
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_open
    ON public.content_reports (reporter_id, target_type, target_id)
    WHERE status = 'OPEN';

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
    ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_target
    ON public.content_reports (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
    ON public.content_reports (reporter_id);

-- Enforce Row Level Security
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from untrusted roles
REVOKE ALL ON TABLE public.content_reports FROM anon, authenticated, public;

-- Grant access strictly to backend service_role
GRANT ALL ON TABLE public.content_reports TO service_role;
