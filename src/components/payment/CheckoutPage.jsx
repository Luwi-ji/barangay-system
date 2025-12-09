import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../shared/LoadingSpinner'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [paymentStatus, setPaymentStatus] = useState('processing')
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState('')

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const clientSecret = searchParams.get('clientSecret')
        const reqId = searchParams.get('requestId')
        
        if (!clientSecret || !reqId) {
          setError('Invalid payment parameters')
          setPaymentStatus('failed')
          return
        }

        setRequestId(reqId)

        // Extract payment intent ID from client secret
        const paymentIntentId = clientSecret.split('_secret_')[0]

        // Get the current auth session
        const { data: { session } } = await supabase.auth.getSession()

        // Call backend to verify the payment
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const headers = {
          'Content-Type': 'application/json',
        }
        
        // Add auth token if available
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            clientSecret: clientSecret,
            requestId: reqId
          })
        })

        const data = await response.json()

        console.log('Payment verification response:', data, 'Status:', response.status)

        if (!response.ok) {
          console.error('Payment verification failed:', data)
          setError(data.error || 'Payment verification failed')
          setPaymentStatus('failed')
          return
        }

        // Payment successful
        setPaymentStatus('success')

        // Auto-redirect to dashboard after 3 seconds
        setTimeout(() => {
          navigate('/dashboard')
        }, 3000)
      } catch (err) {
        console.error('Payment verification error:', err)
        setError(err.message || 'Failed to verify payment')
        setPaymentStatus('failed')
      }
    }

    verifyPayment()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {paymentStatus === 'processing' && (
          <div className="text-center">
            <LoadingSpinner />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Verifying Payment</h2>
            <p className="mt-2 text-gray-600">Please wait while we verify your payment...</p>
          </div>
        )}

        {paymentStatus === 'success' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your payment has been processed successfully. Your request is now being reviewed.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                <span className="font-semibold">Request ID:</span> {requestId}
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              You will be redirected to your dashboard in a few seconds...
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-4 py-3 bg-dark-800 text-white rounded-lg hover:bg-accent-600 font-medium transition-colors"
            >
              Go to Dashboard Now
            </button>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 rounded-full p-4">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Payment Failed</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/new-request')}
                className="w-full px-4 py-3 bg-dark-800 text-white rounded-lg hover:bg-accent-600 font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-dark-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
