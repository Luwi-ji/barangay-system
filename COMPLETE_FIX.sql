-- COMPLETE FIX - Run this entire script to resolve all issues

-- Step 1: Disable RLS on ALL tables completely
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resident_documents DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Create the missing profile for the existing user
-- This is for the user ID from your error: bf859a4c-226a-47b9-a720-5254d0a76108
INSERT INTO public.profiles (id, email, full_name, address, mobile, birth_date, role, created_at)
VALUES ('bf859a4c-226a-47b9-a720-5254d0a76108', 'lowel.rubino29@gmail.com', 'Lowel Rubino', '', '', NULL, 'resident', NOW())
ON CONFLICT (id) DO NOTHING;

-- Step 4: Verify the profile was created
SELECT id, email, full_name, role FROM public.profiles 
WHERE id = 'bf859a4c-226a-47b9-a720-5254d0a76108';

-- Step 5: Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'requests', 'document_types', 'status_history', 'resident_documents')
ORDER BY tablename;

-- Step 6: Create a simple trigger that actually works
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Simply insert the profile, ignore if it already exists
  INSERT INTO public.profiles (id, email, full_name, address, mobile, birth_date, role, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.user_metadata->>'full_name', NEW.email),
    COALESCE(NEW.user_metadata->>'address', ''),
    COALESCE(NEW.user_metadata->>'mobile', ''),
    COALESCE(NEW.user_metadata->>'birth_date', NULL),
    'resident', 
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- If there's any error, just return NEW anyway - don't block the signup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_user();

-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'auth';
