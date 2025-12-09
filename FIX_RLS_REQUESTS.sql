-- Fix requests table to ensure all necessary columns exist and RLS works properly

-- 1. Ensure id_image_back_url column exists
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS id_image_back_url TEXT;

-- 2. Add resident_id as an alias/trigger if needed, but use user_id as primary
-- Let's make sure the table has proper structure
-- Check that user_id is set as NOT NULL and has proper constraints

-- 3. Verify the requests table has all required columns by recreating RLS policies
-- Drop and recreate the INSERT policy to ensure it works correctly

DROP POLICY IF EXISTS "Users can create requests" ON public.requests;

-- Users can create requests - explicit WITH CHECK clause
CREATE POLICY "Users can create requests"
ON public.requests FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  document_type_id IS NOT NULL AND
  purpose IS NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Test: Query to verify policy allows insert
-- SELECT auth.uid(), user_id FROM public.requests LIMIT 1;
