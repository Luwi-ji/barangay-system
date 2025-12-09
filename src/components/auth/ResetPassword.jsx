import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { resetPassword } from '../../services/authService'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sessionValid, setSessionValid] = useState(true)

  useEffect(() => {
    // Check if user came from password reset link
    const hash = window.location.hash
    if (!hash.includes('type=recovery')) {
      setSessionValid(false)
      setError('Invalid password reset link or session expired')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const result = await resetPassword(formData.password)

      if (!result.success) {
        setError(result.error)
        return
      }

      setSuccess(result.message)
      setFormData({ password: '', confirmPassword: '' })
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error) {
      console.error('Reset password error:', error)
      setError(error.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#9333ea' }}>
              <span className="text-white font-bold text-2xl">BRG</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Invalid Link</h2>
            <p className="mt-2 text-sm text-gray-600">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>

          <button
            onClick={() => navigate('/forgot-password')}
            className="w-full flex items-center justify-center space-x-2 bg-dark-800 text-white py-3 px-4 rounded-lg hover:bg-accent-600 focus:ring-4 focus:ring-accent-300 font-medium transition-colors"
          >
            <span>Request New Reset Link</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#9333ea' }}>
            <span className="text-white font-bold text-2xl">BRG</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Set New Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password *
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
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
            <Lock className="w-5 h-5" />
            <span>{loading ? 'Resetting...' : 'Reset Password'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
