-- Add resolution_comment column to store approval/decline comments
ALTER TABLE public.change_requests 
ADD COLUMN resolution_comment text;