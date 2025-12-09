-- Add id_image_back_url column to requests table for storing the back side of ID

-- Check if column already exists, if not add it
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS id_image_back_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.requests.id_image_back_url IS 'Storage path to the back side of the resident ID image';
