import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import { ArrowLeft, TrendingUp, Download, X } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatStatus, getStatusColor } from '../../utils/helpers'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function Analytics({ user, profile }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState('month') // day, week, month, year
  const [stats, setStats] = useState({
    totalRequests: 0,
    thisMonth: 0,
    lastMonth: 0,
    avgProcessingTime: 0
  })
  const [cancellationCount, setCancellationCount] = useState(0)
  const [cancellationTrend, setCancellationTrend] = useState(0)
  const [documentTypeData, setDocumentTypeData] = useState([])
  const [statusData, setStatusData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [filteredRequests, setFilteredRequests] = useState([])

  useEffect(() => {
    fetchAnalytics()
  }, [timePeriod])

  const fetchAnalytics = async () => {
    try {
      // Fetch all requests
      const { data: requests } = await supabase
        .from('requests')
        .select(`
          *,
          document_types (name)
        `)

      if (!requests) return

      // Filter requests based on time period
      const now = new Date()
      let filteredRequests = requests

      if (timePeriod === 'day') {
        const today = new Date().toDateString()
        filteredRequests = requests.filter(r => 
          new Date(r.created_at).toDateString() === today
        )
      } else if (timePeriod === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        filteredRequests = requests.filter(r => new Date(r.created_at) >= weekAgo)
      } else if (timePeriod === 'year') {
        const yearAgo = new Date()
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        filteredRequests = requests.filter(r => new Date(r.created_at) >= yearAgo)
      }
      // 'month' is default - no additional filtering needed beyond the existing month logic

      // Calculate stats
      const thisMonth = filteredRequests.filter(r => {
        const date = new Date(r.created_at)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      })

      const lastMonth = filteredRequests.filter(r => {
        const date = new Date(r.created_at)
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear()
      })

      setStats({
        totalRequests: filteredRequests.length,
        thisMonth: thisMonth.length,
        lastMonth: lastMonth.length,
        avgProcessingTime: 2.5
      })

      // Store filtered requests for table display
      setFilteredRequests(filteredRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))

      // Document type distribution
      const docTypes = {}
      filteredRequests.forEach(r => {
        const name = r.document_types?.name || 'Unknown'
        docTypes[name] = (docTypes[name] || 0) + 1
      })
      setDocumentTypeData(
        Object.entries(docTypes).map(([name, value]) => ({ name, value }))
      )

      // Status distribution - use formatted status names for display
      const statuses = {}
      filteredRequests.forEach(r => {
        const formattedName = formatStatus(r.status)
        statuses[formattedName] = (statuses[formattedName] || 0) + 1
      })
      setStatusData(
        Object.entries(statuses).map(([name, value]) => ({ name, value }))
      )

      // Daily data (last 7 days)
      const daily = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const count = filteredRequests.filter(r => r.created_at.startsWith(dateStr)).length
        daily.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          requests: count
        })
      }
      setDailyData(daily)

      // Monthly trend (last 6 months)
      const monthly = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const month = date.getMonth()
        const year = date.getFullYear()
        const count = filteredRequests.filter(r => {
          const rDate = new Date(r.created_at)
          return rDate.getMonth() === month && rDate.getFullYear() === year
        }).length
        monthly.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          requests: count
        })
      }
      setMonthlyTrend(monthly)

      // Fetch cancellation stats (use lowercase 'cancelled')
      const { data: cancelledRequests, error: cancelError } = await supabase
        .from('requests')
        .select('id')
        .eq('status', 'cancelled')

      if (!cancelError) {
        setCancellationCount(cancelledRequests?.length || 0)
      }

      // Fetch cancellation trend (this month only)
      const currentDate = new Date()
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString()
      const { data: thisMonthCancellations } = await supabase
        .from('requests')
        .select('id')
        .eq('status', 'cancelled')
        .gte('created_at', firstDayOfMonth)

      if (thisMonthCancellations) {
        setCancellationTrend(thisMonthCancellations.length)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    alert('Export functionality coming soon!')
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} userProfile={profile} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center text-primary-700 hover:text-accent-600 mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
              <p className="mt-2 text-gray-600">
                Insights and statistics for document requests
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
              <button
                onClick={exportReport}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Requests</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalRequests}</div>
            <div className="text-xs text-gray-500 mt-1">All time</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">This Month</div>
            <div className="text-3xl font-bold text-gray-900">{stats.thisMonth}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.thisMonth > stats.lastMonth ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Up from last month
                </span>
              ) : (
                <span className="text-gray-500">vs {stats.lastMonth} last month</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Last Month</div>
            <div className="text-3xl font-bold text-gray-900">{stats.lastMonth}</div>
            <div className="text-xs text-gray-500 mt-1">Previous period</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Avg. Processing</div>
            <div className="text-3xl font-bold text-gray-900">{stats.avgProcessingTime}d</div>
            <div className="text-xs text-gray-500 mt-1">Days to complete</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Cancelled Requests</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{cancellationCount}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {cancellationTrend} cancelled this month
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Document Type Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Requests by Document Type
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={documentTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Charts */}
        <div className="grid grid-cols-1 gap-6">
          {/* Daily Requests (Last 7 Days) */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Requests (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="requests" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Trend (Last 6 Months)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="requests" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filtered Requests Table */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Requests
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Document Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{request.id.slice(0, 8)}...</td>
                      <td className="py-3 px-4 text-gray-700">{request.document_types?.name || 'Unknown'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                          {formatStatus(request.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(request.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 px-4 text-center text-gray-500">
                      No requests found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}