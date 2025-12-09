import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import StatusBadge from '../shared/StatusBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { 
  FileText, Users, Clock, CheckCircle, 
  TrendingUp, AlertCircle, BarChart3, Settings 
} from 'lucide-react'
import { formatDate } from '../../utils/helpers'

export default function AdminDashboard({ user, profile }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    ready: 0,
    completed: 0,
    declined: 0,
    today: 0
  })
  const [recentRequests, setRecentRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch all requests for stats
      const { data: allRequests } = await supabase
        .from('requests')
        .select('status, created_at')

      if (allRequests) {
        const today = new Date().toDateString()
        setStats({
          total: allRequests.length,
          pending: allRequests.filter(r => r.status === 'Pending').length,
          processing: allRequests.filter(r => r.status === 'Processing').length,
          ready: allRequests.filter(r => r.status === 'Ready for Pickup').length,
          completed: allRequests.filter(r => r.status === 'Completed').length,
          declined: allRequests.filter(r => r.status === 'Declined').length,
          today: allRequests.filter(r => 
            new Date(r.created_at).toDateString() === today
          ).length
        })
      }

      // Fetch recent requests
      const { data: recent } = await supabase
        .from('requests')
        .select(`
          id,
          tracking_number,
          status,
          created_at,
          document_types!document_type_id(id, name),
          profiles!user_id(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      setRecentRequests(recent || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
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
        {/* Header */}
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-dark-800 to-dark-900 rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Admin Dashboard</h1>
          <p className="mt-2 text-sm sm:text-base text-black">
            Welcome back, {profile?.full_name}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 sm:w-6 h-5 sm:h-6 text-primary-700" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">All time</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 sm:w-6 h-5 sm:h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Needs attention</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary-700 mt-1">{stats.processing}</p>
              </div>
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 sm:w-6 h-5 sm:h-6 text-primary-700" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">In progress</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Ready</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{stats.ready}</p>
              </div>
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 sm:w-6 h-5 sm:h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">For pickup</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 sm:w-10 h-9 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 sm:w-10 h-9 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Today</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.today}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 sm:w-10 h-9 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Declined</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.declined}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Link
            to="/admin/requests"
            className="rounded-lg shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg" style={{ backgroundColor: '#9333ea', color: 'white' }}
          >
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">Manage Requests</h3>
              <p className="mt-1 text-violet-100 text-xs sm:text-sm">Process pending requests</p>
            </div>
            <FileText className="w-6 sm:w-8 h-6 sm:h-8 text-white mt-2 sm:mt-0" />
          </Link>

          <Link
            to="/admin/analytics"
            className="bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-lg shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">View Analytics</h3>
              <p className="mt-1 text-gray-600 text-xs sm:text-sm">Reports and insights</p>
            </div>
            <BarChart3 className="w-6 sm:w-8 h-6 sm:h-8 text-violet-500 mt-2 sm:mt-0" />
          </Link>

          {profile?.role !== 'encoder' && (
            <Link
              to="/admin/settings"
              className="bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-lg shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
            >
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Settings</h3>
                <p className="mt-1 text-gray-600 text-xs sm:text-sm">Configure system</p>
              </div>
              <Settings className="w-6 sm:w-8 h-6 sm:h-8 text-violet-500 mt-2 sm:mt-0" />
            </Link>
          )}
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Requests</h2>
            <Link
              to="/admin/requests"
              className="text-primary-700 hover:text-accent-600 text-sm font-medium whitespace-nowrap"
            >
              View all →
            </Link>
          </div>

          {recentRequests.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText className="w-12 sm:w-16 h-12 sm:h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Tracking #
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Resident
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Document
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
                  {recentRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {request.tracking_number}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 truncate">{request.profiles?.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{request.profiles?.email}</div>
                      </td>
                      <th className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-gray-900">
                        {request.document_types?.name}
                      </th>
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
        </div>
      </div>
    </div>
  )
}