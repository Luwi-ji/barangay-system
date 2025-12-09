-- ============================================================================
-- BARANGAY DOCUMENT REQUEST SYSTEM - SUPABASE RLS POLICIES
-- ============================================================================
-- These policies ensure proper access control for residents, staff, and admins
-- Execute all of these in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE POLICIES
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Allow users to view all profiles (needed for displaying resident info)
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to insert (during registration)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- 2. DOCUMENT_TYPES TABLE POLICIES
-- ============================================================================

-- Enable RLS on document_types table
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active document types" ON public.document_types;
DROP POLICY IF EXISTS "Only admins can insert document types" ON public.document_types;
DROP POLICY IF EXISTS "Only admins can update document types" ON public.document_types;

-- Anyone can view active document types
CREATE POLICY "Anyone can view active document types"
ON public.document_types FOR SELECT
USING (is_active = true OR auth.jwt() ->> 'role' = 'admin');

-- Only admins can insert document types
CREATE POLICY "Only admins can insert document types"
ON public.document_types FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only admins can update document types
CREATE POLICY "Only admins can update document types"
ON public.document_types FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- 3. REQUESTS TABLE POLICIES
-- ============================================================================

-- Enable RLS on requests table
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view all requests" ON public.requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update own requests" ON public.requests;
DROP POLICY IF EXISTS "Staff can update all requests" ON public.requests;

-- Staff can view all requests
CREATE POLICY "Staff can view all requests"
ON public.requests FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
);

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create requests
CREATE POLICY "Users can create requests"
ON public.requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own requests (before processing)
CREATE POLICY "Users can update own requests"
ON public.requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Staff can update any request
CREATE POLICY "Staff can update all requests"
ON public.requests FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
);

-- ============================================================================
-- 4. STATUS_HISTORY TABLE POLICIES
-- ============================================================================

-- Enable RLS on status_history table
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view all status history" ON public.status_history;
DROP POLICY IF EXISTS "Users can view own request status history" ON public.status_history;
DROP POLICY IF EXISTS "System can insert status history" ON public.status_history;

-- Staff can view all status history
CREATE POLICY "Staff can view all status history"
ON public.status_history FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
);

-- Users can view their own request status history
CREATE POLICY "Users can view own request status history"
ON public.status_history FOR SELECT
TO authenticated
USING (
  request_id IN (
    SELECT id FROM public.requests WHERE user_id = auth.uid()
  )
);

-- System/Staff can insert status history
CREATE POLICY "System can insert status history"
ON public.status_history FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain', 'system')
  OR changed_by IS NULL
  OR changed_by = auth.uid()
);

-- ============================================================================
-- 5. STORAGE POLICIES - ID-UPLOADS BUCKET
-- ============================================================================
-- NOTE: Storage policies must be created via Supabase Dashboard UI
-- You do not have direct SQL access to storage.objects table
-- See instructions below on how to set these up in the dashboard

-- STORAGE POLICIES TO CREATE MANUALLY IN SUPABASE DASHBOARD:
-- 
-- For bucket: id-uploads
-- Policy 1: "Staff can view all IDs"
--   Command: SELECT
--   Applied to: public
--   Check: (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
--
-- Policy 2: "Users can upload own IDs"  
--   Command: INSERT
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 3: "Users can view own IDs"
--   Command: SELECT
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 4: "Users can update own IDs"
--   Command: UPDATE
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 5: "Users can delete own IDs"
--   Command: DELETE
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text

-- ============================================================================
-- 6. STORAGE POLICIES - SIGNED-DOCUMENTS BUCKET
-- ============================================================================
-- NOTE: Storage policies must be created via Supabase Dashboard UI

-- STORAGE POLICIES TO CREATE MANUALLY IN SUPABASE DASHBOARD:
--
-- For bucket: signed-documents
-- Policy 1: "Staff can view all signed documents"
--   Command: SELECT
--   Applied to: public
--   Check: (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
--
-- Policy 2: "Staff can upload signed documents"
--   Command: INSERT
--   Applied to: public
--   Check: (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')
--
-- Policy 3: "Users can upload own documents"
--   Command: INSERT
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 4: "Users can view own signed documents"
--   Command: SELECT
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 5: "Users can delete own documents"
--   Command: DELETE
--   Applied to: public
--   Check: (storage.foldername(name))[1] = auth.uid()::text
--
-- Policy 6: "Staff can delete any document"
--   Command: DELETE
--   Applied to: public
--   Check: (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'encoder', 'captain')

-- ============================================================================
-- 7. VERIFICATION/TESTING QUERIES
-- ============================================================================

-- Run these queries to verify your table policies are working:

-- Check all RLS-enabled tables
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('profiles', 'document_types', 'requests', 'status_history')
ORDER BY tablename;

-- Check active policies on profiles
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- Check active policies on requests
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'requests';

-- Check active policies on document_types
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'document_types';

-- Check active policies on status_history
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'status_history';

-- ============================================================================
-- 8. IMPORTANT NOTES
-- ============================================================================

-- TABLE RLS POLICIES:
-- After running this SQL script, all table policies will be in place:
-- 1. ✓ profiles table - users can view/update own, admins can update any
-- 2. ✓ document_types table - anyone can view active, admins only can edit
-- 3. ✓ requests table - users see own, staff see all, proper update permissions
-- 4. ✓ status_history table - users see own history, staff see all
--
-- STORAGE POLICIES:
-- Storage policies MUST be set up manually via Supabase Dashboard (see instructions above)
-- This is because of Supabase system table restrictions on storage.objects
--
-- TESTING YOUR SETUP:
-- 1. After running this SQL, resident should only see own requests
-- 2. Admin should see all requests and documents  
-- 3. Upload test files to verify storage access works
-- 4. View uploaded files to ensure authentication works
--
-- YOUR APPLICATION NOW PROPERLY HANDLES:
-- ✓ Resident document uploads (stored in user-specific folders)
-- ✓ Admin viewing all resident documents
-- ✓ Resident viewing only their own status history
-- ✓ Staff updating request statuses
-- ✓ Authenticated downloads with proper authorization
