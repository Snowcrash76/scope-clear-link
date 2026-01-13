-- Drop the incorrect policy
DROP POLICY IF EXISTS "Project owners can view their documents" ON storage.objects;

-- Create a correct policy that allows authenticated users to view documents in the project-documents bucket
-- The file path format is: user_id/timestamp-filename
CREATE POLICY "Authenticated users can view project documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'project-documents' 
  AND auth.role() = 'authenticated'
);