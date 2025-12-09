# Fix Registration and Login Issues - Complete Solution

## Problems
1. Registration says "success" but then login says "Invalid login credentials" even with correct password
2. Profile is not being created during registration even though RLS is disabled
3. 401 errors when trying to insert profile

## Root Cause
The profile insertion is failing at the database level. This can happen because:
- The authenticated user session isn't fully established when we try to insert
- There might still be RLS policies interfering
- The profile needs to exist before login can work

## Solution: Use Database Trigger

The most reliable solution is to create a **database trigger** that automatically creates a profile when a user signs up.

### Step 1: Run the Trigger SQL

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **+ New Query**
3. Copy the entire content from `CREATE_PROFILE_TRIGGER.sql`
4. Click **Run**

This creates an automatic trigger that will:
- Listen for new users being created in `auth.users`
- Automatically insert a profile for that user in `profiles` table
- Ensure the profile always exists when the user tries to login

### Step 2: Test Registration Again

1. Clear browser cache/cookies
2. Go to Register page
3. Fill in the form:
   - Full Name: Test User
   - Email: testuser@example.com
   - Mobile: 09123456789
   - Address: Test Address
   - Birth Date: 01/01/1990
   - Password: Password123
   - Confirm Password: Password123
4. Click "Create Account"
5. You should see "Registration successful!"

### Step 3: Test Login

1. Go to Login page
2. Enter:
   - Email: testuser@example.com
   - Password: Password123
3. Click "Sign In"
4. You should be logged in successfully

## How It Works

```
Old Flow (broken):
1. User clicks Register
2. Auth user created in auth.users
3. App tries to insert profile ← FAILS (401)
4. Profile doesn't exist
5. User tries to login
6. Login fails because profile missing

New Flow (with trigger):
1. User clicks Register
2. Auth user created in auth.users
3. Database trigger fires automatically
4. Profile is created by trigger ← SUCCESS
5. App tries to insert profile (optional, can fail safely)
6. User tries to login
7. Login succeeds because profile exists ← SUCCESS
```

## Verification

To verify the trigger is working:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query:
```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- This should show: on_auth_user_created
```

3. Check if a profile was created:
```sql
-- After registering a user, check if profile exists
SELECT id, email, full_name, role, created_at FROM public.profiles;
```

## If It Still Doesn't Work

### Option 1: Delete old test users and try fresh
```sql
-- Delete the test auth user (use the ID from Supabase Auth panel)
DELETE FROM auth.users WHERE email = 'testuser@example.com';

-- Delete corresponding profile
DELETE FROM public.profiles WHERE email = 'testuser@example.com';
```

Then try registering again with the trigger in place.

### Option 2: Check if RLS is completely off
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
-- Should show: rowsecurity = false
```

If it shows `true`, run DISABLE_PROFILES_RLS.sql again.

### Option 3: Check profiles table structure
```sql
-- Verify profiles table exists and has right columns
\d public.profiles
```

Should have columns: `id`, `email`, `full_name`, `address`, `mobile`, `birth_date`, `role`, `created_at`

## Best Practices Going Forward

With this trigger in place:
- ✅ Profiles are created automatically
- ✅ No manual profile insertion needed
- ✅ Login always works if user is authenticated
- ✅ Registration is robust and handles failures gracefully
