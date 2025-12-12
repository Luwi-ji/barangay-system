import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../shared/Navbar'
import LoadingSpinner from '../shared/LoadingSpinner'
import { ArrowLeft, Plus, Edit2, Trash2, Save, X } from 'lucide-react'

export default function Settings({ user, profile }) {
  const navigate = useNavigate()
  const [documentTypes, setDocumentTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    requirements: '',
    processing_days: ''
  })

  useEffect(() => {
    fetchDocumentTypes()
  }, [])

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('name')

      if (error) throw error
      setDocumentTypes(data || [])
    } catch (error) {
      console.error('Error fetching document types:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const { error } = await supabase
        .from('document_types')
        .insert({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          requirements: formData.requirements,
          processing_days: parseInt(formData.processing_days),
          is_active: true
        })

      if (error) throw error

      await fetchDocumentTypes()
      setShowAddForm(false)
      resetForm()
      alert('Document type added successfully!')
    } catch (error) {
      console.error('Error adding document type:', error)
      alert('Failed to add document type: ' + error.message)
    }
  }

  const handleUpdate = async (id) => {
    try {
      const { error } = await supabase
        .from('document_types')
        .update({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          requirements: formData.requirements,
          processing_days: parseInt(formData.processing_days)
        })
        .eq('id', id)

      if (error) throw error

      await fetchDocumentTypes()
      setEditing(null)
      resetForm()
      alert('Document type updated successfully!')
    } catch (error) {
      console.error('Error updating document type:', error)
      alert('Failed to update document type: ' + error.message)
    }
  }

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      await fetchDocumentTypes()
    } catch (error) {
      console.error('Error toggling status:', error)
      alert('Failed to update status: ' + error.message)
    }
  }

  const startEdit = (docType) => {
    setEditing(docType.id)
    setFormData({
      name: docType.name,
      description: docType.description || '',
      price: docType.price.toString(),
      requirements: docType.requirements || '',
      processing_days: docType.processing_days.toString()
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    setShowAddForm(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      requirements: '',
      processing_days: ''
    })
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-2 text-gray-600">
                Manage document types and system configuration
              </p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Document Type</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Document Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="e.g., Barangay Clearance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₱) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Processing Days *
                </label>
                <input
                  type="number"
                  value={formData.processing_days}
                  onChange={(e) => setFormData({...formData, processing_days: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="Brief description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requirements (separate with commas or new lines)
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                  placeholder="e.g., Valid ID, Birth Certificate, Proof of Residency"
                  rows="3"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end space-x-3">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        )}

        {/* Document Types List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Document Types</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {documentTypes.map((docType) => (
              <div key={docType.id} className="p-6">
                {editing === docType.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Document Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Processing Days
                        </label>
                        <input
                          type="number"
                          value={formData.processing_days}
                          onChange={(e) => setFormData({...formData, processing_days: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Requirements (separate with commas or new lines)
                        </label>
                        <textarea
                          value={formData.requirements}
                          onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          placeholder="e.g., Valid ID, Birth Certificate, Proof of Residency"
                          rows="3"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={() => handleUpdate(docType.id)}
                        className="flex items-center space-x-1 px-3 py-2 bg-dark-800 text-white rounded-lg hover:bg-accent-600 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {docType.name}
                        </h3>
                        <span className="text-primary-700 font-semibold">
                          ₱{parseFloat(docType.price).toFixed(2)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          docType.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {docType.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {docType.description && (
                        <p className="text-sm text-gray-600 mb-2">{docType.description}</p>
                      )}
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Requirements:</span> {docType.requirements}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Processing time:</span> {docType.processing_days} days
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(docType.id, docType.is_active)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          docType.is_active
                            ? 'bg-gray-900 text-white hover:text-blue-100'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {docType.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => startEdit(docType)}
                        className="p-2 text-dark-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this document type?')) {
                            // Add delete functionality
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}