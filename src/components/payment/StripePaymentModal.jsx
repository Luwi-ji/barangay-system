import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AlertCircle, CheckCircle, Loader, CreditCard, X, Lock } from 'lucide-react'

export default function StripePaymentModal({ 
  isOpen, 
  onClose, 
  documentName, 
  amount,
  requestId,
  onPaymentSuccess 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('idle') // idle, processing, success, failed
  const navigate = useNavigate()

  const handlePayment = async () => {
    setLoading(true)
    setError('')
    setPaymentStatus('processing')

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please log in again.')
      }

      // Call backend to create payment intent
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          requestId,
          amount,
          documentName,
          metadata: {
            documentName,
            requestId,
          }
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || `Payment request failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Redirect to checkout page for payment verification
      setPaymentStatus('success')
      window.location.href = `/checkout?clientSecret=${data.clientSecret}&requestId=${requestId}`

    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setPaymentStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Payment</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Document Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Document</p>
            <p className="text-lg font-semibold text-gray-900">{documentName}</p>
          </div>

          {/* Amount */}
          <div className="border-t border-b py-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">Amount to Pay</p>
              <p className="text-2xl font-bold text-primary-700">₱{amount.toFixed(2)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Secure payment powered by Stripe
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-700">
                <p className="font-semibold">Payment Successful!</p>
                <p className="mt-1">Your request has been submitted.</p>
              </div>
            </div>
          )}

          {paymentStatus === 'processing' && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center gap-3">
              <Loader className="w-5 h-5 text-primary-700 animate-spin" />
              <p className="text-sm text-primary-800">Processing your payment...</p>
            </div>
          )}

          {/* Payment Info */}
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>100% secure SSL encrypted payment</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Your card details are processed by Stripe only</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Instant payment confirmation</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={loading || paymentStatus === 'processing'}
            className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 text-dark-700 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={loading || paymentStatus === 'processing' || paymentStatus === 'success'}
            className="flex-1 px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {paymentStatus === 'processing' ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : paymentStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Payment Successful</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Pay ₱{amount.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
