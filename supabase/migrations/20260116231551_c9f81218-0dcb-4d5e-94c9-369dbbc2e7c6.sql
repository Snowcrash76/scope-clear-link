-- Add default_terms column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_terms TEXT DEFAULT 'Payment terms: 50% deposit required to commence work. Balance due on completion.';