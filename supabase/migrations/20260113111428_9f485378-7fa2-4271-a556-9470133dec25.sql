-- Create storage bucket for scope images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scope-images', 'scope-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view images (public bucket)
CREATE POLICY "Scope images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'scope-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload scope images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'scope-images' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploaded images
CREATE POLICY "Authenticated users can delete scope images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'scope-images' AND auth.role() = 'authenticated');