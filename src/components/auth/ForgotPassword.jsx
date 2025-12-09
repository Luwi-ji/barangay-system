import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { sendPasswordResetEmail } from '../../services/authService'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    try {
      const result = await sendPasswordResetEmail(email)

      if (!result.success) {
        setError(result.error)
        return
      }

      setSuccess(result.message)
      setEmail('')
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error) {
      console.error('Forgot password error:', error)
      setError(error.message || 'Failed to send reset email')
    } finally {
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
          <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password
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
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-dark-800 text-white py-3 px-4 rounded-lg hover:bg-accent-600 focus:ring-4 focus:ring-accent-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <Mail className="w-5 h-5" />
            <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
          </button>

          <div className="text-center text-sm">
            <Link to="/login" className="flex items-center justify-center text-primary-700 hover:text-accent-600 font-medium">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          Check your email for a link to reset your password. The link will expire in 24 hours.
        </p>
      </div>
    </div>
  )
}
