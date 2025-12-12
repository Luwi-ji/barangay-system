import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Auth components
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import AuthCallback from './components/auth/AuthCallback'

// User components
import Dashboard from './components/user/Dashboard'
import NewRequest from './components/user/NewRequest'
import RequestHistory from './components/user/RequestHistory'
import UserProfile from './components/user/UserProfile'
import EditProfile from './components/user/EditProfile'

// Payment components
import CheckoutPage from './components/payment/CheckoutPage'

// Admin components
import AdminDashboard from './components/admin/AdminDashboard'
import RequestManagement from './components/admin/RequestManagement'
import Analytics from './components/admin/Analytics'
import Settings from './components/admin/Settings'

import LoadingSpinner from './components/shared/LoadingSpinner'

function App() {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize auth - Supabase v2 automatically handles URL tokens via getSession()
    const initAuth = async () => {
      try {
        // getSession() in v2 automatically parses tokens from URL hash if present
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.warn('getSession error:', error)
        }
        
        setSession(session)
        if (session) {
          await fetchUserProfile(session.user.id)
        }
        
        // Clean the URL hash/query to remove tokens if present
        const rawHash = window.location.hash || ''
        if (rawHash.includes('access_token') || rawHash.includes('error')) {
          try { 
            window.history.replaceState({}, document.title, window.location.pathname) 
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.error('Error initializing auth:', e)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()  // Use maybeSingle to avoid error when no profile exists yet

      if (error) {
        // Only log actual errors, not "no rows" which maybeSingle handles
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error)
        }
        setUserProfile(null)
      } else if (data) {
        setUserProfile(data)
      } else {
        // Profile doesn't exist yet - try to create it as a fallback
        // This handles cases where the trigger didn't fire or wasn't set up
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.email_confirmed_at) {
          const metadata = user.user_metadata || {}
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: (user.email || '').toLowerCase(),
              full_name: metadata.full_name || user.email?.split('@')[0] || 'User',
              mobile: metadata.mobile || '',
              address: metadata.address || '',
              birth_date: metadata.birth_date || null,
              role: 'resident',
              status: 'active'
            })
            .select()
            .maybeSingle()

          if (insertError) {
            // Profile might have been created by trigger in the meantime, try fetching again
            const { data: retryData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle()
            setUserProfile(retryData)
          } else {
            setUserProfile(newProfile)
          }
        } else {
          setUserProfile(null)
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }

  // Helper functions
  const isStaff = (role) => ['admin', 'encoder', 'captain'].includes(role)
  const isAdminOrCaptain = (role) => ['admin', 'captain'].includes(role)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            !session 
              ? <Login /> 
              : isStaff(userProfile?.role) 
              ? <Navigate to="/admin" /> 
              : <Navigate to="/dashboard" />
          } 
        />
        <Route 
          path="/register" 
          element={
            !session 
              ? <Register /> 
              : isStaff(userProfile?.role) 
              ? <Navigate to="/admin" /> 
              : <Navigate to="/dashboard" />
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            !session 
              ? <ForgotPassword /> 
              : isStaff(userProfile?.role) 
              ? <Navigate to="/admin" /> 
              : <Navigate to="/dashboard" />
          } 
        />
        <Route 
          path="/reset-password" 
          element={<ResetPassword />} 
        />
        <Route 
          path="/auth/callback" 
          element={<AuthCallback />} 
        />

        {/* Protected user routes - ONLY for residents */}
        <Route 
          path="/dashboard" 
          element={
            !session 
              ? <Navigate to="/login" />
              : isStaff(userProfile?.role)
              ? <Navigate to="/admin" />
              : <Dashboard user={session.user} profile={userProfile} />
          } 
        />
        <Route 
          path="/new-request" 
          element={
            !session 
              ? <Navigate to="/login" />
              : isStaff(userProfile?.role)
              ? <Navigate to="/admin" />
              : <NewRequest user={session.user} profile={userProfile} />
          } 
        />
        <Route 
          path="/history" 
          element={
            !session 
              ? <Navigate to="/login" />
              : isStaff(userProfile?.role)
              ? <Navigate to="/admin" />
              : <RequestHistory user={session.user} profile={userProfile} />
          } 
        />

        {/* Payment routes */}
        <Route 
          path="/checkout" 
          element={
            !session 
              ? <Navigate to="/login" />
              : <CheckoutPage user={session.user} profile={userProfile} />
          } 
        />

        {/* Protected admin routes - For all staff */}
        <Route 
          path="/admin" 
          element={
            !session 
              ? <Navigate to="/login" />
              : !isStaff(userProfile?.role)
              ? <Navigate to="/dashboard" />
              : <AdminDashboard user={session.user} profile={userProfile} />
          } 
        />
        <Route 
          path="/admin/requests" 
          element={
            !session 
              ? <Navigate to="/login" />
              : !isStaff(userProfile?.role)
              ? <Navigate to="/dashboard" />
              : <RequestManagement user={session.user} profile={userProfile} />
          } 
        />
        
        {/* Analytics - Only for admin and captain */}
        <Route 
          path="/admin/analytics" 
          element={
            !session 
              ? <Navigate to="/login" />
              : !isStaff(userProfile?.role)
              ? <Navigate to="/dashboard" />
              : !isAdminOrCaptain(userProfile?.role)
              ? <Navigate to="/admin" />
              : <Analytics user={session.user} profile={userProfile} />
          } 
        />
        
        {/* Settings - Only for admin and captain */}
        <Route 
          path="/admin/settings" 
          element={
            !session 
              ? <Navigate to="/login" />
              : !isStaff(userProfile?.role)
              ? <Navigate to="/dashboard" />
              : !isAdminOrCaptain(userProfile?.role)
              ? <Navigate to="/admin" />
              : <Settings user={session.user} profile={userProfile} />
          } 
        />

        {/* User Profile - Accessible to all authenticated users */}
        <Route 
          path="/profile" 
          element={
            !session 
              ? <Navigate to="/login" />
              : <UserProfile user={session.user} profile={userProfile} />
          } 
        />
        <Route 
          path="/edit-profile" 
          element={
            !session 
              ? <Navigate to="/login" />
              : userProfile?.role !== 'resident'
              ? <Navigate to="/profile" />
              : <EditProfile user={session.user} profile={userProfile} />
          } 
        />

        {/* Default redirect based on role */}
        <Route 
          path="/" 
          element={
            !session 
              ? <Navigate to="/login" />
              : isStaff(userProfile?.role) 
              ? <Navigate to="/admin" /> 
              : <Navigate to="/dashboard" />
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App