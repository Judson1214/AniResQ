-- =========================================================================
-- AniResQ Database Optimization: Indexes & Geographic Constraints
-- =========================================================================

-- 1. Range Checks on Coordinates (-90 to 90 for latitude, -180 to 180 for longitude)
ALTER TABLE public.rescues 
  DROP CONSTRAINT IF EXISTS chk_rescues_latitude,
  ADD CONSTRAINT chk_rescues_latitude CHECK (latitude BETWEEN -90.0 AND 90.0);

ALTER TABLE public.rescues 
  DROP CONSTRAINT IF EXISTS chk_rescues_longitude,
  ADD CONSTRAINT chk_rescues_longitude CHECK (longitude BETWEEN -180.0 AND 180.0);

ALTER TABLE public.lost_and_found 
  DROP CONSTRAINT IF EXISTS chk_lost_found_latitude,
  ADD CONSTRAINT chk_lost_found_latitude CHECK (latitude BETWEEN -90.0 AND 90.0);

ALTER TABLE public.lost_and_found 
  DROP CONSTRAINT IF EXISTS chk_lost_found_longitude,
  ADD CONSTRAINT chk_lost_found_longitude CHECK (longitude BETWEEN -180.0 AND 180.0);

-- 2. Performance Indexes for Rescues
CREATE INDEX IF NOT EXISTS idx_rescues_reporter_id ON public.rescues (reporter_id);
CREATE INDEX IF NOT EXISTS idx_rescues_status ON public.rescues (status);
CREATE INDEX IF NOT EXISTS idx_rescues_created_at ON public.rescues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rescues_status_created_at ON public.rescues (status, created_at DESC);

-- 3. Performance Indexes for Lost & Found
CREATE INDEX IF NOT EXISTS idx_lost_found_reporter_id ON public.lost_and_found (reporter_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON public.lost_and_found (status);
CREATE INDEX IF NOT EXISTS idx_lost_found_created_at ON public.lost_and_found (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_type_status ON public.lost_and_found (type, status);

-- 4. Performance Indexes for Animals
CREATE INDEX IF NOT EXISTS idx_animals_adoption_status ON public.animals (adoption_status);
CREATE INDEX IF NOT EXISTS idx_animals_species ON public.animals (species);
CREATE INDEX IF NOT EXISTS idx_animals_created_at ON public.animals (created_at DESC);

-- 5. Performance Indexes for Adoption Applications
CREATE INDEX IF NOT EXISTS idx_adoption_apps_applicant_id ON public.adoption_applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_animal_id ON public.adoption_applications (animal_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_status ON public.adoption_applications (status);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_created_at ON public.adoption_applications (created_at DESC);

-- 6. Performance Indexes for Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

-- 7. Performance Indexes for Rescue Timeline & Lost/Found Replies
CREATE INDEX IF NOT EXISTS idx_rescue_timeline_rescue_id ON public.rescue_timeline (rescue_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_lost_found_replies_post_id ON public.lost_and_found_replies (lost_and_found_id, created_at ASC);
