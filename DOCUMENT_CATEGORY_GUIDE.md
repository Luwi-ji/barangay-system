# Document Category Organization

## Overview
Documents are now properly categorized and separated by type:

## Categories

### 1. **Signed Documents** (Admin-Uploaded)
- **Category:** `document_category = 'signed-document'`
- **Uploader:** Admin/Staff only
- **Location in UI:**
  - Admin: "Signed Documents" section
  - Resident: "Signed Documents" section (with "Admin" badge)
- **Purpose:** Official signed/processed documents from administration

### 2. **Additional Documents** (Resident-Uploaded)
- **Category:** `document_category = 'additional-document'`
- **Uploader:** Resident only
- **Location in UI:**
  - Admin: "Uploaded Additional Documents" section
  - Resident: "Additional Documents" section
- **Purpose:** Extra documents uploaded by resident beyond initial ID submission

## Storage Location
All documents are stored in the `signed-documents` bucket in Supabase (shared bucket for all non-ID documents)

## Filtering Logic

### Admin View (RequestManagement.jsx)
```
- Uploaded Additional Documents: filter(doc => doc.document_category !== 'signed-document')
- Signed Documents: filter(doc => doc.document_category === 'signed-document')
```

### Resident View (RequestHistory.jsx)
```
- Signed Documents: filter(doc => doc.document_category === 'signed-document')
- Additional Documents: filter(doc => doc.document_category === 'additional-document' OR (!doc.document_category && doc.uploaded_by === user.id))
```

## Document Flow

1. **Resident Initial Submission:**
   - ID Front Side (stored in requests.id_image_url)
   - ID Back Side (stored in requests.id_image_back_url)

2. **Resident Additional Uploads:**
   - Stored in resident_documents with document_category = 'additional-document'
   - Only resident can upload/delete their own documents

3. **Admin Signed Documents:**
   - Stored in resident_documents with document_category = 'signed-document'
   - Multiple documents can be uploaded per request
   - Each gets unique timestamp to prevent overwrites
   - Resident can view/download but not delete

## Database Schema
```sql
resident_documents:
- id (BIGINT)
- request_id (UUID) - FK to requests
- file_path (TEXT)
- file_name (TEXT)
- file_type (TEXT)
- file_size (BIGINT)
- uploaded_by (UUID) - FK to profiles
- document_category (VARCHAR(50)) - 'signed-document' or 'additional-document'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```
