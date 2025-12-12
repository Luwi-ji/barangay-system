-- ============================================================================
-- BARANGAY SYSTEM - DATABASE RESET SCRIPT (Clean Version)
-- ============================================================================
-- This script clears all data while preserving the clean schema structure
-- Run this in Supabase SQL Editor to reset your database
-- ============================================================================

-- Step 1: Temporarily disable RLS to allow truncation
-- ============================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- Step 2: Clear all user-generated data (preserve system settings)
-- ============================================================================
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.request_documents CASCADE;
TRUNCATE TABLE public.payment_history CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.status_history CASCADE;
TRUNCATE TABLE public.requests CASCADE;

-- Clear profiles but keep document_types and settings
TRUNCATE TABLE public.profiles CASCADE;

-- Step 3: Re-enable RLS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Clean up orphaned storage files (optional)
-- ============================================================================
-- Uncomment and run separately if you want to clean up Supabase Storage
-- This removes files that are no longer referenced in the database

-- DELETE FROM storage.objects
-- WHERE bucket_id = 'documents'
-- AND name NOT IN (
--   SELECT DISTINCT id_image_url FROM public.requests WHERE id_image_url IS NOT NULL
--   UNION
--   SELECT DISTINCT id_image_back_url FROM public.requests WHERE id_image_back_url IS NOT NULL
--   UNION
--   SELECT DISTINCT signed_document_url FROM public.requests WHERE signed_document_url IS NOT NULL
--   UNION
--   SELECT DISTINCT file_path FROM public.request_documents WHERE file_path IS NOT NULL
-- );

-- ============================================================================
-- RESET COMPLETE
-- ============================================================================
-- Your database has been reset! Here's what happened:
--
-- ✅ Cleared all user data (requests, payments, documents, notifications)
-- ✅ Cleared all user profiles (but auth users remain)
-- ✅ Preserved document types and system settings
-- ✅ Preserved all database structure and security policies
--
-- Next steps:
-- 1. Users can still login with existing accounts
-- 2. New profiles will be auto-created on next login
-- 3. Create new requests to test the system
-- 4. Check that RLS policies work correctly
--
-- To restore sample data, run the sample data section from CLEAN_SCHEMA.sql
-- ============================================================================

SELECT 'Database reset completed successfully!' as status;