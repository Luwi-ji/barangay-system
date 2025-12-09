-- Create resident_documents table to track additional documents uploaded by residents
-- This table keeps a record of all documents uploaded by residents beyond their initial ID

CREATE TABLE IF NOT EXISTS public.resident_documents (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('UTC'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('UTC'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resident_documents_request_id ON public.resident_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_resident_documents_uploaded_by ON public.resident_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_resident_documents_created_at ON public.resident_documents(created_at);

-- Enable RLS
ALTER TABLE public.resident_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see documents for their own requests or if they are admin
DROP POLICY IF EXISTS "Users can view their own documents" ON public.resident_documents;
CREATE POLICY "Users can view their own documents" ON public.resident_documents
  FOR SELECT
  USING (
    auth.uid() = uploaded_by OR
    auth.uid() IN (
      SELECT DISTINCT id FROM profiles WHERE role IN ('admin', 'encoder', 'captain')
    )
  );

-- RLS Policy: Users can insert their own documents
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.resident_documents;
CREATE POLICY "Users can insert their own documents" ON public.resident_documents
  FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- RLS Policy: Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.resident_documents;
CREATE POLICY "Users can delete their own documents" ON public.resident_documents
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- RLS Policy: Admin/Staff can manage all documents
DROP POLICY IF EXISTS "Admin can manage all documents" ON public.resident_documents;
CREATE POLICY "Admin can manage all documents" ON public.resident_documents
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT DISTINCT id FROM profiles WHERE role IN ('admin', 'encoder', 'captain')
    )
  );

GRANT SELECT, INSERT, DELETE ON public.resident_documents TO authenticated;
GRANT ALL ON public.resident_documents TO service_role;
