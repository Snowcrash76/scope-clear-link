-- Add cost column to scope_items table
ALTER TABLE public.scope_items 
ADD COLUMN cost numeric DEFAULT 0;