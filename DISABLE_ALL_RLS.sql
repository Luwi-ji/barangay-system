-- Disable RLS on all tables to allow the app to function
-- This is for development - in production you'd want proper RLS policies

-- Disable RLS on profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on requests table  
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;

-- Disable RLS on document_types table
ALTER TABLE public.document_types DISABLE ROW LEVEL SECURITY;

-- Disable RLS on status_history table (if it exists)
ALTER TABLE IF EXISTS public.status_history DISABLE ROW LEVEL SECURITY;

-- Disable RLS on resident_documents table (if it exists)
ALTER TABLE IF EXISTS public.resident_documents DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'requests', 'document_types', 'status_history', 'resident_documents')
ORDER BY tablename;
