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
WITH numbered_requests AS (
  SELECT id, created_at, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.requests
  WHERE tracking_number IS NULL OR tracking_number = ''
)
UPDATE public.requests r
SET tracking_number = 'BRG-' || TO_CHAR(nr.created_at, 'YYYY') || '-' || LPAD(nr.rn::TEXT, 6, '0')
FROM numbered_requests nr
WHERE r.id = nr.id;

-- ============================================================================
-- PART 5: Fix Document Types RLS Policies
-- ============================================================================

-- Create a function to check if user is admin (avoids RLS recursion issues)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'captain')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop existing document_types policies
DROP POLICY IF EXISTS "document_types_select_active" ON public.document_types;
DROP POLICY IF EXISTS "document_types_select" ON public.document_types;
DROP POLICY IF EXISTS "document_types_insert_admin" ON public.document_types;
DROP POLICY IF EXISTS "document_types_update_admin" ON public.document_types;
DROP POLICY IF EXISTS "Anyone can view active document types" ON public.document_types;
DROP POLICY IF EXISTS "Only admins can insert document types" ON public.document_types;
DROP POLICY IF EXISTS "Only admins can update document types" ON public.document_types;

-- Enable RLS on document_types
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

-- Anyone can view document types (for selection dropdown)
CREATE POLICY "document_types_select"
ON public.document_types FOR SELECT
TO authenticated
USING (true);

-- Admins and captains can insert document types
CREATE POLICY "document_types_insert_admin"
ON public.document_types FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins and captains can update document types
CREATE POLICY "document_types_update_admin"
ON public.document_types FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins and captains can delete document types
DROP POLICY IF EXISTS "document_types_delete_admin" ON public.document_types;
CREATE POLICY "document_types_delete_admin"
ON public.document_types FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PART 6: Fix Test Account Roles
-- ============================================================================

UPDATE public.profiles SET role = 'admin', updated_at = NOW() WHERE email = 'admin@test.com';
UPDATE public.profiles SET role = 'captain', updated_at = NOW() WHERE email = 'captain@test.com';
UPDATE public.profiles SET role = 'encoder', updated_at = NOW() WHERE email = 'encoder@test.com';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List current policies on profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- List policies on document_types
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'document_types';

-- Verify test account roles
SELECT email, role FROM public.profiles 
WHERE email IN ('admin@test.com', 'captain@test.com', 'encoder@test.com');

-- List triggers on auth.users
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users' AND event_object_schema = 'auth';

-- ============================================================================
-- PART 7: Create is_staff() function and fix requests RLS policies
-- ============================================================================

-- Create a function to check if user is staff (admin, captain, OR encoder)
-- This uses SECURITY DEFINER to bypass RLS recursion issues
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'captain', 'encoder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ============================================================================
-- PART 8: Fix Requests RLS Policies (using is_staff() to avoid recursion)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "requests_select_own" ON public.requests;
DROP POLICY IF EXISTS "requests_select_staff" ON public.requests;
DROP POLICY IF EXISTS "requests_update_own" ON public.requests;
DROP POLICY IF EXISTS "requests_update_staff" ON public.requests;
DROP POLICY IF EXISTS "Allow users to view their own requests" ON public.requests;
DROP POLICY IF EXISTS "Allow staff to view all requests" ON public.requests;
DROP POLICY IF EXISTS "Allow users to update their own requests" ON public.requests;
DROP POLICY IF EXISTS "Allow staff to update requests" ON public.requests;

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "requests_select_own"
ON public.requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Staff (admin, captain, encoder) can view ALL requests
CREATE POLICY "requests_select_staff"
ON public.requests FOR SELECT
TO authenticated
USING (public.is_staff());

-- Users can update their own requests (e.g., cancel)
CREATE POLICY "requests_update_own"
ON public.requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Staff can update any request
CREATE POLICY "requests_update_staff"
ON public.requests FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ============================================================================
-- PART 9: Fix Status History RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "status_history_select_own" ON public.status_history;
DROP POLICY IF EXISTS "status_history_select_staff" ON public.status_history;
DROP POLICY IF EXISTS "status_history_insert_staff" ON public.status_history;
DROP POLICY IF EXISTS "Allow users to view status history for their requests" ON public.status_history;
DROP POLICY IF EXISTS "Allow staff to view all status history" ON public.status_history;
DROP POLICY IF EXISTS "Allow staff to insert status history" ON public.status_history;

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Users can view status history for their own requests
CREATE POLICY "status_history_select_own"
ON public.status_history FOR SELECT
TO authenticated
USING (request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid()));

-- Staff can view all status history
CREATE POLICY "status_history_select_staff"
ON public.status_history FOR SELECT
TO authenticated
USING (public.is_staff());

-- Staff can insert status history entries
CREATE POLICY "status_history_insert_staff"
ON public.status_history FOR INSERT
TO authenticated
WITH CHECK (public.is_staff());

-- ============================================================================
-- PART 10: Fix Payments RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_select_staff" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_staff" ON public.payments;
DROP POLICY IF EXISTS "payments_update_staff" ON public.payments;

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "payments_select_own"
ON public.payments FOR SELECT
TO authenticated
USING (request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid()));

-- Staff can view all payments
CREATE POLICY "payments_select_staff"
ON public.payments FOR SELECT
TO authenticated
USING (public.is_staff());

-- Staff can insert payments
CREATE POLICY "payments_insert_staff"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (public.is_staff());

-- Staff can update payments
CREATE POLICY "payments_update_staff"
ON public.payments FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ============================================================================
-- PART 11: Verify the new functions and policies
-- ============================================================================

-- Check is_staff function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('is_admin', 'is_staff');

-- List policies on requests
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'requests';

-- List policies on status_history
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'status_history';

-- ============================================================================
-- PART 12: Add processed_by column to requests table
-- ============================================================================
-- This column tracks which staff member processed/updated each request

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'requests' 
    AND column_name = 'processed_by'
  ) THEN
    ALTER TABLE public.requests ADD COLUMN processed_by UUID REFERENCES public.profiles(id);
  END IF;
END $$;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_requests_processed_by ON public.requests(processed_by);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'requests' AND column_name = 'processed_by';

-- Fix existing request status values to lowercase
UPDATE public.requests SET status = 'pending' WHERE LOWER(status) = 'pending' AND status != 'pending';
UPDATE public.requests SET status = 'processing' WHERE LOWER(status) = 'processing' AND status != 'processing';
UPDATE public.requests SET status = 'ready_for_pickup' WHERE LOWER(REPLACE(status, ' ', '_')) = 'ready_for_pickup' AND status != 'ready_for_pickup';
UPDATE public.requests SET status = 'completed' WHERE LOWER(status) = 'completed' AND status != 'completed';
UPDATE public.requests SET status = 'rejected' WHERE LOWER(status) IN ('rejected', 'declined') AND status NOT IN ('rejected');
UPDATE public.requests SET status = 'cancelled' WHERE LOWER(status) IN ('cancelled', 'canceled') AND status != 'cancelled';

-- Also add the processed_by column if missing
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.profiles(id);

-- Verify the status values are now lowercase
SELECT id, tracking_number, status FROM public.requests;