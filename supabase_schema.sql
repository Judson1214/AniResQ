-- ==========================================
-- AniResQ Supabase PostgreSQL Schema
-- ==========================================

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
  phone TEXT,
  role user_role DEFAULT 'CITIZEN'::user_role NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Create Lost & Found Table
CREATE TABLE public.lost_and_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type lost_found_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  species TEXT NOT NULL, -- Keep as text or match species Enum if strictly validated
  breed TEXT,
  color TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  last_seen_address TEXT NOT NULL,
  last_seen_date TIMESTAMPTZ NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  images TEXT[] DEFAULT '{}',
  status lost_found_status DEFAULT 'ACTIVE'::lost_found_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Create Rescues Table
CREATE TABLE public.rescues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity rescue_severity NOT NULL,
  species TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  address TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  status rescue_status DEFAULT 'PENDING'::rescue_status NOT NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_animals_modtime BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_adoption_applications_modtime BEFORE UPDATE ON public.adoption_applications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_lost_and_found_modtime BEFORE UPDATE ON public.lost_and_found FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_rescues_modtime BEFORE UPDATE ON public.rescues FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Trigger to auto-create user profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unknown User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CITIZEN'::user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. Row Level Security (RLS) Setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescues ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies (everyone can view)
CREATE POLICY "Public profiles are viewable by everyone." ON public.users FOR SELECT USING (true);
CREATE POLICY "Animals are viewable by everyone." ON public.animals FOR SELECT USING (true);
CREATE POLICY "Lost and found viewable by everyone." ON public.lost_and_found FOR SELECT USING (true);
CREATE POLICY "Rescues viewable by everyone." ON public.rescues FOR SELECT USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can report lost/found." ON public.lost_and_found FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can report rescues." ON public.rescues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can apply for adoption." ON public.adoption_applications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own content
CREATE POLICY "Users can update own profile." ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can update own lost/found." ON public.lost_and_found FOR UPDATE USING (auth.uid() = reporter_id);
CREATE POLICY "Users can view own adoption applications." ON public.adoption_applications FOR SELECT USING (auth.uid() = applicant_id);
