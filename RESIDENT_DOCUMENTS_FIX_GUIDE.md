# Fix for Resident Additional Documents Preview Issue

## Problem
Resident uploaded "Additional Documents" cannot be viewed because:
1. Old documents in the database have incorrect file paths
2. File paths don't include the request_id as required
3. Old format: `user_id/timestamp-random.ext`
4. Required format: `user_id/request_id-timestamp.ext`

## Root Cause
The file upload code was recently updated to include request_id in the path, but old documents in the database still have the old path format.

## Solution

### Option 1: Clean Database (RECOMMENDED)
Delete old incorrect documents and have residents re-upload them with the correct format.

**Steps:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the following query to see what will be deleted:
```sql
SELECT id, file_path, request_id::text 
FROM public.resident_documents
WHERE file_path NOT LIKE '%' || request_id::text || '-%'
  AND file_path != '';
```

3. If the results look correct (old documents only), run:
```sql
DELETE FROM public.resident_documents
WHERE file_path NOT LIKE '%' || request_id::text || '-%'
  AND file_path != '';
```

4. Notify residents that they need to re-upload their additional documents

### Option 2: Rename Files in Storage (ADVANCED)
Manually move files in Supabase storage and update database records to match new paths.

**This requires:**
- Going through each old file
- Renaming it in storage to include request_id
- Updating the database record with new path

### After Fix
- ✅ Residents can upload additional documents
- ✅ Documents display with correct paths
- ✅ View/Download buttons work
- ✅ Both images and PDFs preview correctly

## Code Changes Made
All code is already correct:
- `RequestHistory.jsx` saves with correct path format: `user_id/request_id-timestamp.ext`
- Storage bucket is correct: `signed-documents`
- File access uses authenticated download with proper bucket name

## Prevention
Going forward, all new uploads will have the correct path format with request_id included.

## Testing
After cleanup:
1. Resident opens Request Details
2. Goes to "Additional Documents" section
3. Uploads a new document
4. Document should appear and be viewable immediately
