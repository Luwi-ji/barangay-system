# Storage Bucket Organization

## Overview
Files are organized in two separate Supabase storage buckets for different purposes:

## Buckets

### 1. **id-uploads** Bucket
**Purpose:** Store resident ID images (front and back)
**File Types:** JPG, PNG images
**Path Structure:** `{user_id}/{filename}`
**Access:** Used during initial request submission

**Location in Code:**
- RequestHistory.jsx: ID Front/Back display
- RequestManagement.jsx: ID Front/Back display

**Example Path:**
```
89f0b5b7-2b89-4df8-b302-99d716aa435b-id-front-1765289487933.jpg
```

### 2. **signed-documents** Bucket
**Purpose:** Store all additional documents beyond ID images
- **Admin-uploaded signed documents** (document_category = 'signed-document')
- **Resident-uploaded additional documents** (document_category = 'additional-document')

**File Types:** PDF, JPG, PNG, and other documents
**Path Structure:** `{user_id}/{request_id}-{timestamp}.{ext}`
**Access:** Used after request submission

**Example Paths:**
```
89f0b5b7-2b89-4df8-b302-99d716aa435b/d1c10196-18a0-492f-b793-585707c8baa9-1765290387488.pdf
89f0b5b7-2b89-4df8-b302-99d716aa435b/d1c10196-18a0-492f-b793-585707c8baa9-1765290388999.jpg
```

## Correct Bucket Usage in Components

### RequestHistory.jsx (Resident View)
```javascript
// For ID images (Front/Back)
viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_url)

// For Signed Documents (admin uploads)
viewImageWithAuth(null, 'signed-documents', doc.file_path)

// For Additional Documents (resident uploads)
viewImageWithAuth(null, 'signed-documents', doc.file_path)
```

### RequestManagement.jsx (Admin View)
```javascript
// For ID images (Front/Back)
viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_url)

// For Uploaded Additional Documents (resident uploads)
viewImageWithAuth(null, 'signed-documents', doc.file_path)

// For Signed Documents (admin uploads)
viewImageWithAuth(null, 'signed-documents', doc.file_path)
```

## Key Points

✅ **ID Images** → Always use `'id-uploads'` bucket  
✅ **All Other Documents** → Always use `'signed-documents'` bucket  
✅ **PDFs** → Supported in signed-documents bucket with embed/iframe viewer  
✅ **Images** → Supported in both buckets with img tag viewer  

## Common Issues

❌ **400 Bad Request Error**
- Cause: Wrong bucket name passed to viewImageWithAuth
- Solution: Verify correct bucket is used based on document type

❌ **Failed to load PDF**
- Cause: Using id-uploads bucket for PDFs (doesn't support PDF mime type properly)
- Solution: Ensure PDFs are stored in and retrieved from signed-documents bucket

## Storage Policies

Both buckets are protected by RLS (Row Level Security):
- Users can only upload to their own user_id folder
- Admin can manage all documents
- All authenticated users can download their own files
