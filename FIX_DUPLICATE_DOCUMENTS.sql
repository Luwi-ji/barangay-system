-- Fix Duplicate Document Types
-- Run this in Supabase SQL Editor

-- Step 1: Identify duplicates (show which ones are duplicated)
SELECT name, COUNT(*) as count
FROM public.document_types
GROUP BY name
HAVING COUNT(*) > 1;

-- Step 2: Find the duplicate IDs (keep the lowest ID, delete the higher ones)
WITH ranked_docs AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id ASC) as rn
  FROM public.document_types
)
SELECT id, name, rn
FROM ranked_docs
WHERE rn > 1
ORDER BY name, id;

-- Step 3: Update requests to point to the first (lowest) ID for each document type
WITH ranked_docs AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id ASC) as rn,
    FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY id ASC) as first_id
  FROM public.document_types
)
UPDATE public.requests
SET document_type_id = ranked_docs.first_id
FROM ranked_docs
WHERE requests.document_type_id = ranked_docs.id
  AND ranked_docs.rn > 1;

-- Step 4: Delete the duplicate rows (keeping only the one with lowest ID for each name)
DELETE FROM public.document_types
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.document_types
  GROUP BY name
);

-- Step 5: Verify - should show each document type only once
SELECT id, name, price
FROM public.document_types
ORDER BY name;
