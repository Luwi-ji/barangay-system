# Complete Supabase Integration Guide

## Overview

This guide covers the complete implementation of email authentication with profile management, password reset, and email change functionality for the Barangay System.

## Features Implemented

### 1. **User Registration with Profile Creation**
- Users register with email, password, and personal information
- Profile is automatically created in the `profiles` table with all provided data
- User data persists and is fetched on login

### 2. **Email Authentication**
- Email/password sign-up and sign-in
- Email verification (Supabase handles this)
- Session management with automatic refresh

### 3. **Forgot Password / Password Reset**
- Users can request password reset via email
- Email includes a reset link
- Password can be reset from the reset page
- Automatic redirect after successful reset

### 4. **Profile Management**
- View full profile information
- Edit profile (name, email, address, mobile, birth date)
- Change email address with verification
- Only residents can edit their own profiles

## Database Schema Required

### `profiles` Table

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  address TEXT,
  mobile VARCHAR(20),
  birth_date DATE,
  role VARCHAR(50) DEFAULT 'resident',
  gender VARCHAR(20),
  civil_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Optional: Auto-Create Profile Trigger

If you want profiles to auto-create on signup (backup to manual creation):

```sql
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'resident',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_user();
```

## Environment Variables

Add these to your `.env.local` file locally and to Vercel:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_STRIPE_PUBLIC_KEY=your-stripe-key-here (if using payments)
```

## Supabase Configuration

### 1. Email Settings
- Go to Supabase Dashboard → Project Settings → Auth → Email Templates
- Configure email templates for:
  - Confirmation email
  - Password reset email
  - Email change confirmation

### 2. Email Provider
- Supabase uses Auth0 email service by default
- For production, configure a custom email provider (SMTP)
- Or use Supabase's built-in email service

### 3. Password Reset Configuration
- Set up email template in Supabase dashboard
- The reset link will redirect to: `your-domain.com/reset-password`
- Make sure the domain is whitelisted in Supabase settings

### 4. Authorized URLs
In Supabase Dashboard → Project Settings → Auth → URL Configuration:

```
Site URL: https://your-domain.com
Additional Redirect URLs:
  https://your-domain.com/reset-password
  https://your-domain.com/
  https://your-domain.com/dashboard
  https://your-domain.com/admin
```

## Components & Services

### Auth Service (`src/services/authService.js`)

Main authentication service with these functions:

```javascript
signUpResident(email, password, fullName, address, mobile, birthDate)
signIn(email, password)
sendPasswordResetEmail(email)
resetPassword(newPassword)
updateUserProfile(userId, updates)
signOut()
getCurrentSession()
getUserProfile(userId)
onAuthStateChange(callback)
```

### Components

1. **Login.jsx** (`/login`)
   - Email/password sign-in
   - Link to forgot password
   - Link to registration

2. **Register.jsx** (`/register`)
   - Email/password registration
   - Personal information form
   - Auto-creates profile
   - Link to login

3. **ForgotPassword.jsx** (`/forgot-password`)
   - Email input
   - Sends reset link
   - Redirects to login after

4. **ResetPassword.jsx** (`/reset-password`)
   - Validates reset token
   - New password form
   - Updates password securely

5. **EditProfile.jsx** (`/edit-profile`)
   - Edit all profile fields
   - Change email (with verification)
   - For residents only

6. **UserProfile.jsx** (`/profile`)
   - View profile (all users)
   - Edit button (residents only)
   - Display role-based info

## Authentication Flow

### Registration
```
Register Form → Auth Service → Create Auth User
                              → Create Profile Record
                              → Confirmation Email
                              → Redirect to Login
```

### Login
```
Login Form → Auth Service → Authenticate
                          → Fetch Profile
                          → Check Role
                          → Redirect (Admin/Resident)
```

### Password Reset
```
Forgot Password → Auth Service → Send Reset Email
                              → User clicks link
                              → Reset Password Form
                              → Auth Service → Update Password
                              → Redirect to Login
```

### Profile Edit
```
Edit Profile → Form → Auth Service → Update Profile
                                    → Update Auth Email (if changed)
                                    → Email Verification (if changed)
                                    → Redirect to Profile
```

## Testing

### Local Testing

1. Start dev server: `npm run dev`
2. Register new user at `/register`
3. Verify email (check browser console for confirmation link)
4. Login at `/login`
5. View profile at `/profile`
6. Edit profile at `/edit-profile`
7. Test password reset at `/forgot-password`

### Email Testing
- In development, check Supabase dashboard → Auth → Users
- Look for "User signup confirm" and other emails in the logs
- Supabase provides test emails automatically

## Supabase Dashboard Features to Use

1. **Users Management**
   - View all registered users
   - Manually confirm emails
   - Reset user passwords
   - Delete users if needed

2. **SQL Editor**
   - Run provided SQL scripts
   - Create/modify tables
   - Set up RLS policies

3. **Auth Logs**
   - Monitor signup/login events
   - Track authentication errors
   - Debug issues

## Troubleshooting

### Profile Not Created
- Check if trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_schema = 'auth'`
- Verify RLS policies allow insertion
- Check Auth Service creates profile manually (it does!)

### Email Not Sending
- Check Supabase email provider settings
- Verify email templates are configured
- Test with Supabase provided test emails
- Check spam folder

### Reset Link Not Working
- Verify redirect URL in Supabase settings
- Check that `/reset-password` route exists
- Ensure link includes `type=recovery` in hash

### Can't Login After Registration
- Confirm user email verification (not always required)
- Check profile exists in database
- Verify RLS policies allow profile selection

## Security Notes

1. **Password Requirements**
   - Minimum 6 characters (enforced in app)
   - Supabase handles secure hashing
   - Never log or store passwords

2. **Email Changes**
   - Requires new email verification
   - Old email gets notification
   - Updates both auth and profile

3. **Session Management**
   - Supabase manages JWT tokens
   - Automatic token refresh
   - Secure HttpOnly cookies option available

4. **RLS Policies**
   - Users can only view/edit their own profile
   - Implemented in database
   - Enforced on all queries

## Next Steps

1. Implement password change functionality
2. Add two-factor authentication (2FA)
3. Add social login (Google, Facebook, etc.)
4. Implement role-based access control (RBAC) enhancements
5. Add activity logging
