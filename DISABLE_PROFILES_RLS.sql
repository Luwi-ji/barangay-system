-- Alternative approach: Disable RLS on profiles table entirely
-- This is simpler and works for development
-- For production, use the FIX_PROFILES_RLS.sql with proper policies

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
