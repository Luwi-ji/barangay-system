import { supabase } from '../lib/supabase'

/**
 * Check if an email already exists in the system (auth.users or profiles)
 * Uses RPC function that has elevated privileges to check auth.users
 */
export const checkEmailExists = async (email) => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim()
    
    // Try RPC function first (checks both auth.users and profiles)
    const { data: exists, error: rpcError } = await supabase
      .rpc('check_email_exists', { p_email: normalizedEmail })
    
    if (rpcError) {
      console.warn('RPC check_email_exists not available:', rpcError.message)
      // Fallback: check profiles table only
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()
      
      return !!profile
    }
    
    return exists === true
  } catch (e) {
    console.warn('Error in checkEmailExists:', e)
    return false
  }
}

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
  try {
    const REDIRECT_BASE = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${REDIRECT_BASE}/auth/callback`
      }
    })

    if (error) throw error

    return {
      success: true,
      message: 'Redirecting to Google...'
    }
  } catch (error) {
    console.error('Google sign in error:', error)
    return {
      success: false,
      error: error.message || 'Failed to sign in with Google'
    }
  }
}

/**
 * Handle OAuth callback and create/update profile
 */
export const handleOAuthCallback = async () => {
  try {
    // First, check URL hash/query for auth errors (e.g., otp_expired)
    const rawHash = window.location.hash || ''
    const rawQuery = window.location.search || ''
    const params = new URLSearchParams((rawHash.startsWith('#') ? rawHash.slice(1) : rawHash) || rawQuery)
    if (params.get('error')) {
      const code = params.get('error_code') || ''
      const desc = params.get('error_description') || params.get('error') || 'Authentication error'
      return {
        success: false,
        error: decodeURIComponent(desc.replace(/\+/g, ' ')) || `Auth error${code ? `: ${code}` : ''}`
      }
    }

    // Try to parse a session from the URL (this handles magic-link / provider redirects)
    const { data: fromUrlData, error: fromUrlError } = await supabase.auth.getSessionFromUrl({ storeSession: true })

    if (fromUrlError) {
      // If the URL parsing failed, fall back to checking any existing session
      console.warn('getSessionFromUrl error:', fromUrlError.message || fromUrlError)
    }

    const session = fromUrlData?.session || (await (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    })())

    if (!session) {
      return { success: false, error: 'No session found. Please sign in.' }
    }

    const user = session.user
    const userEmail = (user.email || '').toLowerCase().trim()
    const userFullName = user.user_metadata?.full_name || user.email.split('@')[0]

    // Check if user's email is confirmed (Google OAuth users are typically auto-confirmed)
    const isConfirmed = !!(user?.email_confirmed_at || user?.confirmed_at)

    if (!isConfirmed) {
      // Sign out the session to prevent access until confirmation
      try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
      return {
        success: false,
        error: 'Please confirm your email before continuing.'
      }
    }

    // Check if this email is already used by a DIFFERENT user (profile with different id)
    // This catches cases where someone tries to use Google OAuth with an email 
    // that was already registered via email/password
    try {
      const { data: profileByEmail, error: profileByEmailErr } = await supabase
        .from('profiles')
        .select('id,email')
        .eq('email', userEmail)
        .maybeSingle()

      if (profileByEmailErr && profileByEmailErr.code !== '42501') {
        console.warn('profiles email lookup error:', profileByEmailErr)
      }

      // If a profile exists with this email but belongs to a different auth user
      if (profileByEmail && profileByEmail.id !== user.id) {
        try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
        return {
          success: false,
          error: 'This email is already registered with another account. Please sign in using your original method or reset your password.'
        }
      }
    } catch (e) {
      console.warn('Error checking profile by email:', e)
    }

    // Check if profile exists for this user
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()  // Use maybeSingle to avoid PGRST116 error when no rows

    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('Profile check error:', checkError)
      // Don't throw - the trigger may create the profile
    }

    // If profile doesn't exist, try to create it
    // The database trigger should have created it, but we create as fallback
    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: userEmail,
          full_name: userFullName,
          address: '',
          mobile: '',
          birth_date: null,
          role: 'resident',
          created_at: new Date().toISOString()
        })

      // 23505 = unique violation (profile already exists - race condition with trigger)
      // 42501 = RLS violation (will be fixed after running SQL script)
      if (profileError) {
        if (profileError.code === '23505') {
          // Profile was created by trigger, this is fine
          console.log('Profile already exists (created by trigger)')
        } else if (profileError.code === '42501') {
          // RLS issue - instruct user to run the fix script
          console.error('RLS policy blocking profile creation. Run FIX_RLS_AUTH_USERS.sql in Supabase.')
          return {
            success: false,
            error: 'Account setup incomplete. Please contact support or try again later.'
          }
        } else {
          console.error('Profile creation error:', profileError)
          return {
            success: false,
            error: 'Failed to set up your account. Please try again.'
          }
        }
      }
    } else {
      // Update existing profile with latest email/name (in case they changed)
      await supabase
        .from('profiles')
        .update({
          email: userEmail,
          full_name: userFullName
        })
        .eq('id', user.id)
    }

    return {
      success: true,
      user: user,
      message: 'Signed in successfully'
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    return {
      success: false,
      error: error.message || 'Failed to process sign in'
    }
  }
}

/**
 * Sign up a new resident with their profile information
 */
export const signUpResident = async (email, password, fullName, address, mobile, birthDate) => {
  try {
    // Normalize email
    const normalizedEmail = (email || '').toLowerCase().trim()

    // Check if email already exists using RPC function (checks both auth.users and profiles)
    try {
      const { data: emailExists, error: rpcError } = await supabase
        .rpc('check_email_exists', { p_email: normalizedEmail })

      if (rpcError) {
        console.warn('RPC check_email_exists error:', rpcError)
        // Fallback to profiles check if RPC fails
        const { data: existingByEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (existingByEmail) {
          return {
            success: false,
            error: 'This email is already registered. Please sign in or reset your password.'
          }
        }
      } else if (emailExists === true) {
        return {
          success: false,
          error: 'This email is already registered. Please sign in or reset your password.'
        }
      }
    } catch (e) {
      console.warn('Error checking existing email:', e)
    }

    // Step 1: Create auth user
    const REDIRECT_BASE = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          address: address,
          mobile: mobile,
          birth_date: birthDate
        },
        redirectTo: `${REDIRECT_BASE}/auth/callback`
      }
    })

    if (authError) {
      const msg = (authError.message || '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('user already exists') || authError.status === 400) {
        return { success: false, error: 'Email is already registered. Try signing in or resetting your password.' }
      }
      throw authError
    }
    // Do NOT create profile client-side yet. The database trigger will create
    // the profile after the user confirms their email. Creating profiles
    // before confirmation allows unverified/fake emails to create accounts.

    return {
      success: true,
      user: authData.user,
      message: 'Registration successful! Please check your email for verification.'
    }
  } catch (error) {
    console.error('Sign up error:', error)
    return {
      success: false,
      error: error.message || 'Failed to register'
    }
  }
}

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    // Ensure the user's email is confirmed before allowing sign in to proceed
    const isConfirmed = !!(data.user?.email_confirmed_at || data.user?.confirmed_at)
    if (!isConfirmed) {
      // Sign the user out to clear any session
      try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
      return {
        success: false,
        error: 'Please confirm your email before signing in.'
      }
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
    }

    return {
      success: true,
      user: data.user,
      profile: profile
    }
  } catch (error) {
    console.error('Sign in error:', error)
    return {
      success: false,
      error: error.message || 'Failed to sign in'
    }
  }
}

/**
 * Resend confirmation email for unverified users
 */
export const resendConfirmationEmail = async (email) => {
  try {
    const REDIRECT_BASE = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${REDIRECT_BASE}/auth/callback`
      }
    })

    if (error) throw error

    return {
      success: true,
      message: 'Confirmation email sent! Please check your inbox.'
    }
  } catch (error) {
    console.error('Resend confirmation error:', error)
    return {
      success: false,
      error: error.message || 'Failed to resend confirmation email'
    }
  }
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email) => {
  try {
    const REDIRECT_BASE = import.meta.env.VITE_SITE_URL || window.location.origin
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${REDIRECT_BASE}/reset-password`
    })

    if (error) throw error

    return {
      success: true,
      message: 'Password reset email sent! Please check your inbox.'
    }
  } catch (error) {
    console.error('Password reset error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send reset email'
    }
  }
}

/**
 * Reset password with token
 */
export const resetPassword = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error

    return {
      success: true,
      message: 'Password updated successfully!'
    }
  } catch (error) {
    console.error('Password update error:', error)
    return {
      success: false,
      error: error.message || 'Failed to update password'
    }
  }
}

/**
 * Get current user profile
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error

    return {
      success: true,
      profile: data
    }
  } catch (error) {
    console.error('Profile fetch error:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch profile'
    }
  }
}

/**
 * Update user profile (email, full_name, address, mobile, birth_date)
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()

    if (error) throw error

    // If email is being updated, also update auth user
    if (updates.email) {
      const { error: authError } = await supabase.auth.updateUser({
        email: updates.email
      })

      if (authError) {
        console.error('Email update error:', authError)
        // Revert profile email change if auth update fails
        await supabase
          .from('profiles')
          .update({ email: data[0].email })
          .eq('id', userId)
        throw authError
      }
    }

    return {
      success: true,
      profile: data[0]
    }
  } catch (error) {
    console.error('Profile update error:', error)
    return {
      success: false,
      error: error.message || 'Failed to update profile'
    }
  }
}

/**
 * Sign out current user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    return {
      success: true,
      message: 'Signed out successfully'
    }
  } catch (error) {
    console.error('Sign out error:', error)
    return {
      success: false,
      error: error.message || 'Failed to sign out'
    }
  }
}

/**
 * Get current session
 */
export const getCurrentSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) throw error

    return {
      success: true,
      session: data.session
    }
  } catch (error) {
    console.error('Session fetch error:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch session'
    }
  }
}

/**
 * Subscribe to auth state changes
 */
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })

  return subscription
}
