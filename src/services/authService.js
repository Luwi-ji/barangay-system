import { supabase } from '../lib/supabase'

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) throw sessionError
    if (!session) {
      return {
        success: false,
        error: 'No session found'
      }
    }

    const user = session.user
    const userEmail = user.email
    const userFullName = user.user_metadata?.full_name || user.email.split('@')[0]

    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    // If profile doesn't exist, create it
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

      if (profileError && profileError.code !== '23505') {
        throw profileError
      }
    } else {
      // Update existing profile with latest email/name
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
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          address: address,
          mobile: mobile,
          birth_date: birthDate
        }
      }
    })

    if (authError) throw authError

    // Step 2: Create profile immediately (don't rely on trigger)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        address: address,
        mobile: mobile,
        birth_date: birthDate,
        role: 'resident',
        created_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't throw here, profile might exist already
    }

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
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email) => {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
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
