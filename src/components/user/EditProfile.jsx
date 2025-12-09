import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, User } from 'lucide-react'
import { updateUserProfile } from '../../services/authService'

export default function EditProfile({ user, profile }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    address: '',
    mobile: '',
    birthDate: ''
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        email: profile.email || '',
        fullName: profile.full_name || '',
        address: profile.address || '',
        mobile: profile.mobile || '',
        birthDate: profile.birth_date || ''
      })
      setLoading(false)
    }
  }, [profile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    if (!formData.fullName.trim()) {
      setError('Full name is required')
      setSaving(false)
      return
    }

    if (!formData.address.trim()) {
      setError('Address is required')
      setSaving(false)
      return
    }

    try {
      const result = await updateUserProfile(user.id, {
        email: formData.email,
        full_name: formData.fullName,
        address: formData.address,
        mobile: formData.mobile,
        birth_date: formData.birthDate
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => {
        navigate('/profile')
      }, 1500)
    } catch (error) {
      console.error('Profile update error:', error)
      setError(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} userProfile={profile} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center text-primary-700 hover:text-accent-600 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </button>

        {/* Edit Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-dark-800 to-dark-900 px-6 sm:px-8 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Edit Profile</h1>
            <p className="mt-1 text-black">Update your personal information</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-8 space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                    placeholder="your.email@example.com"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Note: Changing your email will require verification
                </p>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </div>

              {/* Birth Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none z-10" />
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                    style={{
                      colorScheme: 'light',
                    }}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-black placeholder-gray-500"
                    placeholder="Complete address"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-dark-800 text-white py-3 px-4 rounded-lg hover:bg-accent-600 focus:ring-4 focus:ring-accent-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
