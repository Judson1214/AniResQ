CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_role public.user_role;
  v_name TEXT;
BEGIN
  -- Extract display name safely
  v_name := NEW.raw_user_meta_data->>'display_name';
  IF v_name IS NULL OR v_name = '' THEN
    v_name := 'Unknown User';
  END IF;

  -- Extract role safely with exception handling for invalid enums
  BEGIN
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
      v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    ELSE
      v_role := 'CITIZEN'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'CITIZEN'::public.user_role;
  END;

  -- Insert into public.users
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    v_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
