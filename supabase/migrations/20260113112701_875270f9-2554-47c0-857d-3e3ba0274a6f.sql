-- Make the project-documents bucket private instead of public
UPDATE storage.buckets
SET public = false
WHERE id = 'project-documents';

-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view project documents" ON storage.objects;

-- Create policy for project owners to view their documents
CREATE POLICY "Project owners can view their documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'project-documents' AND
  auth.uid() IN (
    SELECT user_id FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
  )
);

-- Also make scope-images bucket private for consistency
UPDATE storage.buckets
SET public = false
WHERE id = 'scope-images';

-- Drop the public access policy for scope-images
DROP POLICY IF EXISTS "Scope images are publicly accessible" ON storage.objects;

-- Create policy for anyone to view scope images (needed for client view via signed URLs)
CREATE POLICY "Anyone can view scope images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'scope-images');