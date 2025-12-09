-- Create a trigger to automatically create a profile when a new auth user is created
-- This ensures the profile exists even if the app fails to insert it

-- First, verify the profiles table structure
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create a function that runs when a new user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_error_msg text;
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.user_metadata->>'full_name', NEW.email),
      'resident',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    RAISE WARNING 'Error in handle_new_user: %', v_error_msg;
    -- Still return NEW to allow the user to be created even if profile insert fails
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users table
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger is created
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'users' AND trigger_schema = 'auth';
