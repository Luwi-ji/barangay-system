import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import { FileText, Upload, ArrowLeft, AlertCircle } from 'lucide-react'

export default function NewRequest({ user, profile }) {
  const navigate = useNavigate()
  const [documentTypes, setDocumentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIdFront, setSelectedIdFront] = useState(null)
  const [selectedIdBack, setSelectedIdBack] = useState(null)
  const [selectedAdditionalFiles, setSelectedAdditionalFiles] = useState([])
  const [formData, setFormData] = useState({
    document_type_id: '',
    purpose: ''
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDocumentTypes()
  }, [])

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setDocumentTypes(data || [])
    } catch (error) {
      console.error('Error fetching document types:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIdFrontChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPG, PNG)')
        return
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }

      setSelectedIdFront({
        file,
        id: Date.now(),
        preview: URL.createObjectURL(file)
      })
      setError('')
    }
  }

  const handleIdBackChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPG, PNG)')
        return
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }

      setSelectedIdBack({
        file,
        id: Date.now(),
        preview: URL.createObjectURL(file)
      })
      setError('')
    }
  }

  const handleAdditionalFilesChange = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Please upload image files (JPG, PNG)')
          return
        }

        // Validate file size (5MB max per file)
        if (file.size > 5 * 1024 * 1024) {
          setError('Each file size must be less than 5MB')
          return
        }

        newFiles.push({
          file,
          id: Date.now() + i,
          preview: URL.createObjectURL(file)
        })
      }
      
      setSelectedAdditionalFiles([...selectedAdditionalFiles, ...newFiles])
      setError('')
    }
  }

  const handleDeleteAdditionalFile = (fileId) => {
    setSelectedAdditionalFiles(selectedAdditionalFiles.filter(f => f.id !== fileId))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    // Validation
    if (!formData.document_type_id) {
      setError('Please select a document type')
      setSubmitting(false)
      return
    }

    if (!formData.purpose.trim()) {
      setError('Please provide a purpose for the request')
      setSubmitting(false)
      return
    }

    if (!selectedIdFront) {
      setError('Please upload the front side of your ID')
      setSubmitting(false)
      return
    }

    if (!selectedIdBack) {
      setError('Please upload the back side of your ID')
      setSubmitting(false)
      return
    }

    try {
      // Upload front ID file
      const idFrontExt = selectedIdFront.file.name.split('.').pop()
      const idFrontFileName = `${user.id}-id-front-${Date.now()}.${idFrontExt}`
      
      const { error: idFrontError } = await supabase.storage
        .from('id-uploads')
        .upload(idFrontFileName, selectedIdFront.file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            owner: user.id,
            type: 'id_front'
          }
        })

      if (idFrontError) throw idFrontError

      // Upload back ID file
      const idBackExt = selectedIdBack.file.name.split('.').pop()
      const idBackFileName = `${user.id}-id-back-${Date.now()}.${idBackExt}`
      
      const { error: idBackError } = await supabase.storage
        .from('id-uploads')
        .upload(idBackFileName, selectedIdBack.file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            owner: user.id,
            type: 'id_back'
          }
        })

      if (idBackError) throw idBackError

      console.log('Generated ID URLs - Front:', idFrontFileName, 'Back:', idBackFileName)

      // Create request first to get request_id for document paths
      const { data: insertData, error: insertError } = await supabase
        .from('requests')
        .insert({
          user_id: user.id,
          document_type_id: formData.document_type_id,
          purpose: formData.purpose,
          id_image_url: idFrontFileName,
          id_image_back_url: idBackFileName
        })
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw insertError
      }

      console.log('Request created:', insertData)

      // Get request ID
      const createdRequestId = insertData[0]?.id
      if (!createdRequestId) {
        throw new Error('Failed to get request ID from response')
      }

      // Now upload additional requirement files with correct path format
      const additionalUploadedPaths = []
      
      for (const fileObj of selectedAdditionalFiles) {
        const fileExt = fileObj.file.name.split('.').pop()
        // Correct path format: user_id/request_id-timestamp.ext
        const fileName = `${user.id}/${createdRequestId}-${Date.now()}.${fileExt}`
        
        console.log('Uploading additional file:', fileName)
        const { error: uploadError } = await supabase.storage
          .from('signed-documents')
          .upload(fileName, fileObj.file, {
            cacheControl: '3600',
            upsert: false,
            metadata: {
              owner: user.id,
              type: 'additional'
            }
          })

        if (uploadError) {
          console.error('Upload error details:', uploadError)
          throw uploadError
        }

        console.log('Upload successful:', fileName)
        additionalUploadedPaths.push(fileName)
      }

      // Store additional documents in resident_documents table
      const documentRecords = selectedAdditionalFiles.map((fileObj, index) => ({
        request_id: createdRequestId,
        file_path: additionalUploadedPaths[index],
        file_name: fileObj.file.name,
        uploaded_by: user.id,
        document_category: 'additional-document'
      }))

      if (documentRecords.length > 0) {
        const { error: docError } = await supabase
          .from('resident_documents')
          .insert(documentRecords)

        if (docError) {
          console.error('Error saving document records:', docError)
          // Don't throw here - documents are already uploaded, just log the error
        }
      }

      // Request submitted successfully - redirect to dashboard
      alert('Request submitted successfully!')
      navigate('/dashboard')
      
      setSubmitting(false)
    } catch (error) {
      console.error('Error submitting request:', error)
      setError(error.message || 'Failed to submit request. Please try again.')
      setSubmitting(false)
    }
  }

  const selectedDocType = documentTypes.find(
    dt => dt.id.toString() === formData.document_type_id
  )

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} userProfile={profile} />

      <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-primary-700 hover:text-accent-600 mb-3 sm:mb-4 font-medium text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Document Request</h1>
          <p className="mt-2 text-xs sm:text-base text-gray-600">
            Fill out the form below to request a barangay document
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 text-sm">
            <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Document Type Selection */}
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              Select Document Type
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {documentTypes.map((docType) => (
                <label
                  key={docType.id}
                  className={`relative flex cursor-pointer rounded-lg border-2 p-3 sm:p-4 transition-all text-sm sm:text-base ${
                    formData.document_type_id === docType.id.toString()
                      ? 'border-purple-600 bg-purple-50 shadow-md shadow-purple-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="document_type"
                    value={docType.id}
                    checked={formData.document_type_id === docType.id.toString()}
                    onChange={(e) =>
                      setFormData({ ...formData, document_type_id: e.target.value })
                    }
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="font-medium text-gray-900">{docType.name}</span>
                      <span className="text-gray-900 font-semibold whitespace-nowrap">
                        ₱{parseFloat(docType.price).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">{docType.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Processing: {docType.processing_days} days
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Document Details */}
          {selectedDocType && (
            <div className="bg-purple-50 border-2 border-purple-600 rounded-lg p-3 sm:p-4 text-sm shadow-md shadow-purple-200">
              <h3 className="font-bold text-purple-900 mb-2 text-base">Requirements</h3>
              <p className="text-xs sm:text-sm text-purple-900 font-medium">{selectedDocType.requirements}</p>
            </div>
          )}

          {/* Purpose */}
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Purpose</h2>
            <textarea
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent text-black placeholder-gray-500 text-sm sm:text-base"
              placeholder="Please specify the purpose of this document request..."
              rows="4"
            />
          </div>

          {/* Upload Valid ID - Front Side */}
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
              Upload Valid ID - Front Side <span className="text-red-600">*</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Please upload a clear photo of your valid ID front side
            </p>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className={`flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 ${selectedIdFront ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'} border-dashed rounded-lg cursor-pointer hover:bg-gray-100 transition-colors`}>
                  <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-5 sm:pb-6 px-4">
                    {selectedIdFront ? (
                      <>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 sm:mb-4">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs sm:text-sm text-green-700 font-medium">File uploaded successfully</p>
                        <p className="text-xs text-gray-500 mt-1">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 sm:w-12 h-8 sm:h-12 text-gray-400 mb-2 sm:mb-4" />
                        <p className="mb-2 text-xs sm:text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleIdFrontChange}
                  />
                </label>
              </div>

              {selectedIdFront && (
                <div className="flex items-center justify-between p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-700 truncate font-medium">{selectedIdFront.file.name}</p>
                    <p className="text-xs text-gray-500">{(selectedIdFront.file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => window.open(selectedIdFront.preview, '_blank')}
                      className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-blue-50 rounded"
                      title="Preview file"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIdFront(null)}
                      className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-red-50 rounded"
                      title="Delete file"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Valid ID - Back Side */}
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mt-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
              Upload Valid ID - Back Side <span className="text-red-600">*</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Please upload a clear photo of your valid ID back side
            </p>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className={`flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 ${selectedIdBack ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'} border-dashed rounded-lg cursor-pointer hover:bg-gray-100 transition-colors`}>
                  <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-5 sm:pb-6 px-4">
                    {selectedIdBack ? (
                      <>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-2 sm:mb-4">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs sm:text-sm text-green-700 font-medium">File uploaded successfully</p>
                        <p className="text-xs text-gray-500 mt-1">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 sm:w-12 h-8 sm:h-12 text-gray-400 mb-2 sm:mb-4" />
                        <p className="mb-2 text-xs sm:text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleIdBackChange}
                  />
                </label>
              </div>

              {selectedIdBack && (
                <div className="flex items-center justify-between p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-700 truncate font-medium">{selectedIdBack.file.name}</p>
                    <p className="text-xs text-gray-500">{(selectedIdBack.file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => window.open(selectedIdBack.preview, '_blank')}
                      className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-blue-50 rounded"
                      title="Preview file"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIdBack(null)}
                      className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-red-50 rounded"
                      title="Delete file"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Additional Requirements */}
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">
              Upload Additional Requirements <span className="text-gray-500 text-sm font-normal">(Optional)</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Upload any additional documents (proof of residency, certificates, etc.)
            </p>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-4 sm:pt-5 pb-5 sm:pb-6 px-4">
                    <Upload className="w-8 sm:w-12 h-8 sm:h-12 text-gray-400 mb-2 sm:mb-4" />
                    <p className="mb-2 text-xs sm:text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB per file)</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*"
                    onChange={handleAdditionalFilesChange}
                  />
                </label>
              </div>

              {selectedAdditionalFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-700">{selectedAdditionalFiles.length} file(s) uploaded</p>
                  {selectedAdditionalFiles.map((fileObj) => (
                    <div key={fileObj.id} className="flex items-center justify-between p-2 sm:p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-700 truncate font-medium">{fileObj.file.name}</p>
                        <p className="text-xs text-gray-500">{(fileObj.file.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => window.open(fileObj.preview, '_blank')}
                          className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-blue-50 rounded"
                          title="Preview file"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdditionalFile(fileObj.id)}
                          className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 hover:bg-red-50 rounded"
                          title="Delete file"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-white border-2 border-gray-300 text-gray-900 hover:bg-gray-50 rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 sm:px-8 py-2 sm:py-3 bg-dark-800 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2 transition-colors text-sm sm:text-base"
            >
              <FileText className="w-4 sm:w-5 h-4 sm:h-5" />
              <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}