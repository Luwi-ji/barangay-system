-- Cancel Request Feature SQL
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing status check constraint
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;

-- Step 2: Add new constraint that includes 'Cancelled'
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check 
CHECK (status IN ('Pending', 'Processing', 'Ready for Pickup', 'Completed', 'Declined', 'Cancelled'));

-- Create index for faster filtering of cancelled requests
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_status_history_status ON public.status_history(status);

-- Add RLS policy to allow residents to cancel their own requests
DROP POLICY IF EXISTS "Users can cancel own requests" ON public.requests;
CREATE POLICY "Users can cancel own requests"
ON public.requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('Pending', 'Processing'))
WITH CHECK (user_id = auth.uid() AND (status = 'Cancelled' OR status IN ('Pending', 'Processing')));

-- Allow residents to insert cancellation status history
DROP POLICY IF EXISTS "Users can record own cancellation" ON public.status_history;
CREATE POLICY "Users can record own cancellation"
ON public.status_history FOR INSERT
TO authenticated
WITH CHECK (
  request_id IN (SELECT id FROM requests WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT DISTINCT id FROM profiles WHERE role IN ('admin', 'encoder', 'captain'))
);
