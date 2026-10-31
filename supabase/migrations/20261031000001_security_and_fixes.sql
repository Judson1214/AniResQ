-- =========================================================================
-- AniResQ Security & Schema Migration
-- Fixes: Privilege escalation, RLS lockdown, PII exposure, missing tables
-- =========================================================================

-- 1. Helper functions to safely determine user roles in RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN'::public.user_role, 'NGO'::public.user_role, 'SHELTER'::public.user_role, 'VOLUNTEER'::public.user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_shelter_or_ngo()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN'::public.user_role, 'NGO'::public.user_role, 'SHELTER'::public.user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Ensure missing columns on existing tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

ALTER TABLE public.adoption_applications 
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS screening_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3. Create missing tables if they do not exist

-- 3a. rescue_timeline
CREATE TABLE IF NOT EXISTS public.rescue_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_id UUID REFERENCES public.rescues(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3b. lost_and_found_replies
CREATE TABLE IF NOT EXISTS public.lost_and_found_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_and_found_id UUID REFERENCES public.lost_and_found(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3c. notifications (merged from supabase_add_notifications.sql)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  related_entity_id UUID,
  related_entity_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable updated_at trigger on notifications
DROP TRIGGER IF EXISTS update_notifications_modtime ON public.notifications;
CREATE TRIGGER update_notifications_modtime 
  BEFORE UPDATE ON public.notifications 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. HARDEN SIGNUP TRIGGER: Always default to CITIZEN, ignore user-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unknown User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'CITIZEN'::public.user_role -- Strictly default to CITIZEN to prevent privilege escalation
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE WHEN public.users.display_name = 'Unknown User' THEN EXCLUDED.display_name ELSE public.users.display_name END;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. HARDEN ROLE UPDATES: Prevent users from self-promoting to ADMIN/staff
CREATE OR REPLACE FUNCTION public.protect_user_role_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      -- Only service_role or verified ADMIN users can change user roles
      auth.role() = 'service_role' OR 
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
      )
    ) THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only administrators can change roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_user_role_update ON public.users;
CREATE TRIGGER tr_protect_user_role_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.protect_user_role_update();

-- 6. RESET AND RE-ESTABLISH ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS across all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 6a. Users Policies (Stop PII exposure)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.users;
DROP POLICY IF EXISTS "Users can view own profile or staff can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile." ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile or staff can view profiles" 
  ON public.users FOR SELECT 
  USING (
    auth.uid() = id 
    OR public.is_staff() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own profile" 
  ON public.users FOR UPDATE 
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR auth.role() = 'service_role'
  );

-- 6b. Animals Policies
DROP POLICY IF EXISTS "Animals are viewable by everyone." ON public.animals;
DROP POLICY IF EXISTS "Animals are viewable by everyone" ON public.animals;
DROP POLICY IF EXISTS "Staff can insert animals" ON public.animals;
DROP POLICY IF EXISTS "Staff can update animals" ON public.animals;
DROP POLICY IF EXISTS "Staff can delete animals" ON public.animals;

CREATE POLICY "Animals are viewable by everyone" 
  ON public.animals FOR SELECT 
  USING (true);

CREATE POLICY "Staff can insert animals" 
  ON public.animals FOR INSERT 
  WITH CHECK (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

CREATE POLICY "Staff can update animals" 
  ON public.animals FOR UPDATE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

CREATE POLICY "Staff can delete animals" 
  ON public.animals FOR DELETE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

-- 6c. Adoption Applications Policies
DROP POLICY IF EXISTS "Users can view own adoption applications." ON public.adoption_applications;
DROP POLICY IF EXISTS "Users can view own applications or staff can view all" ON public.adoption_applications;
DROP POLICY IF EXISTS "Authenticated users can apply for adoption." ON public.adoption_applications;
DROP POLICY IF EXISTS "Authenticated users can apply for adoption" ON public.adoption_applications;
DROP POLICY IF EXISTS "Staff can review adoption applications" ON public.adoption_applications;

CREATE POLICY "Users can view own applications or staff can view all" 
  ON public.adoption_applications FOR SELECT 
  USING (
    auth.uid() = applicant_id 
    OR public.is_shelter_or_ngo() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Authenticated users can apply for adoption" 
  ON public.adoption_applications FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can review adoption applications" 
  ON public.adoption_applications FOR UPDATE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

-- 6d. Lost and Found Policies
DROP POLICY IF EXISTS "Lost and found viewable by everyone." ON public.lost_and_found;
DROP POLICY IF EXISTS "Lost and found viewable by everyone" ON public.lost_and_found;
DROP POLICY IF EXISTS "Authenticated users can report lost/found." ON public.lost_and_found;
DROP POLICY IF EXISTS "Authenticated users can report lost/found" ON public.lost_and_found;
DROP POLICY IF EXISTS "Users can update own lost/found." ON public.lost_and_found;
DROP POLICY IF EXISTS "Users can update own lost/found" ON public.lost_and_found;
DROP POLICY IF EXISTS "Users can delete own lost/found" ON public.lost_and_found;

CREATE POLICY "Lost and found viewable by everyone" 
  ON public.lost_and_found FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can report lost/found" 
  ON public.lost_and_found FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own lost/found" 
  ON public.lost_and_found FOR UPDATE 
  USING (auth.uid() = reporter_id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own lost/found" 
  ON public.lost_and_found FOR DELETE 
  USING (auth.uid() = reporter_id OR public.is_admin() OR auth.role() = 'service_role');

-- 6e. Lost and Found Replies Policies
DROP POLICY IF EXISTS "Replies are viewable by everyone" ON public.lost_and_found_replies;
DROP POLICY IF EXISTS "Authenticated users can add replies" ON public.lost_and_found_replies;
DROP POLICY IF EXISTS "Authors or admin can delete replies" ON public.lost_and_found_replies;

CREATE POLICY "Replies are viewable by everyone" 
  ON public.lost_and_found_replies FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can add replies" 
  ON public.lost_and_found_replies FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors or admin can delete replies" 
  ON public.lost_and_found_replies FOR DELETE 
  USING (auth.uid() = user_id OR public.is_admin() OR auth.role() = 'service_role');

-- 6f. Rescues & Rescue Timeline Policies
DROP POLICY IF EXISTS "Rescues viewable by everyone." ON public.rescues;
DROP POLICY IF EXISTS "Rescues viewable by everyone" ON public.rescues;
DROP POLICY IF EXISTS "Authenticated users can report rescues." ON public.rescues;
DROP POLICY IF EXISTS "Authenticated users can report rescues" ON public.rescues;
DROP POLICY IF EXISTS "Authorized users can update rescues" ON public.rescues;
DROP POLICY IF EXISTS "Reporter or admin can delete rescues" ON public.rescues;

CREATE POLICY "Rescues viewable by everyone" 
  ON public.rescues FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can report rescues" 
  ON public.rescues FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authorized users can update rescues" 
  ON public.rescues FOR UPDATE 
  USING (
    auth.uid() = reporter_id 
    OR public.is_staff() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Reporter or admin can delete rescues" 
  ON public.rescues FOR DELETE 
  USING (auth.uid() = reporter_id OR public.is_admin() OR auth.role() = 'service_role');

-- Rescue Timeline
DROP POLICY IF EXISTS "Rescue timelines are viewable by everyone." ON public.rescue_timeline;
DROP POLICY IF EXISTS "Rescue timelines are viewable by everyone" ON public.rescue_timeline;
DROP POLICY IF EXISTS "Authenticated users can insert rescue timelines." ON public.rescue_timeline;
DROP POLICY IF EXISTS "Authenticated users can insert rescue timelines" ON public.rescue_timeline;

CREATE POLICY "Rescue timelines are viewable by everyone" 
  ON public.rescue_timeline FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert rescue timelines" 
  ON public.rescue_timeline FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 6g. Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users or system can insert notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own notifications (mark as read)" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users or system can insert notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 7. Storage Bucket & Policies for 'uploads'
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public viewing of uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own uploads" ON storage.objects;

CREATE POLICY "Allow public viewing of uploads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'uploads');

CREATE POLICY "Allow authenticated users to upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow users to update their own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'uploads' AND (auth.uid() = owner OR auth.role() = 'service_role'));

CREATE POLICY "Allow users to delete their own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads' AND (auth.uid() = owner OR auth.role() = 'service_role'));

-- ----------------------------------------------------
-- 8. Coordinate Range Constraints & Performance Indexes
-- ----------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_rescues_reporter_id ON public.rescues (reporter_id);
CREATE INDEX IF NOT EXISTS idx_rescues_status ON public.rescues (status);
CREATE INDEX IF NOT EXISTS idx_rescues_created_at ON public.rescues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rescues_status_created_at ON public.rescues (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lost_found_reporter_id ON public.lost_and_found (reporter_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON public.lost_and_found (status);
CREATE INDEX IF NOT EXISTS idx_lost_found_created_at ON public.lost_and_found (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_type_status ON public.lost_and_found (type, status);

CREATE INDEX IF NOT EXISTS idx_animals_adoption_status ON public.animals (adoption_status);
CREATE INDEX IF NOT EXISTS idx_animals_species ON public.animals (species);
CREATE INDEX IF NOT EXISTS idx_animals_created_at ON public.animals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adoption_apps_applicant_id ON public.adoption_applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_animal_id ON public.adoption_applications (animal_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_status ON public.adoption_applications (status);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_created_at ON public.adoption_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rescue_timeline_rescue_id ON public.rescue_timeline (rescue_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_lost_found_replies_post_id ON public.lost_and_found_replies (lost_and_found_id, created_at ASC);
