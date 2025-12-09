import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import StatusBadge from '../shared/StatusBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { ArrowLeft, FileText, Download, Eye, Calendar, Upload, X, Edit2, Trash2 } from 'lucide-react'
import { formatDate, formatDateTime, viewImageWithAuth, downloadFileWithAuth } from '../../utils/helpers'

export default function RequestHistory({ user, profile }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [residentDocuments, setResidentDocuments] = useState([])
  const [editingDocId, setEditingDocId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [editingIdSide, setEditingIdSide] = useState(null) // 'front' or 'back'
  const [idFileToUpload, setIdFileToUpload] = useState(null)

  useEffect(() => {
    fetchRequests()
  }, [user])

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id,
          tracking_number,
          user_id,
          document_type_id,
          status,
          purpose,
          id_image_url,
          id_image_back_url,
          admin_notes,
          signed_document_url,
          created_at,
          updated_at,
          document_types!document_type_id(id, name, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error('Error fetching requests:', error)
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
          status,
          changed_at,
          profiles!changed_by(id, full_name)
        `)
        .eq('request_id', requestId)
        .order('changed_at', { ascending: false })

      if (error) throw error
      setStatusHistory(data || [])
    } catch (error) {
      console.error('Error fetching status history:', error)
    }
  }

  const fetchResidentDocuments = async (requestId) => {
    try {
      const { data, error } = await supabase
        .from('resident_documents')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) {
        // Table might not exist yet, initialize as empty
        console.warn('resident_documents table not found or query failed:', error)
        setResidentDocuments([])
        return
      }
      console.log('Fetched resident documents:', data)
      setResidentDocuments(data || [])
    } catch (error) {
      console.error('Error fetching resident documents:', error)
      setResidentDocuments([])
    }
  }

  const handleViewDetails = async (request) => {
    setSelectedRequest(request)
    await fetchStatusHistory(request.id)
    await fetchResidentDocuments(request.id)
    setUploadedFile(null)
    setEditingDocId(null)
    setShowModal(true)
  }

  const downloadDocument = async (bucket, filePath, filename = 'document') => {
    if (!filePath) return
    await downloadFileWithAuth(bucket, filePath, filename)
  }

  const viewIDImage = (url, filePath) => {
    if (!url) return
    console.log('Viewing document:', url)
    viewImageWithAuth(url, 'id-uploads', filePath)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      setUploadedFile(file)
    }
  }

  const handleUploadDocument = async () => {
    if (!uploadedFile || !selectedRequest) return

    setUploading(true)
    try {
      const fileExt = uploadedFile.name.split('.').pop()
      const fileName = `${user.id}/${selectedRequest.id}-${Date.now()}.${fileExt}`

      // Upload file to signed-documents bucket
      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(fileName, uploadedFile, { 
          upsert: false, // Don't overwrite
          metadata: {
            owner: user.id,
            requestId: selectedRequest.id
          }
        })

      if (uploadError) throw uploadError

      // Save document record in resident_documents table
      const { error: insertError } = await supabase
        .from('resident_documents')
        .insert({
          request_id: selectedRequest.id,
          file_path: fileName,
          file_name: uploadedFile.name,
          file_type: uploadedFile.type,
          file_size: uploadedFile.size,
          uploaded_by: user.id,
          document_category: 'additional-document',
          created_at: new Date().toISOString()
        })

      if (insertError) {
        // If table doesn't exist, continue anyway (will be created later)
        console.warn('Could not save document record:', insertError)
      }

      alert('Document uploaded successfully!')
      await fetchRequests()
      await fetchResidentDocuments(selectedRequest.id)
      setUploadedFile(null)
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (docId, filePath) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return

    try {
      // Delete from storage
      const { error: deleteStorageError } = await supabase.storage
        .from('signed-documents')
        .remove([filePath])

      if (deleteStorageError) {
        console.warn('Storage delete warning:', deleteStorageError)
      }

      // Delete from database
      const { error: deleteDbError } = await supabase
        .from('resident_documents')
        .delete()
        .eq('id', docId)

      if (deleteDbError) throw deleteDbError

      alert('Document deleted successfully!')
      await fetchResidentDocuments(selectedRequest.id)
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document: ' + error.message)
    }
  }

  const handleReplaceDocument = (docId) => {
    setEditingDocId(docId)
  }

  const handleIdImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      setIdFileToUpload(file)
    }
  }

  const handleSaveIdImage = async (side) => {
    if (!idFileToUpload || !selectedRequest) return

    try {
      const fileExt = idFileToUpload.name.split('.').pop()
      const fileName = `${user.id}-id-${side}-${Date.now()}.${fileExt}`

      // Upload new ID image to id-uploads bucket
      const { error: uploadError } = await supabase.storage
        .from('id-uploads')
        .upload(fileName, idFileToUpload, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            owner: user.id,
            type: `id_${side}`
          }
        })

      if (uploadError) throw uploadError

      // Delete old ID image from storage if it exists
      const oldFileName = side === 'front' ? selectedRequest.id_image_url : selectedRequest.id_image_back_url
      if (oldFileName) {
        await supabase.storage
          .from('id-uploads')
          .remove([oldFileName])
          .catch(err => console.warn('Could not delete old image:', err))
      }

      // Update request with new ID image path
      const updateData = side === 'front' 
        ? { id_image_url: fileName }
        : { id_image_back_url: fileName }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', selectedRequest.id)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      alert(`ID ${side === 'front' ? 'front' : 'back'} side updated successfully!`)
      setIdFileToUpload(null)
      setEditingIdSide(null)
      
      // Refresh requests to show updated ID images
      await fetchRequests()
      
      // Update selected request with new data
      const updatedRequests = requests.map(req => 
        req.id === selectedRequest.id 
          ? { ...req, ...updateData }
          : req
      )
      const updatedRequest = updatedRequests.find(req => req.id === selectedRequest.id)
      setSelectedRequest(updatedRequest)
    } catch (error) {
      console.error('Error updating ID image:', error)
      alert('Failed to update ID image: ' + error.message)
    }
  }

  const handleCancelIdEdit = () => {
    setEditingIdSide(null)
    setIdFileToUpload(null)
  }

  const handleCancelRequest = async (request) => {
    if (!window.confirm('Are you sure you want to cancel this request? This action cannot be undone.')) return

    setCancellingId(request.id)
    try {
      // Update request status to Cancelled
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Record cancellation in status_history
      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          request_id: request.id,
          status: 'Cancelled',
          changed_by: null,
          notes: 'Request cancelled by resident'
        })

      if (historyError) {
        console.warn('Could not record cancellation history:', historyError)
      }

      alert('Request cancelled successfully!')
      await fetchRequests()
      setShowModal(false)
    } catch (error) {
      console.error('Error cancelling request:', error)
      alert('Failed to cancel request: ' + error.message)
    } finally {
      setCancellingId(null)
    }
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
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-primary-700 hover:text-accent-600 mb-4 font-medium text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Request History</h1>
          <p className="mt-2 text-gray-600">
            View all your document requests
          </p>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {requests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No requests found</p>
              <p className="text-gray-400 mt-2">Start by creating a new request</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tracking #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Requested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.tracking_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {request.document_types?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          ₱{parseFloat(request.document_types?.price || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {request.purpose}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(request.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewDetails(request)}
                          className="text-primary-700 hover:text-accent-600 font-medium flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
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

      {/* Details Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-900">Request Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-6">
              {/* Request Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Request Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tracking Number:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.tracking_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Document Type:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.document_types?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Price:</span>
                    <span className="text-sm font-medium text-gray-900">
                      ₱{parseFloat(selectedRequest.document_types?.price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Date Requested:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatDateTime(selectedRequest.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Purpose</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                  {selectedRequest.purpose}
                </p>
              </div>

              {/* Admin Notes */}
              {selectedRequest.admin_notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Admin Notes</h4>
                  <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    {selectedRequest.admin_notes}
                  </p>
                </div>
              )}

              {/* Status History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Status History</h4>
                <div className="space-y-3">
                  {statusHistory.map((history, index) => (
                    <div key={history.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-primary-700" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={history.status} />
                          <span className="text-xs text-gray-500">
                            {formatDateTime(history.changed_at)}
                          </span>
                        </div>
                        {history.notes && (
                          <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                        )}
                        {history.profiles?.full_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            By: {history.profiles.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Document */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Signed Documents</h4>
                {residentDocuments.filter(doc => doc.document_category === 'signed-document').length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {residentDocuments.filter(doc => doc.document_category === 'signed-document').map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                            {doc.uploaded_by !== user.id && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Admin</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{formatDateTime(doc.created_at)}</p>
                        </div>
                        <button
                          onClick={() => {
                            viewImageWithAuth(null, 'signed-documents', doc.file_path)
                          }}
                          className="flex items-center space-x-2 text-primary-700 hover:text-accent-600 px-2 py-1 text-sm"
                          title="View document"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                        <button
                          onClick={() => downloadDocument('signed-documents', doc.file_path, doc.file_name)}
                          className="flex items-center space-x-2 text-green-600 hover:text-green-700 px-2 py-1 text-sm"
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : selectedRequest.signed_document_url ? (
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={() => {
                        const filePath = selectedRequest.signed_document_url.split('/').slice(-2).join('/')
                        viewImageWithAuth(selectedRequest.signed_document_url, 'signed-documents', filePath)
                      }}
                      className="flex items-center space-x-2 text-primary-700 hover:text-accent-600"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => {
                        const filePath = selectedRequest.signed_document_url.split('/').slice(-2).join('/')
                        downloadDocument('signed-documents', filePath, `signed-doc-${selectedRequest.tracking_number}`)
                      }}
                      className="flex items-center space-x-2 text-green-600 hover:text-green-700"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No signed document available yet</p>
                )}
              </div>

              {/* Upload/Edit Documents */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Your Submitted Documents</h4>
                <div className="space-y-4">
                  {/* ID Front Side */}
                  {selectedRequest.id_image_url && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">ID - Front Side</p>
                      {editingIdSide === 'front' ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIdImageUpload}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                          {idFileToUpload && <p className="text-sm text-gray-600 mb-3">Selected: {idFileToUpload.name}</p>}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveIdImage('front')}
                              disabled={!idFileToUpload}
                              className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelIdEdit}
                              className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Front Side</p>
                            <p className="text-xs text-gray-500">Initial submission</p>
                          </div>
                          <button
                            onClick={() => {
                              viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_url)
                            }}
                            className="flex items-center space-x-2 text-primary-700 hover:text-accent-600 px-3 py-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm">View</span>
                          </button>
                          <button
                            onClick={() => {
                              downloadDocument('id-uploads', selectedRequest.id_image_url, `id-front-${selectedRequest.tracking_number}`)
                            }}
                            className="flex items-center space-x-2 text-green-600 hover:text-green-700 px-3 py-1"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-sm">Download</span>
                          </button>
                          <button
                            onClick={() => setEditingIdSide('front')}
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 px-3 py-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="text-sm">Edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ID Back Side */}
                  {selectedRequest.id_image_back_url && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">ID - Back Side</p>
                      {editingIdSide === 'back' ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIdImageUpload}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                          {idFileToUpload && <p className="text-sm text-gray-600 mb-3">Selected: {idFileToUpload.name}</p>}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveIdImage('back')}
                              disabled={!idFileToUpload}
                              className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelIdEdit}
                              className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Back Side</p>
                            <p className="text-xs text-gray-500">Initial submission</p>
                          </div>
                          <button
                            onClick={() => {
                              viewImageWithAuth(null, 'id-uploads', selectedRequest.id_image_back_url)
                            }}
                            className="flex items-center space-x-2 text-primary-700 hover:text-accent-600 px-3 py-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm">View</span>
                          </button>
                          <button
                            onClick={() => {
                              downloadDocument('id-uploads', selectedRequest.id_image_back_url, `id-back-${selectedRequest.tracking_number}`)
                            }}
                            className="flex items-center space-x-2 text-green-600 hover:text-green-700 px-3 py-1"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-sm">Download</span>
                          </button>
                          <button
                            onClick={() => setEditingIdSide('back')}
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 px-3 py-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="text-sm">Edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resident Uploaded Documents */}
                  {residentDocuments.filter(doc => doc.document_category === 'additional-document' || (!doc.document_category && doc.uploaded_by === user.id)).length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Additional Documents</p>
                      <div className="space-y-2">
                        {residentDocuments.filter(doc => doc.document_category === 'additional-document' || (!doc.document_category && doc.uploaded_by === user.id)).map((doc) => (
                          <div key={doc.id} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(doc.created_at)}</p>
                            </div>
                            <button
                              onClick={() => {
                                viewImageWithAuth(null, 'signed-documents', doc.file_path)
                              }}
                              className="flex items-center space-x-2 text-primary-700 hover:text-accent-600 px-2 py-1 text-sm"
                              title="View document"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            <button
                              onClick={() => downloadDocument('signed-documents', doc.file_path, doc.file_name)}
                              className="flex items-center space-x-2 text-green-600 hover:text-green-700 px-2 py-1 text-sm"
                              title="Download document"
                            >
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                              className="flex items-center space-x-2 text-red-600 hover:text-red-700 px-2 py-1 text-sm"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add More Documents */}
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Add Additional Documents</p>
                    <label className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors">
                      <Upload className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
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
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {(uploadedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="flex items-center space-x-2 text-red-600 hover:text-red-700 px-2 py-1 text-sm font-medium"
                          >
                            <X className="w-4 h-4" />
                            <span>Remove</span>
                          </button>
                        </div>
                        {uploadedFile.type.startsWith('image/') && (
                          <div className="mt-2 max-h-48">
                            <img 
                              src={URL.createObjectURL(uploadedFile)} 
                              alt="Preview" 
                              className="max-w-full max-h-48 rounded"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-dark-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Close
                </button>
                
                {/* Cancel Request Button */}
                {selectedRequest && ['Pending', 'Processing'].includes(selectedRequest.status) && (
                  <button
                    onClick={() => handleCancelRequest(selectedRequest)}
                    disabled={cancellingId === selectedRequest.id}
                    className="px-4 py-2 border-2 border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 hover:border-red-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {cancellingId === selectedRequest.id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}
              </div>

              {uploadedFile && (
                <button
                  onClick={handleUploadDocument}
                  disabled={uploading}
                  className="px-6 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}