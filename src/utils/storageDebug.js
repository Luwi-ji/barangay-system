import { supabase } from '../lib/supabase'

export const checkStorageAccess = async (bucket, fileName) => {
  try {
    // Try to get the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(fileName)
    
    if (error) {
      console.error(`Error accessing ${bucket}/${fileName}:`, error)
      return { success: false, error: error.message }
    }
    
    // Try to get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)
    
    console.log(`✓ File accessible: ${publicUrl}`)
    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('Storage debug error:', error)
    return { success: false, error: error.message }
  }
}

export const listBucketContents = async (bucket) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list()
    
    if (error) {
      console.error(`Error listing ${bucket}:`, error)
      return []
    }
    
    return data
  } catch (error) {
    console.error('List error:', error)
    return []
  }
}
