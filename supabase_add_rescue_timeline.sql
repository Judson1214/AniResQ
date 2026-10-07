-- Rescue Timeline Table

CREATE TABLE public.rescue_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_id UUID REFERENCES public.rescues(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.rescue_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rescue timelines are viewable by everyone." 
  ON public.rescue_timeline FOR SELECT 
  USING (true);

-- Authenticated users (volunteers, admins) can insert
CREATE POLICY "Authenticated users can insert rescue timelines." 
  ON public.rescue_timeline FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
