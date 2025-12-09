-- Clean up resident_documents with incorrect file paths
-- This removes documents where the file_path doesn't contain the request_id
-- These are old uploads that used incorrect path naming convention
-- (Old format: user_id/timestamp.ext instead of user_id/request_id-timestamp.ext)

-- First, check what will be deleted:
SELECT id, file_path, request_id::text 
FROM public.resident_documents
WHERE file_path NOT LIKE '%' || request_id::text || '-%'
  AND file_path != '';

-- Then run this to delete them:
DELETE FROM public.resident_documents
WHERE file_path NOT LIKE '%' || request_id::text || '-%'
  AND file_path != '';

-- After deletion, ask residents to re-upload their additional documents
-- Future uploads will have the correct path format with request_id included

