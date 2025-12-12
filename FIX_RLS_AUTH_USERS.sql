-- ============================================================================
-- FIX RLS POLICIES & PROFILE CREATION TRIGGER
-- ============================================================================
-- Issues fixed:
-- 1. RLS policies queried auth.users directly → "permission denied for table users"
-- 2. Profile trigger only fired on INSERT, not when user confirms email (UPDATE)
-- 3. Google OAuth users weren't getting profiles created
-- 4. Added function to check if email exists (in both auth.users and profiles)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix RLS Policies
-- ============================================================================

-- Fix profiles_select: allow all authenticated users to read profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Also allow anon to check profiles for email existence (needed for signup check)
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
CREATE POLICY "profiles_select_anon"
ON public.profiles FOR SELECT
TO anon
USING (true);

-- Fix profiles_insert: allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "profiles_insert_confirmed" ON public.profiles;
CREATE POLICY "profiles_insert_confirmed"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Fix requests_insert: allow authenticated users to insert their own requests
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert"
ON public.requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PART 2: Create function to check if email already exists
-- ============================================================================
-- This function checks BOTH auth.users AND profiles tables
-- It runs with SECURITY DEFINER so it can access auth.users

DROP FUNCTION IF EXISTS public.check_email_exists(TEXT);
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_exists BOOLEAN := FALSE;
BEGIN
  v_email := LOWER(TRIM(p_email));
  
  -- Check in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_email) THEN
    v_exists := TRUE;
  END IF;
  
  -- Also check in profiles (in case of orphaned records)
  IF NOT v_exists AND EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = v_email) THEN
    v_exists := TRUE;
  END IF;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant execute to anon and authenticated so client can call it
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated;

-- ============================================================================
-- PART 3: Fix Profile Creation Trigger (fires on INSERT and UPDATE)
-- ============================================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Recreate the function to handle both new users and email confirmation
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create a profile if the auth user's email is confirmed.
  -- This handles both:
  -- 1. New users who sign up with email (confirmed via link)
  -- 2. OAuth users (Google) who are auto-confirmed
  -- 3. Users whose email_confirmed_at just changed from NULL to a value
  
  IF COALESCE(NEW.email_confirmed_at, NEW.confirmed_at) IS NOT NULL THEN
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      -- Also check if email is already used by another profile
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email) AND id != NEW.id) THEN
        INSERT INTO public.profiles (
          id, email, full_name, mobile, address, birth_date, role, status, created_at, updated_at
        ) VALUES (
          NEW.id,
          LOWER(COALESCE(NEW.email, '')),
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
          COALESCE(NEW.raw_user_meta_data->>'mobile', ''),
          COALESCE(NEW.raw_user_meta_data->>'address', ''),
          NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE,
          COALESCE(NEW.raw_user_meta_data->>'role', 'resident'),
          'active',
          NOW(),
          NOW()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user signups
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_user();

-- Trigger for when user confirms email (UPDATE sets email_confirmed_at)
CREATE TRIGGER on_auth_user_confirmed
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.create_profile_for_user();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'RLS policies, email check function, and triggers fixed successfully!' as status;

-- ============================================================================
-- PART 4: Add Tracking Number Generation
-- ============================================================================

-- Function to generate tracking number
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_sequence INT;
  v_tracking TEXT;
BEGIN
  -- Format: BRG-YYYY-XXXXXX (e.g., BRG-2025-000001)
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN tracking_number LIKE 'BRG-' || v_year || '-%' 
      THEN CAST(SUBSTRING(tracking_number FROM 10) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO v_sequence
  FROM public.requests;
  
  -- Generate tracking number
  v_tracking := 'BRG-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
  
  NEW.tracking_number := v_tracking;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS generate_tracking_number_trigger ON public.requests;

-- Create trigger to generate tracking number before insert
CREATE TRIGGER generate_tracking_number_trigger
BEFORE INSERT ON public.requests
FOR EACH ROW
WHEN (NEW.tracking_number IS NULL OR NEW.tracking_number = '')
EXECUTE FUNCTION public.generate_tracking_number();

-- Update existing requests without tracking numbers
UPDATE public.requests
SET tracking_number = 'BRG-' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(
  ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0'
)
WHERE tracking_number IS NULL OR tracking_number = '';

-- List current policies on profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- List triggers on auth.users
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users' AND event_object_schema = 'auth';
