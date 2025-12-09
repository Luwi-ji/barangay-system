-- Fix Storage Policies for Admin/Encoder Download
-- Run this in Supabase SQL Editor

-- For signed-documents bucket - allow admin/encoder to download all documents
DROP POLICY IF EXISTS "Allow admin download documents" ON storage.objects;
CREATE POLICY "Allow admin download documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signed-documents' AND
  auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
);

-- For id-uploads bucket - allow admin/encoder to view/download
DROP POLICY IF EXISTS "Allow admin download IDs" ON storage.objects;
CREATE POLICY "Allow admin download IDs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-uploads' AND
  auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain')
);

-- For signed-documents bucket - allow residents to download their own documents
DROP POLICY IF EXISTS "Allow resident download own documents" ON storage.objects;
CREATE POLICY "Allow resident download own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signed-documents' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR
   auth.jwt() ->> 'role' IN ('admin', 'encoder', 'captain'))
);
