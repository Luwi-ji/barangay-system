import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import StatusBadge from '../shared/StatusBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { FileText, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

export default function Dashboard({ user, profile }) {
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    ready: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [user])

  const fetchRequests = async () => {
    try {
      // Fetch user's requests
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          document_types (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error

      setRequests(data || [])

      // Calculate stats
      const allRequests = await supabase
        .from('requests')
        .select('status')
        .eq('user_id', user.id)

      if (allRequests.data) {
        // Normalize status to handle both uppercase and lowercase
        const normalizeStatus = (s) => (s || '').toLowerCase().replace(/\s+/g, '_')
        
        // Debug: Log all status values to see what we're getting
        console.log('All request statuses:', allRequests.data.map(r => ({ original: r.status, normalized: normalizeStatus(r.status) })))
        
        const stats = {
          total: allRequests.data.length,
          pending: allRequests.data.filter(r => normalizeStatus(r.status) === 'pending').length,
          processing: allRequests.data.filter(r => normalizeStatus(r.status) === 'processing').length,
          ready: allRequests.data.filter(r => normalizeStatus(r.status) === 'ready_for_pickup').length
        }
        console.log('Calculated stats:', stats)
        setStats(stats)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} userProfile={profile} />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name}!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Manage your barangay document requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-9 sm:w-12 h-9 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 sm:w-6 h-4 sm:h-6 text-primary-700" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl sm:text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="w-9 sm:w-12 h-9 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 sm:w-6 h-4 sm:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Processing</p>
                <p className="text-xl sm:text-3xl font-bold mt-1" style={{ color: '#2563eb' }}>{stats.processing}</p>
              </div>
              <div className="w-9 sm:w-12 h-9 sm:w-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#dbeafe' }}>
                <AlertCircle className="w-4 sm:w-6 h-4 sm:h-6" style={{ color: '#2563eb' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Ready</p>
                <p className="text-xl sm:text-3xl font-bold text-green-600 mt-1">{stats.ready}</p>
              </div>
              <div className="w-9 sm:w-12 h-9 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 sm:w-6 h-4 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Link
            to="/new-request"
            className="rounded-lg shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg" style={{ backgroundColor: '#9333ea', color: 'white' }}
          >
            <div>
              <h3 className="text-base sm:text-xl font-semibold text-white">New Request</h3>
              <p className="mt-1 text-violet-100 text-xs sm:text-sm">Submit a new document request</p>
            </div>
            <Plus className="w-6 sm:w-8 h-6 sm:h-8 text-white mt-2 sm:mt-0" />
          </Link>

          <Link
            to="/history"
            className="bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-lg shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            <div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900">View History</h3>
              <p className="mt-1 text-gray-600 text-xs sm:text-sm">See all your past requests</p>
            </div>
            <FileText className="w-6 sm:w-8 h-6 sm:h-8 text-violet-500 mt-2 sm:mt-0" />
          </Link>
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Requests</h2>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText className="w-12 sm:w-16 h-12 sm:h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No requests yet</p>
              <p className="text-gray-400 mt-2 text-sm sm:text-base">Click "New Request" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Tracking #
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {request.tracking_number}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-gray-900">
                        {request.document_types?.name}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-gray-500 max-w-xs truncate">
                        {request.purpose}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatDate(request.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {requests.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t bg-gray-50">
              <Link
                to="/history"
                className="text-primary-700 hover:text-accent-600 text-sm font-medium"
              >
                View all requests →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}