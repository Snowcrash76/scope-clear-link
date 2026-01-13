-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true);

-- Create table to track uploaded documents
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Anyone can view project documents (for client access)
CREATE POLICY "Anyone can view project documents"
ON public.project_documents
FOR SELECT
USING (true);

-- Project owners can manage documents
CREATE POLICY "Project owners can manage documents"
ON public.project_documents
FOR ALL
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_documents.project_id
  AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_documents.project_id
  AND projects.user_id = auth.uid()
));

-- Storage policies for project-documents bucket
CREATE POLICY "Anyone can view project documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'project-documents');

CREATE POLICY "Authenticated users can upload project documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'project-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their project documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'project-documents' AND auth.role() = 'authenticated');