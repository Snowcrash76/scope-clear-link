-- Add display_name column to project_documents table
ALTER TABLE project_documents
ADD COLUMN display_name text;

COMMENT ON COLUMN project_documents.display_name IS 'Custom display name shown to clients. Falls back to file_name if null.';