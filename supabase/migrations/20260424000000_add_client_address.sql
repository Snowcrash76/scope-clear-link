-- Add client address field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_address text;
