import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

export const formatDate = (date) => {
  return format(new Date(date), 'MMM dd, yyyy')
}

export const formatDateTime = (date) => {
  return format(new Date(date), 'MMM dd, yyyy hh:mm a')
}

export const getStatusColor = (status) => {
  // Normalize status to handle different cases
  const normalizedStatus = (status || '').toLowerCase().replace(/_/g, ' ')
  
  const colors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'ready for pickup': 'bg-green-100 text-green-800',
    'ready_for_pickup': 'bg-green-100 text-green-800',
    'completed': 'bg-gray-100 text-gray-800',
    'declined': 'bg-red-100 text-red-800',
    'rejected': 'bg-red-100 text-red-800',
    'cancelled': 'bg-slate-100 text-slate-800',
    'canceled': 'bg-slate-100 text-slate-800',
  }
  return colors[normalizedStatus] || 'bg-gray-100 text-gray-800'
}

// Format status for display (capitalize properly)
export const formatStatus = (status) => {
  if (!status) return ''
  // Handle snake_case and capitalize each word
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

export const uploadFile = async (supabase, bucket, path, file) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) throw error
  return data
}

export const getFileUrl = (supabase, bucket, path) => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return data.publicUrl
}

/**
 * Download file with authentication - uses Supabase download method for secure file access
 * @param {string} bucket - The bucket name (e.g., 'signed-documents')
 * @param {string} filePath - The full file path in the bucket
 * @param {string} filename - The filename for download
 * @returns {Promise<void>}
 */
export const downloadFileWithAuth = async (bucket, filePath, filename = 'document') => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath)

    if (error) throw error

    // Create blob URL and trigger download
    const blobUrl = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Download failed:', error)
    alert('Failed to download file: ' + error.message)
  }
}

/**
 * View image with authentication - tries public URL first, then falls back to authenticated download
 * Supports images and PDF files
 * @param {string} url - The public URL to the image (can be null)
 * @param {string} bucket - The bucket name (e.g., 'id-uploads')
 * @param {string} filePath - The full file path in the bucket (e.g., 'userid/filename.jpg')
 * @returns {Promise<void>}
 */
export const viewImageWithAuth = async (url, bucket, filePath) => {
  if (!url && !filePath) return

  // Determine file type
  const isPDF = filePath?.toLowerCase().endsWith('.pdf')

  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50'
  modal.id = 'imageViewerModal'
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
        <h3 class="text-lg font-semibold text-gray-900">View Document</h3>
        <button onclick="document.getElementById('imageViewerModal')?.remove()" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="p-6 flex items-center justify-center min-h-[400px]">
        <div class="text-center">
          <p class="text-gray-600 mb-4">Loading document...</p>
          <div class="inline-block animate-spin">
            <svg class="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  try {
    // If URL provided, try public URL first
    if (url) {
      if (isPDF) {
        await displayAuthenticatedPDF()
      } else {
        const img = new Image()
        img.onload = () => {
          const imgContainer = modal.querySelector('div[class*="min-h"]')
          if (imgContainer) {
            imgContainer.innerHTML = `<img src="${url}" alt="Document" class="max-w-full h-auto rounded-lg" />`
          }
        }
        img.onerror = async () => {
          console.warn('Public URL failed, attempting authenticated download...')
          // Fallback to authenticated download
          await displayAuthenticatedImage()
        }
        img.src = url
      }
    } else {
      // No public URL, use authenticated download directly
      if (isPDF) {
        await displayAuthenticatedPDF()
      } else {
        await displayAuthenticatedImage()
      }
    }

    async function displayAuthenticatedImage() {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(filePath)

        if (error) throw error

        const blobUrl = URL.createObjectURL(data)
        const imgContainer = modal.querySelector('div[class*="min-h"]')
        if (imgContainer) {
          imgContainer.innerHTML = `<img src="${blobUrl}" alt="Document" class="max-w-full h-auto rounded-lg" />`
        }
      } catch (err) {
        console.error('Failed to load image:', err)
        const imgContainer = modal.querySelector('div[class*="min-h"]')
        if (imgContainer) {
          imgContainer.innerHTML = `
            <div class="text-center">
              <svg class="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-red-600 font-medium">Failed to load image</p>
              <p class="text-gray-500 text-sm mt-2">The file may not be accessible.</p>
              <p class="text-gray-400 text-xs mt-4">Error: ${err.message}</p>
            </div>
          `
        }
      }
    }

    async function displayAuthenticatedPDF() {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(filePath)

        if (error) throw error

        const blobUrl = URL.createObjectURL(data)
        const pdfContainer = modal.querySelector('div[class*="min-h"]')
        if (pdfContainer) {
          // Try embed first, with iframe as fallback
          pdfContainer.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center">
              <div style="width: 100%; height: 600px; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                <embed 
                  src="${blobUrl}" 
                  type="application/pdf" 
                  style="width: 100%; height: 100%; border-radius: 0.5rem;"
                  onerror="this.parentElement.innerHTML='<iframe src=\\'${blobUrl}\\' style=\\'width: 100%; height: 100%; border: none; border-radius: 0.5rem;\\'></iframe>'"
                />
              </div>
              <p class="text-gray-600 text-sm mt-4">PDF Preview - Use download button to save file locally</p>
            </div>
          `
        }
      } catch (err) {
        console.error('Failed to load PDF:', err)
        const pdfContainer = modal.querySelector('div[class*="min-h"]')
        if (pdfContainer) {
          pdfContainer.innerHTML = `
            <div class="text-center">
              <svg class="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-red-600 font-medium">Failed to load PDF</p>
              <p class="text-gray-500 text-sm mt-2">The file may not be accessible.</p>
              <p class="text-gray-400 text-xs mt-4">Error: ${err.message}</p>
              <p class="text-gray-500 text-sm mt-4">Tip: Try downloading the PDF instead</p>
            </div>
          `
        }
      }
    }
  } catch (error) {
    console.error('Modal setup error:', error)
  }
}