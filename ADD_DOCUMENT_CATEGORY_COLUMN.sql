-- Add document_category column to resident_documents table to track document types
-- This allows us to differentiate between regular documents and signed documents

ALTER TABLE public.resident_documents
ADD COLUMN IF NOT EXISTS document_category VARCHAR(50) DEFAULT NULL;

-- Create index for faster filtering by document category
CREATE INDEX IF NOT EXISTS idx_resident_documents_category ON public.resident_documents(document_category);

-- Update existing documents to not have a category (NULL is default)
-- New uploads will explicitly set the category as needed
