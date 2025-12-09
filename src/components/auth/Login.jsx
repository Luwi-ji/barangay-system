import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, LogIn } from 'lucide-react'
import { signIn, signInWithGoogle } from '../../services/authService'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')

 const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    const result = await signIn(formData.email, formData.password)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Check user profile for role
    if (result.profile?.role === 'resident') {
      navigate('/dashboard')
    } else {
      navigate('/admin')
    }
  } catch (error) {
    console.error('Sign in error:', error)
    setError(error.message || 'Failed to sign in')
  } finally {
    setLoading(false)
  }
}

const handleGoogleSignIn = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    const result = await signInWithGoogle()
    if (!result.success) {
      setError(result.error)
      setLoading(false)
    }
    // Google will redirect, so loading stays true
  } catch (error) {
    console.error('Google sign in error:', error)
    setError(error.message || 'Failed to sign in with Google')
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#9333ea' }}>
            <span className="text-white font-bold text-2xl">BRG</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your barangay account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-dark-800 text-white py-3 px-4 rounded-lg hover:bg-accent-600 focus:ring-4 focus:ring-accent-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <LogIn className="w-5 h-5" />
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{loading ? 'Signing in...' : 'Google'}</span>
          </button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/register" className="text-primary-700 hover:text-accent-600 font-medium">
              Register here
            </Link>
          </div>

          <div className="text-center text-sm">
            <Link to="/forgot-password" className="text-primary-700 hover:text-accent-600 font-medium">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}