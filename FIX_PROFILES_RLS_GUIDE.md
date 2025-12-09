# Fix Profiles RLS Policy for Registration - Comprehensive Guide

## Problem
When registering a new account, you get a 401 Unauthorized error:
```
POST https://iikwlhjgzydxpprnipgm.supabase.co/rest/v1/profiles 401 (Unauthorized)
```

This means the RLS policy is blocking the INSERT operation.

## Root Causes

1. **RLS policy is too restrictive** - The policy might not be allowing new users to insert their profile
2. **Conflicting policies** - Multiple policies might be blocking the insert
3. **Auth state issue** - The user's auth ID might not be set correctly during registration

## Solution Options

### Option 1: Quick Fix - Disable RLS on Profiles Table (Development)

If you're having trouble with the policies, the quickest solution is to disable RLS on the profiles table:

**Steps:**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Copy and paste from `DISABLE_PROFILES_RLS.sql`
4. Click **Run**
5. Test registration again

**Pros:** Simple, works immediately  
**Cons:** Reduces security, not recommended for production

---

### Option 2: Fix RLS Policies (Recommended)

If you want proper security with RLS enabled:

**Steps:**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Copy and paste the entire content from `FIX_PROFILES_RLS.sql`
4. Click **Run**
5. Test registration again

**What it does:**
- Drops all conflicting policies
- Creates a simple INSERT policy: `id = auth.uid()`
- Creates an UPDATE policy for users to edit their own profile
- Creates a DELETE policy for users to delete their own profile
- Allows admins to update any profile

---

### Option 3: Manual Policy Check and Fix

If you want to understand what's happening:

**Step 1: Check current RLS status**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
```

Should show `rowsecurity = true`

**Step 2: List all existing policies**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;
```

**Step 3: If you see multiple or conflicting policies, drop them all**
```sql
DROP POLICY IF EXISTS "policy_name_here" ON public.profiles;
```

Repeat for each policy shown in Step 2.

**Step 4: Create the INSERT policy**
```sql
CREATE POLICY "Authenticated users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
```

---

## Testing

After applying one of the solutions:

1. Open your app in a new browser tab
2. Go to Register page
3. Fill in the form with:
   - Full Name: Test User
   - Email: testuser@example.com
   - Mobile: 09123456789
   - Address: Test Address
   - Birth Date: 01/01/1990
   - Password: Password123
   - Confirm Password: Password123
4. Click "Create Account"
5. You should see: "Registration successful! Please check your email for verification."

If you still get 401 error, try Option 1 (Disable RLS) to confirm the issue is with RLS.

---

## Why Registration Fails with Strict RLS

When a user registers:
1. ✅ Auth user is created with ID (e.g., `abc123`)
2. ❌ App tries to INSERT into profiles table with `id: abc123`
3. ❌ RLS policy checks: Does `id = auth.uid()`?
4. ❌ If policy is wrong, INSERT is blocked → 401 error

The fix ensures the RLS policy allows this INSERT operation.

---

## Production Recommendation

For production, use Option 2 (proper RLS policies) with these policies:

| Operation | Who | Can Do It | Rule |
|-----------|-----|----------|------|
| SELECT | Authenticated | Yes | Can view all profiles |
| INSERT | Authenticated | Only own profile | `id = auth.uid()` |
| UPDATE | Authenticated | Only own profile | `id = auth.uid()` |
| UPDATE | Admin | Any profile | If user role = 'admin' |
| DELETE | Authenticated | Only own profile | `id = auth.uid()` |

This provides security while allowing registration to work.

