import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import StatusBadge from '../shared/StatusBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { 
  ArrowLeft, Search, Filter, Eye, Download, 
  Upload, Check, X, FileText, Trash2 
} from 'lucide-react'
import { formatDateTime, viewImageWithAuth, downloadFileWithAuth } from '../../utils/helpers'

export default function RequestManagement({ user, profile }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [filteredRequests, setFilteredRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [processing, setProcessing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [residentDocuments, setResidentDocuments] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [showResidentProfileModal, setShowResidentProfileModal] = useState(false)
  const [selectedResidentProfile, setSelectedResidentProfile] = useState(null)
  const [residentProfileLoading, setResidentProfileLoading] = useState(false)
  
  const [updateForm, setUpdateForm] = useState({
    status: '',
    notes: ''
  })

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    filterRequests()
  }, [requests, searchTerm, statusFilter])

    const fetchRequests = async () => {
    try {
        const { data, error } = await supabase
        .from('requests')
        .select(`
            id,
            user_id,
            document_type_id,
            tracking_number,
            status,
            purpose,
            id_image_url,
            id_image_back_url,
            admin_notes,
            signed_document_url,
            processed_by,
            created_at,
            updated_at,
            document_types!document_type_id(id, name, price),
            profiles!user_id(id, full_name, email, mobile, address, role)
        `)
        .order('created_at', { ascending: false })

        if (error) {
        console.error('Error fetching requests:', error)
        throw error
        }

        console.log('Fetched requests:', data) // Debug log
        setRequests(data || [])
    } catch (error) {
        console.error('Error fetching requests:', error)
        alert('Error loading requests. Check console for details.')
    } finally {
        setLoading(false)
    }
    }
  const fetchStatusHistory = async (requestId) => {
    try {
      const { data, error } = await supabase
        .from('status_history')
        .select(`
          id,
          request_id,
          old_status,
          new_status,
          notes,
          created_at,
          profiles!changed_by(id, full_name)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStatusHistory(data || [])
    } catch (error) {
      console.error('Error fetching status history:', error)
    }
  }

  const filterRequests = () => {
    let filtered = [...requests]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Search filter - improved to handle various search patterns
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(r => {
        // Search in tracking number (with or without # prefix)
        const trackingMatch = r.tracking_number?.toLowerCase().includes(term) || 
                             r.tracking_number?.toLowerCase().includes(term.replace('#', ''))
        
        // Search in resident name
        const nameMatch = r.profiles?.full_name?.toLowerCase().includes(term)
        
        // Search in document type
        const docMatch = r.document_types?.name?.toLowerCase().includes(term)
        
        return trackingMatch || nameMatch || docMatch
      })
    }

    setFilteredRequests(filtered)
  }

  const fetchResidentDocuments = async (requestId) => {
    try {
      const { data, error } = await supabase
        .from('resident_documents')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('resident_documents query failed:', error)
        setResidentDocuments([])
        return
      }
      console.log('Fetched resident documents for admin:', data)
      setResidentDocuments(data || [])
    } catch (error) {
      console.error('Error fetching resident documents:', error)
      setResidentDocuments([])
    }
  }

  // Helper to normalize status to lowercase snake_case
  const normalizeStatus = (status) => {
    if (!status) return 'pending'
    const normalized = status.toLowerCase().replace(/\s+/g, '_')
    // Map old status values to new ones
    const statusMap = {
      'declined': 'rejected',
      'ready for pickup': 'ready_for_pickup',
      'readyforpickup': 'ready_for_pickup'
    }
    return statusMap[normalized] || normalized
  }

  const handleViewRequest = (request) => {
    setSelectedRequest(request)
    setUpdateForm({
      status: normalizeStatus(request.status),
      notes: request.admin_notes || ''
    })
    setUploadedFile(null)
    fetchResidentDocuments(request.id)
    fetchStatusHistory(request.id)
    setShowModal(true)
  }

  const handleViewResidentProfile = async (residentId) => {
    if (!residentId) {
      alert('Unable to load resident profile')
      return
    }

    setResidentProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', residentId)
        .single()

      if (error) throw error
      
      setSelectedResidentProfile(data)
      setShowResidentProfileModal(true)
    } catch (error) {
      console.error('Error fetching resident profile:', error)
      alert('Error loading resident profile')
    } finally {
      setResidentProfileLoading(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      setUploadedFile(file)
    }
  }

  const handleUploadSignedDocument = async () => {
    if (!uploadedFile || !selectedRequest) return
    
    setProcessing(true)

    try {
      const fileExt = uploadedFile.name.split('.').pop()
      const fileName = `${selectedRequest.user_id}/${selectedRequest.id}-${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(fileName, uploadedFile, { 
          upsert: false,
          metadata: {
            owner: selectedRequest.user_id,
            requestId: selectedRequest.id,
            documentType: 'signed-document'
          }
        })

      if (uploadError) throw uploadError

      // Save document record in resident_documents table (multiple documents supported)
      const { error: insertError } = await supabase
        .from('resident_documents')
        .insert({
          request_id: selectedRequest.id,
          file_path: fileName,
          file_name: uploadedFile.name,
          file_type: uploadedFile.type,
          file_size: uploadedFile.size,
          uploaded_by: user.id,
          document_category: 'signed-document',
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.warn('Could not save document record:', insertError)
      }

      // Clear the uploaded file and refresh the documents list
      setUploadedFile(null)
      await fetchResidentDocuments(selectedRequest.id)
      alert('Document uploaded successfully!')
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateRequest = async () => {
    if (!selectedRequest) return
    
    // Prevent updating cancelled requests
    if (selectedRequest.status === 'cancelled') {
      alert('Cannot update a cancelled request')
      return
    }
    
    setProcessing(true)

    try {
      // Update request status and notes
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          status: updateForm.status,
          admin_notes: updateForm.notes,
          processed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id)

      if (updateError) throw updateError

      // Refresh requests
      await fetchRequests()
      setShowModal(false)
      alert('Request updated successfully!')
    } catch (error) {
      console.error('Error updating request:', error)
      alert('Failed to update request: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const viewIDImage = (url, filePath, bucket = 'id-uploads') => {
    if (!url) return
    console.log('Viewing document:', url)
    viewImageWithAuth(url, bucket, filePath)
  }

  const downloadDocument = async (bucket, filePath, filename = 'document') => {
    if (!filePath) return
    await downloadFileWithAuth(bucket, filePath, filename)
  }

  const handleDeleteResidentDocument = async (docId, filePath) => {
    if (!window.confirm('Are you sure you want to delete this resident document?')) return

    try {
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('signed-documents')
        .remove([filePath])

      if (deleteError) throw deleteError

      // Delete from database
      const { error: dbError } = await supabase
        .from('resident_documents')
        .delete()
        .eq('id', docId)

      if (dbError) throw dbError

      alert('Document deleted successfully!')
      await fetchResidentDocuments(selectedRequest.id)
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document: ' + error.message)
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
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center text-primary-700 hover:text-accent-600 mb-3 sm:mb-4 font-medium text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Request Management</h1>
          <p className="mt-2 text-xs sm:text-base text-gray-600">
            Process and manage all document requests
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 sm:w-5 h-4 sm:h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by tracking #, name, or document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 sm:w-5 h-4 sm:h-5 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none text-gray-900 bg-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">● Pending</option>
                <option value="processing">● Processing</option>
                <option value="ready_for_pickup">● Ready for Pickup</option>
                <option value="completed">● Completed</option>
                <option value="rejected">● Rejected</option>
                <option value="cancelled">● Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs sm:text-sm text-gray-600">
            <span>
              Showing {filteredRequests.length} of {requests.length} requests
            </span>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText className="w-12 sm:w-16 h-12 sm:h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No requests found</p>
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
                    <th className="px-3 sm:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {request.tracking_number}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 truncate text-xs sm:text-sm">
                          {request.profiles?.full_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {request.profiles?.email}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-gray-900">
                        {request.document_types?.name}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {formatDateTime(request.created_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewRequest(request)}
                          className="text-primary-700 hover:text-accent-600 font-medium flex items-center space-x-1 text-xs sm:text-sm"
                        >
                          <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                          <span className="hidden sm:inline">Process</span>
                          <span className="inline sm:hidden">View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Process Request Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl my-4 sm:my-8 shadow-lg">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                Process Request
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 sm:w-6 h-5 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-4 sm:px-6 py-4 space-y-4 sm:space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto text-sm sm:text-base">
              {/* Request Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Request Details</h4>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600">Tracking:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedRequest.tracking_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Document:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedRequest.document_types?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Price:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        ₱{parseFloat(selectedRequest.document_types?.price || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Date:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatDateTime(selectedRequest.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Resident Info</h4>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedRequest.profiles?.full_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium text-gray-900 truncate">
                        {selectedRequest.profiles?.email}
                      </span>
                    </div>
                    {selectedRequest.profiles?.mobile && (
                      <div>
                        <span className="text-gray-600">Mobile:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {selectedRequest.profiles.mobile}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Address:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {selectedRequest.profiles?.address}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewResidentProfile(selectedRequest.profiles?.id)}
                      className="mt-3 w-full flex items-center justify-center space-x-2 px-3 py-2 bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Full Profile</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Purpose</h4>
                <p className="text-xs sm:text-sm text-gray-600 bg-gray-50 rounded-lg p-3 sm:p-4">
                  {selectedRequest.purpose}
                </p>
              </div>

              {/* Cancellation Info */}
              {selectedRequest.status === 'cancelled' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4 text-xs sm:text-sm">
                  <h4 className="font-medium text-gray-900 mb-2">Cancellation Information</h4>
                  <p className="text-gray-600">
                    This request was cancelled by the resident.
                  </p>
                  {statusHistory[0]?.new_status === 'cancelled' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Cancelled on: {formatDateTime(statusHistory[0]?.created_at)}
                    </p>
                  )}
                </div>
              )}

              {/* Uploaded ID */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm">Uploaded ID</h4>
                <div className="space-y-2">
                  {/* Front Side */}
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">Front Side</span>
                    <button
                      onClick={() => {
                        viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_url)
                      }}
                      className="flex items-center space-x-1 text-primary-700 hover:text-accent-600 text-xs sm:text-sm font-medium"
                    >
                      <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                      <span className="hidden sm:inline">View</span>
                    </button>
                  </div>
                  
                  {/* Back Side */}
                  {selectedRequest.id_image_back_url && (
                    <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs sm:text-sm text-gray-700 font-medium">Back Side</span>
                      <button
                        onClick={() => {
                          viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_back_url)
                        }}
                        className="flex items-center space-x-1 text-primary-700 hover:text-accent-600 text-xs sm:text-sm font-medium"
                      >
                        <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Uploaded Additional Documents */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm">Uploaded Additional Documents</h4>
                {residentDocuments.filter(doc => doc.document_category !== 'signed-document').length > 0 ? (
                  <div className="space-y-2">
                    {residentDocuments.filter(doc => doc.document_category !== 'signed-document').map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-2 bg-gray-50 p-2 sm:p-3 rounded-lg text-xs sm:text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(doc.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              viewImageWithAuth(null, 'signed-documents', doc.file_path)
                            }}
                            className="flex items-center space-x-1 text-primary-700 hover:text-accent-600 px-1 sm:px-2 py-1 text-xs"
                            title="View document"
                          >
                            <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">View</span>
                          </button>
                          <button
                            onClick={() => downloadDocument('signed-documents', doc.file_path, doc.file_name)}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-700 px-1 sm:px-2 py-1 text-xs"
                            title="Download document"
                          >
                            <Download className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">Download</span>
                          </button>
                          <button
                            onClick={() => handleDeleteResidentDocument(doc.id, doc.file_path)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 px-1 sm:px-2 py-1 text-xs"
                            title="Delete document"
                          >
                            <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-500">No requirement documents uploaded</p>
                )}
              </div>

              {/* Signed Documents View */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Signed Documents</h4>
                {residentDocuments.filter(doc => doc.document_category === 'signed-document').length > 0 ? (
                  <div className="space-y-2">
                    {residentDocuments.filter(doc => doc.document_category === 'signed-document').map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-2 bg-gray-50 p-2 sm:p-3 rounded-lg text-xs sm:text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(doc.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              viewImageWithAuth(null, 'signed-documents', doc.file_path)
                            }}
                            className="flex items-center space-x-1 text-primary-700 hover:text-accent-600 px-1 sm:px-2 py-1 text-xs"
                            title="View document"
                          >
                            <Eye className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">View</span>
                          </button>
                          <button
                            onClick={() => downloadDocument('signed-documents', doc.file_path, doc.file_name)}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-700 px-1 sm:px-2 py-1 text-xs"
                            title="Download document"
                          >
                            <Download className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">Download</span>
                          </button>
                          <button
                            onClick={() => handleDeleteResidentDocument(doc.id, doc.file_path)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 px-1 sm:px-2 py-1 text-xs"
                            title="Delete document"
                          >
                            <Trash2 className="w-3 sm:w-4 h-3 sm:h-4" />
                            <span className="hidden sm:inline text-xs">Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedRequest.signed_document_url ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => {
                        const filePath = selectedRequest.signed_document_url.split('/').slice(-2).join('/')
                        viewImageWithAuth(selectedRequest.signed_document_url, 'signed-documents', filePath)
                      }}
                      className="flex items-center space-x-2 text-primary-700 hover:text-accent-600 text-xs sm:text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Document</span>
                    </button>
                    <button
                      onClick={() => {
                        const filePath = selectedRequest.signed_document_url.split('/').slice(-2).join('/')
                        downloadDocument('signed-documents', filePath, `signed-doc-${selectedRequest.tracking_number}`)
                      }}
                      className="flex items-center space-x-2 text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-500">No signed documents uploaded</p>
                )}
              </div>

              {/* Update Form */}
              <div className="border-t pt-4 sm:pt-6">
                <h4 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Update Request</h4>
                
                <div className="space-y-3 sm:space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      value={updateForm.status}
                      onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 bg-white text-sm"
                    >
                      <option value="pending">● Pending</option>
                      <option value="processing">● Processing</option>
                      <option value="ready_for_pickup">● Ready for Pickup</option>
                      <option value="completed">● Completed</option>
                      <option value="rejected">● Rejected</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Admin Notes
                    </label>
                    <textarea
                      value={updateForm.notes}
                      onChange={(e) => setUpdateForm({...updateForm, notes: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-sm"
                      placeholder="Add notes or remarks for the resident..."
                      rows="3"
                    />
                  </div>

                  {/* Upload Signed Document */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Upload Signed Document (PDF or Image)
                    </label>
                    <label className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors text-xs sm:text-sm">
                      <Upload className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 mr-2" />
                      <span className="text-gray-600 truncate">
                        {uploadedFile ? uploadedFile.name : 'Choose file...'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                      />
                    </label>

                    {uploadedFile && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-2 sm:p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {(uploadedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-700 px-2 py-1 text-xs font-medium whitespace-nowrap"
                          >
                            <X className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                        {uploadedFile.type.startsWith('image/') && (
                          <div className="mt-2 max-h-40 sm:max-h-48 overflow-hidden">
                            <img 
                              src={URL.createObjectURL(uploadedFile)} 
                              alt="Preview" 
                              className="max-w-full max-h-40 sm:max-h-48 rounded"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {selectedRequest.signed_document_url && !uploadedFile && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Document already uploaded
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-dark-700 hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Close
              </button>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {uploadedFile && (
                  <button
                    onClick={handleUploadSignedDocument}
                    disabled={processing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2 text-sm transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{processing ? 'Uploading...' : 'Upload Document'}</span>
                  </button>
                )}
                <button
                  onClick={handleUpdateRequest}
                  disabled={processing}
                  className="px-6 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2 text-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>{processing ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resident Profile Modal */}
      {showResidentProfileModal && selectedResidentProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl my-8 shadow-lg">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-semibold text-gray-900">
                Resident Profile
              </h3>
              <button
                onClick={() => setShowResidentProfileModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            {residentProfileLoading ? (
              <div className="px-6 py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Personal Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">Full Name</p>
                      <p className="text-lg font-medium text-gray-900 mt-1">{selectedResidentProfile?.full_name || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">Email</p>
                      <p className="text-lg font-medium text-gray-900 mt-1 truncate">{selectedResidentProfile?.email || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">Mobile Number</p>
                      <p className="text-lg font-medium text-gray-900 mt-1">{selectedResidentProfile?.mobile || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">Role</p>
                      <p className="text-lg font-medium text-gray-900 mt-1 capitalize">{selectedResidentProfile?.role || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Address</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 text-base">{selectedResidentProfile?.address || 'N/A'}</p>
                  </div>
                </div>

                {/* Account Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">User ID</p>
                      <p className="text-sm font-mono text-gray-900 mt-1 truncate">{selectedResidentProfile?.id?.slice(0, 16)}...</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase tracking-wider">Member Since</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {selectedResidentProfile?.created_at 
                          ? new Date(selectedResidentProfile.created_at).toLocaleDateString()
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
              <button
                onClick={() => setShowResidentProfileModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
