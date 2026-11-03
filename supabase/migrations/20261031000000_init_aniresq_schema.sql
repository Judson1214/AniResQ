-- =========================================================================
-- AniResQ Complete Baseline Supabase PostgreSQL Schema
-- Includes: Users, Animals, Adoptions, Lost & Found, Rescues, Timelines,
--           Notifications, Storage, Triggers, RLS Policies, Indexes, and Constraints.
-- =========================================================================

-- 1. Create Enums based on @aniresq/shared-types
CREATE TYPE user_role AS ENUM ('CITIZEN', 'NGO', 'VOLUNTEER', 'SHELTER', 'VET', 'ADMIN');
CREATE TYPE application_status AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE living_environment AS ENUM ('APARTMENT', 'HOUSE', 'FARM', 'OTHER');
CREATE TYPE lost_found_type AS ENUM ('LOST', 'FOUND');
CREATE TYPE lost_found_status AS ENUM ('ACTIVE', 'RESOLVED');
CREATE TYPE rescue_status AS ENUM ('PENDING', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE rescue_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE adoption_status AS ENUM ('NOT_READY', 'AVAILABLE', 'PENDING', 'ADOPTED');
CREATE TYPE species AS ENUM ('DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER');
CREATE TYPE gender AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
CREATE TYPE health_status AS ENUM ('HEALTHY', 'INJURED', 'SICK', 'RECOVERING', 'CRITICAL');

-- 2. Create Users Table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  address TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  role user_role DEFAULT 'CITIZEN'::user_role NOT NULL,
  requested_role TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create Animals Table
CREATE TABLE public.animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species species NOT NULL,
  breed TEXT,
  age_estimate TEXT NOT NULL,
  gender gender NOT NULL,
  weight FLOAT,
  health_status health_status NOT NULL,
  adoption_status adoption_status NOT NULL,
  description TEXT NOT NULL,
  vaccinations TEXT[] DEFAULT '{}',
  is_neutered BOOLEAN DEFAULT FALSE,
  special_needs TEXT,
  shelter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  surrendered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Create Adoption Applications Table
CREATE TABLE public.adoption_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES public.animals(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  living_environment living_environment NOT NULL,
  has_yard BOOLEAN DEFAULT FALSE NOT NULL,
  has_other_pets BOOLEAN DEFAULT FALSE NOT NULL,
  other_pet_details TEXT,
  prior_pet_experience TEXT NOT NULL,
  family_members INTEGER NOT NULL,
  has_children BOOLEAN DEFAULT FALSE NOT NULL,
  work_schedule TEXT NOT NULL,
  why_adopt TEXT NOT NULL,
  status application_status DEFAULT 'SUBMITTED'::application_status NOT NULL,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  screening_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Create Lost & Found Table (with coordinate constraints)
CREATE TABLE public.lost_and_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type lost_found_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  color TEXT,
  latitude FLOAT NOT NULL CHECK (latitude BETWEEN -90.0 AND 90.0),
  longitude FLOAT NOT NULL CHECK (longitude BETWEEN -180.0 AND 180.0),
  last_seen_address TEXT NOT NULL,
  last_seen_date TIMESTAMPTZ NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  images TEXT[] DEFAULT '{}',
  status lost_found_status DEFAULT 'ACTIVE'::lost_found_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5b. Create Lost & Found Replies Table
CREATE TABLE public.lost_and_found_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_and_found_id UUID REFERENCES public.lost_and_found(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Create Rescues Table (with coordinate constraints)
CREATE TABLE public.rescues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity rescue_severity NOT NULL,
  species TEXT NOT NULL,
  latitude FLOAT NOT NULL CHECK (latitude BETWEEN -90.0 AND 90.0),
  longitude FLOAT NOT NULL CHECK (longitude BETWEEN -180.0 AND 180.0),
  address TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  status rescue_status DEFAULT 'PENDING'::rescue_status NOT NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6b. Create Rescue Timeline Table
CREATE TABLE public.rescue_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_id UUID REFERENCES public.rescues(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6c. Create Notifications Table
CREATE TABLE public.notifications (
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

-- 7. Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_animals_modtime BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_adoption_applications_modtime BEFORE UPDATE ON public.adoption_applications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_lost_and_found_modtime BEFORE UPDATE ON public.lost_and_found FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_rescues_modtime BEFORE UPDATE ON public.rescues FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_notifications_modtime BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Auth Signup Trigger (Hardened: Always defaults to CITIZEN, captures requested_role, disallows ADMIN)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
  req_role TEXT;
BEGIN
  req_role := UPPER(NEW.raw_user_meta_data->>'requested_role');
  -- Strictly disallow requesting ADMIN role or invalid roles via signup metadata
  IF req_role = 'ADMIN' OR req_role NOT IN ('VOLUNTEER', 'NGO', 'SHELTER', 'VET') THEN
    req_role := NULL;
  END IF;

  INSERT INTO public.users (id, email, display_name, phone, role, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unknown User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'CITIZEN'::public.user_role, -- Force CITIZEN regardless of user input
    req_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE WHEN public.users.display_name = 'Unknown User' THEN EXCLUDED.display_name ELSE public.users.display_name END,
    requested_role = COALESCE(EXCLUDED.requested_role, public.users.requested_role);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8b. User Fields Protection Trigger (Protects ID, email, and role from client tampering)
CREATE OR REPLACE FUNCTION public.protect_user_fields_update()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent modifying user ID
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot modify user ID.';
  END IF;

  -- Only service_role or ADMIN can update email in public.users
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF NOT (
      auth.role() = 'service_role' OR 
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
      )
    ) THEN
      RAISE EXCEPTION 'Cannot modify email address directly.';
    END IF;
  END IF;

  -- Only service_role or ADMIN can change user roles
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
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

CREATE TRIGGER tr_protect_user_fields_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.protect_user_fields_update();

-- 8c. Rescue Update Protection Trigger (Protects status, assigned_to, reporter_id, and details after dispatch)
CREATE OR REPLACE FUNCTION public.protect_rescue_update()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (backend) bypasses trigger
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Cannot change reporter ID
  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN
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

CREATE TRIGGER tr_protect_rescue_update
  BEFORE UPDATE ON public.rescues
  FOR EACH ROW EXECUTE PROCEDURE public.protect_rescue_update();

-- 9. Helper Role Check Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN'::public.user_role, 'NGO'::public.user_role, 'SHELTER'::public.user_role, 'VOLUNTEER'::public.user_role, 'VET'::public.user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_shelter_or_ngo()
RETURNS BOOLEAN 
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN'::public.user_role, 'NGO'::public.user_role, 'SHELTER'::public.user_role, 'VET'::public.user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 10. Row Level Security (RLS) Setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 10a. Users RLS (PII protected: users see own profile, only administrators or backend service role see others)
CREATE POLICY "Users can view own profile or admins can view profiles" 
  ON public.users FOR SELECT 
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own profile" 
  ON public.users FOR UPDATE 
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR auth.role() = 'service_role'
  );

-- 10b. Animals RLS
CREATE POLICY "Animals are viewable by everyone once ready" 
  ON public.animals FOR SELECT 
  USING (
    adoption_status != 'NOT_READY'::public.adoption_status 
    OR auth.uid() = surrendered_by 
    OR public.is_shelter_or_ngo() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Staff can insert animals" 
  ON public.animals FOR INSERT 
  WITH CHECK (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

CREATE POLICY "Staff can update animals" 
  ON public.animals FOR UPDATE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

CREATE POLICY "Staff can delete animals" 
  ON public.animals FOR DELETE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

-- 10c. Adoption Applications RLS
CREATE POLICY "Users can view own applications or staff can view all" 
  ON public.adoption_applications FOR SELECT 
  USING (
    auth.uid() = applicant_id 
    OR public.is_shelter_or_ngo() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Authenticated users can apply for adoption" 
  ON public.adoption_applications FOR INSERT 
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = applicant_id) 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Staff can review adoption applications" 
  ON public.adoption_applications FOR UPDATE 
  USING (public.is_shelter_or_ngo() OR auth.role() = 'service_role');

-- 10d. Lost & Found RLS
CREATE POLICY "Lost and found viewable by everyone" 
  ON public.lost_and_found FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can report lost/found" 
  ON public.lost_and_found FOR INSERT 
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = reporter_id) 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update own lost/found" 
  ON public.lost_and_found FOR UPDATE 
  USING (auth.uid() = reporter_id OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own lost/found" 
  ON public.lost_and_found FOR DELETE 
  USING (auth.uid() = reporter_id OR public.is_admin() OR auth.role() = 'service_role');

-- 10e. Lost & Found Replies RLS
CREATE POLICY "Replies are viewable by everyone" 
  ON public.lost_and_found_replies FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can add replies" 
  ON public.lost_and_found_replies FOR INSERT 
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id) 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Authors or admin can delete replies" 
  ON public.lost_and_found_replies FOR DELETE 
  USING (auth.uid() = user_id OR public.is_admin() OR auth.role() = 'service_role');

-- 10f. Rescues RLS
CREATE POLICY "Rescues viewable by everyone" 
  ON public.rescues FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can report rescues" 
  ON public.rescues FOR INSERT 
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = reporter_id) 
    OR auth.role() = 'service_role'
  );

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

-- 10g. Rescue Timeline RLS
CREATE POLICY "Rescue timelines are viewable by everyone" 
  ON public.rescue_timeline FOR SELECT 
  USING (true);

CREATE POLICY "Service role or staff can insert rescue timelines" 
  ON public.rescue_timeline FOR INSERT 
  WITH CHECK (
    auth.role() = 'service_role' 
    OR (public.is_staff() AND auth.uid() = updated_by)
  );

-- 10h. Notifications RLS
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own notifications (mark as read)" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role or staff can insert notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (auth.role() = 'service_role' OR public.is_staff());

-- 11. Storage Bucket and Policies with Size and MIME Constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 
  'uploads', 
  true, 
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true, 
  file_size_limit = 10485760, 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

CREATE POLICY "Allow public viewing of uploads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'uploads');

CREATE POLICY "Allow authenticated users to upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uploads' AND 
    (
      (auth.uid()::text = (storage.foldername(name))[1]) OR
      (name LIKE (auth.uid()::text || '/%')) OR
      auth.role() = 'service_role'
    )
  );

CREATE POLICY "Allow users to update their own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'uploads' AND (auth.uid() = owner OR auth.role() = 'service_role'));

CREATE POLICY "Allow users to delete their own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads' AND (auth.uid() = owner OR auth.role() = 'service_role'));

-- 11b. User Avatar URL Bucket Validation Trigger (Compares against configured project storage prefix, fails closed if unset)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://cspnzitnvzdwwyxpnluw.supabase.co';

CREATE OR REPLACE FUNCTION public.get_storage_prefix()
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  config_url TEXT;
BEGIN
  config_url := current_setting('app.settings.supabase_url', true);
  IF config_url IS NULL OR config_url = '' THEN
    RAISE EXCEPTION 'Database setting app.settings.supabase_url is not configured. Configure it via: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://<your-project-id>.supabase.co'';';
  END IF;
  RETURN rtrim(config_url, '/') || '/storage/v1/object/public/uploads/';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_avatar_url()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  valid_prefix TEXT;
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    valid_prefix := public.get_storage_prefix();
    IF NOT (NEW.avatar_url LIKE (valid_prefix || '%')) THEN
      RAISE EXCEPTION 'Invalid avatar URL. Avatars must be uploaded to the official AniResQ uploads storage bucket.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_user_avatar_url ON public.users;
CREATE TRIGGER tr_validate_user_avatar_url
  BEFORE INSERT OR UPDATE OF avatar_url ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_user_avatar_url();

-- 11c. Audit Logs Table and Trigger for Role Changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins to read audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- Strictly allow ONLY service_role to insert audit logs (prevents forged audit entries from client)
CREATE POLICY "Allow service role to insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Skip trigger when updated via service_role to avoid duplicate audit logs with the backend API
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, old_value, new_value)
    VALUES (
      'ROLE_CHANGE',
      'USER',
      NEW.id,
      COALESCE(auth.uid()::text, 'unknown'),
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_user_role_change ON public.users;
CREATE TRIGGER tr_audit_user_role_change
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.audit_user_role_change();

-- 12. Database Indexes
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
CREATE INDEX IF NOT EXISTS idx_animals_surrendered_by ON public.animals (surrendered_by);

CREATE INDEX IF NOT EXISTS idx_adoption_apps_applicant_id ON public.adoption_applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_animal_id ON public.adoption_applications (animal_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_status ON public.adoption_applications (status);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_created_at ON public.adoption_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rescue_timeline_rescue_id ON public.rescue_timeline (rescue_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_lost_found_replies_post_id ON public.lost_and_found_replies (lost_and_found_id, created_at ASC);
