-- Comprehensive Storage Policies for both buckets
-- Run this in Supabase SQL Editor

-- ============================================================================
-- ID-UPLOADS BUCKET POLICIES
-- ============================================================================

-- Allow authenticated users to upload files to id-uploads bucket (INSERT)
DROP POLICY IF EXISTS "Allow authenticated upload to id-uploads" ON storage.objects;
CREATE POLICY "Allow authenticated upload to id-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'id-uploads');

-- Allow users to view their own and staff to view all (SELECT)
DROP POLICY IF EXISTS "Allow view id-uploads" ON storage.objects;
CREATE POLICY "Allow view id-uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-uploads' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
  )
);

-- Allow residents to delete their own files (DELETE)
DROP POLICY IF EXISTS "Allow residents delete own id files" ON storage.objects;
CREATE POLICY "Allow residents delete own id files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'id-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admin to delete any files (DELETE)
DROP POLICY IF EXISTS "Allow admin delete id files" ON storage.objects;
CREATE POLICY "Allow admin delete id files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'id-uploads' AND
  auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
);

-- ============================================================================
-- SIGNED-DOCUMENTS BUCKET POLICIES
-- ============================================================================

-- Allow authenticated users to view signed documents (SELECT)
DROP POLICY IF EXISTS "Allow view signed-documents" ON storage.objects;
CREATE POLICY "Allow view signed-documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signed-documents' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
  )
);

-- Allow admin/staff to upload signed documents (INSERT)
DROP POLICY IF EXISTS "Allow staff upload to signed-documents" ON storage.objects;
CREATE POLICY "Allow staff upload to signed-documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signed-documents' AND
  auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
);

-- Allow staff to delete documents (DELETE)
DROP POLICY IF EXISTS "Allow staff delete from signed-documents" ON storage.objects;
CREATE POLICY "Allow staff delete from signed-documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signed-documents' AND
  auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
);
