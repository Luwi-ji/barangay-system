# Fix for Multiple Signed Documents Support

## Problem
The system was designed to support multiple signed documents, but the database schema was missing the `document_category` column needed to properly track and filter signed documents.

## Solution
Follow these steps to enable multiple signed documents for both admin and resident:

### Step 1: Update Database Schema
Run the following SQL in Supabase SQL Editor:

```sql
-- Add document_category column to resident_documents table
ALTER TABLE public.resident_documents
ADD COLUMN IF NOT EXISTS document_category VARCHAR(50) DEFAULT NULL;

-- Create index for faster filtering by document category
CREATE INDEX IF NOT EXISTS idx_resident_documents_category ON public.resident_documents(document_category);
```

### Step 2: Code Changes (Already Applied)

#### Admin Side (RequestManagement.jsx)
- ✅ `handleUploadSignedDocument()` - Uploads one document at a time
  - Saves to `resident_documents` table with `document_category: 'signed-document'`
  - Each upload gets a unique timestamp to prevent overwrites
  - Does NOT close the modal - allows uploading more documents
  
- ✅ `handleUpdateRequest()` - Saves status and notes changes
  - Separate from uploads to allow flexible workflow
  
- ✅ UI Changes
  - "Upload Document" button (green) - uploads the selected file
  - "Save Changes" button (dark) - saves status/notes and closes modal

#### Resident Side (RequestHistory.jsx)
- ✅ Displays all signed documents (admin-uploaded)
- ✅ Shows "Admin" badge for documents uploaded by admin
- ✅ Allows viewing and downloading admin documents

## How to Use

### Admin Uploads Multiple Documents:
1. Open request details
2. Select file → Click "Upload Document"
3. Select another file → Click "Upload Document" 
4. Repeat as needed
5. When done, change status/notes if needed
6. Click "Save Changes" to finalize

### Resident Views Documents:
1. Open Request Details in Request History
2. Scroll to "Signed Documents" section
3. See all documents uploaded by admin (with "Admin" badge)
4. View, download documents as needed

## Testing
After running the SQL migration:
1. Admin uploads multiple signed documents
2. Refresh the modal - all documents should appear in "Signed Documents"
3. Login as resident and view Request History
4. In Request Details, "Signed Documents" should show all admin uploads with "Admin" badge
