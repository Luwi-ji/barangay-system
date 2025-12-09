import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, User, Shield } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

export default function UserProfile({ user, profile }) {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      setProfileData(profile)
      setLoading(false)
    }
  }, [profile])

  if (loading) {
    return <LoadingSpinner />
  }

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'encoder':
        return 'bg-blue-100 text-blue-800'
      case 'captain':
        return 'bg-purple-100 text-purple-800'
      case 'resident':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleDescription = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'System Administrator'
      case 'encoder':
        return 'Document Encoder'
      case 'captain':
        return 'Barangay Captain'
      case 'resident':
        return 'Resident'
      default:
        return 'User'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} userProfile={profile} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-primary-700 hover:text-accent-600 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Header with role badge */}
          <div className="bg-gradient-to-r from-dark-800 to-dark-900 px-6 sm:px-8 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #9333ea, #7e22ce)' }}>
                  <span className="text-2xl font-bold text-white">
                    {profileData?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-black">{profileData?.full_name}</h1>
                  <p className="mt-1 text-black">{getRoleDescription(profileData?.role)}</p>
                </div>
              </div>
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getRoleBadgeColor(
                  profileData?.role
                )}`}
              >
                {profileData?.role?.charAt(0).toUpperCase() + profileData?.role?.slice(1)}
              </span>
            </div>
          </div>

          {/* Profile Details */}
          <div className="px-6 sm:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Basic Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-primary-700" />
                  Basic Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Full Name
                    </label>
                    <p className="text-gray-900 font-medium">{profileData?.full_name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Email Address
                    </label>
                    <div className="flex items-center text-gray-900">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      <p className="font-medium break-all">{user?.email}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Role
                    </label>
                    <p className="text-gray-900 font-medium">
                      {getRoleDescription(profileData?.role)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Account Created
                    </label>
                    <div className="flex items-center text-gray-900">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      <p className="font-medium">{formatDate(profileData?.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-primary-700" />
                  Contact Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Mobile Number
                    </label>
                    <div className="flex items-center text-gray-900">
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      <p className="font-medium">{profileData?.mobile || 'Not provided'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address
                    </label>
                    <div className="flex items-start text-gray-900">
                      <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-1 flex-shrink-0" />
                      <p className="font-medium">{profileData?.address || 'Not provided'}</p>
                    </div>
                  </div>

                  {profileData?.birth_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Birth Date
                      </label>
                      <div className="flex items-center text-gray-900">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <p className="font-medium">{formatDate(profileData?.birth_date)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Role-Specific Information */}
            {profileData?.role === 'resident' && (
              <div className="mt-8 pt-8 border-t">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Resident Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Gender
                    </label>
                    <p className="text-gray-900 font-medium">{profileData?.gender || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Civil Status
                    </label>
                    <p className="text-gray-900 font-medium">{profileData?.civil_status || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            )}

            {profileData?.role === 'encoder' && (
              <div className="mt-8 pt-8 border-t">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Encoder Information</h2>
                <div>
                  <p className="text-gray-600">
                    Encoders have access to manage and process document requests submitted by residents.
                  </p>
                </div>
              </div>
            )}

            {profileData?.role === 'captain' && (
              <div className="mt-8 pt-8 border-t">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Captain Information</h2>
                <div>
                  <p className="text-gray-600">
                    Barangay Captains have administrative access to oversee all document requests and system operations.
                  </p>
                </div>
              </div>
            )}

            {profileData?.role === 'admin' && (
              <div className="mt-8 pt-8 border-t">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Administrator Information</h2>
                <div>
                  <p className="text-gray-600">
                    Administrators have full system access including user management, settings, and analytics.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
