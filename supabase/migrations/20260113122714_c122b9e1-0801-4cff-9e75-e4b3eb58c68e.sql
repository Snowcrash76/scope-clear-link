-- Add a new column for multiple images (JSON array of URLs)
ALTER TABLE public.scope_items ADD COLUMN image_urls text[] DEFAULT '{}';

-- Migrate existing image_url data to image_urls array
UPDATE public.scope_items 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '';

-- Note: Keeping image_url column for backwards compatibility, will be deprecated