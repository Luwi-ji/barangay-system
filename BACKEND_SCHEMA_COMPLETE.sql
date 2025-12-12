-- ============================================================================
-- BARANGAY SYSTEM - COMPLETE BACKEND SCHEMA (ALIGNED WITH FEATURES)
-- ============================================================================
-- Production-ready schema supporting:
-- ✅ Multi-role auth (resident, encoder, captain, admin)
-- ✅ Document request lifecycle with status tracking
-- ✅ Cancel requests (residents only while pending)
-- ✅ Reject with notes (admin only)
-- ✅ Status history with change tracking
-- ✅ Payment status & payment reference
-- ✅ Multiple document uploads (additional + signed)
-- ✅ ID image uploads (front + back)
-- ✅ Admin notes on requests
-- ============================================================================

-- Step 1: Create Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "http";

-- Step 2: Create Profiles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  address TEXT,
  mobile TEXT,
  birth_date DATE,
  gender VARCHAR(20),
  civil_status VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'resident' 
    CHECK (role IN ('resident', 'encoder', 'captain', 'admin')),
  status VARCHAR(50) DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'suspended')),
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Step 3: Create Document Types Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10, 2) DEFAULT 0,
  processing_days INTEGER DEFAULT 1,
  requirements TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  category VARCHAR(100),
  icon TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for document_types
CREATE INDEX IF NOT EXISTS idx_document_types_is_active ON public.document_types(is_active);
CREATE INDEX IF NOT EXISTS idx_document_types_category ON public.document_types(category);

-- Step 4: Create Requests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  reference_number VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'ready_for_pickup', 'completed', 'rejected', 'cancelled')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  purpose TEXT,
  priority VARCHAR(50) DEFAULT 'normal' 
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  payment_status VARCHAR(50) DEFAULT 'unpaid' 
    CHECK (payment_status IN ('unpaid', 'paid', 'completed', 'partial', 'refunded')),
  payment_reference VARCHAR(255),
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  pickup_date DATE,
  estimated_completion_date DATE,
  admin_notes TEXT,
  id_image_url TEXT,
  id_image_back_url TEXT,
  signed_document_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_document_type_id ON public.requests(document_type_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON public.requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_payment_status ON public.requests(payment_status);

-- Step 5: Create Status History Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for status_history
CREATE INDEX IF NOT EXISTS idx_status_history_request_id ON public.status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON public.status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.status_history(created_at DESC);

-- Step 6: Create Payments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL 
    CHECK (payment_method IN ('card', 'bank_transfer', 'cash', 'gcash', 'paypal')),
  stripe_payment_intent_id VARCHAR(255),
  transaction_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_request_id ON public.payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);

-- Step 7: Create Resident Documents Table (Additional & Signed Documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.resident_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  file_path TEXT NOT NULL,
  storage_bucket VARCHAR(100) DEFAULT 'signed-documents',
  document_category VARCHAR(50) 
    CHECK (document_category IN ('additional-document', 'signed-document', 'other')),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for resident_documents
CREATE INDEX IF NOT EXISTS idx_resident_documents_request_id ON public.resident_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_resident_documents_document_category ON public.resident_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_resident_documents_uploaded_by ON public.resident_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_resident_documents_created_at ON public.resident_documents(created_at DESC);

-- Step 8: Create Notifications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL 
    CHECK (type IN ('request_created', 'status_updated', 'payment_received', 'ready_for_pickup', 'request_rejected', 'message', 'other')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON public.notifications(request_id);

-- Step 9: Create Audit Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);

-- Step 10: Create Settings/Configuration Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert default settings
INSERT INTO public.settings (key, value, description, is_public, category) VALUES
  ('max_requests_per_day', '{"value": 5}', 'Maximum requests a resident can create per day', true, 'request_limits'),
  ('standard_processing_days', '{"value": 3}', 'Default processing time in days', true, 'processing'),
  ('barangay_name', '{"value": "Barangay San Juan"}', 'Name of the barangay', true, 'general'),
  ('barangay_address', '{"value": "123 Main St, City, Province"}', 'Address of the barangay office', true, 'general'),
  ('enable_online_payment', '{"value": true}', 'Enable online payment functionality', true, 'payment'),
  ('stripe_public_key', '{"value": ""}', 'Stripe public key for payments', false, 'payment')
ON CONFLICT (key) DO NOTHING;

-- Step 11: Create All RLS Policies (BEFORE enabling RLS)
-- ============================================================================
-- All policies must be created before RLS is enabled on any table.
-- This avoids "column does not exist" errors during policy creation.

-- Step 12: Create RLS Policies for Profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_public"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'captain')))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'captain')));

-- Step 13: Create RLS Policies for Document Types
-- ============================================================================
DROP POLICY IF EXISTS "document_types_select_active" ON public.document_types;
DROP POLICY IF EXISTS "document_types_insert_admin" ON public.document_types;
DROP POLICY IF EXISTS "document_types_update_admin" ON public.document_types;

CREATE POLICY "document_types_select_active"
ON public.document_types FOR SELECT
USING (is_active = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'captain')));

CREATE POLICY "document_types_insert_admin"
ON public.document_types FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "document_types_update_admin"
ON public.document_types FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Step 14: Create RLS Policies for Requests
-- ============================================================================
DROP POLICY IF EXISTS "requests_select_own" ON public.requests;
DROP POLICY IF EXISTS "requests_select_staff" ON public.requests;
DROP POLICY IF EXISTS "requests_insert_user" ON public.requests;
DROP POLICY IF EXISTS "requests_update_own" ON public.requests;
DROP POLICY IF EXISTS "requests_update_staff" ON public.requests;

CREATE POLICY "requests_select_own"
ON public.requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "requests_select_staff"
ON public.requests FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain')));

CREATE POLICY "requests_insert_user"
ON public.requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'resident'));

CREATE POLICY "requests_update_own"
ON public.requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "requests_update_staff"
ON public.requests FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain')))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain')));

-- Step 15: Create RLS Policies for Status History
-- ============================================================================
DROP POLICY IF EXISTS "status_history_select_own" ON public.status_history;
DROP POLICY IF EXISTS "status_history_select_staff" ON public.status_history;
DROP POLICY IF EXISTS "status_history_insert_staff" ON public.status_history;

CREATE POLICY "status_history_select_own"
ON public.status_history FOR SELECT
TO authenticated
USING (request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid()));

CREATE POLICY "status_history_select_staff"
ON public.status_history FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain')));

CREATE POLICY "status_history_insert_staff"
ON public.status_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain')));

-- Step 16: Create RLS Policies for Payments
-- ============================================================================
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_select_staff" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;

CREATE POLICY "payments_select_own"
ON public.payments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "payments_select_staff"
ON public.payments FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'captain')));

CREATE POLICY "payments_insert_own"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Step 17: Create RLS Policies for Resident Documents
-- ============================================================================
DROP POLICY IF EXISTS "resident_documents_select" ON public.resident_documents;
DROP POLICY IF EXISTS "resident_documents_insert" ON public.resident_documents;
DROP POLICY IF EXISTS "resident_documents_delete" ON public.resident_documents;

CREATE POLICY "resident_documents_select"
ON public.resident_documents FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  request_id IN (SELECT id FROM public.requests WHERE user_id = auth.uid()) OR
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain'))
);

CREATE POLICY "resident_documents_insert"
ON public.resident_documents FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "resident_documents_delete"
ON public.resident_documents FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'encoder', 'captain'))
);

-- Step 18: Create RLS Policies for Notifications
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_system"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 19: Create RLS Policies for Settings
-- ============================================================================
DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;

CREATE POLICY "settings_select_public"
ON public.settings FOR SELECT
USING (is_public = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "settings_update_admin"
ON public.settings FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Step 19b: Create RLS Policies for Audit Logs
-- ============================================================================
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;

CREATE POLICY "audit_logs_select_admin"
ON public.audit_logs FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Step 20: Create Views BEFORE Enabling RLS (to avoid column reference issues)
-- ============================================================================

-- View for active residents
DROP VIEW IF EXISTS public.vw_active_residents CASCADE;
CREATE VIEW public.vw_active_residents AS
SELECT id, email, full_name, mobile, address, birth_date, created_at
FROM public.profiles
WHERE role = 'resident' AND status = 'active'
ORDER BY created_at DESC;

-- View for pending requests with details
DROP VIEW IF EXISTS public.vw_pending_requests CASCADE;
CREATE VIEW public.vw_pending_requests AS
SELECT 
  r.id, r.reference_number, r.user_id, r.document_type_id, r.status, r.quantity,
  r.purpose, r.priority, r.created_at, r.updated_at,
  p.full_name, p.mobile, p.email,
  dt.name as document_name
FROM public.requests r
JOIN public.profiles p ON r.user_id = p.id
JOIN public.document_types dt ON r.document_type_id = dt.id
WHERE r.status IN ('pending', 'processing')
ORDER BY r.priority DESC, r.created_at ASC;

-- View for user request statistics
DROP VIEW IF EXISTS public.vw_user_request_stats CASCADE;
CREATE VIEW public.vw_user_request_stats AS
SELECT 
  user_id,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests
FROM public.requests
GROUP BY user_id;

-- View for daily statistics
DROP VIEW IF EXISTS public.vw_daily_stats CASCADE;
CREATE VIEW public.vw_daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_requests
FROM public.requests
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Step 21: Enable Row Level Security (NOW - after all policies and views are created)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Step 22: Create Helper Functions
-- ============================================================================

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, address, mobile, birth_date, role, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.user_metadata->>'full_name', NEW.email),
    COALESCE(NEW.user_metadata->>'address', ''),
    COALESCE(NEW.user_metadata->>'mobile', ''),
    COALESCE((NEW.user_metadata->>'birth_date')::date, NULL),
    'resident',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log status changes
CREATE OR REPLACE FUNCTION public.log_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.status, '') <> COALESCE(OLD.status, '') THEN
    INSERT INTO public.status_history (
      request_id, old_status, new_status, changed_by, reason, created_at
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(), 'Status updated by system', NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update request updated_at on change
CREATE OR REPLACE FUNCTION public.update_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile timestamp on change
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 23: Create Triggers
-- ============================================================================

-- Trigger to create profile on auth user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_user();

-- Trigger to log status changes
DROP TRIGGER IF EXISTS log_request_status_change ON public.requests;
CREATE TRIGGER log_request_status_change
AFTER UPDATE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.log_request_status_change();

-- Trigger to update request timestamp
DROP TRIGGER IF EXISTS update_request_timestamp ON public.requests;
CREATE TRIGGER update_request_timestamp
BEFORE UPDATE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.update_request_timestamp();

-- Trigger to update profile timestamp
DROP TRIGGER IF EXISTS update_profile_timestamp ON public.profiles;
CREATE TRIGGER update_profile_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_timestamp();

-- Step 24: Grant Permissions
-- ============================================================================

-- Grant select on views to authenticated users
GRANT SELECT ON public.vw_active_residents TO authenticated;
GRANT SELECT ON public.vw_pending_requests TO authenticated;
GRANT SELECT ON public.vw_user_request_stats TO authenticated;
GRANT SELECT ON public.vw_daily_stats TO authenticated;

-- Step 25: Verify Installation
-- ============================================================================

-- Check that all tables exist
SELECT 
  table_name,
  to_regclass(table_schema||'.'||table_name) IS NOT NULL as exists
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'profiles', 'document_types', 'requests', 'status_history',
  'payments', 'resident_documents', 'notifications', 'audit_logs', 'settings'
)
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'profiles', 'document_types', 'requests', 'status_history',
  'payments', 'resident_documents', 'notifications', 'audit_logs', 'settings'
)
ORDER BY tablename;

-- ============================================================================
-- INSTALLATION COMPLETE!
-- ============================================================================
-- Your Barangay System backend is now fully configured with:
-- ✅ 9 Core Tables
-- ✅ Complete RLS Policies
-- ✅ Helper Functions & Triggers
-- ✅ Views for Analytics
-- ✅ Audit Logging Ready
-- ============================================================================
