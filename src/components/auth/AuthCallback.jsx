import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleOAuthCallback } from '../../services/authService'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const processCallback = async () => {
      try {
        const result = await handleOAuthCallback()

        if (!result.success) {
          setError(result.error)
          setTimeout(() => {
            navigate('/login')
          }, 3000)
          return
        }

        // Redirect based on role
        if (result.user) {
          // Small delay to ensure profile is created
          setTimeout(() => {
            navigate('/dashboard')
          }, 1000)
        }
      } catch (err) {
        console.error('Callback error:', err)
        setError('An error occurred during sign in. Please try again.')
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    }

    processCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#9333ea' }}>
              <span className="text-white font-bold text-2xl">BRG</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Sign In Error</h2>
          </div>

          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>

          <p className="text-center text-sm text-gray-600">
            Redirecting to login page...
          </p>
        </div>
      </div>
    )
  }

  return <LoadingSpinner />
}
