-- ========================================
-- Fix Profile Creation Issue
-- ========================================
-- Adds INSERT policy and function to handle profile creation

-- Add INSERT policy for profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Make username nullable and add default
ALTER TABLE public.profiles
  ALTER COLUMN username DROP NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN username SET DEFAULT '';

-- Create function to handle profile upsert
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT '',
  p_full_name TEXT DEFAULT '',
  p_bio TEXT DEFAULT '',
  p_phone_number TEXT DEFAULT '',
  p_location TEXT DEFAULT '',
  p_website TEXT DEFAULT '',
  p_language TEXT DEFAULT 'en',
  p_theme TEXT DEFAULT 'dark'
)
RETURNS SETOF public.profiles AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    bio,
    phone_number,
    location,
    website,
    language,
    theme,
    updated_at
  )
  VALUES (
    p_user_id,
    p_username,
    p_full_name,
    p_bio,
    p_phone_number,
    p_location,
    p_website,
    p_language,
    p_theme,
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    username = COALESCE(NULLIF(EXCLUDED.username, ''), public.profiles.username),
    full_name = EXCLUDED.full_name,
    bio = EXCLUDED.bio,
    phone_number = EXCLUDED.phone_number,
    location = EXCLUDED.location,
    website = EXCLUDED.website,
    language = EXCLUDED.language,
    theme = EXCLUDED.theme,
    updated_at = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_profile TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Profile creation fix applied successfully!';
  RAISE NOTICE 'Users can now create and update their profiles.';
END $$;
